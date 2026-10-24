# VAGO

API (Laravel + Sanctum) e front simples para avaliação e ranking de restaurantes.

## Como rodar

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve        # front em http://localhost:8000 (public/index.html)
php artisan test         # testes
```

## Endpoints

| Método | Rota | Auth |
|---|---|---|
| POST | `/api/usuarios` | não |
| POST | `/api/login` (devolve `token`, limite 5/min) | não |
| POST | `/api/logout` | Bearer |
| GET · PATCH | `/api/perfil` (ver / editar nome e telefone) | Bearer |
| GET | `/api/usuarios/{id}` (perfil público) | Bearer |
| GET | `/api/restaurantes?busca=&categoria=&nota_min=&lat=&lng=&raio=&page=` | não |
| GET | `/api/restaurantes/{id}` (inclui `picos`, `latitude`, `longitude`) · `/ranking` · `/categorias` | não |
| GET | `/api/pratos/ranking` | não |
| POST | `/api/restaurantes` (geocodifica o endereço → `latitude`/`longitude`) | Bearer |
| GET | `/api/restaurantes/{id}/avaliacoes` · `/cardapio` · `/promocoes` · `/mesas` · `/fila` | não |
| POST | `/api/restaurantes/{id}/cardapio` · `/promocoes` · `/mesas` | dono |
| PATCH | `/api/mesas/{id}` (status · `pos_x`/`pos_y` no mapa) | dono |
| POST | `/api/restaurantes/{id}/reservas` · GET `/minhas-reservas` | Bearer |
| GET | `/api/restaurantes/{id}/reservas` (recebidas) | dono |
| PATCH | `/api/reservas/{id}` (confirmar/recusar: dono · cancelar: cliente) | Bearer |
| POST/DELETE | `/api/restaurantes/{id}/fila` (entrar/sair) · POST `/fila/chamar` (dono) | Bearer |
| POST | `/api/restaurantes/{id}/favorito` (alterna) · GET `/api/favoritos` | Bearer |
| POST | `/api/restaurantes/{id}/avaliacoes` (1 por usuário) | Bearer |
| GET | `/api/cardapios/{id}/avaliacoes` | não |
| POST | `/api/cardapios/{id}/avaliacoes` (1 por usuário/prato) | Bearer |
| PUT | `/api/avaliacoes/{id}/resposta` | dono |
| PUT | `/api/avaliacoes-pratos/{id}/resposta` | dono |

Enviar `Authorization: Bearer <token>` nas rotas protegidas.

## Funcionalidades

Implementadas: 1 a 10, mais cardápio (com categoria e descrição), mesas (com mapa do salão), reservas, promoções, fila de espera, favoritos, modo escuro, página de perfil, filtro por avaliação e por distância, respostas do dono (restaurante e pratos), avaliação/ranking de pratos, dias de pico e mapa (Google Maps).
O "dono" é quem cadastrou o restaurante. `tipo_culinaria` do diagrama = campo `categoria`.
