<?php

namespace App\Http\Controllers;

use App\Models\Avaliacao;
use App\Models\Restaurante;
use App\Repositories\AvaliacaoRepository;
use App\Services\CriarAvaliacaoService;
use App\Services\ResponderAvaliacaoService;
use Illuminate\Http\Request;

class AvaliacaoController extends Controller
{
    // Funcionalidade 8: Criar Avaliação (usuário autenticado)
    public function store(Request $request, Restaurante $restaurante, CriarAvaliacaoService $service)
    {
        $dados = $request->validate([
            'nota' => 'required|integer|min:1|max:5',
            'comentario' => 'nullable|string|max:2000',
        ]);

        return response()->json(
            $service->executar($restaurante, $request->user()->id, $dados),
            201
        );
    }

    // Funcionalidade 9: Listar Avaliações do Restaurante
    public function index(Restaurante $restaurante, AvaliacaoRepository $repository)
    {
        return response()->json($repository->buscarPorRestaurante($restaurante->id));
    }

    public function responder(Request $request, Avaliacao $avaliacao, ResponderAvaliacaoService $service)
    {
        $avaliacao->load('restaurante');
        $avaliacao->restaurante->autorizarDono($request->user());

        $dados = $request->validate([
            'resposta' => 'required|string|max:2000',
        ]);

        return response()->json($service->executar($avaliacao, $dados['resposta']));
    }
}
