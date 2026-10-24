<?php

namespace App\Repositories;

use App\Models\Avaliacao;

class AvaliacaoRepository
{
    public function buscarPorRestaurante(int $restauranteId, int $porPagina = 20)
    {
        return Avaliacao::where('restaurante_id', $restauranteId)
            ->with('user:id,name')
            ->latest()
            ->paginate($porPagina);
    }

    public function jaAvaliou(int $userId, int $restauranteId): bool
    {
        return Avaliacao::where('user_id', $userId)
            ->where('restaurante_id', $restauranteId)
            ->exists();
    }
}
