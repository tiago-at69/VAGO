<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AtualizarPerfilService;
use App\Services\AutenticarUsuarioService;
use App\Services\CadastrarUsuarioService;
use App\Services\ObterPerfilService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    // Funcionalidade 1: Cadastrar
    public function cadastrar(Request $request, CadastrarUsuarioService $service)
    {
        $dados = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users',
            'password' => ['required', 'string', Password::min(8)],
            'cpf' => 'nullable|digits:11|unique:users',
            'telefone' => 'nullable|string|max:30',
        ]);

        return response()->json($service->executar($dados), 201);
    }

    // Funcionalidade 2: Autenticar (devolve token Sanctum)
    public function login(Request $request, AutenticarUsuarioService $service)
    {
        $dados = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $resultado = $service->executar($dados['email'], $dados['password']);

        if (! $resultado) {
            return response()->json(['erro' => 'Credenciais inválidas.'], 401);
        }

        return response()->json([
            'mensagem' => 'Login realizado com sucesso!',
            'usuario' => $resultado['usuario'],
            'token' => $resultado['token'],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['mensagem' => 'Sessão encerrada.']);
    }

    // Perfil do usuário logado (com e-mail, contagens e histórico)
    public function meuPerfil(Request $request, ObterPerfilService $service)
    {
        return response()->json($service->executar($request->user()));
    }

    public function atualizarPerfil(Request $request, AtualizarPerfilService $service)
    {
        $dados = $request->validate([
            'name' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:30',
        ]);

        return response()->json($service->executar($request->user(), $dados));
    }

    // Perfil público de outro usuário: sem e-mail
    public function perfil(User $user)
    {
        return response()->json($user->only(['id', 'name', 'created_at']));
    }
}
