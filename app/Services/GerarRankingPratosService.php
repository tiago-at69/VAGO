<?php

namespace App\Services;

use App\Models\Cardapio;

class GerarRankingPratosService
{
    public function executar(int $limite = 10)
    {
        return Cardapio::query()
            ->whereHas('avaliacoes')
            ->withAvg('avaliacoes', 'nota')
            ->withCount('avaliacoes')
            ->with('restaurante:id,nome')
            ->orderByRaw('avaliacoes_avg_nota IS NULL')
            ->orderByDesc('avaliacoes_avg_nota')
            ->orderByDesc('avaliacoes_count')
            ->take($limite)
            ->get();
    }
}
