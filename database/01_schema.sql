CREATE DATABASE IF NOT EXISTS biocargo;
USE biocargo;

CREATE TABLE usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo_usuario ENUM('EMPRESA', 'MOTORISTA', 'ADMIN') NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE empresa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    CONSTRAINT fk_empresa_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
);

CREATE TABLE motorista (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    disponivel BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_motorista_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
);

CREATE TABLE qualificacao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    motorista_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    CONSTRAINT fk_qualificacao_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id)
);

CREATE TABLE veiculo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    motorista_id INT NOT NULL,
    placa VARCHAR(8) NOT NULL UNIQUE,
    renavam VARCHAR(11) NOT NULL UNIQUE,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    ano INT NOT NULL,
    disponivel BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_veiculo_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id)
);

CREATE TABLE interesse (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    motorista_id INT NOT NULL,
    veiculo_id INT NULL,
    status ENUM('PENDENTE', 'ACEITO', 'RECUSADO') NOT NULL DEFAULT 'PENDENTE',
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_interesse_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES empresa(id),
    CONSTRAINT fk_interesse_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id),
    CONSTRAINT fk_interesse_veiculo
        FOREIGN KEY (veiculo_id)
        REFERENCES veiculo(id)
);
