<?php

namespace Tests\Feature;

use App\Models\Restaurante;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VagoApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_cadastra_usuario_e_faz_login_com_token(): void
    {
        $this->postJson('/api/usuarios', [
            'name' => 'Ana', 'email' => 'ana@example.com', 'password' => 'senha1234',
        ])->assertCreated()->assertJsonMissing(['password']);

        $this->postJson('/api/login', ['email' => 'ana@example.com', 'password' => 'senha1234'])
            ->assertOk()->assertJsonStructure(['token', 'usuario']);
    }

    public function test_login_invalido_retorna_401(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);

        $this->postJson('/api/login', ['email' => 'ana@example.com', 'password' => 'errada'])
            ->assertUnauthorized();
    }

    public function test_senha_curta_e_rejeitada(): void
    {
        $this->postJson('/api/usuarios', [
            'name' => 'Ana', 'email' => 'ana@example.com', 'password' => '123',
        ])->assertUnprocessable();
    }

    public function test_cadastrar_restaurante_exige_autenticacao(): void
    {
        $this->postJson('/api/restaurantes', ['nome' => 'X', 'endereco' => 'Rua Y'])->assertUnauthorized();
    }

    public function test_cadastra_restaurante_autenticado_e_valida_categoria(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum');

        $this->postJson('/api/restaurantes', ['nome' => 'Cantina', 'endereco' => 'Rua A', 'categoria' => 'Italiana'])
            ->assertCreated();
        $this->postJson('/api/restaurantes', ['nome' => 'Outro', 'endereco' => 'Rua B', 'categoria' => 'Inventada'])
            ->assertUnprocessable();
    }

    public function test_cadastro_grava_coordenadas_do_endereco(): void
    {
        config(['services.geocode.enabled' => true, 'services.google.maps_key' => 'teste']);
        \Illuminate\Support\Facades\Http::fake([
            'maps.googleapis.com/*' => \Illuminate\Support\Facades\Http::response([
                'status' => 'OK',
                'results' => [['geometry' => ['location' => ['lat' => -23.5505, 'lng' => -46.6333]]]],
            ]),
        ]);
        $this->actingAs(User::factory()->create(), 'sanctum')
            ->postJson('/api/restaurantes', ['nome' => 'Cantina', 'endereco' => 'Praça da Sé, São Paulo', 'categoria' => 'Italiana'])
            ->assertCreated()
            ->assertJsonPath('latitude', -23.5505)
            ->assertJsonPath('longitude', -46.6333);
    }

    public function test_cadastro_aceita_coordenadas_manuais(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum')
            ->postJson('/api/restaurantes', [
                'nome' => 'Cantina', 'endereco' => 'Rua A', 'categoria' => 'Italiana',
                'latitude' => -22.9, 'longitude' => -43.2,
            ])->assertCreated()->assertJsonPath('latitude', -22.9)->assertJsonPath('longitude', -43.2);
    }

    public function test_listagem_filtra_por_busca_e_categoria(): void
    {
        Restaurante::factory()->create(['nome' => 'Cantina Bella', 'categoria' => 'Italiana']);
        Restaurante::factory()->create(['nome' => 'Sushi Zen', 'categoria' => 'Japonesa']);

        $this->getJson('/api/restaurantes?busca=Bella')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/restaurantes?categoria=Japonesa')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_listagem_filtra_por_distancia(): void
    {
        $perto = Restaurante::factory()->create(['nome' => 'Perto', 'latitude' => -23.5614, 'longitude' => -46.6559]);
        $medio = Restaurante::factory()->create(['nome' => 'Médio', 'latitude' => -23.5505, 'longitude' => -46.6333]);
        $longe = Restaurante::factory()->create(['nome' => 'Longe', 'latitude' => -22.9068, 'longitude' => -43.1729]);
        Restaurante::factory()->create(['nome' => 'Sem GPS', 'latitude' => null, 'longitude' => null]);

        $this->getJson('/api/restaurantes?lat=-23.5614')->assertUnprocessable();
        $this->getJson('/api/restaurantes?raio=2')->assertUnprocessable();

        $pertoDe = $this->getJson('/api/restaurantes?lat=-23.5614&lng=-46.6559&raio=2')->assertOk()->json('data');
        $this->assertSame(['Perto'], collect($pertoDe)->pluck('nome')->all());
        $this->assertEquals(0, $pertoDe[0]['distancia_km']);

        $ordem = collect($this->getJson('/api/restaurantes?lat=-23.5614&lng=-46.6559')->assertOk()->json('data'))->pluck('nome')->all();
        $this->assertSame(['Perto', 'Médio', 'Longe'], $ordem);
        $this->assertFalse(collect($ordem)->contains('Sem GPS'));
        $this->assertGreaterThan(300, collect($this->getJson('/api/restaurantes?lat=-23.5614&lng=-46.6559')->json('data'))->firstWhere('nome', 'Longe')['distancia_km']);
    }

    public function test_listagem_filtra_por_nota_minima(): void
    {
        $alto = Restaurante::factory()->create(['nome' => 'Alto']);
        $baixo = Restaurante::factory()->create(['nome' => 'Baixo']);
        $sem = Restaurante::factory()->create(['nome' => 'Sem Nota']);
        $alto->avaliacoes()->create(['user_id' => User::factory()->create()->id, 'nota' => 5]);
        $baixo->avaliacoes()->create(['user_id' => User::factory()->create()->id, 'nota' => 2]);

        $ids = collect($this->getJson('/api/restaurantes?nota_min=4')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($alto->id));
        $this->assertFalse($ids->contains($baixo->id));
        $this->assertFalse($ids->contains($sem->id));
    }

    public function test_nota_min_invalida_e_rejeitada(): void
    {
        $this->getJson('/api/restaurantes?nota_min=6')->assertUnprocessable();
    }

    public function test_rota_categorias_nao_e_engolida_pelo_show(): void
    {
        $this->getJson('/api/restaurantes/categorias')->assertOk()->assertJsonCount(count(Restaurante::CATEGORIAS));
    }

    public function test_avaliacao_grava_usuario_e_bloqueia_duplicada(): void
    {
        $user = User::factory()->create();
        $restaurante = Restaurante::factory()->create();
        $this->actingAs($user, 'sanctum');

        $this->postJson("/api/restaurantes/{$restaurante->id}/avaliacoes", ['nota' => 5, 'comentario' => 'Ótimo'])
            ->assertCreated();
        $this->assertDatabaseHas('avaliacoes', ['restaurante_id' => $restaurante->id, 'user_id' => $user->id]);

        $this->postJson("/api/restaurantes/{$restaurante->id}/avaliacoes", ['nota' => 1])
            ->assertUnprocessable();
    }

    public function test_avaliar_restaurante_inexistente_retorna_404(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum');

        $this->postJson('/api/restaurantes/999/avaliacoes', ['nota' => 4])->assertNotFound();
    }

    public function test_nota_fora_do_intervalo_e_rejeitada(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum');
        $restaurante = Restaurante::factory()->create();

        $this->postJson("/api/restaurantes/{$restaurante->id}/avaliacoes", ['nota' => 6])->assertUnprocessable();
    }

    public function test_ranking_ordena_por_media_e_deixa_sem_avaliacao_por_ultimo(): void
    {
        $melhor = Restaurante::factory()->create();
        $pior = Restaurante::factory()->create();
        $semNota = Restaurante::factory()->create();

        $melhor->avaliacoes()->create(['user_id' => User::factory()->create()->id, 'nota' => 5]);
        $pior->avaliacoes()->create(['user_id' => User::factory()->create()->id, 'nota' => 2]);

        $ids = collect($this->getJson('/api/restaurantes/ranking')->assertOk()->json())->pluck('id')->all();

        $this->assertSame([$melhor->id, $pior->id, $semNota->id], $ids);
    }

    public function test_perfil_publico_nao_expoe_email(): void
    {
        $outro = User::factory()->create();
        $this->actingAs(User::factory()->create(), 'sanctum');

        $this->getJson("/api/usuarios/{$outro->id}")->assertOk()->assertJsonMissing(['email' => $outro->email]);
    }

    public function test_perfil_proprio_exige_login(): void
    {
        $this->getJson('/api/perfil')->assertUnauthorized();
    }

    public function test_perfil_logado_traz_email_e_contagens(): void
    {
        $user = User::factory()->create(['email' => 'ana@example.com']);
        $restaurante = Restaurante::factory()->create(['user_id' => $user->id]);
        $user->favoritos()->attach($restaurante->id);
        $restaurante->avaliacoes()->create(['user_id' => $user->id, 'nota' => 5, 'comentario' => 'Ótimo']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/perfil')
            ->assertOk()
            ->assertJsonPath('email', 'ana@example.com')
            ->assertJsonPath('contagens.restaurantes', 1)
            ->assertJsonPath('contagens.favoritos', 1)
            ->assertJsonPath('contagens.avaliacoes', 1)
            ->assertJsonPath('contagens.reservas', 0)
            ->assertJsonPath('restaurantes.0.id', $restaurante->id);
    }

    public function test_atualiza_nome_e_telefone_do_perfil(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'telefone' => null]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/perfil', ['name' => 'Ana Clara', 'telefone' => '11999999999'])
            ->assertOk()
            ->assertJsonPath('name', 'Ana Clara')
            ->assertJsonPath('telefone', '11999999999');

        $this->assertDatabaseHas('users', [
            'id' => $user->id, 'name' => 'Ana Clara', 'telefone' => '11999999999',
        ]);
    }

    public function test_perfil_ignora_tentativa_de_trocar_email(): void
    {
        $user = User::factory()->create(['email' => 'ana@example.com', 'name' => 'Ana']);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/perfil', ['name' => 'Ana', 'email' => 'outra@example.com'])
            ->assertOk()
            ->assertJsonPath('email', 'ana@example.com');
    }
}
