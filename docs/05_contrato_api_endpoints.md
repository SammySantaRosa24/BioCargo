# Contrato planejado da API REST — BioCargo

> **Status:** proposta de contrato para orientar a implementação. Os endpoints deste documento não estão implementados. A API deverá atender ao frontend React existente e ao esquema MySQL registrado em `database/01_schema.sql`.

## 1. Objetivo e convenções

Este documento define uma proposta de endpoints, permissões, formatos de dados e erros para o MVP BioCargo. O frontend já contém páginas de login e cadastro, mas ainda não possui serviços HTTP nem integração com o backend.

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

### Endpoints planejados

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `POST /api/v1/auth/register/company` | Cadastrar usuário e perfil de empresa. | Visitante | JSON de cadastro de empresa abaixo. | `201 Created`, usuário e empresa criados. | `400`, `409`, `422`, `500` |
| `POST /api/v1/auth/register/driver` | Cadastrar usuário e perfil de motorista PJ. | Visitante | JSON de cadastro de motorista abaixo. | `201 Created`, usuário e motorista criados. | `400`, `409`, `422`, `500` |
| `POST /api/v1/auth/login` | Autenticar com e-mail e senha. | Visitante | `email`, `senha`. | `200 OK`, identidade autenticada e credencial/sessão conforme estratégia ainda pendente. | `400`, `401`, `422`, `500` |
| `GET /api/v1/auth/me` | Consultar usuário autenticado. | `EMPRESA`, `MOTORISTA` ou `ADMIN` autenticado | Sem parâmetros. | `200 OK`, dados básicos do usuário. | `401`, `500` |
| `POST /api/v1/auth/logout` | Encerrar sessão quando o mecanismo adotado permitir revogação no servidor. | Usuário autenticado | Sem corpo. | `204 No Content`, se aplicável à estratégia definida. | `401`, `500` |

Logout é condicional: se a estratégia for stateless e não houver revogação no servidor, o cliente poderá descartar sua credencial; a necessidade e semântica de um endpoint de logout ficam pendentes.

### Cadastro de empresa

O formulário existente contém `razaoSocial`, `nomeFantasia`, `cnpj`, `telefone`, `email`, `password` e `confirmPassword`. Para a API, a proposta é usar `senha`; confirmação de senha é validada pelo frontend e não precisa ser persistida nem enviada. Os campos opcionais refletem os campos anuláveis no SQL.

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

Resposta `201` proposta:

```json
{
  "data": {
    "usuario": { "id": 101, "tipoUsuario": "EMPRESA" },
    "empresa": { "id": 201 }
  }
}
```

### Cadastro de motorista PJ

O frontend chama o campo de nome `nomeCompleto`; o banco usa `motorista.nome`. A integração deverá mapear esse campo para `nome`. A API propõe `senha` e não recebe `confirmPassword`.

```json
{
  "nome": "<nome completo>",
  "cpf": "<cpf>",
  "cnpj": "<cnpj>",
  "telefone": "<telefone opcional>",
  "email": "<email>",
  "senha": "<senha>"
}
```

Resposta `201` proposta:

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

Exemplo parcial de `200` — mecanismo e campo de sessão ainda pendentes:

```json
{
  "data": {
    "usuario": { "id": 101, "email": "<email>", "tipoUsuario": "EMPRESA" },
    "sessao": "<formato a definir>"
  }
}
```

`GET /auth/me` retorna identidade mínima, sem senha:

```json
{
  "data": {
    "id": 101,
    "email": "<email>",
    "tipoUsuario": "EMPRESA",
    "status": true
  }
}
```

## 3. Empresas

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

Se a atualização de CNPJ for permitida, o backend deve aplicar a regra aprovada de unicidade global. A possibilidade de atualizar e-mail em `usuario` não está incluída; precisa ser decidida.

## 4. Motoristas

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

Não há endpoint de exclusão física de veículo neste contrato. A necessidade de inativação individual do veículo ainda será avaliada; o esquema atual não possui campo para isso, e a decisão deve preservar interesses e histórico relacionados sem inventar um campo de status.

## 6. Qualificações

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

### Endpoint proposto

`GET /api/v1/drivers` — somente empresa autenticada.

### Parâmetros propostos

