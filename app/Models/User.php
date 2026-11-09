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

    public const TIPO_CLIENTE = 'cliente';

    public const TIPO_RESTAURANTE = 'restaurante';

    protected $fillable = ['name', 'email', 'password', 'cpf', 'telefone', 'tipo'];

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

    public function ehRestaurante(): bool
    {
        return $this->tipo === self::TIPO_RESTAURANTE;
    }

    /** Reservar, avaliar, favoritar e entrar na fila são ações de cliente. */
    public function autorizarCliente(): void
    {
        abort_unless(
            ! $this->ehRestaurante(),
            403,
            'Esta ação é feita com uma conta de cliente.'
        );
    }
}
