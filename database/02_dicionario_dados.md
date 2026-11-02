# Dicionário de dados — BioCargo

## 1. Objetivo do banco de dados

O banco `biocargo` armazena os usuários e seus perfis de empresa ou motorista PJ, as qualificações e veículos associados a motoristas e os interesses que relacionam empresas a motoristas, com possibilidade de indicar um veículo.

Este documento descreve o esquema registrado em [`01_schema.sql`](./01_schema.sql) e as regras de negócio fornecidas. A existência de uma tabela ou coluna não significa que os fluxos correspondentes já estejam implementados na aplicação.

## 2. Descrição geral das tabelas

| Tabela | Descrição |
|---|---|
| `usuario` | Armazena e-mail, senha, perfil, status e data de cadastro. Os perfis permitidos no SQL são `EMPRESA`, `MOTORISTA` e `ADMIN`. |
| `empresa` | Armazena dados da empresa e referencia um usuário. |
| `motorista` | Armazena dados do motorista PJ e referencia um usuário. |
| `qualificacao` | Armazena qualificações associadas a um motorista. |
| `veiculo` | Armazena veículos associados a um motorista. |
| `interesse` | Relaciona uma empresa e um motorista e pode referenciar um veículo. |

## 3. Dicionário de dados

### `usuario`

| Campo | Tipo de dado | Obrigatório (SIM/NÃO) | Chave/restrição | Descrição |
|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | SIM | Chave primária (`PRIMARY KEY`) | Identificador do usuário, gerado automaticamente. |
| `email` | `VARCHAR(255)` | SIM | `UNIQUE` | E-mail do usuário; o SQL impede valores duplicados. |
| `senha` | `VARCHAR(255)` | SIM | — | Campo destinado à senha armazenada para o usuário. O SQL não especifica como ela é protegida. |
| `tipo_usuario` | `ENUM('EMPRESA', 'MOTORISTA', 'ADMIN')` | SIM | `ENUM` | Perfil do usuário, limitado a `EMPRESA`, `MOTORISTA` ou `ADMIN`. |
| `status` | `BOOLEAN` | SIM | `DEFAULT TRUE` | Status do usuário; assume `TRUE` quando não informado. |
| `data_cadastro` | `DATETIME` | SIM | `DEFAULT CURRENT_TIMESTAMP` | Data e hora do cadastro, preenchidas com o horário corrente quando não informadas. |

### `empresa`

| Campo | Tipo de dado | Obrigatório (SIM/NÃO) | Chave/restrição | Descrição |
|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | SIM | Chave primária (`PRIMARY KEY`) | Identificador da empresa, gerado automaticamente. |
| `usuario_id` | `INT` | SIM | `UNIQUE`; chave estrangeira `fk_empresa_usuario` → `usuario(id)` | Usuário associado à empresa. O valor não pode se repetir nesta tabela e deve referenciar um usuário existente. |
| `razao_social` | `VARCHAR(255)` | SIM | — | Razão social da empresa. |
| `nome_fantasia` | `VARCHAR(255)` | NÃO | — | Nome fantasia da empresa. |
| `cnpj` | `VARCHAR(18)` | SIM | `UNIQUE` | CNPJ da empresa; o SQL impede valores duplicados. |
| `telefone` | `VARCHAR(20)` | NÃO | — | Telefone da empresa. |

### `motorista`

| Campo | Tipo de dado | Obrigatório (SIM/NÃO) | Chave/restrição | Descrição |
|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | SIM | Chave primária (`PRIMARY KEY`) | Identificador do motorista, gerado automaticamente. |
| `usuario_id` | `INT` | SIM | `UNIQUE`; chave estrangeira `fk_motorista_usuario` → `usuario(id)` | Usuário associado ao motorista. O valor não pode se repetir nesta tabela e deve referenciar um usuário existente. |
| `nome` | `VARCHAR(255)` | SIM | — | Nome do motorista. |
| `cpf` | `VARCHAR(14)` | SIM | `UNIQUE` | CPF do motorista; o SQL impede valores duplicados. |
| `cnpj` | `VARCHAR(18)` | SIM | `UNIQUE` | CNPJ do motorista PJ; o SQL impede valores duplicados. |
| `telefone` | `VARCHAR(20)` | NÃO | — | Telefone do motorista. |
| `disponivel` | `BOOLEAN` | SIM | `DEFAULT FALSE` | Indicador de disponibilidade; assume `FALSE` quando não informado. |

