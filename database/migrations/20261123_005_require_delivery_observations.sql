USE biocargo;

UPDATE comprovante_entrega
SET observacoes = 'Nao informado no registro anterior'
WHERE observacoes IS NULL OR TRIM(observacoes) = '';

ALTER TABLE comprovante_entrega
    MODIFY COLUMN observacoes VARCHAR(2000) NOT NULL;
