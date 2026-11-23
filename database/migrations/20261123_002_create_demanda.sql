-- Cria demandas de transporte e vincula manifestaÃ§Ãµes da tabela interesse.
USE biocargo;

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

ALTER TABLE interesse
    ADD COLUMN demanda_id INT NULL AFTER veiculo_id,
    ADD CONSTRAINT fk_interesse_demanda
        FOREIGN KEY (demanda_id)
        REFERENCES demanda(id),
    ADD INDEX idx_interesse_demanda_data (demanda_id, data_criacao),
    ADD INDEX idx_interesse_demanda_motorista_status (demanda_id, motorista_id, status);
