'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const primaryKey = () => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    })

    const timestamps = () => ({
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    })

    const productReference = () => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    await queryInterface.createTable('users', {
      id: primaryKey(),
      firstname: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      surname: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ...timestamps(),
    })

    await queryInterface.createTable('categories', {
      id: primaryKey(),
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      use_in_menu: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ...timestamps(),
    })

    await queryInterface.createTable('products', {
      id: primaryKey(),
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      use_in_menu: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      price_with_discount: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      ...timestamps(),
    })

    await queryInterface.createTable('product_images', {
      id: primaryKey(),
      product_id: productReference(),
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      path: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    })

    await queryInterface.createTable('product_options', {
      id: primaryKey(),
      product_id: productReference(),
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      shape: {
        type: Sequelize.ENUM('square', 'circle'),
        allowNull: false,
        defaultValue: 'square',
      },
      radius: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      type: {
        type: Sequelize.ENUM('text', 'color'),
        allowNull: false,
        defaultValue: 'text',
      },
      values: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    })

    await queryInterface.createTable('product_categories', {
      product_id: {
        ...productReference(),
        primaryKey: true,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    })

    await queryInterface.addIndex('product_categories', ['category_id'])
  },

  async down(queryInterface) {
    // As tabelas dependentes precisam ser removidas primeiro.
    await queryInterface.dropTable('product_categories')
    await queryInterface.dropTable('product_options')
    await queryInterface.dropTable('product_images')
    await queryInterface.dropTable('products')
    await queryInterface.dropTable('categories')
    await queryInterface.dropTable('users')
  },
}