| Parâmetro | Obrigatório | Base no esquema | Descrição |
|---|---|---|---|
| `veiculoDisponivel` | NÃO | `veiculo.disponivel` | Restringir os veículos associados por disponibilidade; não altera o requisito padrão de motorista disponível. |
| `marca` | NÃO | `veiculo.marca` | Filtrar pela marca cadastrada do veículo. |
| `modelo` | NÃO | `veiculo.modelo` | Filtrar pelo modelo cadastrado. |
| `ano` | NÃO | `veiculo.ano` | Filtrar pelo ano cadastrado. |
| `page` | NÃO | Proposta de paginação | Página solicitada. Proposta inicial: `1`. |
| `limit` | NÃO | Proposta de paginação | Itens por página. Proposta inicial: `20`; limite máximo a definir. |

Por padrão, a busca inclui somente motoristas cuja conta relacionada esteja ativa (`usuario.status = TRUE`) e cujo perfil esteja disponível (`motorista.disponivel = TRUE`). Nenhum filtro pode incluir contas inativas ou motoristas indisponíveis. Filtros adicionais apenas restringem esse conjunto padrão.

Os três campos têm significados diferentes: `usuario.status` indica se a conta está ativa e pode acessar o sistema; `motorista.disponivel` indica se o motorista aceita ser encontrado para novas oportunidades e aparece como `motoristaDisponivel` no resultado de busca; `veiculo.disponivel` indica a disponibilidade de cada veículo e aparece junto ao veículo. A disponibilidade do veículo não substitui as duas verificações do motorista. O status da conta não é exposto na resposta.

Filtros de veículo devem ser aplicados mantendo a associação com o motorista. A busca não deve aceitar CPF, CNPJ ou e-mail como filtros. A combinação dos filtros e a paginação ainda precisam de validação de produto.

### Dados retornados

Resposta inicial proposta para a empresa:

```json
{
  "data": [
    {
      "id": 202,
      "nome": "<nome para exibição>",
      "motoristaDisponivel": true,
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

O exemplo não inclui CPF, CNPJ, e-mail, telefone, placa ou RENAVAM. A exposição do nome do motorista e dos demais campos visíveis precisa de aprovação explícita; a resposta acima é uma proposta mínima, não uma decisão de privacidade concluída.

## 8. Interesses

Somente a empresa autenticada poderá criar um interesse em seu próprio nome. A API deriva `empresaId` exclusivamente da sessão; o cliente não envia `empresaId` nem `status` na criação. `motoristaId` identifica o motorista-alvo e `veiculoId` é opcional. Quando informado, o backend valida que o veículo existe, está disponível (`veiculo.disponivel = TRUE`) e pertence ao motorista indicado.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `POST /api/v1/interests` | Criar interesse em um motorista. | `EMPRESA` autenticada | `motoristaId` obrigatório; `veiculoId` opcional. | `201 Created`, interesse com status inicial `PENDENTE`. | `400`, `401`, `403`, `404`, `409` se duplicidade for bloqueada, `422`, `500` |
| `GET /api/v1/companies/me/interests` | Listar interesses criados pela empresa autenticada. | `EMPRESA` autenticada | Paginação opcional a definir. | `200 OK`, lista paginada. | `400`, `401`, `403`, `422`, `500` |
| `GET /api/v1/drivers/me/interests` | Listar interesses recebidos pelo motorista autenticado. | `MOTORISTA` autenticado | Paginação opcional a definir. | `200 OK`, lista paginada. | `400`, `401`, `403`, `422`, `500` |
| `GET /api/v1/interests/:id` | Consultar interesse relacionado ao usuário autenticado. | Empresa criadora ou motorista destinatário | `id` na URL. | `200 OK`, interesse visível ao participante. | `400`, `401`, `403`, `404`, `500` |
| `POST /api/v1/interests/:id/accept` | Aceitar interesse recebido. | `MOTORISTA` destinatário | `id` na URL; sem corpo. | `200 OK`, interesse atualizado. | `400`, `401`, `403`, `404`, `409`, `500` |
| `POST /api/v1/interests/:id/reject` | Recusar interesse recebido. | `MOTORISTA` destinatário | `id` na URL; sem corpo. | `200 OK`, interesse atualizado. | `400`, `401`, `403`, `404`, `409`, `500` |

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
    "dataCriacao": "<data ISO 8601>"
  }
}
```

Resposta `200` de aceite ou recusa tem o mesmo recurso, com `status` atualizado. O motorista relacionado é o destinatário das ações. As transições permitidas, a possibilidade de resposta apenas enquanto `PENDENTE` e a política de interesses duplicados ainda precisam de decisão.

## 9. Administração

