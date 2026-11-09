<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Cria a conta de quem cozinha e o restaurante dela no mesmo passo. */
class CadastrarContaRestauranteService
{
    public function __construct(
        private CadastrarUsuarioService $usuarios,
        private CadastrarRestauranteService $restaurantes,
    ) {}

    public function executar(array $dados): array
    {
        return DB::transaction(function () use ($dados) {
            $usuario = $this->usuarios->executar([
                'name' => $dados['name'],
                'email' => $dados['email'],
                'password' => $dados['password'],
                'cpf' => $dados['cpf'] ?? null,
                'telefone' => $dados['telefone'] ?? null,
                'tipo' => User::TIPO_RESTAURANTE,
            ]);

            $restaurante = $this->restaurantes->executar([
                'nome' => $dados['nome'],
                'endereco' => $dados['endereco'],
                'telefone' => $dados['telefone'] ?? null,
                'descricao' => $dados['descricao'] ?? null,
                'categoria' => $dados['categoria'] ?? 'Geral',
                'capacidade_mesas' => $dados['capacidade_mesas'] ?? 0,
                'tempo_tolerancia' => isset($dados['tempo_tolerancia'])
                    ? substr((string) $dados['tempo_tolerancia'], 0, 5)
                    : '00:15',
            ], $usuario->id);

            return [
                'mensagem' => 'Restaurante cadastrado.',
                'usuario' => $usuario,
                'restaurante' => $restaurante,
            ];
        });
    }
}
