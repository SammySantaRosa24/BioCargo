USE biocargo;

ALTER TABLE motorista
    ADD COLUMN foto_perfil_arquivo VARCHAR(100) NULL AFTER telefone;
