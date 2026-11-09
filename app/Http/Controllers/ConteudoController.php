<?php

namespace App\Http\Controllers;

use App\Models\AvaliacaoPrato;
use App\Models\Cardapio;
use App\Models\Promocao;
use App\Models\Restaurante;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Cardápio e promoções do restaurante. */
class ConteudoController extends Controller
{
    public function cardapio(Request $request, Restaurante $restaurante)
    {
        $itens = $restaurante->cardapios()
            ->withAvg('avaliacoes', 'nota')
            ->withCount('avaliacoes')
            ->with(['avaliacoes' => fn ($q) => $q->with('user:id,name')->latest()])
            ->orderBy('nome')
            ->get();

        $user = $request->user('sanctum');
        $minhas = $user
            ? AvaliacaoPrato::where('user_id', $user->id)->whereIn('cardapio_id', $itens->pluck('id'))->pluck('nota', 'cardapio_id')
            : collect();
        $itens->each(fn ($p) => $p->setAttribute('minha_nota', $minhas[$p->id] ?? null));

        $ordem = array_flip(Cardapio::CATEGORIAS);

        return response()->json($itens->sortBy(fn ($p) => [$ordem[$p->categoria] ?? 99, $p->nome])->values());
    }

    public function addPrato(Request $request, Restaurante $restaurante)
    {
        $restaurante->autorizarDono($request->user());
        $dados = $request->validate([
            'nome' => 'required|string|max:255',
            'categoria' => ['nullable', Rule::in(Cardapio::CATEGORIAS)],
            'descricao' => 'nullable|string|max:2000',
            'preco' => 'required|numeric|min:0',
            'foto' => 'nullable|url|max:500',
        ]);
        $dados['categoria'] = $dados['categoria'] ?? 'Outro';

        return response()->json($restaurante->cardapios()->create($dados), 201);
    }

    public function listar()
    {
        return response()->json(
            Promocao::with('restaurante:id,nome,categoria,endereco')->latest()->get()
        );
    }

    public function promocoes(Restaurante $restaurante)
    {
        return response()->json($restaurante->promocoes()->latest()->get());
    }

    public function addPromocao(Request $request, Restaurante $restaurante)
    {
        $restaurante->autorizarDono($request->user());
        $dados = $request->validate([
            'titulo' => 'required|string|max:255',
            'banner_url' => 'nullable|url|max:500',
        ]);

        return response()->json($restaurante->promocoes()->create($dados), 201);
    }
}
