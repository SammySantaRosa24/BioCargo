# Administracao, foto de perfil e conclusao de transporte

Todas as rotas usam o prefixo `/api/v1` e sessao MySQL existente.

## Rotas frontend

- `/admin`: indicadores lidos do banco.
- `/admin/usuarios` e `/admin/usuarios/:id`: lista, filtros, detalhes, ativacao e inativacao logicas.
- `/admin/demandas` e `/admin/demandas/:id`: consulta paginada, filtros por status/empresa e detalhes de operacao.
- `/motorista/perfil`: edicao do perfil e substituicao de foto.
- `/empresa/motoristas`: consulta paginada de prestadores e fotos autorizadas.

## Endpoints administrativos (`ADMIN`)

- `GET /api/v1/admin/dashboard/summary`: contagem de empresas, motoristas, usuarios ativos/inativos e demandas por status.
- `GET /api/v1/admin/users?page=&limit=&q=&tipo=&situacao=`: pesquisa, filtros e paginacao.
- `GET /api/v1/admin/users/:id`: dados cadastrais sem senha/hash.
- `PATCH /api/v1/admin/users/:id/status` com `{ "status": true|false }`: ativa/inativa preservando dados; invalida sessoes ao inativar. Bloqueia auto-inativacao e a inativacao do ultimo administrador ativo.
- `GET /api/v1/admin/demands?page=&limit=&status=&empresaId=` e `GET /api/v1/admin/demands/:id`: consulta sem alterar historico ou operacoes.

## Foto do motorista

- `POST /api/v1/auth/register/driver`: aceita JSON usual ou multipart com campo opcional `fotoPerfil` e `veiculos` em JSON.
- `GET /api/v1/drivers/me/photo`: foto do proprio motorista.
- `PUT /api/v1/drivers/me/photo`: multipart com `fotoPerfil`, substitui a imagem anterior.
- `GET /api/v1/drivers/:id/photo`: somente ADMIN, o proprio motorista ou empresa autorizada. Empresas podem acessar perfil disponivel ou perfil ligado a interesse da empresa.

Imagens aceitas: JPG/JPEG e PNG; limite de 5 MB. MIME e conteudo sao verificados no servidor. Os nomes de arquivo sao UUID e os arquivos ficam fora da raiz publica. Configure `DRIVER_PHOTO_STORAGE_DIR`; o armazenamento padrao fica em `backend/storage/private/driver-photos`.

## Finalizacao obrigatoria

`POST /api/v1/drivers/me/services/:id/complete` exige multipart com `comprovante`, `dataEntrega` (YYYY-MM-DD), `horarioEntrega` (HH:mm), `nomeRecebedor` e `observacoes` (1 a 2.000 caracteres apos trim). O motorista autenticado deve ser responsavel pelo interesse aceito e a demanda deve estar `EM_ANDAMENTO`. Transacao e restricoes unicas impedem finalizacao duplicada. A empresa contratante, motorista responsavel e ADMIN consultam comprovante e dados da conclusao.

## Migracoes MySQL 8

Em bancos existentes, executar em ordem, apos as migracoes anteriores:

1. `database/migrations/20261123_004_add_driver_profile_photo.sql`
2. `database/migrations/20261123_005_require_delivery_observations.sql`

A primeira adiciona coluna nullable, preservando cadastros anteriores. A segunda preenche observacoes vazias existentes com `Nao informado no registro anterior` e depois aplica `NOT NULL`. `database/01_schema.sql` ja representa o schema final.

## Provisionar ADMIN em ambiente local

Nao existe cadastro publico de ADMIN. Em terminal local configure `NODE_ENV=development`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (12 caracteres ou mais) e execute `cd backend; npm run admin:provision`. O script usa o hash scrypt existente, recusa producao e nao promove emails ja cadastrados. Nao salvar credenciais em arquivos versionados.