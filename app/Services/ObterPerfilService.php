<?php

namespace App\Services;

use App\Models\User;

class ObterPerfilService
{
    public function executar(User $user): array
    {
        $user->loadCount(['restaurantes', 'favoritos', 'avaliacoes', 'reservas']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'cpf' => $user->cpf,
            'telefone' => $user->telefone,
            'created_at' => $user->created_at,
            'contagens' => [
                'restaurantes' => $user->restaurantes_count,
                'favoritos' => $user->favoritos_count,
                'avaliacoes' => $user->avaliacoes_count,
                'reservas' => $user->reservas_count,
            ],
            'restaurantes' => $user->restaurantes()
                ->withAvg('avaliacoes', 'nota')
                ->withCount('avaliacoes')
                ->orderBy('nome')
                ->get(['id', 'nome', 'categoria', 'endereco']),
            'avaliacoes' => $user->avaliacoes()
                ->with('restaurante:id,nome')
                ->latest()
                ->take(10)
                ->get(['id', 'restaurante_id', 'nota', 'comentario', 'created_at']),
        ];
    }
}
