<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reserva extends Model
{
    protected $fillable = ['user_id', 'mesa_id', 'data', 'horario', 'num_pessoas', 'status_confirmacao'];

    public function mesa() { return $this->belongsTo(Mesa::class); }
    public function user() { return $this->belongsTo(User::class); }
}
