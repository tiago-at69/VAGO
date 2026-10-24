<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AvaliacaoPrato extends Model
{
    protected $table = 'avaliacoes_pratos';

    protected $fillable = ['cardapio_id', 'user_id', 'nota', 'comentario', 'resposta', 'respondida_em'];

    protected function casts(): array
    {
        return [
            'respondida_em' => 'datetime',
        ];
    }

    public function prato()
    {
        return $this->belongsTo(Cardapio::class, 'cardapio_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
