# Contrato da API REST — BioCargo

> **Status:** este documento separa os endpoints atualmente implementados das propostas ainda não implementadas. A existência de uma especificação abaixo não significa que o endpoint ou a funcionalidade estejam disponíveis.

## 1. Objetivo e convenções

Este documento registra o comportamento observado nos endpoints existentes e preserva as propostas para as operações futuras do MVP. O frontend já integra cadastro e login; consulte o status indicado em cada seção para a implementação atual.

### URLs e JSON

- Prefixo proposto: `/api/v1`.
- Corpo e respostas em JSON com `Content-Type: application/json`.
- Nomes de propriedades da API em `camelCase`; os nomes de colunas MySQL permanecem conforme `01_schema.sql` e o backend faz o mapeamento.
- Datas e horários da API usam ISO 8601 em UTC, com sufixo `Z`; o frontend converte para o horário local somente na apresentação. Como `DATETIME` não guarda fuso, o backend deve configurar a conexão MySQL para UTC ou fazer conversões explícitas para manter gravação e leitura em UTC, sem alterar o esquema nesta etapa.
- E-mails são normalizados removendo espaços externos e convertendo para minúsculas. A mesma normalização deve ser aplicada no cadastro, login e validação de unicidade, para que a comparação não diferencie maiúsculas de minúsculas.
- Identificadores de registros são gerados pelo banco. Em operações próprias, a identidade do usuário/perfil é derivada da sessão. Na criação de interesse, `motoristaId` identifica o motorista-alvo e `veiculoId` é opcional; esses IDs não definem a identidade da empresa solicitante.
- Nas tabelas de campos abaixo, **Obrigatório** significa necessário para a operação descrita; **Opcional** significa que pode ser omitido. Propriedade opcional omitida não equivale automaticamente a `null`, salvo quando indicado.

### Envelope de resposta

Sucesso com conteúdo:

```json
{
  "data": {}
}
```

Listas paginadas usam o envelope proposto:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

Os valores de paginação são uma proposta inicial e precisam ser confirmados antes da implementação.

## 2. Autenticação

O cadastro público só cria usuários `EMPRESA` ou `MOTORISTA`. Não há endpoint de cadastro público como `ADMIN`. O perfil é determinado pela rota e validado no servidor.

### Endpoints implementados

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `POST /api/v1/auth/register/company` | Cadastrar usuário e perfil de empresa em transação. | Visitante | `razaoSocial`, `cnpj`, `email`, `senha`; `nomeFantasia` e `telefone` opcionais. | `201 Created`, IDs do usuário e da empresa. | `400` para campos obrigatórios ausentes; `409` para duplicidade; `500` para erro inesperado. |
| `POST /api/v1/auth/register/driver` | Cadastrar usuário e perfil de motorista PJ em transação. | Visitante | `nomeCompleto`, `cpf`, `cnpj`, `email`, `senha`; `telefone` opcional. | `201 Created`, IDs do usuário e do motorista. | `400` para campos obrigatórios ausentes; `409` para duplicidade; `500` para erro inesperado. |
| `POST /api/v1/auth/login` | Verificar credenciais e iniciar sessão persistida no MySQL. | Visitante | `email`, `senha`. | `200 OK`, identidade em `data.usuario`; o cookie de sessão é enviado pelo servidor. | `400` para campos ausentes; `401` para e-mail/senha inválidos; `403` para conta inativa; `500` para erro inesperado. |
| `GET /api/v1/auth/me` | Consultar a identidade armazenada na sessão atual. | Com sessão válida | Sem parâmetros. | `200 OK`, `data.usuario` com `id`, `email` e `tipoUsuario`. | `401` sem identidade de sessão. |
| `POST /api/v1/auth/logout` | Destruir a sessão atual e limpar o cookie `biocargo.sid`. | Sem verificação de autenticação na rota | Sem corpo. | `200 OK` com mensagem de sucesso. | `500` se houver falha ao destruir a sessão. **Implementado; teste ainda pendente.** |
| `GET /api/v1/health` | Verificar a API e a conexão com o MySQL (`SELECT 1`). | Público | Sem parâmetros. | `200 OK` com `status: "OK"` e banco conectado. | `500` com API em execução e banco indisponível. |

Cadastro e login foram integrados ao frontend e testados, assim como a persistência da sessão. O teste de logout permanece pendente. O login normaliza e-mail com espaços externos removidos e letras minúsculas. Senhas são armazenadas como derivação `scrypt` com salt aleatório; não são retornadas na resposta. A sessão usa `express-session` e `express-mysql-session`, cookie `biocargo.sid`, `httpOnly`, `sameSite: 'lax'`, `secure` em produção e duração configurada de 24 horas.

As respostas e status acima refletem o código atual, não uma promessa de cobertura completa de validação. O servidor valida a presença/tipo de alguns campos obrigatórios, mas não implementa todas as validações de domínio ou formatos propostas neste documento.

### Endpoints ainda planejados