### `qualificacao`

| Campo | Tipo de dado | Obrigatório (SIM/NÃO) | Chave/restrição | Descrição |
|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | SIM | Chave primária (`PRIMARY KEY`) | Identificador da qualificação, gerado automaticamente. |
| `motorista_id` | `INT` | SIM | Chave estrangeira `fk_qualificacao_motorista` → `motorista(id)` | Motorista ao qual a qualificação está associada. |
| `titulo` | `VARCHAR(255)` | SIM | — | Título da qualificação. |
| `descricao` | `TEXT` | NÃO | — | Descrição da qualificação. |

### `veiculo`

| Campo | Tipo de dado | Obrigatório (SIM/NÃO) | Chave/restrição | Descrição |
|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | SIM | Chave primária (`PRIMARY KEY`) | Identificador do veículo, gerado automaticamente. |
| `motorista_id` | `INT` | SIM | Chave estrangeira `fk_veiculo_motorista` → `motorista(id)` | Motorista associado ao veículo. A regra de negócio permite que um motorista tenha vários veículos. |
| `placa` | `VARCHAR(8)` | SIM | `UNIQUE` | Placa do veículo; o SQL impede valores duplicados. |
| `renavam` | `VARCHAR(11)` | SIM | `UNIQUE` | RENAVAM do veículo; o SQL impede valores duplicados. |
| `marca` | `VARCHAR(100)` | SIM | — | Marca do veículo. |
| `modelo` | `VARCHAR(100)` | SIM | — | Modelo do veículo. |
| `ano` | `INT` | SIM | — | Ano do veículo. O SQL não define faixa de valores. |
| `disponivel` | `BOOLEAN` | SIM | `DEFAULT FALSE` | Indicador de disponibilidade do veículo; assume `FALSE` quando não informado. |

### `interesse`

| Campo | Tipo de dado | Obrigatório (SIM/NÃO) | Chave/restrição | Descrição |
|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | SIM | Chave primária (`PRIMARY KEY`) | Identificador do interesse, gerado automaticamente. |
| `empresa_id` | `INT` | SIM | Chave estrangeira `fk_interesse_empresa` → `empresa(id)` | Empresa relacionada ao interesse. |
| `motorista_id` | `INT` | SIM | Chave estrangeira `fk_interesse_motorista` → `motorista(id)` | Motorista relacionado ao interesse. |
| `veiculo_id` | `INT` | NÃO | Chave estrangeira `fk_interesse_veiculo` → `veiculo(id)` | Veículo opcional relacionado ao interesse. Quando preenchido, deve referenciar um veículo existente. |
| `status` | `ENUM('PENDENTE', 'ACEITO', 'RECUSADO')` | SIM | `ENUM`; `DEFAULT 'PENDENTE'` | Estado do interesse, limitado aos valores indicados; assume `PENDENTE` quando não informado. |
| `data_criacao` | `DATETIME` | SIM | `DEFAULT CURRENT_TIMESTAMP` | Data e hora de criação do interesse, preenchidas com o horário corrente quando não informadas. |

## 4. Regras de negócio relacionadas ao banco

### Registradas como restrições no SQL

- O e-mail de `usuario` é obrigatório e único.
- `empresa.cnpj` é obrigatório e único.
- `motorista.cpf` e `motorista.cnpj` são obrigatórios e únicos, cada um em sua coluna.
- Os perfis de usuário são limitados pelo `ENUM` a `EMPRESA`, `MOTORISTA` e `ADMIN`.
- O estado de interesse é limitado pelo `ENUM` a `PENDENTE`, `ACEITO` e `RECUSADO`.
- As chaves estrangeiras exigem que os registros referenciados existam.
- `interesse.veiculo_id` é opcional; os demais campos de referência de `interesse` são obrigatórios.

### Regras de negócio aprovadas

