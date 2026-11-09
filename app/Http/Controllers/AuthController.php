<?php

namespace App\Http\Controllers;

use App\Models\Restaurante;
use App\Models\User;
use App\Services\AtualizarPerfilService;
use App\Services\AutenticarUsuarioService;
use App\Services\CadastrarContaRestauranteService;
use App\Services\CadastrarUsuarioService;
use App\Services\ObterPerfilService;
use Illuminate\Database\QueryException;
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
        ], $this->mensagensCadastro());
        $dados['tipo'] = User::TIPO_CLIENTE;

        return $this->respostaDeCadastro(fn () => $service->executar($dados));
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
        ], $this->mensagensCadastro());

        return $this->respostaDeCadastro(fn () => $service->executar($dados));
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

    /** Grava a conta e já devolve o token, para o front não depender de um segundo login. */
    private function respostaDeCadastro(callable $criar)
    {
        try {
            $resultado = $criar();
        } catch (QueryException $e) {
            report($e);

            return response()->json([
                'erro' => 'Não consegui gravar a conta. Rode php artisan migrate e tente de novo.',
            ], 500);
        }

        $usuario = $resultado instanceof User ? $resultado : $resultado['usuario'];
        $extra = $resultado instanceof User ? [] : ['restaurante' => $resultado['restaurante']];
        $mensagem = $resultado instanceof User ? 'Conta criada.' : ($resultado['mensagem'] ?? 'Conta criada.');

        try {
            $token = $usuario->createToken('app')->plainTextToken;
        } catch (QueryException $e) {
            report($e);

            return response()->json([
                'erro' => 'A conta foi gravada, mas a sessão não. Rode php artisan migrate e entre com o e-mail.',
            ], 500);
        }

        return response()->json([
            'mensagem' => $mensagem,
            'usuario' => $usuario,
            'token' => $token,
        ] + $extra, 201);
    }

    private function mensagensCadastro(): array
    {
        return [
            'name.required' => 'Informe o nome.',
            'email.required' => 'Informe o e-mail.',
            'email.email' => 'O e-mail não é válido.',
            'email.unique' => 'Esse e-mail já está cadastrado.',
            'password.required' => 'Informe a senha.',
            'password.min' => 'A senha precisa ter no mínimo 8 caracteres.',
            'cpf.digits' => 'O CPF precisa ter 11 dígitos.',
            'cpf.unique' => 'Esse CPF já está cadastrado.',
            'nome.required' => 'Informe o nome do restaurante.',
            'endereco.required' => 'Informe o endereço.',
            'categoria.in' => 'Escolha um tipo de culinária da lista.',
            'tempo_tolerancia.regex' => 'A tolerância deve estar no formato HH:MM.',
        ];
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
