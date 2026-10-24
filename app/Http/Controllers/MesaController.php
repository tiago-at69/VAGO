<?php

namespace App\Http\Controllers;

use App\Models\Mesa;
use App\Models\Restaurante;
use App\Services\PosicionarMesaService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MesaController extends Controller
{
    public function index(Restaurante $restaurante)
    {
        return response()->json($restaurante->mesas()->orderBy('numero')->get());
    }

    public function store(Request $request, Restaurante $restaurante, PosicionarMesaService $posicao)
    {
        $restaurante->autorizarDono($request->user());
        $dados = $request->validate([
            'numero' => ['required', 'integer', 'min:1', Rule::unique('mesas')->where('restaurante_id', $restaurante->id)],
            'cadeiras' => 'required|integer|min:1|max:50',
            'pos_x' => 'nullable|required_with:pos_y|integer|min:0|max:'.Mesa::MAPA_MAX,
            'pos_y' => 'nullable|required_with:pos_x|integer|min:0|max:'.Mesa::MAPA_MAX,
        ]);
        $dados = array_merge($dados, $posicao->garantir(
            $restaurante,
            isset($dados['pos_x']) ? (int) $dados['pos_x'] : null,
            isset($dados['pos_y']) ? (int) $dados['pos_y'] : null,
        ));

        return response()->json($restaurante->mesas()->create($dados), 201);
    }

    public function atualizar(Request $request, Mesa $mesa, PosicionarMesaService $posicao)
    {
        $mesa->restaurante->autorizarDono($request->user());
        $dados = $request->validate([
            'status' => 'sometimes|required|in:livre,ocupada,reservada',
            'pos_x' => 'required_with:pos_y|integer|min:0|max:'.Mesa::MAPA_MAX,
            'pos_y' => 'required_with:pos_x|integer|min:0|max:'.Mesa::MAPA_MAX,
        ]);

        if ($dados === []) {
            throw ValidationException::withMessages(['status' => 'Informe status ou a nova posição.']);
        }

        if (array_key_exists('pos_x', $dados) && array_key_exists('pos_y', $dados)) {
            $dados = array_merge($dados, $posicao->garantir(
                $mesa->restaurante,
                (int) $dados['pos_x'],
                (int) $dados['pos_y'],
                $mesa->id,
            ));
        }

        $mesa->update($dados);

        return response()->json($mesa);
    }
}
