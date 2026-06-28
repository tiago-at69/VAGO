NOME COMPLETO DOS INTEGRANTES: Tiago Vinícius Santos Silva Pedro Henrique Braga Izac Theo Souza da Silva Sarah Beatriz Silveira Campos Isabela Pena Mollinari Vieira Davi Ferreira Eustáquio

DESCRIÇÃO BREVE DO SISTEMA

O VAGO é uma plataforma de gestão de reservas para restaurantes que busca reduzir prejuízos causados por faltas de clientes (no-show) e otimizar a ocupação das mesas. O sistema permite que clientes consultem restaurantes, visualizem cardápios, acompanhem filas de espera em tempo real, realizem reservas e avaliem estabelecimentos. Para os restaurantes, o VAGO oferece automação de confirmações de reservas, gerenciamento de mesas, controle de filas de espera, divulgação de promoções e relatórios gerenciais que auxiliam na tomada de decisões estratégicas. Seu principal diferencial é a liberação inteligente de mesas, que envia confirmações automáticas aos clientes antes da reserva e cancela automaticamente aquelas não confirmadas, permitindo que as mesas sejam disponibilizadas para outros consumidores e reduzindo perdas financeiras.

INSTRUÇÕES BÁSICAS PARA EXECUTAR O PROJETO

Pré-requisitos

Banco de dados relacional (MySQL ou PostgreSQL). Ambiente de desenvolvimento compatível com a linguagem escolhida para implementação. Navegador web atualizado para acesso ao sistema.

Passos para execução

Criar o banco de dados utilizando o modelo entidade-relacionamento apresentado no projeto. Executar os scripts SQL para criação das tabelas: Cliente Restaurante Mesa Reserva Cardápio Promoção Fila de Espera Avaliação Configurar a conexão da aplicação com o banco de dados. Iniciar o servidor da aplicação. Acessar o sistema pelo navegador através do endereço configurado. Realizar o cadastro de restaurantes e clientes para utilização das funcionalidades. Utilizar os módulos de reservas, filas de espera, promoções, avaliações e gerenciamento de mesas conforme o perfil de usuário.

Funcionalidades principais

Cadastro e gerenciamento de restaurantes. Cadastro de clientes. Reserva de mesas. Controle de filas de espera. Confirmação automática de reservas. Liberação automática de mesas não confirmadas. Consulta de cardápios e promoções. Avaliação de restaurantes. Relatórios gerenciais para apoio à tomada de decisão.

# Vago Sistema PS

Repositório do projeto desenvolvido para a disciplina de desenvolvimento web.

## Estrutura do repositório

```
vago-sistema-ps/
├── frontend/          # Interface do sistema (em construção)
└── backend/           # API Web em Flask (Python)
    ├── controllers/   # Recebe requisições e retorna respostas
    ├── models/        # Entidades e operações ligadas ao banco de dados
    ├── repositories/  # Consultas específicas além do CRUD básico
    ├── services/      # Regras de negócio e casos de uso
    └── database/
        └── create_database.sql
```

## Como rodar o backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

A API estará disponível em `http://localhost:5000/api/status`.
