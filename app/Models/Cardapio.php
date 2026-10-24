<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cardapio extends Model
{
    public const CATEGORIAS = [
        'Entrada',
        'Prato principal',
        'Acompanhamento',
        'Sobremesa',
        'Bebida',
        'Outro',
    ];

    protected $fillable = ['restaurante_id', 'nome', 'categoria', 'descricao', 'preco', 'foto'];

    public function restaurante()
    {
        return $this->belongsTo(Restaurante::class);
    }

    public function avaliacoes()
    {
        return $this->hasMany(AvaliacaoPrato::class, 'cardapio_id');
    }
}
