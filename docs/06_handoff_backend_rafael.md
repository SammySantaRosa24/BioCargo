# Handoff técnico do backend — BioCargo

**Destinatário:** Rafael Alvarenga  
**Objetivo:** transferir a Rafael o estado atual do backend, os procedimentos para executá-lo e o trabalho ainda pendente.

Este documento descreve o estado do repositório atualizado em 16/11/2026. O código é a referência para o que já existe; funcionalidades apenas documentadas como planejadas não devem ser tratadas como implementadas. Regras de negócio aprovadas são separadas das decisões técnicas ainda pendentes.

## 1. Identificação e objetivo do projeto

O BioCargo é uma plataforma web para conectar empresas que precisam de serviços de transporte biológico a motoristas PJ qualificados e com veículos adequados. O backend deverá receber as requisições do frontend, validar dados e permissões, aplicar as regras de negócio e persistir os registros no MySQL 8.

O MVP prevê cadastro e autenticação de empresas e motoristas, perfis, veículos, qualificações, busca de motoristas e veículos e demonstração de interesse. Cadastro, login, sessão, consulta da sessão, health check, perfis próprios, veículos, qualificações, disponibilidade, busca, interesses e inativação administrativa estão implementados. O contrato está em [`05_contrato_api_endpoints.md`](./05_contrato_api_endpoints.md).

## 2. Escopo do MVP

### Implementado no backend atual

- Cadastro público de empresa e motorista PJ, com gravações de usuário e perfil dentro de transação.
- Login compartilhado, hash de senha com `scrypt`, normalização de e-mail e recusa de contas inativas.
- Sessão persistida pelo `express-session` e `express-mysql-session`.
- Consulta da identidade da sessão em `GET /api/v1/auth/me`.
- Endpoint de logout que destrói a sessão e limpa o cookie; **o teste de logout ainda está pendente**.
- Verificação de API e conexão MySQL em `GET /api/v1/health`.
- Consulta e atualização do próprio perfil em `GET/PATCH /api/v1/companies/me` e `GET/PATCH /api/v1/drivers/me`, com autorização por sessão ativa e tipo de conta.
- Cadastro, listagem, consulta individual, edição e disponibilidade de veículos do motorista autenticado; consultas e atualizações verificam propriedade.
- Cadastro, listagem e atualização de qualificações do motorista proprietário.
- Busca de motoristas para empresas com filtros de veículos e qualificações; respostas minimizadas e paginadas.
- Criação e consulta de interesses, respostas, cancelamentos e expiração; estados ativos duplicados são bloqueados.
- Inativação lógica de usuários por `ADMIN`, com remoção das sessões persistidas.
- Integração do frontend com cadastro e login; build do frontend executado com sucesso, conforme validação informada pela equipe.

### Pendências do MVP

- Validar as rotas recém-implementadas contra MySQL 8 e concluir o teste específico de logout.
- Provisionar a primeira conta `ADMIN` por procedimento seguro fora do cadastro público.

### Fora do escopo aprovado ou sem requisitos suficientes

- Cadastro público de `ADMIN`.
- Exclusão física de usuários ou registros históricos no fluxo normal.
- Endpoints de exclusão de veículos ou qualificações; veículos podem ser desativados pelo campo `ativo`, sem exclusão do registro.
- Funcionalidades não descritas no esquema ou contrato, como pagamentos, rastreamento em tempo real, mensagens ou outros módulos. Qualquer ampliação exige alinhamento prévio.
- Painel ou operações administrativas além da inativação de usuário, até que seus requisitos sejam aprovados.

## 3. Estado atual do repositório

### Documentação e banco

- O `README.md` da raiz contém instruções para clonar, preparar o banco, configurar o ambiente e executar frontend e backend.
- O esquema MySQL está registrado em `database/01_schema.sql`.
- O dicionário de dados, relacionamentos, arquitetura e contrato estão em `database/02_dicionario_dados.md`, `database/03_relacionamentos.md`, `docs/04_arquitetura_geral.md` e `docs/05_contrato_api_endpoints.md`.
- O backend contém `src/server.js`, `src/config/database.js`, `package.json`, lockfile e `.env.example`. O arquivo local `backend/.env` existe, é ignorado pelo Git e não deve ser compartilhado.

