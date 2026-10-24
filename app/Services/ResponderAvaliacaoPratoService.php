<?php

namespace App\Services;

use App\Models\AvaliacaoPrato;

class ResponderAvaliacaoPratoService
{
    public function executar(AvaliacaoPrato $avaliacao, string $resposta): AvaliacaoPrato
    {
        $avaliacao->update([
            'resposta' => $resposta,
            'respondida_em' => now(),
        ]);

        return $avaliacao->fresh(['user:id,name']);
    }
}
