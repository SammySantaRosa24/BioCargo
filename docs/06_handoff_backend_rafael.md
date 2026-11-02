# Handoff técnico do backend — BioCargo

**Destinatário:** Rafael Alvarenga  
**Objetivo:** orientar a implementação do backend, da API REST, da autenticação e da integração com o frontend e o MySQL.

Este documento transfere o contexto técnico disponível. Ele não representa código implementado nem substitui o esquema SQL ou o contrato da API. Regras de negócio aprovadas são separadas das decisões técnicas ainda pendentes.

## 1. Identificação e objetivo do projeto

O BioCargo é uma plataforma web para conectar empresas que precisam de serviços de transporte biológico a motoristas PJ qualificados e com veículos adequados. O backend deverá receber as requisições do frontend, validar dados e permissões, aplicar as regras de negócio e persistir os registros no MySQL 8.

O MVP prevê cadastro e autenticação de empresas e motoristas, perfis, veículos, qualificações, busca de motoristas e veículos e demonstração de interesse. O contrato planejado está em [`05_contrato_api_endpoints.md`](./05_contrato_api_endpoints.md).

## 2. Escopo do MVP

### Incluído no plano

- Cadastro público de empresa e motorista PJ.
- Login compartilhado e consulta da identidade autenticada.
- Consulta e atualização do próprio perfil.
- Cadastro, consulta e atualização de veículos e qualificações do motorista.
- Busca autenticada de motoristas e dados de veículos, respeitando as regras de disponibilidade e privacidade.
- Criação e consulta de interesses; aceite ou recusa pelo motorista destinatário, conforme transições a definir.
- Inativação lógica de conta por `ADMIN` autorizado, com bloqueio de acesso, invalidação de sessões ativas e preservação do histórico.

### Fora do escopo aprovado ou sem requisitos suficientes

- Cadastro público de `ADMIN`.
- Exclusão física de usuários ou registros históricos no fluxo normal.
- Endpoints de exclusão de veículos ou qualificações; a necessidade de inativação individual desses registros ainda será avaliada.
- Funcionalidades não descritas no esquema ou contrato, como pagamentos, rastreamento em tempo real, mensagens ou outros módulos. Qualquer ampliação exige alinhamento prévio.
- Painel ou operações administrativas além da inativação de usuário, até que seus requisitos sejam aprovados.

## 3. Estado atual do repositório

### Documentação e banco

- O `README.md` da raiz está vazio.
- O esquema MySQL está registrado em `database/01_schema.sql`.
- O dicionário de dados, relacionamentos, arquitetura e contrato estão em `database/02_dicionario_dados.md`, `database/03_relacionamentos.md`, `docs/04_arquitetura_geral.md` e `docs/05_contrato_api_endpoints.md`.
- A pasta `backend/` existe, mas está vazia. Não há API, autenticação, conexão MySQL ou dependências de backend implementadas.

### Frontend

O frontend usa React, JavaScript, Vite, React Router DOM e CSS puro. As rotas existentes são `/`, `/login`, `/cadastro`, `/cadastro/empresa` e `/cadastro/motorista`; a rota curinga retorna à landing page.

Já existem landing page, navegação, tela de login visual, escolha do tipo de cadastro e formulários de empresa e motorista PJ. A validação local contempla CPF, CNPJ numérico/alfanumérico e confirmação de senha; e-mail usa os atributos HTML `type="email"` e `required`. Os formulários não chamam API nem persistem dados: após validação local, exibem mensagem de integração pendente. Não há serviços HTTP, estado de sessão, rotas autenticadas ou dashboards.

Campos relevantes dos formulários existentes:

- **Empresa:** `razaoSocial`, `nomeFantasia`, `cnpj`, `telefone`, `email`, senha e confirmação.
- **Motorista:** `nomeCompleto`, `cpf`, `cnpj`, `telefone`, `email`, senha e confirmação.
- **Login:** `email` e senha.

Na integração, o campo visual `nomeCompleto` deverá ser mapeado para `motorista.nome`; o contrato propõe `senha` na API e mantém confirmação de senha como validação local. Não enviar a confirmação como campo persistido.

## 4. Tecnologias e arquitetura planejada

| Parte | Tecnologia | Situação/responsabilidade |
|---|---|---|
| Frontend | React, JavaScript, Vite, React Router DOM, CSS puro | Implementado parcialmente; interface e formulários públicos. |
| Backend | Node.js, Express, JavaScript | Planejado; Rafael implementará rotas, API, autenticação e regras. |
| Persistência | MySQL 8 | Banco existente; esquema documentado em `database/01_schema.sql`. |
| Comunicação | API REST com JSON | Contrato planejado; ainda sem integração. |

