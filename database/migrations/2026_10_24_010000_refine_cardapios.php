<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cardapios', function (Blueprint $table) {
            $table->string('categoria')->default('Outro')->after('nome');
            $table->text('descricao')->nullable()->after('categoria');
        });
    }

    public function down(): void
    {
        Schema::table('cardapios', function (Blueprint $table) {
            $table->dropColumn(['categoria', 'descricao']);
        });
    }
};
