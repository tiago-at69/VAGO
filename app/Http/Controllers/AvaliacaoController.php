<?php

namespace App\Http\Controllers;

use App\Models\Avaliacao;
use App\Models\AvaliacaoPrato;
use App\Models\Cardapio;
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
        $request->user()->autorizarCliente();

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

    // Histórico de quem avalia, ou a caixa de entrada de quem tem o restaurante.
    public function minhas(Request $request)
    {
        $user = $request->user();

        if ($user->ehRestaurante()) {
            $ids = $user->restaurantes()->pluck('id');
            $pratos = Cardapio::whereIn('restaurante_id', $ids)->pluck('id');

            return response()->json([
                'contexto' => 'restaurante',
                'restaurantes' => Avaliacao::with(['user:id,name', 'restaurante:id,nome'])
                    ->whereIn('restaurante_id', $ids)->latest()->get(),
                'pratos' => AvaliacaoPrato::with(['user:id,name', 'prato:id,nome,restaurante_id', 'prato.restaurante:id,nome'])
                    ->whereIn('cardapio_id', $pratos)->latest()->get(),
            ]);
        }

        return response()->json([
            'contexto' => 'cliente',
            'restaurantes' => Avaliacao::with('restaurante:id,nome')
                ->where('user_id', $user->id)->latest()->get(),
            'pratos' => AvaliacaoPrato::with(['prato:id,nome,restaurante_id', 'prato.restaurante:id,nome'])
                ->where('user_id', $user->id)->latest()->get(),
        ]);
    }
}
