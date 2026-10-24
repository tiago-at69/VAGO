<?php

namespace App\Http\Controllers;

use App\Models\FilaEspera;
use App\Models\Restaurante;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FilaController extends Controller
{
    public function index(Restaurante $restaurante)
    {
        return response()->json($restaurante->fila()->with('user:id,name')->orderBy('posicao')->get());
    }

    public function entrar(Request $request, Restaurante $restaurante)
    {
        if ($restaurante->fila()->where('user_id', $request->user()->id)->exists()) {
            throw ValidationException::withMessages(['fila' => 'Você já está na fila deste restaurante.']);
        }

        $entrada = $restaurante->fila()->create([
            'user_id' => $request->user()->id,
            'posicao' => $restaurante->fila()->max('posicao') + 1,
            'hora_entrada' => now()->format('H:i:s'),
        ]);

        return response()->json($entrada, 201);
    }

    public function sair(Request $request, Restaurante $restaurante)
    {
        $restaurante->fila()->where('user_id', $request->user()->id)->delete();
        $this->reordenar($restaurante);

        return response()->json(['mensagem' => 'Você saiu da fila.']);
    }

    public function chamarProximo(Request $request, Restaurante $restaurante)
    {
        $restaurante->autorizarDono($request->user());
        $primeiro = $restaurante->fila()->with('user:id,name')->orderBy('posicao')->first();
        abort_unless($primeiro, 404, 'A fila está vazia.');

        $primeiro->delete();
        $this->reordenar($restaurante);

        return response()->json($primeiro);
    }

    private function reordenar(Restaurante $restaurante): void
    {
        $restaurante->fila()->orderBy('posicao')->get()
            ->each(fn (FilaEspera $f, $i) => $f->update(['posicao' => $i + 1]));
    }
}
