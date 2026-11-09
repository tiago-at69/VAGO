<?php

namespace App\Http\Controllers;

use App\Models\Restaurante;
use Illuminate\Http\Request;

class FavoritoController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->favoritos()->withAvg('avaliacoes', 'nota')->withCount('avaliacoes')->get()
        );
    }

    public function alternar(Request $request, Restaurante $restaurante)
    {
        $request->user()->autorizarCliente();

        $resultado = $request->user()->favoritos()->toggle($restaurante->id);

        return response()->json(['favorito' => count($resultado['attached']) > 0]);
    }
}
