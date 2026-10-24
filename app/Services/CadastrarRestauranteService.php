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
            'tempo_tolerancia' => ($dados['tempo_tolerancia'] ?? '00:15') . ':00',
            'latitude' => $coords['latitude'] ?? null,
            'longitude' => $coords['longitude'] ?? null,
        ]);
    }
}
