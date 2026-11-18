# Digital Store — Back-end

API REST desenvolvida por **Mariana Vitória Bernardino Nicolau** como projeto final de Back-end.

Implementa gerenciamento de usuários, categorias e produtos, autenticação JWT, upload de imagens e persistência em MySQL.

## Tecnologias

- Node.js
- Express
- MySQL 8.4
- Sequelize e Sequelize CLI
- Dotenv
- Bcrypt
- JSON Web Token
- Zod
- Helmet e CORS
- Swagger UI
- Jest e Supertest
- Nodemon

## Requisitos locais

- Node.js com suporte às dependências do projeto
- npm
- MySQL em execução
- Git

O projeto foi executado e testado com Node.js 26.13.0 e MySQL 8.4.

## Instalação

Clone este repositório e abra sua pasta.

Instale as dependências:

```bash
npm ci
```

Copie o modelo de variáveis de ambiente.

No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com as configurações do seu MySQL:

```dotenv
NODE_ENV=development
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=digital_store
DB_USER=root
DB_PASSWORD="SUA_SENHA"

JWT_SECRET=SUBSTITUA_POR_UMA_CHAVE_ALEATORIA
JWT_EXPIRES_IN=1h
```

Gere uma chave aleatória:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copie o resultado para `JWT_SECRET` no `.env`.

Não publique o arquivo `.env` nem utilize a chave de exemplo.

O usuário do MySQL precisa de permissão para criar os bancos e executar as migrations. O uso de root é apenas uma conveniência de configuração local; em produção, utilize um usuário dedicado.

## Banco de dados

Crie o banco de desenvolvimento:

```bash
npm run db:create
```

Execute as migrations:

```bash
npm run db:migrate
```

As migrations criam:

- `users`
- `categories`
- `products`
- `product_images`
- `product_options`
- `product_categories`

O Sequelize também cria `SequelizeMeta` para controlar as migrations executadas.

Produtos e categorias possuem uma relação muitos para muitos. Imagens e opções pertencem a um produto.

Ao excluir um produto, suas imagens, opções e associações são removidas por cascata. Ao excluir uma categoria, suas associações são removidas, preservando os produtos.

Para desfazer a última migration:

```bash
npm run db:undo
```

Atenção: desfazer a migration inicial remove as tabelas e seus dados.

## Execução

Desenvolvimento, com reinício automático:

```bash
npm run dev
```

Execução sem Nodemon:

```bash
npm start
```

Endereços padrão:

- API: http://localhost:3000
- Verificação de conexão: http://localhost:3000/health
- Swagger: http://localhost:3000/docs
- Especificação OpenAPI: http://localhost:3000/openapi.json

No PowerShell, caso `npm.ps1` esteja bloqueado, utilize `npm.cmd` no lugar de `npm`.

## Endpoints

### Usuários

| Método | Rota | Autenticação |
| --- | --- | --- |
| POST | `/v1/user` | Pública |
| POST | `/v1/user/token` | Pública |
| GET | `/v1/user/:id` | Pública, conforme o escopo |
| PUT | `/v1/user/:id` | JWT da própria conta |
| DELETE | `/v1/user/:id` | JWT da própria conta |

### Categorias

| Método | Rota | Autenticação |
| --- | --- | --- |
| GET | `/v1/category/search` | Pública |
| GET | `/v1/category/:id` | Pública |
| POST | `/v1/category` | JWT |
| PUT | `/v1/category/:id` | JWT |
| DELETE | `/v1/category/:id` | JWT |

### Produtos

| Método | Rota | Autenticação |
| --- | --- | --- |
| GET | `/v1/product/search` | Pública |
| GET | `/v1/product/:id` | Pública |
| POST | `/v1/product` | JWT |
| PUT | `/v1/product/:id` | JWT |
| DELETE | `/v1/product/:id` | JWT |

## Autenticação

Cadastre uma conta:

```json
{
  "firstname": "Mariana",
  "surname": "Teste",
  "email": "mariana@example.com",
  "password": "Teste@123",
  "confirmPassword": "Teste@123"
}
```

Faça login em `POST /v1/user/token`:

```json
{
  "email": "mariana@example.com",
  "password": "Teste@123"
}
```

Envie o token recebido nas rotas protegidas:

```http
Authorization: Bearer SEU_TOKEN
```

No Swagger, utilize o botão **Authorize** e cole somente o token.

As senhas são armazenadas como hash bcrypt e não são retornadas pela API.

A senha de cadastro deve ter pelo menos 6 caracteres e no máximo 72 bytes em UTF-8.

Qualquer usuário autenticado pode gerenciar categorias e produtos, conforme o escopo implementado. Não há separação entre administrador e cliente.

Cada usuário só pode atualizar e excluir a própria conta. Tokens vinculados a contas excluídas são rejeitados.

## Busca e paginação

Categorias:

```text
/v1/category/search?limit=12&page=1
/v1/category/search?use_in_menu=true&fields=id,name,slug
```

Produtos:

```text
/v1/product/search?match=tenis
/v1/product/search?category_ids=1,2
/v1/product/search?price-range=100-250
/v1/product/search?fields=id,name,price,images
/v1/product/search?option[1]=40,41
```

Substitua o ID da opção por um ID existente no banco.

