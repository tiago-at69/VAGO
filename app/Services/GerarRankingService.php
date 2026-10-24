<?php

namespace App\Services;

use App\Repositories\RestauranteRepository;

class GerarRankingService
{
    public function __construct(private RestauranteRepository $repository) {}

    public function executar(int $limite = 10)
    {
        return $this->repository->gerarRankingMelhores($limite);
    }
}
