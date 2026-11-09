<?php

namespace App\Services;

use App\Models\Restaurante;

class CadastrarRestauranteService
{
    public function __construct(private GeocodificarEnderecoService $geo) {}

    public function executar(array $dados, int $userId): Restaurante
    {
        $coords = isset($dados['latitude'], $dados['longitude'])
            ? ['latitude' => $dados['latitude'], 'longitude' => $dados['longitude']]
            : ($this->geo->executar($dados['endereco']) ?? []);

        return Restaurante::create([
            'nome' => $dados['nome'],
            'endereco' => $dados['endereco'],
            'telefone' => $dados['telefone'] ?? null,
            'descricao' => $dados['descricao'] ?? null,
            'categoria' => $dados['categoria'] ?? 'Geral',
            'user_id' => $userId,
            'capacidade_mesas' => $dados['capacidade_mesas'] ?? 0,
            'tempo_tolerancia' => $this->tolerancia($dados['tempo_tolerancia'] ?? null),
            'latitude' => $coords['latitude'] ?? null,
            'longitude' => $coords['longitude'] ?? null,
        ]);
    }

    /** Aceita HH:MM ou HH:MM:SS e grava sempre com segundos. */
    private function tolerancia(?string $valor): string
    {
        $valor = substr($valor ?: '00:15', 0, 5);

        return $valor.':00';
    }
}