### Frontend

O frontend usa React, JavaScript, Vite, React Router DOM e CSS puro. As rotas existentes são `/`, `/login`, `/cadastro`, `/cadastro/empresa` e `/cadastro/motorista`; a rota curinga retorna à landing page.

Já existem landing page, navegação, tela de login, escolha do tipo de cadastro e formulários de empresa e motorista PJ. Cadastro e login chamam o backend. A validação local contempla CPF, CNPJ numérico/alfanumérico e confirmação de senha; e-mail usa os atributos HTML `type="email"` e `required`. Não há estado de sessão frontend, rotas autenticadas ou dashboards.

Campos relevantes dos formulários existentes:

- **Empresa:** `razaoSocial`, `nomeFantasia`, `cnpj`, `telefone`, `email`, senha e confirmação.
- **Motorista:** `nomeCompleto`, `cpf`, `cnpj`, `telefone`, `email`, senha e confirmação.
- **Login:** `email` e senha.

O formulário envia `nomeCompleto`, que o backend grava em `motorista.nome`; envia `senha`, sem enviar a confirmação de senha.

### Execução local

1. Crie `backend/.env` a partir de `backend/.env.example` e informe acesso ao MySQL local e um `SESSION_SECRET` próprio. Não compartilhe `.env`.
2. Execute `database/01_schema.sql` em um MySQL 8 compatível, com permissão para criar `biocargo` e suas tabelas.
3. Em `backend/`, rode `npm ci` e depois `npm run dev`. A API escuta na porta `3000`.
4. Em outro terminal, em `frontend/`, rode `npm ci` e `npm run dev`. O proxy Vite envia `/api` para `http://localhost:3000`.

O README da raiz contém os mesmos passos. `npm start` inicia o backend sem o modo watch.

## 4. Tecnologias e arquitetura planejada

| Parte | Tecnologia | Situação/responsabilidade |
|---|---|---|
| Frontend | React 19, JavaScript, Vite, React Router DOM, CSS puro | Implementado parcialmente; interface, cadastro e login integrados. |
| Backend | Node.js, Express, JavaScript | Cadastro, login, sessões, perfis, veículos, qualificações, busca, interesses, administração e health check implementados. |
| Persistência | MySQL 8 | Banco existente; esquema documentado em `database/01_schema.sql`. |
| Comunicação | API REST com JSON | `/api/v1`; cadastro/login integrados e endpoints do MVP implementados. |

A arquitetura é uma aplicação única, sem microserviços. O navegador comunica-se com a API; somente o backend acessa o MySQL. O acesso ao banco usa `mysql2/promise`; sessões usam `express-session` e `express-mysql-session`. Não há biblioteca de validação declarada.

## 5. Estrutura atual e expansão sugerida

Estrutura atualmente existente:

```text
backend/
├── src/
│   ├── config/database.js
│   └── server.js         # Express, sessão e endpoints atuais
├── .env.example
├── package.json
└── package-lock.json
```

O backend atual concentra rotas, handlers e configuração Express em `server.js`. Uma futura reorganização por camadas pode ser feita ao ampliar os módulos, sem ser requisito desta transferência.

Responsabilidades recomendadas para eventual expansão:

- **Routes:** registram URL, método e middlewares e conectam ao controller.
- **Controllers:** interpretam requisições e formam respostas HTTP; não concentram SQL nem regras de domínio.
- **Services:** aplicam autorização contextual e regras do negócio; coordenam operações relacionadas.
- **Repositories:** encapsulam SQL e mapeamento de dados; usam parâmetros e respeitam FKs e `UNIQUE`.
- **Middlewares/configuração/validações:** verificam sessão e perfil, validam entrada, centralizam erros e carregam configurações sem expor segredos.