As propostas para busca, qualificações, interesses e administração nas seções seguintes são referência de escopo e contrato futuro. Perfis próprios e gestão de veículos estão implementados, conforme as seções 3 a 5.

### Cadastro de empresa

O formulário existente contém `razaoSocial`, `nomeFantasia`, `cnpj`, `telefone`, `email`, `password` e `confirmPassword`. O frontend envia `senha`; a confirmação é validada localmente e não é enviada. `nomeFantasia` e `telefone` são opcionais para o servidor.

```json
{
  "razaoSocial": "<razao social>",
  "nomeFantasia": "<nome fantasia opcional>",
  "cnpj": "<cnpj>",
  "telefone": "<telefone opcional>",
  "email": "<email>",
  "senha": "<senha>"
}
```

Resposta `201` atual:

```json
{
  "data": {
    "usuario": { "id": 101, "tipoUsuario": "EMPRESA" },
    "empresa": { "id": 201 }
  }
}
```

### Cadastro de motorista PJ

O formulário e o servidor usam `nomeCompleto`; o backend grava esse valor em `motorista.nome`. A API recebe `senha` e não recebe `confirmPassword`.

```json
{
  "nomeCompleto": "<nome completo>",
  "cpf": "<cpf>",
  "cnpj": "<cnpj>",
  "telefone": "<telefone opcional>",
  "email": "<email>",
  "senha": "<senha>"
}
```

Resposta `201` atual:

```json
{
  "data": {
    "usuario": { "id": 102, "tipoUsuario": "MOTORISTA" },
    "motorista": { "id": 202 }
  }
}
```

### Login e identidade

Entrada do login, compatível com os campos atuais da página:

```json
{
  "email": "<email>",
  "senha": "<senha>"
}
```

Resposta `200` atual (a sessão é transportada pelo cookie HTTP, sem campo `sessao` no JSON):

```json
{
  "data": {
    "usuario": { "id": 101, "email": "<email>", "tipoUsuario": "EMPRESA" }
  }
}
```

`GET /api/v1/auth/me` retorna a identidade guardada na sessão, sem senha:

```json
{
  "data": {
    "usuario": { "id": 101, "email": "<email>", "tipoUsuario": "EMPRESA" }
  }
}
```

## 3. Empresas

**Status da Etapa A:** `GET` e `PATCH /api/v1/companies/me` estão implementados. Exigem sessão ativa de uma conta `EMPRESA`; o perfil é localizado pelo ID do usuário autenticado. `PATCH` aceita um objeto com ao menos um campo permitido, valida tipos e comprimentos, aceita `null` para limpar `nomeFantasia` ou `telefone`, verifica CNPJ existente e retorna o perfil atualizado em `data`. Campos desconhecidos ou tipos incorretos recebem `400`; valores de texto incompatíveis recebem `422`; conflito de CNPJ recebe `409`. O usuário não pode informar `usuarioId`.

O endpoint `me` resolve a empresa a partir do usuário autenticado; o cliente não escolhe nem envia `usuarioId`.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `GET /api/v1/companies/me` | Consultar o próprio perfil empresarial. | `EMPRESA` autenticada | Sem parâmetros. | `200 OK`, objeto `empresa` com campos de perfil. | `401`, `403`, `404`, `500` |
| `PATCH /api/v1/companies/me` | Atualizar campos permitidos da própria empresa. | `EMPRESA` autenticada | Propriedades permitidas entre `razaoSocial`, `nomeFantasia`, `cnpj`, `telefone`; ao menos uma. | `200 OK`, perfil atualizado. | `400`, `401`, `403`, `404`, `409`, `422`, `500` |

Exemplo de resposta de perfil:

```json
{
  "data": {
    "id": 201,
    "razaoSocial": "<razao social>",
    "nomeFantasia": "<nome fantasia ou null>",
    "cnpj": "<cnpj>",
    "telefone": "<telefone ou null>"
  }
}
```

Exemplo de `PATCH`:

```json
{
  "telefone": "<novo telefone>"
}
```

A atualização de CNPJ aplica verificação preventiva de unicidade global; a limitação de concorrência descrita na seção 11 permanece. A atualização de e-mail em `usuario` não está incluída.

## 4. Motoristas

**Status da Etapa A:** `GET` e `PATCH /api/v1/drivers/me` estão implementados. Exigem sessão ativa de uma conta `MOTORISTA`; o perfil é localizado pelo ID do usuário autenticado. `PATCH` aceita `nome`, `cpf`, `cnpj`, `telefone` e `disponivel`, com ao menos um campo; disponibilidade deve ser booleano. Campos desconhecidos ou tipos incorretos recebem `400`; valores de texto incompatíveis recebem `422`; conflito de CPF/CNPJ recebe `409`. `telefone` pode ser limpo enviando `null`. O usuário não pode informar `usuarioId`.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `GET /api/v1/drivers/me` | Consultar o próprio perfil de motorista. | `MOTORISTA` autenticado | Sem parâmetros. | `200 OK`, objeto `motorista` próprio. | `401`, `403`, `404`, `500` |
| `PATCH /api/v1/drivers/me` | Atualizar campos permitidos do próprio perfil. | `MOTORISTA` autenticado | Propriedades permitidas entre `nome`, `cpf`, `cnpj`, `telefone`, `disponivel`; ao menos uma. | `200 OK`, perfil atualizado. | `400`, `401`, `403`, `404`, `409`, `422`, `500` |
| `GET /api/v1/drivers` | Buscar motoristas com conta ativa e disponibilidade habilitada, além de dados de veículos divulgáveis. Detalhes na seção 7. | `EMPRESA` autenticada | Filtros adicionais e paginação opcionais. | `200 OK`, lista paginada de resultados seguros para busca. | `400`, `401`, `403`, `422`, `500` |

