<?php

use App\Models\Mesa;
use App\Models\Restaurante;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->unsignedTinyInteger('pos_x')->nullable();
            $table->unsignedTinyInteger('pos_y')->nullable();
        });

        foreach (Restaurante::query()->whereHas('mesas')->get() as $restaurante) {
            $i = 0;
            foreach ($restaurante->mesas()->orderBy('numero')->get() as $mesa) {
                $mesa->update([
                    'pos_x' => $i % Mesa::MAPA_COLS,
                    'pos_y' => intdiv($i, Mesa::MAPA_COLS),
                ]);
                $i++;
            }
        }
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->dropColumn(['pos_x', 'pos_y']);
        });
    }
};
