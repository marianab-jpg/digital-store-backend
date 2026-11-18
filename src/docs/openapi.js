const ref = (name) => ({
  $ref: `#/components/schemas/${name}`,
})

const json = (schema) => ({
  'application/json': { schema },
})

const body = (schema) => ({
  required: true,
  content: json(schema),
})

const response = (description, schema) => ({
  description,
  ...(schema ? { content: json(schema) } : {}),
})

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'integer',
    minimum: 1,
  },
  description: 'ID do registro.',
}

const query = (name, schema, description) => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
})

const secured = [{ bearerAuth: [] }]

const errorResponses = {
  400: response('Dados inválidos.', ref('Error')),
  401: response('Token ausente, inválido ou expirado.', ref('Error')),
  404: response('Registro não encontrado.', ref('Error')),
  500: response('Erro interno.', ref('Error')),
}

const categoryProperties = {
  name: {
    type: 'string',
    example: 'Tênis',
  },
  slug: {
    type: 'string',
    example: 'tenis',
  },
  use_in_menu: {
    type: 'boolean',
    default: false,
  },
}

const productProperties = {
  enabled: {
    type: 'boolean',
    default: false,
  },
  name: {
    type: 'string',
    example: 'Tênis esportivo',
  },
  slug: {
    type: 'string',
    example: 'tenis-esportivo',
  },
  use_in_menu: {
    type: 'boolean',
    default: false,
  },
  stock: {
    type: 'integer',
    minimum: 0,
    example: 10,
  },
  description: {
    type: 'string',
    nullable: true,
    maxLength: 255,
  },
  price: {
    type: 'number',
    minimum: 0,
    example: 200,
  },
  price_with_discount: {
    type: 'number',
    minimum: 0,
    example: 150,
  },
  category_ids: {
    type: 'array',
    items: {
      type: 'integer',
      minimum: 1,
    },
    example: [1],
  },
}

function collectionResponse(item) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: ref(item),
      },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      page: { type: 'integer' },
    },
  }
}

function resourcePaths(resource, tag, input, output) {
  return {
    [`/v1/${resource}`]: {
      post: {
        tags: [tag],
        summary: `Cadastrar ${resource === 'category' ? 'categoria' : 'produto'}`,
        security: secured,
        requestBody: body(ref(input)),
        responses: {
          ...errorResponses,
          201: response('Registro criado.', ref(output)),
        },
      },
    },
    [`/v1/${resource}/{id}`]: {
      parameters: [idParameter],
      get: {
        tags: [tag],
        summary: 'Consultar pelo ID',
        responses: {
          ...errorResponses,
          200: response('Registro encontrado.', ref(output)),
        },
      },
      put: {
        tags: [tag],
        summary: 'Atualizar pelo ID',
        security: secured,
        requestBody: body(ref(input)),
        responses: {
          ...errorResponses,
          204: response('Atualizado. Não retorna corpo.'),
        },
      },
      delete: {
        tags: [tag],
        summary: 'Excluir pelo ID',
        security: secured,
        responses: {
          ...errorResponses,
          204: response('Excluído. Não retorna corpo.'),
        },
      },
    },
  }
}