Exemplo de resposta de `GET /drivers/me`:

```json
{
  "data": {
    "id": 202,
    "nome": "<nome>",
    "cpf": "<cpf>",
    "cnpj": "<cnpj>",
    "telefone": "<telefone ou null>",
    "disponivel": false
  }
}
```

O endpoint de busca requer autenticação de empresa; “busca” não significa acesso público anônimo.

## 5. Veículos

**Status da Etapa B:** os cinco endpoints da tabela estão implementados. Todas as operações exigem motorista autenticado e usam o perfil ligado ao ID da sessão; consultas e atualizações individuais incluem o proprietário na condição SQL. O cadastro usa `ativo` do banco por default e permite `disponivel` opcional (default `false`). A atualização cadastral não aceita `disponivel`; esse campo só muda pelo endpoint dedicado. Campos desconhecidos e tipos incorretos recebem `400`, valores de texto inválidos recebem `422`, duplicidade de placa/RENAVAM recebe `409`, e veículo de outra conta é respondido como `404`.

Todos os endpoints de gestão abaixo são limitados ao motorista proprietário. A API deve derivar o motorista do usuário autenticado e nunca confiar em um `motoristaId` enviado pelo cliente para decidir propriedade.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `POST /api/v1/drivers/me/vehicles` | Cadastrar veículo próprio. | `MOTORISTA` autenticado | `placa`, `renavam`, `marca`, `modelo`, `ano`; `disponivel` opcional. | `201 Created`, veículo criado. | `400`, `401`, `403`, `409`, `422`, `500` |
| `GET /api/v1/drivers/me/vehicles` | Listar veículos próprios. | `MOTORISTA` autenticado | Sem parâmetros. | `200 OK`, lista de veículos. | `401`, `403`, `500` |
| `GET /api/v1/vehicles/:id` | Consultar veículo próprio por ID. | `MOTORISTA` proprietário | `id` na URL. | `200 OK`, veículo. | `400`, `401`, `403`, `404`, `500` |
| `PATCH /api/v1/vehicles/:id` | Atualizar dados cadastrais do veículo próprio. | `MOTORISTA` proprietário | Campos permitidos entre `placa`, `renavam`, `marca`, `modelo`, `ano`; ao menos um. | `200 OK`, veículo atualizado. | `400`, `401`, `403`, `404`, `409`, `422`, `500` |
| `PATCH /api/v1/vehicles/:id/availability` | Alterar disponibilidade do veículo próprio. | `MOTORISTA` proprietário | `disponivel` booleano. | `200 OK`, veículo com disponibilidade atualizada. | `400`, `401`, `403`, `404`, `422`, `500` |

Exemplo de criação:

```json
{
  "placa": "<placa>",
  "renavam": "<renavam>",
  "marca": "<marca>",
  "modelo": "<modelo>",
  "ano": 2024,
  "disponivel": false
}
```

Exemplo de resposta:

```json
{
  "data": {
    "id": 301,
    "placa": "<placa>",
    "renavam": "<renavam>",
    "marca": "<marca>",
    "modelo": "<modelo>",
    "ano": 2024,
    "disponivel": false
  }
}
```

Não há endpoint de exclusão física de veículo neste contrato. O campo `ativo` permite desativá-lo sem excluir o registro; veículos inativos não aparecem em buscas de disponibilidade e não podem ser selecionados em novos interesses. Interesses e histórico relacionados são preservados.

## 6. Qualificações

**Status da Etapa C:** `POST /api/v1/drivers/me/qualifications`, `GET /api/v1/drivers/me/qualifications` e `PATCH /api/v1/qualifications/:id` estão implementados. Exigem motorista autenticado; operações por ID verificam a propriedade. `titulo` é obrigatório na criação e limitado a 255 caracteres conforme o schema; `descricao` pode ser omitida ou enviada como `null`. Não há exclusão de qualificação. A disponibilidade do motorista é consultada e atualizada em `GET/PATCH /api/v1/drivers/me` (Etapa A), campo `disponivel` booleano.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `POST /api/v1/drivers/me/qualifications` | Cadastrar qualificação própria. | `MOTORISTA` autenticado | `titulo` obrigatório; `descricao` opcional. | `201 Created`, qualificação criada. | `400`, `401`, `403`, `422`, `500` |
| `GET /api/v1/drivers/me/qualifications` | Listar qualificações próprias. | `MOTORISTA` autenticado | Sem parâmetros. | `200 OK`, lista de qualificações. | `401`, `403`, `500` |
| `PATCH /api/v1/qualifications/:id` | Atualizar qualificação própria. | `MOTORISTA` proprietário | `titulo` e/ou `descricao`; ao menos um. | `200 OK`, qualificação atualizada. | `400`, `401`, `403`, `404`, `422`, `500` |

