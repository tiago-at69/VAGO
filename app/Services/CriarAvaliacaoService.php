<?php

namespace App\Services;

use App\Models\Avaliacao;
use App\Models\Restaurante;
use App\Repositories\AvaliacaoRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CriarAvaliacaoService
{
    public function __construct(private AvaliacaoRepository $avaliacoes) {}

    public function executar(Restaurante $restaurante, int $userId, array $dados): Avaliacao
    {
        if ($this->avaliacoes->jaAvaliou($userId, $restaurante->id)) {
            throw ValidationException::withMessages([
                'restaurante' => 'Você já avaliou este restaurante.',
            ]);
        }

        return DB::transaction(fn () => Avaliacao::create([
            'restaurante_id' => $restaurante->id,
            'user_id' => $userId,
            'nota' => $dados['nota'],
            'comentario' => $dados['comentario'] ?? null,
        ]));
    }
}