A arquitetura é uma aplicação única organizada por camadas, sem microserviços. O navegador comunica-se com a API; somente o backend acessa o MySQL. As bibliotecas de acesso a dados, validação e sessão não foram selecionadas.

## 5. Estrutura sugerida para o backend

Estrutura de referência, **não criada** e sujeita a ajuste pelo Rafael conforme os módulos forem implementados:

```text
backend/
├── src/
│   ├── config/          # configuração de ambiente e MySQL
│   ├── routes/          # caminhos e métodos REST
│   ├── controllers/     # tradução HTTP, delegação e respostas
│   ├── services/        # regras de negócio e coordenação de fluxos
│   ├── repositories/    # consultas parametrizadas e persistência
│   ├── middlewares/     # autenticação, autorização, validação e erros
│   ├── validations/     # regras de entrada por operação
│   └── app.js           # configuração do Express
└── server.js            # inicialização do servidor
```

Responsabilidades resumidas:

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
| `veiculo` | Vários veículos podem pertencer a um motorista por `motorista_id`; placa e RENAVAM têm `UNIQUE` próprios; inclui `disponivel`. |
| `interesse` | Referencia uma empresa e um motorista; `veiculo_id` é opcional. Status SQL: `PENDENTE`, `ACEITO`, `RECUSADO`. |

As FKs confirmam a existência dos registros relacionados. Elas não garantem correspondência entre `usuario.tipo_usuario` e a tabela de perfil, propriedade do veículo em relação ao motorista do interesse, CNPJ global entre as duas tabelas ou exclusividade entre os perfis.

## 7. Regras de negócio e responsabilidades do backend

### Regras aprovadas

- E-mail único para login.
- CNPJ obrigatório e globalmente único entre empresa e motorista.
- Um usuário só pode ter perfil `EMPRESA` ou `MOTORISTA`, nunca ambos.
- `ADMIN` é tipo de usuário, sem tabela própria; cadastro público não pode criar `ADMIN`.
- Motorista pode possuir vários veículos e várias qualificações.
- Veículo associado a interesse deve pertencer ao motorista indicado; na criação com veículo, este deve existir e estar disponível.
- Inativação é lógica: bloqueia acesso, preserva registros e histórico e invalida sessões ativas.
- O fluxo normal não realiza exclusões físicas de usuários ou registros históricos.

### Aplicação no backend

- Validar entrada novamente no servidor; validação de frontend é somente apoio de interface.
- Normalizar e-mail removendo espaços externos e convertendo para minúsculas; aplicar a mesma forma no cadastro, login e validação de unicidade.
- Criar usuário e perfil correspondente de forma consistente, usando transação para gravações relacionadas.
- Não aceitar tipo `ADMIN` nos endpoints públicos de cadastro.
- Aplicar autorização por perfil e propriedade em cada rota protegida; derivar a identidade do solicitante pela sessão.
- Em interesse, obter `empresaId` da sessão. `motoristaId` identifica o destinatário e `veiculoId` é opcional; validar que o veículo existe, está disponível e pertence ao motorista indicado.
- Na busca, retornar por padrão somente contas ativas (`usuario.status = TRUE`) e motoristas disponíveis (`motorista.disponivel = TRUE`). Distinguir esses estados da disponibilidade individual do veículo (`veiculo.disponivel`).
- Os campos dos veículos que serão exibidos às empresas na busca ainda precisam ser definidos e validados durante a implementação. Não exponha dados sensíveis sem aprovação.
- Na inativação administrativa, definir `usuario.status = FALSE`, bloquear login e rotas protegidas e invalidar sessões ativas sem apagar histórico.
- Usar consultas parametrizadas, tratar violações de unicidade como conflitos e não expor SQL, stack traces ou dados sensíveis.

O SQL impõe `UNIQUE` separado para CNPJ de empresa e motorista e para `usuario_id` de cada perfil. Não impõe unicidade global de CNPJ nem exclusividade de perfil. A validação deve considerar requisições concorrentes; não há estratégia aprovada ainda.

## 8. Referência do contrato de API

Usar [`05_contrato_api_endpoints.md`](./05_contrato_api_endpoints.md) como referência atual dos endpoints planejados, permissões, exemplos, respostas e erros. O contrato não é implementação e deve ser alinhado com Rafael antes de integrar os formulários.

Grupos principais de endpoints previstos:

- **Autenticação:** cadastro de empresa/motorista, login, identidade autenticada e logout condicional à estratégia de sessão.
- **Perfis:** `/companies/me` e `/drivers/me`.
- **Busca:** `GET /drivers`, autenticado por empresa.
- **Veículos e qualificações:** gestão pelo motorista proprietário, sem exclusão física proposta.
- **Interesses:** empresa cria e consulta os seus; motorista consulta os recebidos e pode aceitar/recusar conforme transições a definir.
- **Administração:** `PATCH /admin/users/:id/status` para inativação lógica, planejado e ainda não implementado.

