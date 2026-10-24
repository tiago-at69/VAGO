<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AutenticarUsuarioService
{
    /** Retorna o usuário e um token, ou null se as credenciais forem inválidas. */
    public function executar(string $email, string $password): ?array
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        return [
            'usuario' => $user,
            'token' => $user->createToken('app')->plainTextToken,
        ];
    }
}
