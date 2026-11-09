<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Restaurante extends Model
{
    use HasFactory;

    /** Fonte única da lista de categorias (o front consome /restaurantes/categorias). */
    public const CATEGORIAS = [
        'Italiana',
        'Japonesa',
        'Hamburgueria',
        'Pizzaria',
        'Brasileira',
        'Mexicana',
        'Árabe',
        'Doces & Sobremesas',
        'Geral',
    ];

    protected $fillable = ['nome', 'endereco', 'telefone', 'descricao', 'categoria', 'user_id', 'capacidade_mesas', 'tempo_tolerancia', 'latitude', 'longitude'];

    protected $appends = ['tipo_culinaria'];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function avaliacoes()
    {
        return $this->hasMany(Avaliacao::class);
    }

    public function cardapios()
    {
        return $this->hasMany(Cardapio::class);
    }

    public function mesas()
    {
        return $this->hasMany(Mesa::class);
    }

    public function promocoes()
    {
        return $this->hasMany(Promocao::class);
    }

    public function fila()
    {
        return $this->hasMany(FilaEspera::class);
    }

    public function getTipoCulinariaAttribute(): ?string
    {
        return $this->attributes['categoria'] ?? null;
    }

    /** Cheio quando já existe mesa e nenhuma está livre. */
    public function estaCheio(): bool
    {
        if (! $this->mesas()->exists()) {
            return false;
        }

        return ! $this->mesas()->where('status', 'livre')->exists();
    }

    /** Só o dono (quem cadastrou) gerencia cardápio, mesas, promoções, fila e reservas. */
    public function autorizarDono(User $user): void
    {
        abort_unless($this->user_id === $user->id, 403, 'Apenas o dono do restaurante pode fazer isso.');
    }
}
