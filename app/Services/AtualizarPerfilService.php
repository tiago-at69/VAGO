<?php

namespace App\Services;

use App\Models\User;

class AtualizarPerfilService
{
    public function __construct(private ObterPerfilService $obter) {}

    public function executar(User $user, array $dados): array
    {
        $user->update([
            'name' => $dados['name'],
            'telefone' => $dados['telefone'] ?? null,
        ]);

        return $this->obter->executar($user->fresh());
    }
}
