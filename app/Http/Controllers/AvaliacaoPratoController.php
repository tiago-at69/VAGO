<?php

namespace App\Http\Controllers;

use App\Models\AvaliacaoPrato;
use App\Models\Cardapio;
use App\Services\CriarAvaliacaoPratoService;
use App\Services\GerarRankingPratosService;
use App\Services\ResponderAvaliacaoPratoService;
use Illuminate\Http\Request;

class AvaliacaoPratoController extends Controller
{
    public function store(Request $request, Cardapio $cardapio, CriarAvaliacaoPratoService $service)
    {
        $dados = $request->validate([
            'nota' => 'required|integer|min:1|max:5',
            'comentario' => 'nullable|string|max:2000',
        ]);

        return response()->json(
            $service->executar($cardapio, $request->user()->id, $dados),
            201
        );
    }

    public function index(Cardapio $cardapio)
    {
        return response()->json(
            $cardapio->avaliacoes()->with('user:id,name')->latest()->get()
        );
    }

    public function ranking(GerarRankingPratosService $service)
    {
        return response()->json($service->executar());
    }

    public function responder(Request $request, AvaliacaoPrato $avaliacao_prato, ResponderAvaliacaoPratoService $service)
    {
        $avaliacao_prato->load('prato.restaurante');
        $avaliacao_prato->prato->restaurante->autorizarDono($request->user());

        $dados = $request->validate([
            'resposta' => 'required|string|max:2000',
        ]);

        return response()->json($service->executar($avaliacao_prato, $dados['resposta']));
    }
}
