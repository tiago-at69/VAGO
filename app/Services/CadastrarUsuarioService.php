<?php

namespace App\Services;

use App\Models\User;

class CadastrarUsuarioService
{
    /** O hash da senha é feito pelo cast "hashed" do model User. */
    public function executar(array $dados): User
    {
        return User::create($dados);
    }
}
