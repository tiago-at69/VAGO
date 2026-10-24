<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mesa extends Model
{
    public const MAPA_COLS = 6;

    public const MAPA_LINHAS = 5;

    public const MAPA_MAX = 11;

    protected $fillable = ['restaurante_id', 'numero', 'cadeiras', 'status', 'pos_x', 'pos_y'];

    public function restaurante() { return $this->belongsTo(Restaurante::class); }
    public function reservas() { return $this->hasMany(Reserva::class); }
}
