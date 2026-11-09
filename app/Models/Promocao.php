<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promocao extends Model
{
    protected $table = 'promocoes';

    protected $fillable = ['restaurante_id', 'titulo', 'banner_url'];

    public function restaurante()
    {
        return $this->belongsTo(Restaurante::class);
    }
}