- O e-mail é único para cada usuário.
- O CNPJ deve ser único globalmente entre as tabelas `empresa` e `motorista`.
- Cada usuário pode ter somente um perfil: `EMPRESA` ou `MOTORISTA`, nunca ambos simultaneamente. `ADMIN` é um tipo de usuário, não um perfil de empresa ou motorista.
- Um motorista PJ pode cadastrar vários veículos.
- Um motorista pode possuir várias qualificações.
- Um interesse relaciona uma empresa a um motorista e pode indicar um veículo opcionalmente.
- Um `ADMIN` autorizado realiza a inativação lógica do usuário por `usuario.status = FALSE`; ela bloqueia o acesso e preserva registros e histórico. O fluxo normal não realiza exclusões físicas de usuários ou registros históricos.

Essas regras de negócio não são todas garantidas pelo SQL. As restrições que o banco realmente impõe estão listadas na seção anterior; as regras que exigem validação ou política de aplicação são detalhadas nas observações técnicas. As relações de um motorista para veículos e qualificações são compatíveis com o SQL: as respectivas tabelas guardam `motorista_id` sem restrição `UNIQUE`. O relacionamento do interesse com empresa, motorista e veículo é representado pelas chaves estrangeiras declaradas.

## 5. Observações técnicas e limitações identificadas no SQL

- As restrições `UNIQUE` e `NOT NULL` descritas acima são as declaradas diretamente nas tabelas. As regras de formato e validade de e-mail, CPF, CNPJ, placa e RENAVAM não são definidas no SQL e devem ser validadas no backend.
- O SQL declara `usuario.email` como `UNIQUE`, mas não declara charset ou collation. Remoção de espaços externos e normalização para minúsculas, aplicadas de modo consistente no cadastro, login e verificação de unicidade, são responsabilidades do backend.
- O SQL não define uma restrição que obrigue `empresa.usuario_id` a apontar para um usuário com `tipo_usuario = 'EMPRESA'`, ou `motorista.usuario_id` para um usuário com `tipo_usuario = 'MOTORISTA'`. Essa correspondência de perfil deve ser validada no backend.
- As restrições `UNIQUE` de `empresa.usuario_id` e `motorista.usuario_id` são independentes. O SQL apresentado não impede, por si só, que o mesmo usuário apareça uma vez em cada uma dessas tabelas.
- A unicidade do CNPJ é garantida pelo SQL separadamente em `empresa.cnpj` e `motorista.cnpj`; não há garantia global entre as duas tabelas. O backend deve aplicar a regra global aprovada e tratar requisições simultâneas.
- A exclusividade do perfil `EMPRESA` ou `MOTORISTA` é uma regra aprovada, mas os `UNIQUE` de `usuario_id` em cada tabela são independentes e não impedem que o mesmo usuário esteja nas duas.
- `usuario.status` pode registrar a inativação lógica (`FALSE`), mas o SQL não bloqueia login ou acesso nem implementa a política de preservação histórica. O backend deve bloquear acesso, preservar os registros e não realizar exclusões físicas no fluxo normal.
- A chave estrangeira `interesse.veiculo_id` garante que o veículo exista, mas o SQL não garante que ele pertença ao motorista indicado no mesmo interesse. Essa consistência deve ser verificada no backend.
- O SQL não declara restrições para valores de `ano`, nem outras validações de domínio para os campos textuais ou numéricos além dos tipos e tamanhos definidos.
- As tabelas `qualificacao`, `veiculo` e `interesse` não declaram unicidade para a combinação de seus campos. Portanto, não há no SQL uma restrição que impeça registros repetidos nessas tabelas.
- `usuario.status`, `motorista.disponivel` e `veiculo.disponivel` são campos booleanos com os valores padrão indicados. Somente `usuario.status` será usado para inativação lógica da conta; o bloqueio de acesso, a invalidação de sessões e a preservação histórica dependem do backend. `motorista` e `veiculo` não possuem campos de status ou inativação individual.
- O SQL não especifica ações `ON DELETE` ou `ON UPDATE` nas chaves estrangeiras. Também não especifica mecanismo de armazenamento, charset ou collation.
- Embora `usuario.senha` seja obrigatória, o SQL não define hash, política de senha ou processo de autenticação. Esses comportamentos pertencem à aplicação/backend.
- O SQL não contém uma tabela separada para administradores; o perfil `ADMIN` está representado em `usuario.tipo_usuario`.