const paginationParameters = [
  query(
    'limit',
    { type: 'integer', default: 12 },
    'Quantidade por página. Use -1 para retornar todos.',
  ),
  query(
    'page',
    { type: 'integer', minimum: 1, default: 1 },
    'Página da busca. Ignorada quando limit=-1.',
  ),
]

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Digital Store API',
    version: '1.0.0',
    description: [
      'Projeto educacional de Back-end.',
      'Crie uma conta em POST /v1/user e faça login em POST /v1/user/token.',
      'Copie o token e informe-o no botão Authorize.',
      'O cadastro e a geração de token são públicos.',
      'A criação, alteração e exclusão de categorias e produtos exigem login.',
      'Qualquer usuário autenticado pode gerenciar o catálogo neste escopo.',
      'Cada usuário pode alterar e excluir somente a própria conta.',
    ].join('\n\n'),
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Saúde' },
    { name: 'Usuários' },
    { name: 'Categorias' },
    { name: 'Produtos' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          firstname: { type: 'string' },
          surname: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      UserInput: {
        type: 'object',
        additionalProperties: false,
        required: ['firstname', 'surname', 'email'],
        properties: {
          firstname: { type: 'string', example: 'Mariana' },
          surname: { type: 'string', example: 'Teste' },
          email: {
            type: 'string',
            format: 'email',
            example: 'mariana@example.com',
          },
        },
      },
      RegisterInput: {
        type: 'object',
        additionalProperties: false,
        required: [
          'firstname',
          'surname',
          'email',
          'password',
          'confirmPassword',
        ],
        properties: {
          firstname: { type: 'string', example: 'Mariana' },
          surname: { type: 'string', example: 'Teste' },
          email: {
            type: 'string',
            format: 'email',
            example: 'nova-conta@example.com',
          },
          password: {
            type: 'string',
            minLength: 6,
            example: 'Teste@123',
            description: 'Máximo de 72 bytes em UTF-8.',
          },
          confirmPassword: {
            type: 'string',
            example: 'Teste@123',
          },
        },
      },
      LoginInput: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'mariana@example.com',
          },
          password: {
            type: 'string',
            example: 'Teste@123',
          },
        },
      },
      CategoryInput: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'slug'],
        properties: categoryProperties,
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          ...categoryProperties,
        },
      },
      OptionInput: {
        type: 'object',
        additionalProperties: false,
        description: [
          'Na criação, informe title e values, sem id.',
          'Na atualização, use id para alterar somente os campos enviados.',
          'Use id e deleted=true para excluir.',
          'Opções omitidas permanecem intactas.',
          'value é aceito como alternativa a values, sem enviar ambos.',
        ].join(' '),
        properties: {
          id: { type: 'integer', minimum: 1 },
          deleted: { type: 'boolean' },
          title: { type: 'string', example: 'Tamanho' },
          shape: {
            type: 'string',
            enum: ['square', 'circle'],
          },
          radius: {
            oneOf: [
              { type: 'integer', minimum: 0 },
              { type: 'string', pattern: '^\\d+px$' },
            ],
          },
          type: {
            type: 'string',
            enum: ['text', 'color'],
          },
          values: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
            example: ['39', '40', '41'],
          },
          value: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
        },
      },
      ImageInput: {
        type: 'object',
        additionalProperties: false,
        description: [
          'Nova imagem: type e content em Base64 puro, sem prefixo data:.',
          'Formatos PNG ou JPEG, até 5 MB por arquivo.',
          'Na atualização, informe id e novo content para substituir.',
          'Reenviar id e o caminho atual mantém o arquivo.',
          'Use id e deleted=true para excluir.',
          'Imagens omitidas permanecem intactas.',
        ].join(' '),
        properties: {
          id: { type: 'integer', minimum: 1 },
          deleted: { type: 'boolean' },
          type: {
            type: 'string',
            enum: ['image/png', 'image/jpeg', 'image/jpg'],
          },
          content: { type: 'string' },
        },
      },
      ProductInput: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'slug', 'price', 'price_with_discount'],
        description: [
          'O preço com desconto não pode superar o preço original.',
          'PUT também exige os quatro campos obrigatórios.',
          'category_ids substitui as associações quando enviado.',
          'As opções e imagens são processadas individualmente por ID.',
          'O limite total do corpo JSON é 10 MB.',
        ].join(' '),
        properties: {
          ...productProperties,
          options: {
            type: 'array',
            maxItems: 100,
            items: ref('OptionInput'),
          },
          images: {
            type: 'array',
            maxItems: 20,
            items: ref('ImageInput'),
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          ...productProperties,
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                content: {
                  type: 'string',
                  example: '/uploads/arquivo.png',
                },
              },
            },
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' },
                shape: { type: 'string' },
                radius: { type: 'integer' },
                type: { type: 'string' },
                values: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Saúde'],
        summary: 'Verificar API e conexão com o banco',
        responses: {
          200: response('API e banco disponíveis.', {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              database: { type: 'string', example: 'connected' },
            },
          }),
          500: errorResponses[500],
        },
      },
    },
    '/v1/user': {
      post: {
        tags: ['Usuários'],
        summary: 'Cadastrar usuário',
        requestBody: body(ref('RegisterInput')),
        responses: {
          201: response('Usuário criado sem expor a senha.', ref('User')),
          400: errorResponses[400],
          500: errorResponses[500],
        },
      },
    },
    '/v1/user/token': {
      post: {
        tags: ['Usuários'],
        summary: 'Fazer login e obter JWT',
        requestBody: body(ref('LoginInput')),
        responses: {
          200: response('Login realizado.', {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
          }),
          400: response('Dados inválidos ou credenciais incorretas.', ref('Error')),
          500: errorResponses[500],
        },
      },
    },
    '/v1/user/{id}': {
      parameters: [idParameter],
      get: {
        tags: ['Usuários'],
        summary: 'Consultar usuário pelo ID',
        responses: {
          200: response('Usuário encontrado.', ref('User')),
          400: errorResponses[400],
          404: errorResponses[404],
          500: errorResponses[500],
        },
      },
      put: {
        tags: ['Usuários'],
        summary: 'Atualizar a própria conta',
        security: secured,
        requestBody: body(ref('UserInput')),
        responses: {
          ...errorResponses,
          204: response('Atualizado. Não retorna corpo.'),
          403: response('Não é permitido alterar outra conta.', ref('Error')),
        },
      },
      delete: {
        tags: ['Usuários'],
        summary: 'Excluir a própria conta',
        security: secured,
        responses: {
          ...errorResponses,
          204: response('Excluído. Não retorna corpo.'),
          403: response('Não é permitido excluir outra conta.', ref('Error')),
        },
      },
    },
    ...resourcePaths(
      'category',
      'Categorias',
      'CategoryInput',
      'Category',
    ),
    '/v1/category/search': {
      get: {
        tags: ['Categorias'],
        summary: 'Buscar categorias',
        parameters: [
          ...paginationParameters,
          query(
            'fields',
            { type: 'string', example: 'id,name,slug' },
            'Campos permitidos: id, name, slug, use_in_menu.',
          ),
          query(
            'use_in_menu',
            { type: 'boolean' },
            'Filtrar categorias por exibição no menu.',
          ),
        ],
        responses: {
          200: response('Resultado paginado.', collectionResponse('Category')),
          400: errorResponses[400],
          500: errorResponses[500],
        },
      },
    },
    ...resourcePaths(
      'product',
      'Produtos',
      'ProductInput',
      'Product',
    ),
    '/v1/product/search': {
      get: {
        tags: ['Produtos'],
        summary: 'Buscar produtos com filtros',
        parameters: [
          ...paginationParameters,
          query(
            'fields',
            { type: 'string', example: 'id,name,price,images' },
            'Campos da resposta separados por vírgula.',
          ),
          query(
            'match',
            { type: 'string', example: 'tenis' },
            'Buscar no nome ou na descrição.',
          ),
          query(
            'category_ids',
            { type: 'string', example: '1,2' },
            'IDs separados por vírgula. Retorna produtos de qualquer categoria informada.',
          ),
          query(
            'price-range',
            { type: 'string', example: '100-250' },
            'Intervalo inclusivo aplicado ao campo price.',
          ),
          query(
            'option[1]',
            { type: 'string', example: '40,41' },
            'Substitua 1 pelo ID real da opção na URL. Valores da mesma opção usam OU; opções distintas usam E.',
          ),
        ],
        responses: {
          200: response('Resultado paginado.', collectionResponse('Product')),
          400: errorResponses[400],
          500: errorResponses[500],
        },
      },
    },
  },
}