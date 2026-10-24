<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Avaliacao extends Model
{
    protected $table = 'avaliacoes';

    protected $fillable = ['restaurante_id', 'user_id', 'nota', 'comentario', 'resposta', 'respondida_em'];

    protected function casts(): array
    {
        return [
            'respondida_em' => 'datetime',
        ];
    }

    public function restaurante()
    {
        return $this->belongsTo(Restaurante::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
