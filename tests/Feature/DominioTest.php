<?php

namespace Tests\Feature;

use App\Models\Mesa;
use App\Models\Restaurante;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DominioTest extends TestCase
{
    use RefreshDatabase;

    private function restauranteComDono(): array
    {
        $dono = User::factory()->restaurante()->create();

        return [$dono, Restaurante::factory()->create(['user_id' => $dono->id])];
    }

    public function test_so_o_dono_gerencia_cardapio_mesas_e_promocoes(): void
    {
        [$dono, $r] = $this->restauranteComDono();

        $this->actingAs(User::factory()->create(), 'sanctum');
        $this->postJson("/api/restaurantes/{$r->id}/cardapio", ['nome' => 'Pizza', 'preco' => 40])->assertForbidden();

        $this->actingAs($dono, 'sanctum');
        $this->postJson("/api/restaurantes/{$r->id}/cardapio", [
            'nome' => 'Pizza', 'preco' => 40, 'categoria' => 'Prato principal', 'descricao' => 'Mussarela',
        ])->assertCreated()->assertJsonPath('categoria', 'Prato principal')->assertJsonPath('descricao', 'Mussarela');
        $this->postJson("/api/restaurantes/{$r->id}/cardapio", ['nome' => 'Suco', 'preco' => 8, 'categoria' => 'Inventada'])->assertUnprocessable();
        $this->postJson("/api/restaurantes/{$r->id}/mesas", ['numero' => 1, 'cadeiras' => 4])
            ->assertCreated()
            ->assertJsonPath('pos_x', 0)
            ->assertJsonPath('pos_y', 0);
        $this->postJson("/api/restaurantes/{$r->id}/mesas", ['numero' => 1, 'cadeiras' => 2])->assertUnprocessable();
        $this->postJson("/api/restaurantes/{$r->id}/promocoes", ['titulo' => '2 por 1'])->assertCreated();
        $this->getJson("/api/restaurantes/{$r->id}/cardapio")->assertOk()->assertJsonCount(1);
    }

    public function test_reserva_valida_lotacao_e_conflito_de_horario(): void
    {
        [, $r] = $this->restauranteComDono();
        $mesa = Mesa::create(['restaurante_id' => $r->id, 'numero' => 1, 'cadeiras' => 4]);
        $this->actingAs(User::factory()->create(), 'sanctum');
        $data = now()->addDay()->toDateString();
        $base = ['mesa_id' => $mesa->id, 'data' => $data, 'horario' => '20:00', 'num_pessoas' => 2];

        $this->postJson("/api/restaurantes/{$r->id}/reservas", $base)->assertCreated();
        $this->postJson("/api/restaurantes/{$r->id}/reservas", ['horario' => '21:00'] + $base)->assertUnprocessable();
        $this->postJson("/api/restaurantes/{$r->id}/reservas", ['horario' => '23:00', 'num_pessoas' => 9] + $base)->assertUnprocessable();
        $this->postJson("/api/restaurantes/{$r->id}/reservas", ['horario' => '23:00'] + $base)->assertCreated();
    }

    public function test_dono_confirma_e_cliente_cancela_reserva(): void
    {
        [$dono, $r] = $this->restauranteComDono();
        $mesa = Mesa::create(['restaurante_id' => $r->id, 'numero' => 1, 'cadeiras' => 4]);
        $cliente = User::factory()->create();
        $reserva = $mesa->reservas()->create([
            'user_id' => $cliente->id, 'data' => now()->addDay()->toDateString(), 'horario' => '20:00', 'num_pessoas' => 2,
        ]);

        $this->actingAs($cliente, 'sanctum')->patchJson("/api/reservas/{$reserva->id}", ['status_confirmacao' => 'confirmada'])->assertForbidden();
        $this->actingAs($dono, 'sanctum')->patchJson("/api/reservas/{$reserva->id}", ['status_confirmacao' => 'confirmada'])->assertOk();
        $this->actingAs($cliente, 'sanctum')->patchJson("/api/reservas/{$reserva->id}", ['status_confirmacao' => 'cancelada'])->assertOk();
    }

    public function test_fila_reordena_ao_sair_e_ao_chamar(): void
    {
        [$dono, $r] = $this->restauranteComDono();
        Mesa::create(['restaurante_id' => $r->id, 'numero' => 1, 'cadeiras' => 4, 'status' => 'ocupada']);
        [$a, $b, $c] = User::factory()->count(3)->create();

        foreach ([$a, $b, $c] as $u) {
            $this->actingAs($u, 'sanctum')->postJson("/api/restaurantes/{$r->id}/fila")->assertCreated();
        }
        $this->actingAs($a, 'sanctum')->postJson("/api/restaurantes/{$r->id}/fila")->assertUnprocessable();

        $this->actingAs($a, 'sanctum')->deleteJson("/api/restaurantes/{$r->id}/fila")->assertOk();
        $this->actingAs($dono, 'sanctum')->postJson("/api/restaurantes/{$r->id}/fila/chamar")->assertOk()->assertJsonPath('user_id', $b->id);

        $this->assertSame(1, $r->fila()->where('user_id', $c->id)->value('posicao'));
    }

    public function test_favoritar_alterna(): void
    {
        [, $r] = $this->restauranteComDono();
        $this->actingAs(User::factory()->create(), 'sanctum');

        $this->postJson("/api/restaurantes/{$r->id}/favorito")->assertJson(['favorito' => true]);
        $this->getJson('/api/favoritos')->assertJsonCount(1);
        $this->postJson("/api/restaurantes/{$r->id}/favorito")->assertJson(['favorito' => false]);
    }

    public function test_so_o_dono_responde_avaliacao(): void
    {
        [$dono, $r] = $this->restauranteComDono();
        $cliente = User::factory()->create();
        $avaliacao = $r->avaliacoes()->create([
            'user_id' => $cliente->id, 'nota' => 4, 'comentario' => 'Bom',
        ]);

        $this->putJson("/api/avaliacoes/{$avaliacao->id}/resposta", ['resposta' => 'Obrigado!'])->assertUnauthorized();
        $this->actingAs($cliente, 'sanctum')
            ->putJson("/api/avaliacoes/{$avaliacao->id}/resposta", ['resposta' => 'Eu mesmo respondo'])->assertForbidden();

        $this->actingAs($dono, 'sanctum')
            ->putJson("/api/avaliacoes/{$avaliacao->id}/resposta", ['resposta' => 'Obrigado pela visita!'])
            ->assertOk()
            ->assertJsonPath('resposta', 'Obrigado pela visita!');

        $this->getJson("/api/restaurantes/{$r->id}/avaliacoes")
            ->assertOk()
            ->assertJsonPath('data.0.resposta', 'Obrigado pela visita!');
    }

    public function test_avaliacao_e_ranking_de_pratos(): void
    {
        [, $r] = $this->restauranteComDono();
        $melhor = $r->cardapios()->create(['nome' => 'Lasanha', 'preco' => 40, 'categoria' => 'Prato principal']);
        $pior = $r->cardapios()->create(['nome' => 'Suco', 'preco' => 8, 'categoria' => 'Bebida']);
        $cliente = User::factory()->create();

        $this->postJson("/api/cardapios/{$melhor->id}/avaliacoes", ['nota' => 5])->assertUnauthorized();
        $this->actingAs($cliente, 'sanctum')
            ->postJson("/api/cardapios/{$melhor->id}/avaliacoes", ['nota' => 5])
            ->assertCreated();
        $this->postJson("/api/cardapios/{$melhor->id}/avaliacoes", ['nota' => 1])->assertUnprocessable();
        $this->postJson("/api/cardapios/{$pior->id}/avaliacoes", ['nota' => 2])->assertCreated();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/restaurantes/{$r->id}/cardapio")
            ->assertOk()
            ->assertJsonPath('0.minha_nota', null);

        $ids = collect($this->getJson('/api/pratos/ranking')->assertOk()->json())->pluck('id')->all();
        $this->assertSame([$melhor->id, $pior->id], $ids);
    }

    public function test_so_o_dono_responde_avaliacao_de_prato(): void
    {
        [$dono, $r] = $this->restauranteComDono();
        $prato = $r->cardapios()->create(['nome' => 'Lasanha', 'preco' => 40, 'categoria' => 'Prato principal']);
        $cliente = User::factory()->create();
        $avaliacao = $prato->avaliacoes()->create([
            'user_id' => $cliente->id, 'nota' => 4, 'comentario' => 'Boa',
        ]);

        $this->putJson("/api/avaliacoes-pratos/{$avaliacao->id}/resposta", ['resposta' => 'Valeu!'])->assertUnauthorized();
        $this->actingAs($cliente, 'sanctum')
            ->putJson("/api/avaliacoes-pratos/{$avaliacao->id}/resposta", ['resposta' => 'Eu mesmo'])->assertForbidden();
        $this->actingAs($dono, 'sanctum')
            ->putJson("/api/avaliacoes-pratos/{$avaliacao->id}/resposta", ['resposta' => 'Obrigado!'])
            ->assertOk()
            ->assertJsonPath('resposta', 'Obrigado!');

        $this->getJson("/api/cardapios/{$prato->id}/avaliacoes")
            ->assertOk()
            ->assertJsonPath('0.resposta', 'Obrigado!')
            ->assertJsonPath('0.comentario', 'Boa');
    }

    public function test_dono_posiciona_e_move_mesa_no_mapa(): void
    {
        [$dono, $r] = $this->restauranteComDono();
        $this->actingAs($dono, 'sanctum');

        $a = $this->postJson("/api/restaurantes/{$r->id}/mesas", ['numero' => 1, 'cadeiras' => 4, 'pos_x' => 2, 'pos_y' => 1])
            ->assertCreated()->json();
        $this->postJson("/api/restaurantes/{$r->id}/mesas", ['numero' => 2, 'cadeiras' => 2, 'pos_x' => 2, 'pos_y' => 1])
            ->assertUnprocessable();
        $b = $this->postJson("/api/restaurantes/{$r->id}/mesas", ['numero' => 2, 'cadeiras' => 2])
            ->assertCreated()->assertJsonPath('pos_x', 0)->assertJsonPath('pos_y', 0)->json();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->patchJson("/api/mesas/{$a['id']}", ['pos_x' => 0, 'pos_y' => 2])->assertForbidden();

        $this->actingAs($dono, 'sanctum')
            ->patchJson("/api/mesas/{$a['id']}", ['pos_x' => 5, 'pos_y' => 3])
            ->assertOk()
            ->assertJsonPath('pos_x', 5)
            ->assertJsonPath('pos_y', 3);
        $this->patchJson("/api/mesas/{$b['id']}", ['pos_x' => 5, 'pos_y' => 3])->assertUnprocessable();
        $this->getJson("/api/restaurantes/{$r->id}/mesas")->assertOk()->assertJsonCount(2);
    }

    public function test_dias_de_pico_saem_das_reservas_ativas(): void
    {
        [, $r] = $this->restauranteComDono();
        $mesa = Mesa::create(['restaurante_id' => $r->id, 'numero' => 1, 'cadeiras' => 4]);
        $user = User::factory()->create();
        $base = ['user_id' => $user->id, 'mesa_id' => $mesa->id, 'horario' => '20:00', 'num_pessoas' => 2];

        $this->getJson("/api/restaurantes/{$r->id}")
            ->assertOk()
            ->assertJsonPath('picos.picos', [])
            ->assertJsonPath('picos.total', 0);

        foreach (['2026-10-23', '2026-10-30', '2026-11-06'] as $sexta) {
            $mesa->reservas()->create($base + ['data' => $sexta, 'status_confirmacao' => 'confirmada']);
        }
        $mesa->reservas()->create($base + ['data' => '2026-10-24', 'status_confirmacao' => 'confirmada']);
        $mesa->reservas()->create($base + ['data' => '2026-10-20', 'status_confirmacao' => 'cancelada']);

        $this->getJson("/api/restaurantes/{$r->id}")
            ->assertOk()
            ->assertJsonPath('picos.total', 4)
            ->assertJsonPath('picos.picos', ['sexta']);
    }

    public function test_cliente_nao_cadastra_restaurante_e_conta_de_salao_nasce_completa(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum')
            ->postJson('/api/restaurantes', ['nome' => 'Cantina', 'endereco' => 'Rua A', 'categoria' => 'Italiana'])
            ->assertForbidden();

        $this->postJson('/api/cadastro/restaurante', [
            'name' => 'João',
            'email' => 'joao@salao.com',
            'password' => 'senha1234',
            'telefone' => '(31) 99999-9999',
            'nome' => 'Salão do João',
            'endereco' => 'Rua A, 10',
            'tipo_culinaria' => 'Brasileira',
            'capacidade_mesas' => 1,
            'tempo_tolerancia' => '00:20:00',
        ])->assertCreated()
            ->assertJsonPath('usuario.tipo', 'restaurante')
            ->assertJsonPath('restaurante.nome', 'Salão do João')
            ->assertJsonPath('restaurante.categoria', 'Brasileira')
            ->assertJsonPath('restaurante.capacidade_mesas', 1);

        $dono = User::where('email', 'joao@salao.com')->first();
        $salao = $dono->restaurantes()->first();

        $this->actingAs($dono, 'sanctum')
            ->postJson("/api/restaurantes/{$salao->id}/mesas", ['numero' => 1, 'cadeiras' => 4])
            ->assertCreated();
        $this->postJson("/api/restaurantes/{$salao->id}/mesas", ['numero' => 2, 'cadeiras' => 2])
            ->assertUnprocessable();

        $mesa = $salao->mesas()->first();
        $this->patchJson("/api/mesas/{$mesa->id}", ['cadeiras' => 6])
            ->assertOk()
            ->assertJsonPath('cadeiras', 6);
    }

    public function test_fila_so_abre_com_o_salao_cheio(): void
    {
        [, $r] = $this->restauranteComDono();
        $mesa = Mesa::create(['restaurante_id' => $r->id, 'numero' => 1, 'cadeiras' => 4, 'status' => 'livre']);
        $cliente = User::factory()->create();

        $this->actingAs($cliente, 'sanctum')
            ->postJson("/api/restaurantes/{$r->id}/fila")
            ->assertUnprocessable();

        $mesa->update(['status' => 'ocupada']);

        $this->postJson("/api/restaurantes/{$r->id}/fila")->assertCreated();
        $this->getJson('/api/minha-fila')->assertOk()->assertJsonCount(1)->assertJsonPath('0.restaurante_id', $r->id);
    }

    public function test_promocoes_avaliacoes_reservas_e_fila_nos_dois_contextos(): void
    {
        [$dono, $r] = $this->restauranteComDono();
        $mesa = Mesa::create(['restaurante_id' => $r->id, 'numero' => 1, 'cadeiras' => 4, 'status' => 'ocupada']);
        $cliente = User::factory()->create();
        $prato = $r->cardapios()->create(['nome' => 'Risoto', 'preco' => 48, 'categoria' => 'Prato principal']);

        $this->actingAs($dono, 'sanctum')
            ->postJson("/api/restaurantes/{$r->id}/promocoes", [
                'titulo' => 'Happy hour',
                'banner_url' => 'https://exemplo.com/banner.jpg',
            ])->assertCreated();

        $this->getJson('/api/promocoes')->assertOk()->assertJsonPath('0.titulo', 'Happy hour');

        $this->actingAs($cliente, 'sanctum')
            ->postJson("/api/restaurantes/{$r->id}/avaliacoes", ['nota' => 5, 'comentario' => 'Voltaria'])
            ->assertCreated();
        $this->postJson("/api/cardapios/{$prato->id}/avaliacoes", ['nota' => 4, 'comentario' => 'Bem servido'])
            ->assertCreated();
        $this->postJson("/api/restaurantes/{$r->id}/reservas", [
            'mesa_id' => $mesa->id,
            'data' => now()->addDay()->toDateString(),
            'horario' => '21:00',
            'num_pessoas' => 2,
        ])->assertCreated();
        $this->postJson("/api/restaurantes/{$r->id}/fila")->assertCreated();

        $this->getJson('/api/minhas-avaliacoes')
            ->assertOk()
            ->assertJsonPath('contexto', 'cliente')
            ->assertJsonCount(1, 'restaurantes')
            ->assertJsonCount(1, 'pratos');
        $this->getJson('/api/minhas-reservas')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/reservas-recebidas')->assertForbidden();

        $this->actingAs($dono, 'sanctum')
            ->postJson("/api/restaurantes/{$r->id}/avaliacoes", ['nota' => 5])
            ->assertForbidden();
        $this->getJson('/api/minhas-avaliacoes')
            ->assertOk()
            ->assertJsonPath('contexto', 'restaurante')
            ->assertJsonCount(1, 'restaurantes')
            ->assertJsonCount(1, 'pratos');
        $this->getJson('/api/reservas-recebidas')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/fila-recebida')->assertOk()->assertJsonCount(1)->assertJsonPath('0.user_id', $cliente->id);
    }
}
