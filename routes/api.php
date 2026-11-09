<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AvaliacaoController;
use App\Http\Controllers\AvaliacaoPratoController;
use App\Http\Controllers\ConteudoController;
use App\Http\Controllers\FavoritoController;
use App\Http\Controllers\FilaController;
use App\Http\Controllers\MesaController;
use App\Http\Controllers\ReservaController;
use App\Http\Controllers\RestauranteController;
use Illuminate\Support\Facades\Route;

// Públicas ---------------------------------------------------------------
Route::post('/usuarios', [AuthController::class, 'cadastrar']);
Route::post('/cadastro/restaurante', [AuthController::class, 'cadastrarRestaurante']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::get('/promocoes', [ConteudoController::class, 'listar']);

// Rotas fixas ANTES de /restaurantes/{restaurante}
Route::get('/restaurantes', [RestauranteController::class, 'index']);
Route::get('/restaurantes/ranking', [RestauranteController::class, 'ranking']);
Route::get('/pratos/ranking', [AvaliacaoPratoController::class, 'ranking']);
Route::get('/restaurantes/categorias', [RestauranteController::class, 'listarCategorias']);
Route::get('/restaurantes/categoria/{categoria}', [RestauranteController::class, 'filtrarPorCategoria']);
Route::get('/restaurantes/busca/{nome}', [RestauranteController::class, 'buscarPorNome']);

Route::prefix('/restaurantes/{restaurante}')->whereNumber('restaurante')->group(function () {
    Route::get('/', [RestauranteController::class, 'show']);
    Route::get('/avaliacoes', [AvaliacaoController::class, 'index']);
    Route::get('/cardapio', [ConteudoController::class, 'cardapio']);
    Route::get('/promocoes', [ConteudoController::class, 'promocoes']);
    Route::get('/mesas', [MesaController::class, 'index']);
    Route::get('/fila', [FilaController::class, 'index']);
});

Route::get('/cardapios/{cardapio}/avaliacoes', [AvaliacaoPratoController::class, 'index']);

// Autenticadas (Sanctum) --------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/perfil', [AuthController::class, 'meuPerfil']);
    Route::patch('/perfil', [AuthController::class, 'atualizarPerfil']);
    Route::get('/usuarios/{user}', [AuthController::class, 'perfil'])->whereNumber('user');

    Route::post('/restaurantes', [RestauranteController::class, 'store']);
    Route::get('/favoritos', [FavoritoController::class, 'index']);
    Route::get('/minhas-reservas', [ReservaController::class, 'minhas']);
    Route::get('/reservas-recebidas', [ReservaController::class, 'recebidas']);
    Route::get('/minhas-avaliacoes', [AvaliacaoController::class, 'minhas']);
    Route::get('/minha-fila', [FilaController::class, 'minha']);
    Route::get('/fila-recebida', [FilaController::class, 'recebida']);
    Route::patch('/mesas/{mesa}', [MesaController::class, 'atualizar']);
    Route::patch('/reservas/{reserva}', [ReservaController::class, 'atualizar']);
    Route::put('/avaliacoes/{avaliacao}/resposta', [AvaliacaoController::class, 'responder']);
    Route::post('/cardapios/{cardapio}/avaliacoes', [AvaliacaoPratoController::class, 'store']);
    Route::put('/avaliacoes-pratos/{avaliacao_prato}/resposta', [AvaliacaoPratoController::class, 'responder']);

    Route::prefix('/restaurantes/{restaurante}')->whereNumber('restaurante')->group(function () {
        Route::post('/avaliacoes', [AvaliacaoController::class, 'store']);
        Route::post('/favorito', [FavoritoController::class, 'alternar']);
        Route::post('/reservas', [ReservaController::class, 'store']);
        Route::get('/reservas', [ReservaController::class, 'doRestaurante']);
        Route::post('/fila', [FilaController::class, 'entrar']);
        Route::delete('/fila', [FilaController::class, 'sair']);
        Route::post('/fila/chamar', [FilaController::class, 'chamarProximo']);
        // Somente o dono
        Route::post('/cardapio', [ConteudoController::class, 'addPrato']);
        Route::post('/promocoes', [ConteudoController::class, 'addPromocao']);
        Route::post('/mesas', [MesaController::class, 'store']);
    });
});
