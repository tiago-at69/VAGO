<?php

namespace App\Services;

use App\Repositories\RestauranteRepository;

class ListarRestaurantesService
{
    public function __construct(private RestauranteRepository $repository) {}

    public function executar(?string $busca = null, ?string $categoria = null, ?int $notaMin = null, ?array $geo = null)
    {
        return $this->repository->listar($busca, $categoria, $notaMin, 20, $geo);
    }
}
