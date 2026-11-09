<?php

namespace App\Http\Controllers;

use App\Models\Restaurante;
use App\Models\User;
use App\Services\AtualizarPerfilService;
use App\Services\AutenticarUsuarioService;
use App\Services\CadastrarContaRestauranteService;
use App\Services\CadastrarUsuarioService;
use App\Services\ObterPerfilService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    // Funcionalidade 1: Cadastrar cliente
    public function cadastrar(Request $request, CadastrarUsuarioService $service)
    {
        $this->normalizarCpf($request);

        $dados = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users',
            'password' => ['required', 'string', Password::min(8)],
            'cpf' => 'nullable|digits:11|unique:users',
            'telefone' => 'nullable|string|max:30',
        ]);
        $dados['tipo'] = User::TIPO_CLIENTE;

        return response()->json($service->executar($dados), 201);
    }

    // Conta de restaurante: responsável + salão, sem precisar já estar logado.
    public function cadastrarRestaurante(Request $request, CadastrarContaRestauranteService $service)
    {
        $this->normalizarCpf($request);
        $this->aceitarTipoCulinaria($request);

        $dados = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users',
            'password' => ['required', 'string', Password::min(8)],
            'cpf' => 'nullable|digits:11|unique:users',
            'telefone' => 'nullable|string|max:30',
            'nome' => 'required|string|max:255',
            'endereco' => 'required|string|max:255',
            'descricao' => 'nullable|string|max:2000',
            'categoria' => ['nullable', Rule::in(Restaurante::CATEGORIAS)],
            'capacidade_mesas' => 'nullable|integer|min:0',
            'tempo_tolerancia' => ['nullable', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
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

    private function normalizarCpf(Request $request): void
    {
        if (! $request->exists('cpf') || $request->input('cpf') === null) {
            return;
        }

        $cpf = preg_replace('/\D/', '', (string) $request->input('cpf'));
        $request->merge(['cpf' => $cpf === '' ? null : $cpf]);
    }

    /** O diagrama chama de tipo_culinaria o que a base guarda em categoria. */
    private function aceitarTipoCulinaria(Request $request): void
    {
        if ($request->filled('tipo_culinaria') && ! $request->filled('categoria')) {
            $request->merge(['categoria' => $request->input('tipo_culinaria')]);
        }
    }
}