## 6. Banco e relacionamentos

O esquema contém seis tabelas. O backend deve manter seus nomes e relações atuais, sem presumir colunas além das declaradas.

| Tabela | Função e relação |
|---|---|
| `usuario` | Credenciais, tipo (`EMPRESA`, `MOTORISTA`, `ADMIN`), status e data de cadastro. E-mail tem `UNIQUE`. |
| `empresa` | Perfil empresarial ligado a um usuário por `usuario_id`, único nesta tabela. CNPJ obrigatório e único dentro de `empresa`. |
| `motorista` | Perfil PJ ligado a um usuário por `usuario_id`, único nesta tabela. CPF e CNPJ obrigatórios e únicos dentro de `motorista`; inclui `disponivel`. |
| `qualificacao` | Várias qualificações podem pertencer a um motorista por `motorista_id`. |
| `veiculo` | Vários veículos podem pertencer a um motorista por `motorista_id`; placa e RENAVAM têm `UNIQUE` próprios; inclui `disponivel` e `ativo`. |
| `interesse` | Referencia uma empresa e um motorista; `veiculo_id` é opcional. Status SQL: `PENDENTE`, `ACEITO`, `RECUSADO`, `EXPIRADO`, `CANCELADO`; inclui prazo e metadados de cancelamento. |

As FKs confirmam a existência dos registros relacionados. Elas não garantem correspondência entre `usuario.tipo_usuario` e a tabela de perfil, propriedade do veículo em relação ao motorista do interesse, CNPJ global entre as duas tabelas ou exclusividade entre os perfis.

## 7. Regras de negócio e responsabilidades do backend

### Regras aprovadas

- E-mail único para login.
- CNPJ obrigatório e globalmente único entre empresa e motorista.
- Um usuário só pode ter perfil `EMPRESA` ou `MOTORISTA`, nunca ambos.
- `ADMIN` é tipo de usuário, sem tabela própria; cadastro público não pode criar `ADMIN`.
- Motorista pode possuir vários veículos e várias qualificações.
- Veículo associado a interesse deve pertencer ao motorista indicado; na criação com veículo, este deve existir, estar ativo e disponível.
- A empresa cancela somente interesses pendentes, sem justificativa; o motorista cancela somente interesses aceitos, com justificativa obrigatória. Interesse pendente expira após 24 horas sem resposta. Recusados, expirados e cancelados permanecem no histórico; nova solicitação pode ser criada após esses estados se o motorista estiver disponível.
- Inativação é lógica: bloqueia acesso, preserva registros e histórico e invalida sessões ativas.
- O fluxo normal não realiza exclusões físicas de usuários ou registros históricos.

### Aplicação no backend

- Validar entrada novamente no servidor; validação de frontend é somente apoio de interface.
- Normalizar e-mail removendo espaços externos e convertendo para minúsculas; aplicar a mesma forma no cadastro, login e validação de unicidade.
- Criar usuário e perfil correspondente de forma consistente, usando transação para gravações relacionadas.
- Não aceitar tipo `ADMIN` nos endpoints públicos de cadastro.
- Aplicar autorização por perfil e propriedade em cada rota protegida; derivar a identidade do solicitante pela sessão.
- Em interesse, obter `empresaId` da sessão. `motoristaId` identifica o destinatário e `veiculoId` é opcional; validar que o veículo existe, está ativo e disponível e pertence ao motorista indicado.
- Na busca, retornar por padrão somente contas ativas (`usuario.status = TRUE`), motoristas disponíveis (`motorista.disponivel = TRUE`) e veículos ativos (`veiculo.ativo = TRUE`). Distinguir esses estados da disponibilidade individual do veículo (`veiculo.disponivel`).
- Os campos dos veículos que serão exibidos às empresas na busca ainda precisam ser definidos e validados durante a implementação. Não exponha dados sensíveis sem aprovação.
- Na inativação administrativa, definir `usuario.status = FALSE`, bloquear login e rotas protegidas e invalidar sessões ativas sem apagar histórico.
- Usar consultas parametrizadas, tratar violações de unicidade como conflitos e não expor SQL, stack traces ou dados sensíveis.

