<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A média passa a ser calculada (withAvg) em vez de armazenada.
        Schema::table('restaurantes', function (Blueprint $table) {
            $table->dropColumn('pontuacao_media');
            $table->index('nome');
            $table->index('categoria');
        });

        // Um usuário só avalia cada restaurante uma vez.
        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->unique(['user_id', 'restaurante_id']);
        });
    }

    public function down(): void
    {
        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'restaurante_id']);
        });

        Schema::table('restaurantes', function (Blueprint $table) {
            $table->dropIndex(['nome']);
            $table->dropIndex(['categoria']);
            $table->decimal('pontuacao_media', 2, 1)->default(0.0);
        });
    }
};
