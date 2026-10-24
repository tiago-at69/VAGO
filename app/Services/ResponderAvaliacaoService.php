<?php

namespace App\Services;

use App\Models\Avaliacao;

class ResponderAvaliacaoService
{
    public function executar(Avaliacao $avaliacao, string $resposta): Avaliacao
    {
        $avaliacao->update([
            'resposta' => $resposta,
            'respondida_em' => now(),
        ]);

        return $avaliacao->fresh(['user:id,name']);
    }
}
