<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'cpf', 'telefone'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function avaliacoes()
    {
        return $this->hasMany(Avaliacao::class);
    }

    public function avaliacoesPratos()
    {
        return $this->hasMany(AvaliacaoPrato::class);
    }

    public function favoritos()
    {
        return $this->belongsToMany(Restaurante::class, 'favoritos');
    }

    public function restaurantes()
    {
        return $this->hasMany(Restaurante::class);
    }

    public function reservas()
    {
        return $this->hasMany(Reserva::class);
    }
}
