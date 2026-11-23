# BioCargo

Plataforma web para conectar empresas a motoristas PJ qualificados para transporte biológico. O projeto usa React 19 e Vite no frontend, Node.js/Express no backend e MySQL 8. O backend expõe a API sob `/api/v1` na porta `3000`; durante o desenvolvimento, o Vite encaminha `/api` para essa porta.

## Requisitos

- Git
- Node.js `^20.19.0` ou `>=22.12.0` e npm (requisito do Vite 8 usado pelo projeto)
- MySQL 8 em execução

## Clonar o projeto

Substitua `<URL_DO_REPOSITORIO>` pela URL fornecida pela equipe:

```bash
git clone <URL_DO_REPOSITORIO>
cd BioCargo
```

## Preparar o banco de dados

1. Inicie o servidor MySQL 8.
2. Execute `database/01_schema.sql` com uma conta autorizada a criar o banco `biocargo` e suas tabelas. Por exemplo, pelo cliente MySQL:

   ```bash
   mysql -u root -p < database/01_schema.sql
   ```

   No Windows PowerShell, se o redirecionamento do arquivo não funcionar com seu cliente, abra o script em uma ferramenta MySQL e execute seu conteúdo.

O script cria e seleciona o banco `biocargo`. Ele contém o esquema atual do projeto. Execute-o em um banco de desenvolvimento adequado; não é um script de migração para preservar dados existentes.

## Configurar e executar o backend

Em um terminal, a partir da raiz do repositório:

```bash
cd backend
npm ci
```

Crie `backend/.env` copiando `backend/.env.example` e configure os valores para seu MySQL local:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=biocargo
PORT=3000
SESSION_SECRET=seu_segredo_local_longo_e_aleatorio
CORS_ORIGINS=
```

Use um segredo próprio e aleatório para `SESSION_SECRET`; não reutilize o valor de exemplo nem compartilhe o arquivo `.env`. O arquivo está ignorado pelo Git.

Inicie a API:

```bash
npm run dev
```

O servidor inicia em `http://localhost:3000`. `npm start` executa o servidor sem o modo de observação.

## Configurar e executar o frontend

Em outro terminal, a partir da raiz:

```bash
cd frontend
npm ci
npm run dev
```

Abra o endereço local informado pelo Vite (normalmente `http://localhost:5173`). O proxy de desenvolvimento encaminha requisições `/api` para `http://localhost:3000`; mantenha o backend em execução para usar cadastro e login integrados.

### Banco MySQL local provisório

Neste computador, o MySQL 8 pode ser executado sem iniciar o serviço Windows, usando a porta `3307` e os dados em `.local/mysql-data` (pasta ignorada pelo Git). O backend lê a conexão de `backend/.env`, também ignorado pelo Git. Para reiniciar o servidor local depois que ele for encerrado:

```powershell
cd backend
npm run db:start:local
```

O schema isolado se chama `biocargo_test_local`; o `.env` local já está configurado para ele. Os dados de teste não são enviados ao repositório.

Para gerar o build do frontend:

```bash
npm run build
```

## Estado atual

Estão implementados no backend cadastro de empresa e motorista PJ, login com sessão persistida no MySQL, consulta da sessão atual, logout, verificação de saúde da API/conexão com banco, consulta/atualização dos próprios perfis, gestão de veículos e qualificações, disponibilidade, busca, interesses e inativação administrativa. Rotas protegidas exigem sessão ativa e o tipo de conta correspondente. O teste específico do logout ainda está pendente. Para origens diferentes no mesmo site, configure `CORS_ORIGINS` com origens exatas separadas por vírgula; sem configuração, use same-origin/Vite proxy. Uma implantação cross-site precisa de política adicional de cookie e CSRF.

O contrato de endpoints e seus status está em [`docs/05_contrato_api_endpoints.md`](docs/05_contrato_api_endpoints.md). O estado e as instruções de transferência do backend estão em [`docs/06_handoff_backend_rafael.md`](docs/06_handoff_backend_rafael.md).

### Dashboard da empresa

Após login com uma conta `EMPRESA`, o frontend abre `/empresa`. O painel usa a sessão atual e dados reais da API. Em bancos já criados, aplique as migrações pendentes em ordem; a migração `20261123_002_create_demanda.sql` cria `demanda` e relaciona `interesse.demanda_id`.

## Contas locais de teste

O seed cria contas fictícias somente quando `NODE_ENV` está definido como `development` ou `test`. Configure `NODE_ENV=development` no `backend/.env` e, dentro da pasta `backend`, execute:

```bash
npm run seed:test
```

O seed é idempotente: se e-mail ou documento já estiver cadastrado, ele ignora a conta existente e não altera nem remove registros. As senhas são armazenadas com o mesmo hash `scrypt` usado pelo login. Nunca execute em produção.

Credenciais exclusivas para testes locais:

| Perfil | E-mail | CNPJ | CPF | Senha |
|---|---|---|---|---|
| Empresa | `empresa.teste@biocargo.local` | `00000000000191` | — | `BioCargo@123` |
| Motorista PJ | `motorista.teste@biocargo.local` | `00000000000272` | `00000000191` | `BioCargo@123` |

## Painel administrativo e fotos de motorista

- O painel `ADMIN` fica em `/admin` e usa dados reais da API; os endpoints administrativos aceitam apenas sessao `ADMIN`.
- Para provisionar um administrador local, configure `NODE_ENV=development`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (minimo de 12 caracteres) no ambiente do terminal e execute `cd backend; npm run admin:provision`. O script nao promove usuarios existentes e nao grava credenciais no repositorio.
- A foto de perfil do motorista e opcional, JPG/JPEG/PNG ate 5 MB. Os arquivos sao privados; configure `DRIVER_PHOTO_STORAGE_DIR` para o diretorio local de armazenamento. Empresas veem fotos apenas de prestadores disponiveis ou com interesse relacionado.
- A conclusao de transporte exige comprovante de imagem, data, horario, nome de recebedor e observacoes nao vazias. A migracao `20261123_005_require_delivery_observations.sql` preenche registros antigos sem observacao com texto de legado antes de impor `NOT NULL`.
- Para bancos existentes, aplique em ordem as migracoes `20261123_004_add_driver_profile_photo.sql` e `20261123_005_require_delivery_observations.sql` apos as migracoes anteriores. As migracoes versionadas usam o banco `biocargo`.
- Contrato dos novos endpoints: [`docs/07_admin_fotos_conclusao.md`](docs/07_admin_fotos_conclusao.md).