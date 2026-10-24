<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('avaliacoes_pratos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cardapio_id')->constrained('cardapios')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('nota');
            $table->text('comentario')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'cardapio_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('avaliacoes_pratos');
    }
};
