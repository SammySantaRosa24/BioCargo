-- BioCargo migration 20261122_001
-- Alinha veiculo/interesse ao database/01_schema.sql e ao contrato atual.
--
-- CUIDADOS:
-- 1. Faça backup e execute em janela de manutenção, com a API e escritores parados.
-- 2. Esta migration não é idempotente: execute-a integralmente uma única vez.
-- 3. Confirme os preflight checks abaixo antes de continuar. Eles refletem o estado
--    observado durante a preparação: veiculo sem `ativo`, interesse sem os quatro
--    campos abaixo e status limitado a PENDENTE/ACEITO/RECUSADO.
-- 4. ALTER TABLE faz commit implícito no MySQL. Em caso de falha parcial, NÃO execute
--    novamente o arquivo inteiro. Inspecione o estado real do banco e retome somente
--    com instruções específicas para as alterações que ainda não foram aplicadas.
-- 5. DATETIME não armazena fuso horário. O backfill preserva a representação temporal
--    de data_criacao e calcula somente +24 horas; não converta fuso sem confirmar a
--    origem dos registros. Se houver interesses PENDENTE antigos, confirme a convenção
--    temporal de data_criacao antes da execução. Não prossiga com origem desconhecida.
-- 6. No estado observado durante a preparação, o único interesse está ACEITO. Para
--    esse registro, o prazo derivado não altera a regra operacional de expiração.

USE biocargo;

-- PREFLIGHT (executar e revisar antes da migration):
-- Esperado no momento da preparação: 2 veículos e 1 interesse ACEITO.
SELECT
  (SELECT COUNT(*) FROM veiculo) AS total_veiculos,
  (SELECT COUNT(*) FROM interesse) AS total_interesses;

-- Contagens explícitas; pendentes deve ser revisado em especial antes do backfill.
SELECT COUNT(*) AS total_interesses,
       COALESCE(SUM(status = 'PENDENTE'), 0) AS pendentes,
       COALESCE(SUM(status = 'ACEITO'), 0) AS aceitos,
       COALESCE(SUM(status = 'RECUSADO'), 0) AS recusados,
       COALESCE(SUM(data_criacao IS NULL), 0) AS criacoes_nulas
FROM interesse;

-- Distribuição completa por status presente, com intervalo temporal agregado.
SELECT status, COUNT(*) AS quantidade,
       MIN(data_criacao) AS primeira_criacao,
       MAX(data_criacao) AS ultima_criacao,
       SUM(data_criacao IS NULL) AS criacoes_nulas
FROM interesse
GROUP BY status
ORDER BY status;

-- A definição atual observada possui apenas estes valores; revise se diferir.
SHOW CREATE TABLE veiculo;
SHOW CREATE TABLE interesse;

-- 1. Adiciona o estado lógico documentado. DEFAULT TRUE aplica o padrão do schema
--    aos veículos existentes e futuros, mantendo-os visíveis até inativação explícita.
ALTER TABLE veiculo
  ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE AFTER disponivel;

-- 2. Amplia o ENUM preservando os valores atuais e adiciona os metadados de prazo
--    e cancelamento. O prazo fica temporariamente NULL para permitir backfill explícito.
ALTER TABLE interesse
  MODIFY COLUMN status ENUM('PENDENTE', 'ACEITO', 'RECUSADO', 'EXPIRADO', 'CANCELADO')
    NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN data_limite_resposta DATETIME NULL AFTER data_criacao,
  ADD COLUMN cancelado_por ENUM('EMPRESA', 'MOTORISTA') NULL AFTER data_limite_resposta,
  ADD COLUMN observacao_cancelamento TEXT NULL AFTER cancelado_por,
  ADD COLUMN data_cancelamento DATETIME NULL AFTER observacao_cancelamento;

-- 3. Backfill determinístico pela regra do contrato: prazo = criação + 24 horas.
--    Não muda status ou histórico. Mantém o mesmo sistema de representação DATETIME.
UPDATE interesse
SET data_limite_resposta = DATE_ADD(data_criacao, INTERVAL 24 HOUR)
WHERE data_limite_resposta IS NULL;

-- 4. Confirma que nenhum prazo ficou sem valor antes de impor NOT NULL.
SELECT COUNT(*) AS prazos_nulos
FROM interesse
WHERE data_limite_resposta IS NULL;
-- Esperado: 0. Se diferente, pare e investigue; não prossiga para ALTER abaixo.

ALTER TABLE interesse
  MODIFY COLUMN data_limite_resposta DATETIME NOT NULL;

-- POSTFLIGHT: confirmar definições, defaults, ENUM, índices e FKs após execução.
SHOW CREATE TABLE veiculo;
SHOW CREATE TABLE interesse;

SELECT ativo, COUNT(*) AS quantidade
FROM veiculo
GROUP BY ativo
ORDER BY ativo;

SELECT status, COUNT(*) AS quantidade,
       SUM(data_limite_resposta IS NULL) AS prazos_nulos
FROM interesse
GROUP BY status
ORDER BY status;

-- Esperado: 0. Confirma que todo prazo deriva exatamente da criação + 24 horas.
SELECT COUNT(*) AS prazos_divergentes
FROM interesse
WHERE data_limite_resposta IS NULL
   OR data_limite_resposta <> DATE_ADD(data_criacao, INTERVAL 24 HOUR);
