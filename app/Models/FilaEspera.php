<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FilaEspera extends Model
{
    protected $table = 'fila_espera';

    protected $fillable = ['restaurante_id', 'user_id', 'posicao', 'hora_entrada'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function restaurante()
    {
        return $this->belongsTo(Restaurante::class);
    }
}