`ADMIN` é um valor de `usuario.tipo_usuario`; não existe tabela de administração. O cadastro público nunca cria `ADMIN`. O endpoint administrativo abaixo é planejado e ainda não implementado; não representa funcionalidade existente.

| Método e caminho | Finalidade | Perfil autorizado | Entrada | Sucesso | Erros possíveis |
|---|---|---|---|---|---|
| `PATCH /api/v1/admin/users/:id/status` | Inativar logicamente uma conta. Define `usuario.status = FALSE`, bloqueia o acesso, invalida as sessões ativas do usuário e preserva registros e histórico. | `ADMIN` autenticado e autorizado | `id` na URL; corpo `{ "status": false }`. | `200 OK`, usuário inativado sem dados de senha. | `400`, `401`, `403`, `404`, `422`, `500` |

Não há endpoint de exclusão física. A reativação de usuários não está incluída nesta proposta.

Ainda precisam ser definidos o provisionamento da primeira conta `ADMIN` e regras operacionais como auto-inativação e inativação do último administrador.

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

Os exemplos seguintes completam as formas de resposta não mostradas junto às operações. São ilustrativos do contrato planejado, não respostas de uma API implementada. IDs e valores entre sinais angulares são placeholders. Endpoints com `204` não têm corpo JSON.

| Endpoint | Exemplo ilustrativo de sucesso |
|---|---|
| `POST /api/v1/auth/logout` | `204 No Content` — sem corpo. |
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
| `POST /api/v1/interests/:id/accept` | `200`: `{ "data": { "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "ACEITO", "dataCriacao": "<ISO 8601 UTC>" } }` — transição ainda pendente de definição. |
| `POST /api/v1/interests/:id/reject` | `200`: `{ "data": { "id": 501, "empresaId": 201, "motoristaId": 202, "veiculoId": null, "status": "RECUSADO", "dataCriacao": "<ISO 8601 UTC>" } }` — transição ainda pendente de definição. |
| `PATCH /api/v1/admin/users/:id/status` | `200`: `{ "data": { "id": 101, "status": false } }` — endpoint planejado, ainda não implementado. |

## 11. Segurança e autorização

- Rotas protegidas exigem autenticação válida; a estratégia e o transporte da credencial ainda estão pendentes.
- A API autoriza por tipo de usuário e por propriedade do registro. Uma FK válida não concede acesso ao registro.
- Contas com `usuario.status = FALSE` não podem iniciar sessão nem continuar acessando rotas protegidas. A inativação administrativa deve invalidar as sessões ativas; o mecanismo técnico depende da estratégia de sessão escolhida.
- O backend valida formato, campos permitidos, tamanho e regras de negócio em todas as entradas. A validação local existente é apenas apoio de interface.
- A regra aprovada de CNPJ global atravessa duas tabelas e não é assegurada pelos `UNIQUE` atuais. A verificação deve tratar concorrência; a estratégia técnica compatível com o esquema atual está pendente.
- A regra de um único perfil entre `EMPRESA` e `MOTORISTA` não é imposta pelo SQL. O backend deve validá-la também em operações concorrentes; estratégia pendente.
- CPF, CNPJ, e-mail, senha, telefone, placa e RENAVAM não devem ser expostos nos resultados da busca disponibilizada exclusivamente a empresas autenticadas. Respostas de perfil próprio podem conter dados necessários ao titular, conforme contrato de cada recurso.
- Usar consultas parametrizadas; não concatenar entrada do cliente em SQL.
- Usar transações quando cadastro ou outra operação persistir dados relacionados que precisam permanecer consistentes.
- Traduzir violações de `UNIQUE` para `409 Conflict`, sem devolver SQL, stack trace ou detalhes internos.
- O fluxo normal não deve excluir fisicamente usuários ou registros históricos. A inativação administrativa é lógica, altera `usuario.status` para `FALSE`, bloqueia o acesso e invalida sessões ativas.
- O token/senha nunca deve aparecer em logs. Hash de senha e política de sessão são decisões de implementação a serem fechadas pelo responsável pelo backend.
- Normalizar e-mail removendo espaços externos e aplicando comparação sem distinção entre maiúsculas e minúsculas de forma consistente no cadastro, login e validação de unicidade.
- Retornar datas e horários em ISO 8601 UTC (`Z`); o frontend converte para o horário local na apresentação. O backend deve tratar valores `DATETIME` do esquema atual como UTC, sem alterar o SQL.

## 12. Códigos HTTP e erros