Exemplo de criação e resposta:

```json
{
  "titulo": "<titulo>",
  "descricao": "<descricao opcional>"
}
```

```json
{
  "data": {
    "id": 401,
    "titulo": "<titulo>",
    "descricao": "<descricao ou null>"
  }
}
```

Não se propõe `DELETE`: a tabela `qualificacao` não possui campo de inativação, e a regra aprovada proíbe exclusões físicas de registros históricos no fluxo normal. A necessidade de inativação individual da qualificação ainda será avaliada; nenhum campo de status é presumido.

## 7. Busca de motoristas e veículos

**Status da Etapa D:** `GET /api/v1/drivers` está implementado para empresas autenticadas. Aceita somente os filtros descritos na tabela. A paginação usa `page=1`, `limit=20` por padrão e limite máximo de 100. O resultado inclui apenas ID, disponibilidade, veículos ativos e títulos de qualificações; CPF, CNPJ, contatos, placa, RENAVAM e nome não são retornados. A tabela do schema não contém localização, então esse filtro não está disponível.

### Endpoint proposto

`GET /api/v1/drivers` — somente empresa autenticada.

### Parâmetros propostos

| Parâmetro | Obrigatório | Base no esquema | Descrição |
|---|---|---|---|
| `veiculoDisponivel` | NÃO | `veiculo.disponivel` | Restringir os veículos ativos associados por disponibilidade; não altera o requisito padrão de motorista disponível. |
| `marca` | NÃO | `veiculo.marca` | Filtrar pela marca cadastrada do veículo. |
| `modelo` | NÃO | `veiculo.modelo` | Filtrar pelo modelo cadastrado. |
| `ano` | NÃO | `veiculo.ano` | Filtrar pelo ano cadastrado. |
| `qualificacao` | NÃO | `qualificacao.titulo` | Restringir a motoristas com título de qualificação correspondente; o resultado apresenta os títulos cadastrados. |
| `page` | NÃO | Proposta de paginação | Página solicitada. Proposta inicial: `1`. |
| `limit` | NÃO | Proposta de paginação | Itens por página. Padrão `20`, máximo `100`. |

Por padrão, a busca inclui somente motoristas cuja conta relacionada esteja ativa (`usuario.status = TRUE`) e cujo perfil esteja disponível (`motorista.disponivel = TRUE`). Nenhum filtro pode incluir contas inativas ou motoristas indisponíveis. Filtros adicionais apenas restringem esse conjunto padrão.

Os quatro campos têm significados diferentes: `usuario.status` indica se a conta está ativa e pode acessar o sistema; `motorista.disponivel` indica se o motorista aceita ser encontrado para novas oportunidades e aparece como `motoristaDisponivel` no resultado de busca; `veiculo.disponivel` indica a disponibilidade operacional de cada veículo e aparece junto ao veículo; `veiculo.ativo` indica se o veículo pode aparecer na busca ou ser selecionado em novos interesses. A disponibilidade do veículo não substitui as verificações de conta e motorista. O status da conta não é exposto na resposta.

Somente veículos `ativo = TRUE` podem aparecer nos resultados. Filtros de veículo devem ser aplicados mantendo a associação com o motorista. A busca não aceita CPF, CNPJ ou e-mail como filtros. Localização não existe no schema atual e, por isso, não pode ser filtrada.

### Dados retornados

Resposta inicial proposta para a empresa:

