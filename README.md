# VAGO

API (Laravel + Sanctum) e front simples para avaliação e ranking de restaurantes.

## Como rodar

O banco da aplicação é MySQL. Crie o banco e o usuário local (a senha abaixo é só de desenvolvimento):

```sql
CREATE DATABASE vago CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE vago_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vago'@'127.0.0.1' IDENTIFIED BY 'vago';
GRANT ALL PRIVILEGES ON vago.* TO 'vago'@'127.0.0.1';
GRANT ALL PRIVILEGES ON vago_testing.* TO 'vago'@'127.0.0.1';
FLUSH PRIVILEGES;
```

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve        # front em http://localhost:8000 (public/index.html)
php artisan test         # testes no MySQL, no banco vago_testing
```

## Endpoints

| Método | Rota | Auth |
|---|---|---|
| POST | `/api/usuarios` (conta de cliente; `tipo=cliente`; devolve `token`) | não |
| POST | `/api/cadastro/restaurante` (conta + salão; `tipo=restaurante`; devolve `token`) | não |
| POST | `/api/login` (devolve `token`, limite 5/min) | não |
| POST | `/api/logout` | Bearer |
| GET · PATCH | `/api/perfil` (ver / editar nome e telefone) | Bearer |
| GET | `/api/usuarios/{id}` (perfil público) | Bearer |
| GET | `/api/restaurantes?busca=&categoria=&nota_min=&lat=&lng=&raio=&page=` | não |
| GET | `/api/restaurantes/{id}` (inclui `picos`, `cheio`, `tipo_culinaria`) · `/ranking` · `/categorias` | não |
| GET | `/api/pratos/ranking` | não |
| GET | `/api/promocoes` | não |
| POST | `/api/restaurantes` (só conta de restaurante; geocodifica o endereço) | Bearer |
| GET | `/api/restaurantes/{id}/avaliacoes` · `/cardapio` · `/promocoes` · `/mesas` · `/fila` | não |
| POST | `/api/restaurantes/{id}/cardapio` · `/promocoes` · `/mesas` | dono |
| PATCH | `/api/mesas/{id}` (status · cadeiras · `pos_x`/`pos_y`) | dono |
| POST | `/api/restaurantes/{id}/reservas` · GET `/minhas-reservas` | cliente |
| GET | `/api/reservas-recebidas` · `/api/restaurantes/{id}/reservas` | restaurante |
| PATCH | `/api/reservas/{id}` (confirmar/recusar: dono · cancelar: cliente) | Bearer |
| GET | `/api/minhas-avaliacoes` (cliente: as que fez · restaurante: as recebidas, salão e pratos) | Bearer |
| POST/DELETE | `/api/restaurantes/{id}/fila` (entrar só com o salão cheio / sair) · GET `/minha-fila` | cliente |
| POST | `/api/restaurantes/{id}/fila/chamar` · GET `/fila-recebida` | dono |
| POST | `/api/restaurantes/{id}/favorito` (alterna) · GET `/api/favoritos` | Bearer |
| POST | `/api/restaurantes/{id}/avaliacoes` (1 por usuário) | Bearer |
| GET | `/api/cardapios/{id}/avaliacoes` | não |
| POST | `/api/cardapios/{id}/avaliacoes` (1 por usuário/prato) | Bearer |
| PUT | `/api/avaliacoes/{id}/resposta` | dono |
| PUT | `/api/avaliacoes-pratos/{id}/resposta` | dono |

Enviar `Authorization: Bearer <token>` nas rotas protegidas.

## Funcionalidades

Implementadas: 1 a 10, mais cardápio (com categoria e descrição), mesas (com mapa do salão), reservas, promoções, fila de espera, favoritos, modo escuro, página de perfil, filtro por avaliação e por distância, respostas do dono (restaurante e pratos), avaliação/ranking de pratos, dias de pico e mapa (Google Maps).
O "dono" é a conta de restaurante que cadastrou o salão. Cliente e restaurante são cadastros separados (`users.tipo`). `tipo_culinaria` do diagrama = campo `categoria`. A fila só aceita entrada quando não há mesa livre.
