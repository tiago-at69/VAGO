<?php

namespace App\Repositories;

use App\Models\Restaurante;
use App\Services\CalcularDistanciaService;
use Illuminate\Pagination\LengthAwarePaginator;

class RestauranteRepository
{
    public function __construct(private CalcularDistanciaService $distancia) {}

    public function listar(?string $busca = null, ?string $categoria = null, ?int $notaMin = null, int $porPagina = 20, ?array $geo = null)
    {
        $query = Restaurante::query()
            ->withAvg('avaliacoes', 'nota')
            ->withCount([
                'avaliacoes',
                'mesas',
                'mesas as mesas_livres_count' => fn ($q) => $q->where('status', 'livre'),
            ])
            ->when($busca, fn ($q) => $q->where('nome', 'like', "%{$busca}%"))
            ->when($categoria, fn ($q) => $q->where('categoria', $categoria))
            ->when($notaMin, fn ($q) => $q->whereRaw(
                '(select avg(avaliacoes.nota) from avaliacoes where avaliacoes.restaurante_id = restaurantes.id) >= ?',
                [$notaMin]
            ));

        if ($geo) {
            return $this->paginarPorDistancia($query, $geo, $porPagina);
        }

        return $query->orderBy('nome')->paginate($porPagina);
    }

    private function paginarPorDistancia($query, array $geo, int $porPagina): LengthAwarePaginator
    {
        $lat = (float) $geo['lat'];
        $lng = (float) $geo['lng'];
        $raio = isset($geo['raio']) ? (float) $geo['raio'] : null;

        $lista = $query->whereNotNull('latitude')->whereNotNull('longitude')->orderBy('nome')->get()
            ->map(function (Restaurante $r) use ($lat, $lng) {
                $r->setAttribute('distancia_km', $this->distancia->km($lat, $lng, (float) $r->latitude, (float) $r->longitude));

                return $r;
            })
            ->when($raio !== null, fn ($c) => $c->filter(fn (Restaurante $r) => $r->distancia_km <= $raio))
            ->sortBy('distancia_km')
            ->values();

        $pagina = max(1, (int) request('page', 1));
        $slice = $lista->forPage($pagina, $porPagina)->values();

        return new LengthAwarePaginator($slice, $lista->count(), $porPagina, $pagina, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]);
    }

    public function buscarPorNome(string $nome)
    {
        return $this->listar($nome);
    }

    public function buscarPorCategoria(string $categoria)
    {
        return $this->listar(null, $categoria);
    }

    public function categoriasEmUso()
    {
        return Restaurante::whereIn('categoria', Restaurante::CATEGORIAS)
            ->distinct()
            ->orderBy('categoria')
            ->pluck('categoria');
    }

    public function gerarRankingMelhores(int $limite = 10)
    {
        return Restaurante::query()
            ->withAvg('avaliacoes', 'nota')
            ->withCount('avaliacoes')
            ->orderByRaw('avaliacoes_avg_nota IS NULL') // sem avaliações por último
            ->orderByDesc('avaliacoes_avg_nota')
            ->orderByDesc('avaliacoes_count')
            ->take($limite)
            ->get();
    }
}
