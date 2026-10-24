<?php

namespace App\Services;

use App\Models\Reserva;
use App\Models\Restaurante;
use Carbon\Carbon;

class CalcularDiasPicoService
{
    /** Ordem de exibição: segunda → domingo. Chave = Carbon::dayOfWeek (0 = domingo). */
    public const DIAS = [
        1 => 'segunda',
        2 => 'terça',
        3 => 'quarta',
        4 => 'quinta',
        5 => 'sexta',
        6 => 'sábado',
        0 => 'domingo',
    ];

    public function executar(Restaurante $restaurante): array
    {
        $contagem = array_fill(0, 7, 0);

        Reserva::query()
            ->whereIn('mesa_id', $restaurante->mesas()->select('id'))
            ->whereIn('status_confirmacao', ['pendente', 'confirmada'])
            ->get(['data'])
            ->each(function (Reserva $reserva) use (&$contagem) {
                $contagem[Carbon::parse($reserva->data)->dayOfWeek]++;
            });

        $total = array_sum($contagem);
        $max = max($contagem);
        $suficiente = $total >= 3 && $max >= 2;

        $dias = [];
        foreach (self::DIAS as $dow => $nome) {
            $reservas = $contagem[$dow];
            $dias[] = [
                'dia' => $dow,
                'nome' => $nome,
                'reservas' => $reservas,
                'pico' => $suficiente && $reservas === $max,
            ];
        }

        return [
            'total' => $total,
            'dias' => $dias,
            'picos' => collect($dias)->where('pico', true)->pluck('nome')->values()->all(),
        ];
    }
}