O SQL impõe `UNIQUE` separado para CNPJ de empresa e motorista e para `usuario_id` de cada perfil. Não impõe unicidade global de CNPJ nem exclusividade de perfil. A validação deve considerar requisições concorrentes; não há estratégia aprovada ainda.

## 8. Referência do contrato de API

Usar [`05_contrato_api_endpoints.md`](./05_contrato_api_endpoints.md) para distinguir o comportamento dos endpoints existentes das propostas ainda não implementadas.

Endpoints implementados atualmente:

- Cadastro: `POST /api/v1/auth/register/company` e `POST /api/v1/auth/register/driver`.
- Sessão: `POST /api/v1/auth/login`, `GET /api/v1/auth/me` e `POST /api/v1/auth/logout` (logout ainda sem teste).
- Saúde: `GET /api/v1/health`.
- Perfis: `GET/PATCH /api/v1/companies/me` e `GET/PATCH /api/v1/drivers/me`.
- Veículos: `POST/GET /api/v1/drivers/me/vehicles`, `GET/PATCH /api/v1/vehicles/:id` e `PATCH /api/v1/vehicles/:id/availability`.
- Qualificações: `POST/GET /api/v1/drivers/me/qualifications` e `PATCH /api/v1/qualifications/:id`.
- Busca: `GET /api/v1/drivers`, somente para empresa; filtra por veículo/qualificação e retorna informações minimizadas. Não há localização no schema.
- Interesses: `POST /api/v1/interests`, listas por empresa/motorista, consulta individual, aceite, recusa e cancelamento.
- Administração: `PATCH /api/v1/admin/users/:id/status`; apenas `ADMIN` ativo pode inativar outra conta.

O prefixo proposto é `/api/v1`; corpos e respostas são JSON com nomes de propriedades `camelCase`. Datas da API usam ISO 8601 UTC; o frontend converte para horário local na apresentação.

## 9. Autenticação, autorização, sessões e segurança

- **Autenticação:** login compartilhado por e-mail e senha; o backend verifica a senha com `scrypt` e recusa conta inativa.
- **Autorização:** perfis `EMPRESA`, `MOTORISTA` e `ADMIN`; todas as rotas protegidas revalidam sessão, conta e tipo no servidor, e verificam a propriedade quando necessário.
- **Sessões:** a sessão persistida em MySQL já existe; a rota administrativa remove as sessões da conta inativada. O logout está implementado, mas ainda precisa de teste; renovação de sessão permanece pendente.
- **Senhas:** login/cadastro atuais usam `scrypt` com salt aleatório e não devolvem a senha/hash. Revisar tratamento de erros/logs ao ampliar os handlers.
- **E-mail:** normalizar antes de persistir e consultar. Charset/collation atuais e dados de e-mail existentes precisam ser verificados para alinhar `UNIQUE` à comparação sem distinção de caixa.
- **Dados pessoais:** não expor CPF, CNPJ, e-mail, telefone, senha, placa ou RENAVAM nos resultados de busca. Campos públicos restantes, inclusive exibição de nome, precisam de aprovação.
- **SQL:** usar consultas parametrizadas. Usar transações quando o fluxo depender de gravações relacionadas.
- **Erros:** handlers retornam mensagens genéricas sem SQL ou stack trace; conflito de unicidade não revela informação além do necessário.
- **CORS:** same-origin funciona sem configuração; origens diferentes precisam estar explicitamente listadas em `CORS_ORIGINS`.

Para datas, API usa UTC em ISO 8601 (`Z`). O tipo SQL `DATETIME` não registra fuso; a conexão MySQL deve ser configurada em UTC ou o backend deve fazer conversões explícitas, sem mudar o esquema nesta etapa. A apresentação local ocorre no frontend.

