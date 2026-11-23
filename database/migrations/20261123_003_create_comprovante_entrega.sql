USE biocargo;

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
    observacoes VARCHAR(2000) NULL,
    enviado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comprovante_demanda FOREIGN KEY (demanda_id) REFERENCES demanda(id),
    CONSTRAINT fk_comprovante_interesse FOREIGN KEY (interesse_id) REFERENCES interesse(id),
    CONSTRAINT fk_comprovante_motorista FOREIGN KEY (motorista_id) REFERENCES motorista(id),
    INDEX idx_comprovante_motorista_enviado (motorista_id, enviado_em)
);
