-- Adiciona uma descrição opcional aos veículos cadastrados.
USE biocargo;

ALTER TABLE veiculo
  ADD COLUMN descricao TEXT NULL AFTER modelo;

