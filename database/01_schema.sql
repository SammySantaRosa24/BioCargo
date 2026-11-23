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
    foto_perfil_arquivo VARCHAR(100) NULL,
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
    descricao TEXT NULL,
    ano INT NOT NULL,
    disponivel BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_veiculo_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id)
);

CREATE TABLE demanda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    descricao TEXT NOT NULL,
    porte ENUM('PEQUENO', 'MEDIO', 'GRANDE') NOT NULL,
    tipo_transporte VARCHAR(100) NOT NULL,
    origem_cidade VARCHAR(120) NOT NULL,
    origem_endereco VARCHAR(255) NOT NULL,
    origem_complemento VARCHAR(500),
    destino_cidade VARCHAR(120) NOT NULL,
    destino_endereco VARCHAR(255) NOT NULL,
    destino_complemento VARCHAR(500),
    data_transporte DATE NOT NULL,
    periodo_retirada VARCHAR(100),
    valor_oferecido DECIMAL(10, 2) NOT NULL,
    requisitos TEXT,
    status ENUM('ABERTA', 'EM_NEGOCIACAO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA', 'EXPIRADA') NOT NULL DEFAULT 'ABERTA',
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_demanda_empresa_status_data (empresa_id, status, data_transporte),
    CONSTRAINT fk_demanda_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES empresa(id)
);

CREATE TABLE interesse (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    motorista_id INT NOT NULL,
    veiculo_id INT NULL,
    demanda_id INT NULL,
    status ENUM('PENDENTE', 'ACEITO', 'RECUSADO', 'EXPIRADO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_limite_resposta DATETIME NOT NULL,
    cancelado_por ENUM('EMPRESA', 'MOTORISTA') NULL,
    observacao_cancelamento TEXT NULL,
    data_cancelamento DATETIME NULL,
    CONSTRAINT fk_interesse_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES empresa(id),
    CONSTRAINT fk_interesse_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id),
    CONSTRAINT fk_interesse_veiculo
        FOREIGN KEY (veiculo_id)
        REFERENCES veiculo(id),
    CONSTRAINT fk_interesse_demanda
        FOREIGN KEY (demanda_id)
        REFERENCES demanda(id),
    INDEX idx_interesse_demanda_data (demanda_id, data_criacao),
    INDEX idx_interesse_demanda_motorista_status (demanda_id, motorista_id, status)
);

CREATE TABLE comprovante_entrega (
    id INT AUTO_INCREMENT PRIMARY KEY,
    demanda_id INT NOT NULL UNIQUE,
    interesse_id INT NOT NULL UNIQUE,
    motorista_id INT NOT NULL,
    nome_arquivo CHAR(40) NOT NULL UNIQUE,
    mime_type ENUM('image/jpeg', 'image/png') NOT NULL,
    tamanho_bytes INT UNSIGNED NOT NULL,
    data_entrega DATE NOT NULL,
    horario_entrega TIME NOT NULL,
    nome_recebedor VARCHAR(255) NOT NULL,
    observacoes VARCHAR(2000) NOT NULL,
    enviado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comprovante_demanda FOREIGN KEY (demanda_id) REFERENCES demanda(id),
    CONSTRAINT fk_comprovante_interesse FOREIGN KEY (interesse_id) REFERENCES interesse(id),
    CONSTRAINT fk_comprovante_motorista FOREIGN KEY (motorista_id) REFERENCES motorista(id),
    INDEX idx_comprovante_motorista_enviado (motorista_id, enviado_em)
);