## 10. Erros e validações

Convenção de erros aplicada aos endpoints atuais. Os handlers retornam `{ "message": "..." }` para falhas e não usam um envelope de erro uniforme:

| HTTP | Uso esperado |
|---|---|
| `200` | Consulta/atualização com conteúdo; login e logout atuais também retornam `200`. |
| `201` | Recurso criado. |
| `204` | Sucesso sem corpo; não é usado pelo logout atual. |
| `400` | JSON malformado, parâmetros inválidos ou campos obrigatórios ausentes. |
| `401` | Credencial ausente/inválida/expirada ou login recusado; mensagem genérica para credencial inválida ou conta inativa. |
| `403` | Perfil ou propriedade sem autorização. |
| `404` | Rota ou recurso inexistente. |
| `409` | Conflito de unicidade ou estado. |
| `422` | Dados bem formados que falham validação de domínio. |
| `500` | Erro inesperado, sem stack trace na resposta. |

Validar tipos, campos permitidos e tamanhos; CNPJ/CPF, e-mail, placa e RENAVAM; disponibilidade, ativação e propriedade de veículo em interesse; perfil e status da conta. A implementação bloqueia duplicidade de interesses `PENDENTE` ou `ACEITO` para o mesmo par empresa/motorista.

## 11. Pendências técnicas

Não decidir unilateralmente os itens abaixo; alinhar com Samy antes de fechar a implementação:

1. Renovação de sessão em produção além da duração atual de 24 horas. O logout existe, mas ainda precisa ser testado contra MySQL real.
2. Acesso atual usa `mysql2/promise`; validar uso de pool/transações com MySQL 8.
3. Estratégia concorrente para CNPJ globalmente único e perfil exclusivo, sem garantia equivalente no esquema atual.
4. Normalização, collation e tratamento dos e-mails já existentes.
5. Configuração UTC da conexão MySQL ou conversões para os demais campos `DATETIME`.
6. Provisionamento da primeira conta `ADMIN`.
7. Política de inativação individual de qualificações; `veiculo.ativo` permite desativação lógica de veículos.
8. Aprovação de produto sobre exibição do nome do motorista na busca; hoje ele é omitido.
9. Campos de perfil editáveis, incluindo alteração de e-mail/documentos.
10. Preencher `CORS_ORIGINS` com as origens exatas ao implantar frontend e API em origens distintas.

## 12. Plano sugerido de continuidade

1. **Validar com MySQL 8:** executar testes dos fluxos implementados com o banco local, especialmente CRUD de veículos, interesses, sessão e inativação.
2. **Completar testes do que existe:** testar logout, incluindo remoção do cookie e confirmação de que a sessão encerrada não é reutilizada.
3. **Provisionar a primeira conta `ADMIN`** por procedimento seguro e restrito.
4. **Alinhar com o frontend:** avaliar as telas de perfil, veículos, qualificações, busca e interesses sem alterar interfaces sem necessidade.
5. **Verificar e entregar:** ampliar cobertura dos cenários de concorrência, privacidade e fluxos ponta a ponta; atualizar documentação final.

## 13. Critérios de conclusão e testes

Critérios mínimos para considerar o backend do MVP pronto para integração final:

- Cadastro de empresa e motorista cria `usuario` e perfil correto sem aceitar `ADMIN` público; falha parcial não deixa cadastro inconsistente.
- Login funciona com normalização acordada; credenciais incorretas e contas inativas não autenticam.
- Inativação por ADMIN autorizado define `status = FALSE`, bloqueia acesso, invalida sessões ativas e mantém os registros relacionados.
- A API impede perfil duplo e CNPJ repetido globalmente inclusive em cenários concorrentes, conforme estratégia aprovada.
- Motorista só gerencia os próprios veículos e qualificações.
- Busca exclui conta inativa e motorista indisponível; filtros e campos retornados obedecem às decisões de privacidade.
- Busca e seleção de veículo excluem veículos inativos.
- Interesse só é criado pela empresa autenticada; o motorista deve estar disponível e o veículo opcional deve existir, estar ativo, disponível e pertencer ao motorista indicado.
- O prazo de resposta é registrado em 24 horas; expiração, aceite, recusa e cancelamentos seguem as regras aprovadas e preservam o histórico.
- Erros seguem o formato e status acordados; respostas/logs não vazam senha, hash, SQL ou dados privados indevidos.
- Datas são serializadas em UTC e apresentadas localmente pelo frontend.
- Formulários React estão conectados ao contrato; erros do servidor são associados corretamente aos campos e estados da interface.

