<?php

namespace App\Services;

use App\Models\Mesa;
use App\Models\Restaurante;
use Illuminate\Validation\ValidationException;

class PosicionarMesaService
{
    public function garantir(Restaurante $restaurante, ?int $x, ?int $y, ?int $ignorar = null): array
    {
        if ($x === null || $y === null) {
            return $this->proximaLivre($restaurante, $ignorar);
        }

        $ocupada = $restaurante->mesas()
            ->where('pos_x', $x)
            ->where('pos_y', $y)
            ->when($ignorar, fn ($q) => $q->where('id', '!=', $ignorar))
            ->exists();

        if ($ocupada) {
            throw ValidationException::withMessages([
                'pos_x' => 'Já existe uma mesa nessa posição do mapa.',
            ]);
        }

        return ['pos_x' => $x, 'pos_y' => $y];
    }

    public function proximaLivre(Restaurante $restaurante, ?int $ignorar = null): array
    {
        $ocupadas = $restaurante->mesas()
            ->whereNotNull('pos_x')
            ->whereNotNull('pos_y')
            ->when($ignorar, fn ($q) => $q->where('id', '!=', $ignorar))
            ->get(['pos_x', 'pos_y'])
            ->map(fn (Mesa $m) => $m->pos_x.':'.$m->pos_y)
            ->all();

        for ($y = 0; $y <= Mesa::MAPA_MAX; $y++) {
            for ($x = 0; $x < Mesa::MAPA_COLS; $x++) {
                if (! in_array("$x:$y", $ocupadas, true)) {
                    return ['pos_x' => $x, 'pos_y' => $y];
                }
            }
        }

        throw ValidationException::withMessages([
            'pos_x' => 'O mapa está cheio. Mova alguma mesa ou aumente o salão.',
        ]);
    }
}
