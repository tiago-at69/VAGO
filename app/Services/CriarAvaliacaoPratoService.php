<?php

namespace App\Services;

use App\Models\AvaliacaoPrato;
use App\Models\Cardapio;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CriarAvaliacaoPratoService
{
    public function executar(Cardapio $prato, int $userId, array $dados): AvaliacaoPrato
    {
        if (AvaliacaoPrato::where('user_id', $userId)->where('cardapio_id', $prato->id)->exists()) {
            throw ValidationException::withMessages([
                'prato' => 'Você já avaliou este prato.',
            ]);
        }

        return DB::transaction(fn () => AvaliacaoPrato::create([
            'cardapio_id' => $prato->id,
            'user_id' => $userId,
            'nota' => $dados['nota'],
            'comentario' => $dados['comentario'] ?? null,
        ]));
    }
}