Conforme validação manual informada por Samy, cadastro de empresa/motorista e login já foram testados com sucesso; a sessão persistida e o build do frontend também foram verificados. O teste de logout segue pendente. Os itens abaixo são cenários complementares recomendados além das verificações já realizadas:

- Unitários para normalização e validação de entrada e regras de domínio.
- Integração MySQL para constraints, transações, unicidade e rollback.
- Integração HTTP para status, payloads, autorização por perfil/propriedade e erros.
- Concorrência para CNPJ global e exclusividade de perfil.
- Sessão: conta ativa/inativa, invalidação após operação administrativa e acesso protegido.
- Busca: combinações de status da conta, disponibilidade do motorista/veículo e filtros aprovados.
- Interesse: `veiculoId` ausente, válido, indisponível, inexistente ou pertencente a outro motorista.
- Ponta a ponta complementar dos formulários de cadastro/login e dos demais fluxos definidos no MVP, cobrindo cenários além dos testes manuais já realizados.

## 14. Divisão de responsabilidades e prazo

Prazo informado para o MVP: **23/11/2026**.

| Responsável | Responsabilidade |
|---|---|
| Samy | Frontend e banco de dados; alinhar decisões de produto e regras que impactem o contrato/esquema. |
| Rafael | Backend e API, autenticação e regras no servidor. |
| Samy e Rafael | Integração final, testes finais, deploy, documentação final e apresentação. |

## 15. Integração com o frontend existente

- Preservar as rotas públicas atuais: `/`, `/login`, `/cadastro`, `/cadastro/empresa`, `/cadastro/motorista`.
- Os serviços HTTP atuais em `frontend/src/services/api.js` conectam cadastro e login por `/api/v1`; cadastro envia e-mail e documentos normalizados e a confirmação de senha permanece validação local.
- Cadastro de motorista envia `nomeCompleto`; o backend atual grava esse valor em `motorista.nome`. O campo `password` do formulário é enviado como `senha`; `confirmPassword` não é enviado.
- A validação no backend é obrigatória mesmo quando o formulário já valida CPF/CNPJ.
- Exibir erros `409` de e-mail/documentos duplicados e `422` de validação nos campos correspondentes sem revelar dados de outra conta.
- O login envia `credentials: 'include'` para receber o cookie de sessão. Não há estado de sessão no frontend nem rotas protegidas; autorização de novas rotas permanece responsabilidade do backend.
- Coordenar entre ambos a integração dos formulários existentes com novos endpoints; Samy mantém frontend/banco e Rafael mantém backend/API.

## Referências consultadas

- `README.md` (raiz; instruções de execução local).
- `database/01_schema.sql`.
- `database/02_dicionario_dados.md`.
- `database/03_relacionamentos.md`.
- `docs/04_arquitetura_geral.md`.
- `docs/05_contrato_api_endpoints.md`.
- Estrutura e arquivos atuais em `backend/` e `frontend/`, incluindo configuração, endpoints existentes e integração dos formulários de cadastro/login.

**Este handoff registra o estado atual do backend.** As decisões listadas na seção 11 permanecem pendentes de alinhamento; os endpoints descritos como implementados já possuem testes automatizados com banco simulado, mas aguardam validação contra MySQL 8 local. O teste específico de logout também está pendente.
