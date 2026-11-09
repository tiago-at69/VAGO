<?php

namespace App\Http\Controllers;

use App\Models\Restaurante;
use App\Repositories\RestauranteRepository;
use App\Services\CadastrarRestauranteService;
use App\Services\CalcularDiasPicoService;
use App\Services\GerarRankingService;
use App\Services\ListarRestaurantesService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RestauranteController extends Controller
{
    // Funcionalidade 4: Cadastrar
    public function store(Request $request, CadastrarRestauranteService $service)
    {
        abort_unless(
            $request->user()->ehRestaurante(),
            403,
            'Só uma conta de restaurante pode cadastrar um salão.'
        );

        if ($request->filled('tipo_culinaria') && ! $request->filled('categoria')) {
            $request->merge(['categoria' => $request->input('tipo_culinaria')]);
        }

        $dados = $request->validate([
            'nome' => 'required|string|max:255',
            'endereco' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:30',
            'descricao' => 'nullable|string|max:2000',
            'categoria' => ['nullable', Rule::in(Restaurante::CATEGORIAS)],
            'capacidade_mesas' => 'nullable|integer|min:0',
            'tempo_tolerancia' => ['nullable', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'latitude' => 'nullable|required_with:longitude|numeric|between:-90,90',
            'longitude' => 'nullable|required_with:latitude|numeric|between:-180,180',
        ]);

        return response()->json($service->executar($dados, $request->user()->id), 201);
    }

    // Listar com busca (?busca=), categoria (?categoria=) e nota mínima (?nota_min=1-5)
    public function index(Request $request, ListarRestaurantesService $service)
    {
        $dados = $request->validate([
            'busca' => 'nullable|string',
            'categoria' => 'nullable|string',
            'nota_min' => 'nullable|integer|min:1|max:5',
            'lat' => 'nullable|required_with:lng,raio|numeric|between:-90,90',
            'lng' => 'nullable|required_with:lat|numeric|between:-180,180',
            'raio' => 'nullable|numeric|min:0.1|max:500',
            'page' => 'nullable|integer|min:1',
        ]);

        $geo = isset($dados['lat'], $dados['lng'])
            ? ['lat' => (float) $dados['lat'], 'lng' => (float) $dados['lng'], 'raio' => isset($dados['raio']) ? (float) $dados['raio'] : null]
            : null;

        return response()->json($service->executar(
            $dados['busca'] ?? null,
            $dados['categoria'] ?? null,
            isset($dados['nota_min']) ? (int) $dados['nota_min'] : null,
            $geo,
        ));
    }

    // Funcionalidade 6: Buscar por ID
    public function show(Restaurante $restaurante, CalcularDiasPicoService $picos)
    {
        $restaurante->loadAvg('avaliacoes', 'nota')->loadCount([
            'avaliacoes',
            'mesas',
            'mesas as mesas_livres_count' => fn ($q) => $q->where('status', 'livre'),
        ]);

        return response()->json($restaurante->toArray() + [
            'picos' => $picos->executar($restaurante),
            'cheio' => $restaurante->mesas_count > 0 && (int) $restaurante->mesas_livres_count === 0,
        ]);
    }

    public function listarCategorias()
    {
        return response()->json(Restaurante::CATEGORIAS);
    }

    public function filtrarPorCategoria(string $categoria, RestauranteRepository $repository)
    {
        return response()->json($repository->buscarPorCategoria($categoria));
    }

    public function buscarPorNome(string $nome, RestauranteRepository $repository)
    {
        return response()->json($repository->buscarPorNome($nome));
    }

    // Funcionalidade 10: Ranking
    public function ranking(GerarRankingService $service)
    {
        return response()->json($service->executar());
    }
}