O prefixo proposto é `/api/v1`; corpos e respostas são JSON com nomes de propriedades `camelCase`. Datas da API usam ISO 8601 UTC; o frontend converte para horário local na apresentação.

## 9. Autenticação, autorização, sessões e segurança

- **Autenticação:** login compartilhado por e-mail e senha; o backend verifica a senha usando mecanismo seguro ainda a escolher e recusa conta inativa.
- **Autorização:** perfis `EMPRESA`, `MOTORISTA` e `ADMIN`; validar também propriedade do registro. Proteger API no servidor, não somente rotas React.
- **Sessões:** invalidar sessões ativas quando ADMIN inativar a conta é requisito. Tipo de sessão, transporte, armazenamento, expiração, renovação, logout e mecanismo de revogação continuam pendentes.
- **Senhas:** armazenar somente hash seguro; algoritmo e parâmetros ainda não foram decididos. Nunca devolver senha/hash ou registrá-los em logs.
- **E-mail:** normalizar antes de persistir e consultar. Charset/collation atuais e dados de e-mail existentes precisam ser verificados para alinhar `UNIQUE` à comparação sem distinção de caixa.
- **Dados pessoais:** não expor CPF, CNPJ, e-mail, telefone, senha, placa ou RENAVAM nos resultados de busca. Campos públicos restantes, inclusive exibição de nome, precisam de aprovação.
- **SQL:** usar consultas parametrizadas. Usar transações quando o fluxo depender de gravações relacionadas.
- **Erros:** resposta padronizada sem detalhes internos; conflito de unicidade não deve revelar informação além do necessário.

Para datas, API usa UTC em ISO 8601 (`Z`). O tipo SQL `DATETIME` não registra fuso; a conexão MySQL deve ser configurada em UTC ou o backend deve fazer conversões explícitas, sem mudar o esquema nesta etapa. A apresentação local ocorre no frontend.

## 10. Erros e validações

Convenção proposta no contrato:

| HTTP | Uso esperado |
|---|---|
| `200` | Consulta/atualização com conteúdo. |
| `201` | Recurso criado. |
| `204` | Sucesso sem corpo, se aplicável ao logout escolhido. |
| `400` | JSON malformado, parâmetros inválidos ou campos obrigatórios ausentes. |
| `401` | Credencial ausente/inválida/expirada ou login recusado; mensagem genérica para credencial inválida ou conta inativa. |
| `403` | Perfil ou propriedade sem autorização. |
| `404` | Rota ou recurso inexistente. |
| `409` | Conflito de unicidade ou estado. |
| `422` | Dados bem formados que falham validação de domínio. |
| `500` | Erro inesperado, sem stack trace na resposta. |

Validar tipos, campos permitidos e tamanhos; CNPJ/CPF, e-mail, placa e RENAVAM; disponibilidade/propriedade de veículo em interesse; perfil e status da conta. Regras de estado de interesse, duplicidade e algumas validações de domínio precisam de decisão antes de codificar.

## 11. Pendências técnicas

Não decidir unilateralmente os itens abaixo; alinhar com Samy antes de fechar a implementação:

1. Estratégia de sessão e revogação, mantendo como requisito invalidar sessões ativas na inativação.
2. Biblioteca de acesso ao MySQL e mecanismo de transações.
3. Estratégia concorrente para CNPJ globalmente único e perfil exclusivo, sem garantia equivalente no esquema atual.
4. Normalização, collation e tratamento dos e-mails já existentes.
5. Configuração UTC da conexão MySQL ou conversões para `DATETIME`.
6. Provisionamento da primeira conta `ADMIN`.
7. Proteção contra auto-inativação e contra inativar o último administrador.
8. Política de inativação individual de veículos e qualificações; não há campos de status para eles.
9. Campos públicos e política de privacidade para busca de motoristas e veículos.
10. Critérios definitivos de busca e paginação.
11. Transições de interesse, duplicidade e comportamento após aceite/recusa.
12. Campos de perfil editáveis, incluindo alteração de e-mail/documentos.
13. CORS, variáveis de ambiente e detalhes de implantação.

## 12. Plano sugerido de implementação

