-- ============================================================
--  Vago Sistema PS — Script de criação do banco de dados
-- ============================================================

-- Remova e recrie o banco ao reiniciar o ambiente (opcional)
-- DROP DATABASE IF EXISTS vago_sistema_ps;
-- CREATE DATABASE vago_sistema_ps;
-- USE vago_sistema_ps;

-- ------------------------------------------------------------
-- Tabela de exemplo — substitua pelas entidades reais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exemplo (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL
);

-- Insira aqui as demais tabelas do sistema conforme o modelo de dados definido.
