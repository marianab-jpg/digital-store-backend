const { Sequelize, DataTypes } = require('sequelize')
const configurations = require('../config/database')

const environment = process.env.NODE_ENV || 'development'
const configuration = configurations[environment]

if (!configuration) {
  throw new Error(`Ambiente inválido: ${environment}`)
}

const sequelize = new Sequelize(configuration)

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    firstname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    surname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'users',
    defaultScope: {
      attributes: {
        exclude: ['password'],
      },
    },
    scopes: {
      withPassword: {
        attributes: [
          'id',
          'firstname',
          'surname',
          'email',
          'password',
        ],
      },
    },
  },
)

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    use_in_menu: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'categories',
  },
)

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    use_in_menu: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    price_with_discount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
  },
  {
    tableName: 'products',
  },
)

const ProductImage = sequelize.define(
  'ProductImage',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'product_images',
    timestamps: false,
  },
)

const ProductOption = sequelize.define(
  'ProductOption',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shape: {
      type: DataTypes.ENUM('square', 'circle'),
      allowNull: false,
      defaultValue: 'square',
    },
    radius: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    type: {
      type: DataTypes.ENUM('text', 'color'),
      allowNull: false,
      defaultValue: 'text',
    },
    values: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'product_options',
    timestamps: false,
  },
)

const ProductCategory = sequelize.define(
  'ProductCategory',
  {
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    tableName: 'product_categories',
    timestamps: false,
  },
)

Product.hasMany(ProductImage, {
  foreignKey: 'product_id',
  as: 'images',
  onDelete: 'CASCADE',
})

ProductImage.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product',
})

Product.hasMany(ProductOption, {
  foreignKey: 'product_id',
  as: 'options',
  onDelete: 'CASCADE',
})

ProductOption.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product',
})

Product.belongsToMany(Category, {
  through: ProductCategory,
  foreignKey: 'product_id',
  otherKey: 'category_id',
  as: 'categories',
})

Category.belongsToMany(Product, {
  through: ProductCategory,
  foreignKey: 'category_id',
  otherKey: 'product_id',
  as: 'products',
})

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  ProductOption,
  ProductCategory,
}