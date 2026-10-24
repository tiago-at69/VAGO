<?php

namespace Database\Factories;

use App\Models\Restaurante;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Restaurante> */
class RestauranteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nome' => fake()->company(),
            'endereco' => fake()->address(),
            'telefone' => fake()->phoneNumber(),
            'descricao' => fake()->sentence(),
            'categoria' => fake()->randomElement(Restaurante::CATEGORIAS),
            'user_id' => \App\Models\User::factory(),
        ];
    }
}