- `limit` padrão: 12.
- `page` padrão: 1.
- `limit=-1` retorna todos os resultados e ignora a página.
- A resposta contém `data`, `total`, `limit` e `page`.
- `total` representa a quantidade de produtos ou categorias que correspondem aos filtros, antes da paginação.
- `price-range` utiliza o preço original, no campo `price`.
- Categorias informadas na mesma busca utilizam OU.
- Valores da mesma opção utilizam OU.
- Filtros de opções distintas utilizam E.

## Produtos, imagens e opções

O cadastro e a atualização de produtos exigem:

- `name`
- `slug`
- `price`
- `price_with_discount`

O preço com desconto não pode ser maior que o preço original.

Quando enviado na atualização, `category_ids` substitui as associações do produto. Uma lista vazia remove as associações.

### Imagens

Novas imagens são enviadas dentro de `images`:

```json
{
  "type": "image/png",
  "content": "BASE64_PURO_DA_IMAGEM"
}
```

- PNG ou JPEG.
- Até 5 MB por arquivo.
- Limite de 10 MB para o corpo JSON completo.
- O conteúdo deve ser Base64 puro, sem o prefixo `data:`.
- Os arquivos ficam em `uploads/`.
- O caminho retornado pode ser acessado no servidor, como `/uploads/arquivo.png`.
- Os arquivos enviados não são versionados no Git.

Para substituir uma imagem existente, informe seu `id` e o novo conteúdo. Para excluir:

```json
{
  "id": 1,
  "deleted": true
}
```

### Opções

Exemplo de nova opção:

```json
{
  "title": "Tamanho",
  "shape": "square",
  "radius": 4,
  "type": "text",
  "values": ["39", "40", "41"]
}
```

Para alterar uma opção, envie seu `id` e os campos que deseja modificar:

```json
{
  "id": 1,
  "radius": "6px",
  "values": ["40", "41", "42"]
}
```

Para excluir:

```json
{
  "id": 1,
  "deleted": true
}
```

Opções e imagens omitidas na atualização são preservadas. Os IDs precisam pertencer ao produto atualizado.

O campo `value` também é aceito como alternativa a `values`, devido à variação dos exemplos da documentação oficial. Não envie ambos.

## Respostas HTTP

- `200`: consulta ou login realizado.
- `201`: registro criado.
- `204`: atualização ou exclusão realizada, sem corpo.
- `400`: dados inválidos ou credenciais de login incorretas.
- `401`: token ausente, inválido ou expirado.
- `403`: tentativa de alterar ou excluir a conta de outro usuário.
- `404`: registro ou rota não encontrado.
- `413`: corpo da requisição acima do limite.
- `500`: erro interno, sem exposição dos detalhes ao cliente.

A documentação oficial apresenta uma divergência entre 400 e 401 para token inválido. Este projeto utiliza 401, conforme os exemplos dos endpoints protegidos e o significado do status HTTP.

## Testes automatizados

Os testes usam o banco separado `digital_store_test`.

Crie e prepare o banco:

```bash
npm run db:create -- --env test
npm run db:migrate -- --env test
```

Execute:

```bash
npm test
```

A suíte contém 19 testes: 13 de integração com MySQL e 6 testes unitários focados, utilizando Jest e Supertest. A cobertura inclui:

- Conexão com o banco.
- Cadastro, hash de senha e login.
- Rejeição de dados inválidos.
- Autenticação e proteção da conta.
- Consulta de categorias.
- Criação, busca, atualização e exclusão de produtos.
- Upload e exclusão de imagem.
- Atualização individual de opção.
- Rollback de operação inválida.
- Respostas HTTP e exclusão de registros.

Os testes criam dados próprios e removem os principais registros utilizados ao finalizar. Não configure o banco de testes com dados reais.

## Organização

```text
src/
├── config/
├── controllers/
├── database/
│   ├── migrations/
│   └── seeders/
├── docs/
├── middleware/
├── models/
├── routes/
├── services/
├── app.js
└── server.js
tests/
uploads/
```

- Rotas definem os endpoints.
- Controllers recebem as requisições e produzem as respostas.
- Models representam as tabelas e associações.
- Services concentram o processamento das relações e dos arquivos dos produtos.
- Middleware valida a autenticação.
- Migrations versionam a estrutura do banco.

## Escopo e limitações

Este projeto implementa uma API educacional conforme o escopo de usuários, categorias e produtos.

Não inclui pagamentos, pedidos, recuperação de senha, envio de e-mails ou integração com o projeto de Front-end. Não há dados iniciais automáticos; cadastre os registros pela API ou pelo Swagger.

Para uso em produção, ainda são necessários ajustes como controle de acesso administrativo, limites de requisições, configuração de CORS por origem, HTTPS e estratégia de armazenamento e backup das imagens.

## Referência

[Documentação oficial do projeto](https://github.com/digitalcollegebr/projeto-backend)

## Melhorias na atualização de imagens e nas consultas

- A atualização aceita o caminho relativo ou uma URL HTTP/HTTPS cujo caminho corresponda à imagem já cadastrada, preservando o arquivo. Não realiza download da URL. Para substituir a imagem, envie Base64.
- A busca consulta apenas os campos e relações solicitados em fields. O ID pode ser consultado internamente para associar os registros, sem aparecer na resposta quando não solicitado.
- Os filtros de opções são consultados em lote.
- Imagens e opções solicitadas na resposta são carregadas separadamente para evitar a multiplicação de linhas dos relacionamentos.