1. **Alinhar decisões:** fechar itens bloqueantes acima e confirmar o contrato de `docs/05_contrato_api_endpoints.md`.
2. **Preparar base do backend:** inicialização Node/Express, configuração de ambiente e conexão MySQL, sem escolher biblioteca sem alinhamento.
3. **Fundação HTTP:** rotas, validação, autenticação/autorização como estrutura, tratamento centralizado de erros e consultas parametrizadas.
4. **Cadastro e login:** cadastro transacional, hash de senha, normalização de e-mail, login, identidade autenticada, conta ativa e sessão/revogação.
5. **Perfis e inativação:** endpoints `me`, autorização de propriedade e inativação administrativa com preservação histórica.
6. **Veículos e qualificações:** operações de leitura/criação/atualização conforme contrato; sem exclusões físicas.
7. **Busca e interesses:** filtros aprovados, privacidade, verificação de status/disponibilidade e validação de veículo pertencente ao motorista.
8. **Integração React:** serviços HTTP, mapeamento de formulário, estados de carregamento/erro e rotas protegidas após contrato acordado.
9. **Verificação e entrega:** testes automatizados/manuais do contrato, segurança, regras concorrentes e fluxos ponta a ponta; corrigir resultados e atualizar documentação final.

## 13. Critérios de conclusão e testes

Critérios mínimos para considerar o backend do MVP pronto para integração final:

- Cadastro de empresa e motorista cria `usuario` e perfil correto sem aceitar `ADMIN` público; falha parcial não deixa cadastro inconsistente.
- Login funciona com normalização acordada; credenciais incorretas e contas inativas não autenticam.
- Inativação por ADMIN autorizado define `status = FALSE`, bloqueia acesso, invalida sessões ativas e mantém os registros relacionados.
- A API impede perfil duplo e CNPJ repetido globalmente inclusive em cenários concorrentes, conforme estratégia aprovada.
- Motorista só gerencia os próprios veículos e qualificações.
- Busca exclui conta inativa e motorista indisponível; filtros e campos retornados obedecem às decisões de privacidade.
- Interesse só é criado pela empresa autenticada; o veículo opcional deve existir, estar disponível e pertencer ao motorista indicado.
- Erros seguem o formato e status acordados; respostas/logs não vazam senha, hash, SQL ou dados privados indevidos.
- Datas são serializadas em UTC e apresentadas localmente pelo frontend.
- Formulários React estão conectados ao contrato; erros do servidor são associados corretamente aos campos e estados da interface.

Testes recomendados, ainda não executados:

- Unitários para normalização e validação de entrada e regras de domínio.
- Integração MySQL para constraints, transações, unicidade e rollback.
- Integração HTTP para status, payloads, autorização por perfil/propriedade e erros.
- Concorrência para CNPJ global e exclusividade de perfil.
- Sessão: conta ativa/inativa, invalidação após operação administrativa e acesso protegido.
- Busca: combinações de status da conta, disponibilidade do motorista/veículo e filtros aprovados.
- Interesse: `veiculoId` ausente, válido, indisponível, inexistente ou pertencente a outro motorista.
- Ponta a ponta dos formulários de cadastro/login e dos fluxos definidos no MVP.

## 14. Divisão de responsabilidades

| Responsável | Responsabilidade |
|---|---|
| Samy | Frontend, preparação do banco e documentação técnica; alinhar decisões de produto e regras que impactem o contrato/esquema. |
| Rafael | Backend, API, autenticação, regras no servidor, persistência MySQL e integração do frontend com a API. |
| Samy e Rafael | Integração final, testes finais, deploy, documentação final e apresentação. |

## 15. Integração com o frontend existente

- Preservar as rotas públicas atuais: `/`, `/login`, `/cadastro`, `/cadastro/empresa`, `/cadastro/motorista`.
- Criar serviços HTTP no frontend somente após acordar o contrato; componentes não acessam MySQL diretamente.
- Cadastro de empresa envia os campos definidos no contrato. Confirmação de senha permanece validação local, salvo acordo diferente.
- Cadastro de motorista mapeia `nomeCompleto` do formulário para `nome` da API. O campo `password` do formulário é enviado como `senha`; `confirmPassword` não é persistido.
- A validação no backend é obrigatória mesmo quando o formulário já valida CPF/CNPJ.
- Exibir erros `409` de e-mail/documentos duplicados e `422` de validação nos campos correspondentes sem revelar dados de outra conta.
- Implementar estado de sessão e rotas protegidas por perfil apenas após definir transporte/armazenamento da sessão. Autorização real permanece no backend.
- Integrar formulários em mudanças isoladas e coordenadas, já que Samy mantém o frontend e Rafael é responsável pelo backend e pela integração.

## Referências consultadas

- `README.md` (raiz; vazio).
- `database/01_schema.sql`.
- `database/02_dicionario_dados.md`.
- `database/03_relacionamentos.md`.
- `docs/04_arquitetura_geral.md`.
- `docs/05_contrato_api_endpoints.md`.
- Estrutura e arquivos atuais em `frontend/`, incluindo `package.json`, rotas, páginas, formulários, validações locais e mensagem de integração pendente.

**Este handoff é documentação de transferência; não implementa backend, endpoints ou autenticação.** As decisões listadas na seção 11 permanecem pendentes de alinhamento. Aguarde revisão antes de commit ou push.
