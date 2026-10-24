<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('cpf', 11)->nullable()->unique();
            $t->string('telefone')->nullable();
        });

        Schema::table('restaurantes', function (Blueprint $t) {
            $t->unsignedBigInteger('user_id')->nullable()->index(); // dono
            $t->unsignedInteger('capacidade_mesas')->default(0);
            $t->time('tempo_tolerancia')->default('00:15:00');
        });

        Schema::create('cardapios', function (Blueprint $t) {
            $t->id();
            $t->foreignId('restaurante_id')->constrained()->cascadeOnDelete();
            $t->string('nome');
            $t->decimal('preco', 8, 2);
            $t->string('foto')->nullable();
            $t->timestamps();
        });

        Schema::create('mesas', function (Blueprint $t) {
            $t->id();
            $t->foreignId('restaurante_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('numero');
            $t->unsignedInteger('cadeiras');
            $t->string('status')->default('livre'); // livre | ocupada | reservada
            $t->timestamps();
            $t->unique(['restaurante_id', 'numero']);
        });

        Schema::create('reservas', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $t->date('data');
            $t->time('horario');
            $t->unsignedInteger('num_pessoas');
            $t->string('status_confirmacao')->default('pendente'); // pendente | confirmada | recusada | cancelada
            $t->timestamps();
        });

        Schema::create('promocoes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('restaurante_id')->constrained()->cascadeOnDelete();
            $t->string('titulo');
            $t->string('banner_url')->nullable();
            $t->timestamps();
        });

        Schema::create('fila_espera', function (Blueprint $t) {
            $t->id();
            $t->foreignId('restaurante_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('posicao');
            $t->time('hora_entrada');
            $t->timestamps();
            $t->unique(['restaurante_id', 'user_id']);
        });

        Schema::create('favoritos', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('restaurante_id')->constrained()->cascadeOnDelete();
            $t->primary(['user_id', 'restaurante_id']);
        });
    }

    public function down(): void
    {
        foreach (['favoritos', 'fila_espera', 'promocoes', 'reservas', 'mesas', 'cardapios'] as $tabela) {
            Schema::dropIfExists($tabela);
        }
        Schema::table('restaurantes', fn (Blueprint $t) => $t->dropColumn(['user_id', 'capacidade_mesas', 'tempo_tolerancia']));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['cpf', 'telefone']));
    }
};