| Código | Uso proposto |
|---|---|
| `200 OK` | Consulta ou atualização concluída com conteúdo. |
| `201 Created` | Recurso criado. |
| `204 No Content` | Operação concluída sem corpo, como logout se suportado pela estratégia escolhida. |
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

Os códigos de erro e mensagens apresentados são propostas para uniformização e devem ser confirmados durante a implementação.

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
| Inativar conta de usuário | — | — | — | `ADMIN` autorizado; endpoint planejado, ainda não implementado |

## 14. Pontos pendentes

Samy e Rafael precisam alinhar antes de considerar o contrato fechado:

- Estratégia de autenticação e sessão: token/cookie, armazenamento, expiração, renovação e logout. Invalidar sessões ativas após inativação é requisito; falta definir o mecanismo técnico.
- Biblioteca de acesso ao MySQL e mecanismo de transações.
- Contrato exato de payload, resposta, erros, versionamento e paginação. A API deve usar ISO 8601 UTC; falta configurar a conexão MySQL em UTC ou as conversões para o `DATETIME` sem fuso.
- Verificar a collation real e os e-mails já armazenados no MySQL para alinhar a restrição `UNIQUE` com a forma canônica normalizada pela API, sem alterar o esquema nesta etapa.
- Campos de perfil que podem ser alterados, inclusive possibilidade de alteração de e-mail e documentos.
- Campos públicos do motorista e veículo na busca; o exemplo proposto esconde documentos, contatos, placa e RENAVAM.
- Critérios definitivos e combinação de filtros da busca.
- Estratégia concorrente para garantir CNPJ global e exclusividade de perfil usando o esquema atual, que não possui restrições cruzadas.
- Quem pode atualizar disponibilidade de motorista e em quais condições.
- Regras de transição de interesses, repetição/duplicidade e comportamento para interesse já aceito ou recusado.
- Se e como qualificações ou veículos podem ser removidos sem exclusão física; o esquema atual não tem campos de inativação para eles.
- Processo de criação inicial de `ADMIN` e regras operacionais da inativação, incluindo auto-inativação e proteção do último administrador.
- Se empresas poderão consultar diretamente um veículo por ID ou apenas os dados retornados na busca.

## Endpoints propostos — resumo

- `POST /api/v1/auth/register/company`
- `POST /api/v1/auth/register/driver`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout` (condicional à estratégia de sessão)
- `GET /api/v1/companies/me`
- `PATCH /api/v1/companies/me`
- `GET /api/v1/drivers/me`
- `PATCH /api/v1/drivers/me`
- `GET /api/v1/drivers` (busca autenticada por empresa)
- `POST /api/v1/drivers/me/vehicles`
- `GET /api/v1/drivers/me/vehicles`
- `GET /api/v1/vehicles/:id`
- `PATCH /api/v1/vehicles/:id`
- `PATCH /api/v1/vehicles/:id/availability`
- `POST /api/v1/drivers/me/qualifications`
- `GET /api/v1/drivers/me/qualifications`
- `PATCH /api/v1/qualifications/:id`
- `POST /api/v1/interests`
- `GET /api/v1/companies/me/interests`
- `GET /api/v1/drivers/me/interests`
- `GET /api/v1/interests/:id`
- `POST /api/v1/interests/:id/accept`
- `POST /api/v1/interests/:id/reject`
- `PATCH /api/v1/admin/users/:id/status` (inativação lógica; planejado, ainda não implementado)

Não foram propostos endpoints de exclusão física.

## Resumo das decisões documentadas

- O contrato é planejado para REST/JSON, React, Node.js/Express e MySQL 8; ainda não descreve implementação existente.
- Cadastro público é restrito a empresa e motorista. `ADMIN` não pode ser criado por essas rotas.
- A API deve garantir autorização por perfil e propriedade, CNPJ global, perfil exclusivo, associação correta entre veículo e interesse, bloqueio de inativos e preservação histórica.
- A busca retorna por padrão somente contas ativas e motoristas disponíveis; distingue status da conta, disponibilidade do motorista e do veículo. Não expõe documentos, contatos, placa ou RENAVAM; a divulgação do nome ainda depende de aprovação.
- A inativação deve ser administrativa e lógica, bloquear o acesso e invalidar sessões ativas, preservando registros e histórico. O endpoint proposto ainda não foi implementado.
- Não há exclusão de qualificação/veículo proposta enquanto política de preservação e suporte de inativação não estiverem definidos.

Este documento é uma especificação planejada; nenhum endpoint nele descrito está implementado.
