<?php

namespace App\Http\Controllers;

use App\Models\Reserva;
use App\Models\Restaurante;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReservaController extends Controller
{
    public function store(Request $request, Restaurante $restaurante)
    {
        $dados = $request->validate([
            'mesa_id' => 'required|integer',
            'data' => 'required|date|after_or_equal:today',
            'horario' => 'required|date_format:H:i',
            'num_pessoas' => 'required|integer|min:1',
        ]);

        $mesa = $restaurante->mesas()->findOrFail($dados['mesa_id']);

        if ($dados['num_pessoas'] > $mesa->cadeiras) {
            throw ValidationException::withMessages(['num_pessoas' => "Esta mesa comporta no máximo {$mesa->cadeiras} pessoas."]);
        }

        // Mesma mesa, mesmo dia, com menos de 2h de diferença = conflito.
        $inicio = strtotime($dados['horario']);
        $conflito = $mesa->reservas()
            ->where('data', $dados['data'])
            ->whereIn('status_confirmacao', ['pendente', 'confirmada'])
            ->get()
            ->contains(fn ($r) => abs(strtotime($r->horario) - $inicio) < 7200);

        if ($conflito) {
            throw ValidationException::withMessages(['horario' => 'Mesa indisponível neste horário.']);
        }

        return response()->json(
            Reserva::create($dados + ['user_id' => $request->user()->id, 'status_confirmacao' => 'pendente']),
            201
        );
    }

    public function minhas(Request $request)
    {
        return response()->json(
            Reserva::with('mesa.restaurante:id,nome')->where('user_id', $request->user()->id)->latest()->get()
        );
    }

    public function doRestaurante(Request $request, Restaurante $restaurante)
    {
        $restaurante->autorizarDono($request->user());

        return response()->json(
            Reserva::with(['user:id,name,telefone', 'mesa:id,numero'])
                ->whereIn('mesa_id', $restaurante->mesas()->select('id'))
                ->latest()->get()
        );
    }

    public function atualizar(Request $request, Reserva $reserva)
    {
        $novo = $request->validate(['status_confirmacao' => 'required|in:confirmada,recusada,cancelada'])['status_confirmacao'];
        $uid = $request->user()->id;

        $cliente = $reserva->user_id === $uid && $novo === 'cancelada';
        $dono = $reserva->mesa->restaurante->user_id === $uid && $novo !== 'cancelada';
        abort_unless($cliente || $dono, 403, 'Ação não permitida.');

        $reserva->update(['status_confirmacao' => $novo]);

        return response()->json($reserva);
    }
}