```json
{
  "data": [
    {
      "id": 202,
      "motoristaDisponivel": true,
      "qualificacoes": ["<título profissional>"],
      "veiculos": [
        {
          "id": 301,
          "marca": "<marca>",
          "modelo": "<modelo>",
          "ano": 2024,
          "disponivel": true
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

O resultado não inclui nome, CPF, CNPJ, e-mail, telefone, placa ou RENAVAM. A exposição do nome continua pendente de aprovação.

## 8. Interesses

**Status da Etapa E:** os sete endpoints da tabela estão implementados. A empresa autenticada cria e lista somente os seus; o motorista consulta os recebidos, aceita ou recusa apenas enquanto pendentes e cancela apenas após aceite com justificativa. A empresa cancela apenas enquanto pendente. Interesses pendentes vencidos são marcados como `EXPIRADO` sob demanda e por rotina a cada 60 segundos. O prazo é calculado em UTC como 24 horas após a criação. Duplicidades `PENDENTE` ou `ACEITO` para o mesmo par empresa/motorista são recusadas com `409`; estados terminais permitem novo interesse se o motorista estiver disponível.

Somente a empresa autenticada poderá criar um interesse em seu próprio nome. A API deriva `empresaId` exclusivamente da sessão; o cliente não envia `empresaId` nem `status` na criação. `motoristaId` identifica o motorista-alvo e `veiculoId` é opcional. O motorista deve estar disponível. Quando informado, o backend valida que o veículo existe, está ativo (`veiculo.ativo = TRUE`), disponível (`veiculo.disponivel = TRUE`) e pertence ao motorista indicado.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `POST /api/v1/interests` | Criar interesse em um motorista. | `EMPRESA` autenticada | `motoristaId` obrigatório; `veiculoId` opcional. | `201 Created`, interesse com status inicial `PENDENTE`. | `400`, `401`, `403`, `404`, `409` se duplicidade for bloqueada, `422`, `500` |
| `GET /api/v1/companies/me/interests` | Listar interesses criados pela empresa autenticada. | `EMPRESA` autenticada | Paginação opcional a definir. | `200 OK`, lista paginada. | `400`, `401`, `403`, `422`, `500` |
| `GET /api/v1/drivers/me/interests` | Listar interesses recebidos pelo motorista autenticado. | `MOTORISTA` autenticado | Paginação opcional a definir. | `200 OK`, lista paginada. | `400`, `401`, `403`, `422`, `500` |
| `GET /api/v1/interests/:id` | Consultar interesse relacionado ao usuário autenticado. | Empresa criadora ou motorista destinatário | `id` na URL. | `200 OK`, interesse visível ao participante. | `400`, `401`, `403`, `404`, `500` |
| `POST /api/v1/interests/:id/accept` | Aceitar interesse recebido. | `MOTORISTA` destinatário | `id` na URL; sem corpo. | `200 OK`, interesse atualizado. | `400`, `401`, `403`, `404`, `409`, `500` |
| `POST /api/v1/interests/:id/reject` | Recusar interesse recebido. | `MOTORISTA` destinatário | `id` na URL; sem corpo. | `200 OK`, interesse atualizado. | `400`, `401`, `403`, `404`, `409`, `500` |
| `POST /api/v1/interests/:id/cancel` | Cancelar interesse conforme o papel do participante. | Empresa criadora ou motorista destinatário | Empresa: sem justificativa. Motorista: `observacaoCancelamento` obrigatória. | `200 OK`, status `CANCELADO` e metadados de cancelamento. | `400`, `401`, `403`, `404`, `409`, `422`, `500` |

Exemplo de criação:

```json
{
  "motoristaId": 202,
  "veiculoId": 301
}
```

`veiculoId` pode ser omitido quando o interesse não especificar veículo. Resposta `201` proposta:

```json
{
  "data": {
    "id": 501,
    "empresaId": 201,
    "motoristaId": 202,
    "veiculoId": 301,
    "status": "PENDENTE",
    "dataCriacao": "<data ISO 8601>",
    "dataLimiteResposta": "<data ISO 8601>"
  }
}
```

O prazo `dataLimiteResposta` é 24 horas após `dataCriacao`. Sem resposta, o interesse expira automaticamente (`EXPIRADO`). O motorista destinatário pode aceitar ou recusar somente enquanto `PENDENTE`. A empresa pode cancelar somente enquanto `PENDENTE`, sem justificativa obrigatória; o motorista pode cancelar somente após aceite e deve enviar justificativa. Cancelamentos registram `canceladoPor`, `dataCancelamento` e, no cancelamento pelo motorista, `observacaoCancelamento`. Interesses recusados, expirados ou cancelados permanecem no histórico. Após esses estados, uma nova solicitação pode ser criada se o motorista estiver disponível. A implementação considera `PENDENTE` e `ACEITO` como estados ativos para impedir duplicidade do mesmo par.

## 9. Administração

`ADMIN` é um valor de `usuario.tipo_usuario`; não existe tabela de administração. O cadastro público nunca cria `ADMIN`.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `PATCH /api/v1/admin/users/:id/status` | Inativar logicamente uma conta. Define `usuario.status = FALSE`, bloqueia o acesso, invalida as sessões ativas do usuário e preserva registros e histórico. | `ADMIN` autenticado e autorizado | `id` na URL; corpo `{ "status": false }`. | `200 OK`, usuário inativado sem dados de senha. | `400`, `401`, `403`, `404`, `422`, `500` |

**Status da Etapa F:** o endpoint está implementado. Requer `ADMIN` ativo, aceita somente `status: false`, impede auto-inativação e protege o último administrador ativo. A alteração e a remoção das sessões persistidas são feitas na mesma transação. Reativação não é permitida por esta rota.

Não há endpoint de exclusão física. A reativação de usuários não está incluída nesta proposta.

Ainda precisa ser definido o provisionamento seguro da primeira conta `ADMIN`. A rota impede auto-inativação e inativação do último administrador ativo.

## 10. Padrão de requisição e resposta por endpoint

As tabelas das seções 2 a 9 especificam para cada endpoint o método, caminho, finalidade, perfil autorizado, parâmetros/corpo, status de sucesso e erros possíveis. Os exemplos de JSON correspondentes estão junto aos grupos de operação.

Convenções adicionais propostas:

- Campos obrigatórios ausentes ou tipos/formato JSON incorretos: `400 Bad Request`.
- JSON bem formado com valores incompatíveis com validações de domínio: `422 Unprocessable Content`.
- Duplicidade de e-mail, CPF, CNPJ, placa ou RENAVAM detectada pela operação: `409 Conflict`.
- Nunca incluir `senha`, hash de senha, token ou segredo em resposta.
- Derivar da sessão a identidade de quem executa a operação: nunca aceitar `usuarioId` ou `empresaId` do cliente para definir o solicitante. IDs-alvo necessários são permitidos e devem ser validados: na criação de interesse, `motoristaId` identifica o destinatário e `veiculoId` identifica opcionalmente o veículo relacionado.
- Respostas de listas devem seguir o envelope `data` e, se a paginação for aprovada, `meta`.

### Exemplos ilustrativos de resposta por endpoint

Os exemplos seguintes completam formas de resposta propostas para operações ainda não implementadas. IDs e valores entre sinais angulares são placeholders. A linha de logout abaixo registra a resposta atualmente implementada.

| Endpoint | Exemplo ilustrativo de sucesso |
|---|---|
| `POST /api/v1/auth/logout` | Implementado: `200 OK`, `{ "message": "Logout realizado com sucesso." }`; teste pendente. |
| `PATCH /api/v1/companies/me` | `200`: `{ "data": { "id": 201, "razaoSocial": "<razao social>", "nomeFantasia": null, "cnpj": "<cnpj>", "telefone": "<telefone>" } }` |
| `PATCH /api/v1/drivers/me` | `200`: `{ "data": { "id": 202, "nome": "<nome>", "cpf": "<cpf>", "cnpj": "<cnpj>", "telefone": null, "disponivel": true } }` |
| `GET /api/v1/drivers/me/vehicles` | `200`: `{ "data": [{ "id": 301, "placa": "<placa>", "renavam": "<renavam>", "marca": "<marca>", "modelo": "<modelo>", "ano": 2024, "disponivel": false }] }` |
| `GET /api/v1/vehicles/:id` | `200`: `{ "data": { "id": 301, "placa": "<placa>", "renavam": "<renavam>", "marca": "<marca>", "modelo": "<modelo>", "ano": 2024, "disponivel": false } }` |
| `PATCH /api/v1/vehicles/:id` | `200`: `{ "data": { "id": 301, "placa": "<placa>", "renavam": "<renavam>", "marca": "<marca>", "modelo": "<modelo>", "ano": 2024, "disponivel": false } }` |
| `PATCH /api/v1/vehicles/:id/availability` | `200`: `{ "data": { "id": 301, "disponivel": true } }` |
| `GET /api/v1/drivers/me/qualifications` | `200`: `{ "data": [{ "id": 401, "titulo": "<titulo>", "descricao": "<descricao ou null>" }] }` |
| `PATCH /api/v1/qualifications/:id` | `200`: `{ "data": { "id": 401, "titulo": "<titulo>", "descricao": "<descricao ou null>" } }` |
| `GET /api/v1/companies/me/interests` | `200`: `{ "data": [{ "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "PENDENTE", "dataCriacao": "<ISO 8601 UTC>" }], "meta": { "page": 1, "limit": 20, "total": 1 } }` |
| `GET /api/v1/drivers/me/interests` | `200`: `{ "data": [{ "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "PENDENTE", "dataCriacao": "<ISO 8601 UTC>" }], "meta": { "page": 1, "limit": 20, "total": 1 } }` |
| `GET /api/v1/interests/:id` | `200`: `{ "data": { "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "PENDENTE", "dataCriacao": "<ISO 8601 UTC>" } }` |
| `POST /api/v1/interests/:id/accept` | `200`: `{ "data": { "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "ACEITO", "dataCriacao": "<ISO 8601 UTC>" } }` |
| `POST /api/v1/interests/:id/reject` | `200`: `{ "data": { "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "RECUSADO", "dataCriacao": "<ISO 8601 UTC>" } }` |
| `PATCH /api/v1/admin/users/:id/status` | Implementado: `200`, `{ "data": { "id": 101, "status": false } }`. |

## 11. Segurança e autorização

- Todas as rotas protegidas atuais exigem sessão HTTP válida pelo cookie `biocargo.sid` e consultam `usuario` em cada requisição para recusar contas inativas e validar o tipo de usuário.
- A API autoriza por tipo de usuário e por propriedade do registro. As rotas `me` derivam o proprietário da sessão e não aceitam ID do usuário enviado pelo cliente. Uma FK válida não concede acesso ao registro.
- O login recusa contas inativas; as rotas protegidas também revalidam o estado da conta. A inativação administrativa remove as sessões armazenadas da conta.
- Os endpoints atuais verificam presença e alguns tipos de campos obrigatórios, mas não cobrem todas as validações de formato/domínio descritas para o MVP. Os novos endpoints devem validar no servidor; a validação local do frontend é apenas apoio de interface.
- A regra aprovada de CNPJ global atravessa duas tabelas e não é assegurada pelos `UNIQUE` atuais. Cadastro e atualização fazem uma verificação preventiva; a garantia contra requisições simultâneas continua pendente sem uma restrição ou coordenação compartilhada por todos os escritores.
- A regra de um único perfil entre `EMPRESA` e `MOTORISTA` não é imposta pelo SQL. O backend deve validá-la também em operações concorrentes; estratégia pendente.
- CPF, CNPJ, e-mail, senha, telefone, placa e RENAVAM não devem ser expostos nos resultados da busca disponibilizada exclusivamente a empresas autenticadas. Respostas de perfil próprio podem conter dados necessários ao titular, conforme contrato de cada recurso.
- Usar consultas parametrizadas; não concatenar entrada do cliente em SQL.
- Usar transações quando cadastro ou outra operação persistir dados relacionados que precisam permanecer consistentes.
- Traduzir violações de `UNIQUE` para `409 Conflict`, sem devolver SQL, stack trace ou detalhes internos.
- O fluxo normal não deve excluir fisicamente usuários ou registros históricos. A inativação administrativa é lógica, altera `usuario.status` para `FALSE`, bloqueia o acesso e invalida sessões ativas.
- O token/senha nunca deve aparecer em logs. Hash de senha e política de sessão são decisões de implementação a serem fechadas pelo responsável pelo backend.
- Normalizar e-mail removendo espaços externos e aplicando comparação sem distinção entre maiúsculas e minúsculas de forma consistente no cadastro, login e validação de unicidade.
- Retornar datas e horários em ISO 8601 UTC (`Z`); o frontend converte para o horário local na apresentação. O backend deve tratar valores `DATETIME` do esquema atual como UTC, sem alterar o SQL.
- O cookie de sessão usa `httpOnly`, `sameSite: 'lax'` e `secure` em produção; a API falha ao iniciar sem segredo de sessão próprio. CORS permite somente origens listadas em `CORS_ORIGINS`; sem configuração, o frontend deve usar same-origin/Vite proxy. Não há origem curinga. Uma implantação cross-site exigirá revisar a política de cookie e CSRF.

## 12. Códigos HTTP e erros

| Código | Uso proposto |
|---|---|
| `200 OK` | Consulta ou atualização concluída com conteúdo. |
| `201 Created` | Recurso criado. |
| `204 No Content` | Operação concluída sem corpo; não é o status usado pelo logout atual, que responde `200` com mensagem. |
| `400 Bad Request` | JSON malformado, parâmetros inválidos ou campos obrigatórios ausentes. |
| `401 Unauthorized` | Credencial ausente, inválida, expirada ou login recusado. Para evitar enumeração, credenciais inválidas e usuário inativo podem receber mensagem genérica. |
| `403 Forbidden` | Usuário autenticado sem perfil ou propriedade autorizada para a operação. |
| `404 Not Found` | Recurso ou rota não encontrado. |
| `409 Conflict` | Conflito com unicidade ou estado atual do recurso. |
| `422 Unprocessable Content` | Dados JSON válidos sintaticamente, mas reprovados por validação de domínio. |
| `500 Internal Server Error` | Erro inesperado, sem detalhes internos na resposta. |

Formato padronizado proposto:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revise os dados enviados.",
    "details": [
      {
        "field": "cnpj",
        "message": "CNPJ inválido."
      }
    ]
  }
}
```

`details` pode ser omitido quando não houver detalhes por campo. Exemplo de conflito de unicidade:

```json
{
  "error": {
    "code": "DUPLICATE_CNPJ",
    "message": "Já existe um cadastro com este CNPJ."
  }
}
```

Os códigos de erro e mensagens desta seção são propostas para os endpoints futuros. Nos handlers existentes, cadastro/login usam objeto `{ "message": "..." }` em erros; status e mensagens atuais constam na tabela da seção 2.

## 13. Matriz de permissões

Legenda: **Próprio** = somente o perfil ligado à conta autenticada; **Busca** = somente consulta autenticada de motoristas por empresa; **Participante** = empresa criadora ou motorista destinatário; **Pendente** = requisito ainda não aprovado; **—** = sem permissão proposta.

| Módulo/operação | Visitante | EMPRESA | MOTORISTA | ADMIN |
|---|---|---|---|---|
| Cadastro público e login | Permitido para empresa/motorista | — | — | Cadastro público não permitido |
| Consultar identidade (`/auth/me`) | — | Permitido | Permitido | Permitido |
| Perfil da empresa | — | Próprio | — | Pendente |
| Perfil do motorista | — | — | Próprio | Pendente |
| Buscar motoristas e ver resumo de veículos | — | Busca | — | Pendente |
| Gerenciar veículos | — | — | Próprios | Pendente |
| Gerenciar qualificações | — | — | Próprias | Pendente |
| Criar e listar interesses da empresa | — | Próprios | — | Pendente |
| Listar interesses recebidos | — | — | Próprios | Pendente |
| Consultar interesse individual | — | Participante | Participante | Pendente |
| Aceitar ou recusar interesse | — | — | Somente destinatário | Pendente |
| Inativar conta de usuário | — | — | — | `ADMIN` ativo; implementado |

## 14. Pontos pendentes

Samy e Rafael precisam alinhar antes de considerar o contrato fechado:

- Política de sessão em produção além do cookie `secure` e da duração atual de 24 horas, incluindo renovação. O logout está implementado e seu teste específico está pendente.
- A biblioteca de acesso atual é `mysql2/promise`; os cadastros integrados usam transações. Estratégia transacional para os novos módulos deve ser definida conforme necessário.
- Contrato exato de payload, resposta, erros, versionamento e paginação. A API deve usar ISO 8601 UTC; falta configurar a conexão MySQL em UTC ou as conversões para o `DATETIME` sem fuso.
- Verificar a collation real e os e-mails já armazenados no MySQL para alinhar a restrição `UNIQUE` com a forma canônica normalizada pela API, sem alterar o esquema nesta etapa.
- Campos de perfil que podem ser alterados, inclusive possibilidade de alteração de e-mail e documentos.
- Campos públicos do motorista e veículo na busca; o exemplo proposto esconde documentos, contatos, placa e RENAVAM.
- Critérios definitivos e combinação de filtros da busca.
- Estratégia concorrente para garantir CNPJ global e exclusividade de perfil usando o esquema atual, que não possui restrições cruzadas.
- Quem pode atualizar disponibilidade de motorista e em quais condições.
- Regras de transição de interesses, repetição/duplicidade e comportamento para interesse já aceito ou recusado.
- Se e como qualificações ou veículos podem ser removidos sem exclusão física; o esquema atual não tem campos de inativação para eles.
- Processo de criação inicial da primeira conta `ADMIN`.
- Se empresas poderão consultar diretamente um veículo por ID ou apenas os dados retornados na busca.

## Endpoints deste documento — resumo de status

Autenticação, health check e os endpoints das seções 3 a 9 estão implementados, exceto onde a linha marca explicitamente uma pendência.

- `POST /api/v1/auth/register/company`
- `POST /api/v1/auth/register/driver`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout` (implementado; teste pendente)
- `GET /api/v1/health` (implementado)
- `GET /api/v1/companies/me` (implementado)
- `PATCH /api/v1/companies/me` (implementado)
- `GET /api/v1/drivers/me` (implementado)
- `PATCH /api/v1/drivers/me` (implementado)
- `GET /api/v1/drivers` (implementado; busca autenticada por empresa)
- `POST /api/v1/drivers/me/vehicles` (implementado)
- `GET /api/v1/drivers/me/vehicles` (implementado)
- `GET /api/v1/vehicles/:id` (implementado; somente motorista proprietário)
- `PATCH /api/v1/vehicles/:id` (implementado; somente motorista proprietário)
- `PATCH /api/v1/vehicles/:id/availability` (implementado; somente motorista proprietário)
- `POST /api/v1/drivers/me/qualifications` (implementado)
- `GET /api/v1/drivers/me/qualifications` (implementado)
- `PATCH /api/v1/qualifications/:id` (implementado)
- `POST /api/v1/interests` (implementado)
- `GET /api/v1/companies/me/interests` (implementado)
- `GET /api/v1/drivers/me/interests` (implementado)
- `GET /api/v1/interests/:id` (implementado)
- `POST /api/v1/interests/:id/accept` (implementado)
- `POST /api/v1/interests/:id/reject` (implementado)
- `POST /api/v1/interests/:id/cancel` (implementado)
- `PATCH /api/v1/admin/users/:id/status` (implementado; inativação lógica)

Não foram propostos endpoints de exclusão física.

## Resumo das decisões documentadas

- A API REST/JSON usa prefixo `/api/v1`, Node.js/Express e MySQL 8. Cadastro, login, sessão, consulta de sessão, health check, perfis próprios, veículos, qualificações, busca, interesses e inativação administrativa estão implementados.
- Cadastro público é restrito a empresa e motorista. `ADMIN` não pode ser criado por essas rotas.
- A API deve garantir autorização por perfil e propriedade, CNPJ global, perfil exclusivo, associação correta entre veículo e interesse, bloqueio de inativos e preservação histórica.
- A busca retorna por padrão somente contas ativas e motoristas disponíveis; distingue status da conta, disponibilidade do motorista e do veículo. Não expõe documentos, contatos, placa ou RENAVAM; a divulgação do nome ainda depende de aprovação.
- A inativação administrativa é lógica, bloqueia o acesso e remove sessões ativas, preservando registros e histórico; auto-inativação e inativação do último ADMIN são recusadas.
- Não há exclusão de qualificação/veículo proposta enquanto política de preservação e suporte de inativação não estiverem definidos.

Este documento descreve parcialmente endpoints implementados e parcialmente propostas futuras; consulte a seção 2 para a lista e os status atuais.
