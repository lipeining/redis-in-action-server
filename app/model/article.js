'use strict';
module.exports = app => {
  const db = app.model;
  const DataTypes = app.Sequelize;
  const Model = app.model.define(
    'Article',
    {
      id: {
        field: 'id',
        type: DataTypes.INTEGER(11),
        allowNull: false,
        primaryKey: true,
        comment: '主键',
        autoIncrement: true,
      },
      title: {
        field: 'title',
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: '',
        comment: 'title',
      },
      link: {
        field: 'link',
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: '',
        comment: 'link',
      },
      content: {
        field: 'content',
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        comment: 'content',
      },
      votes: {
        field: 'votes',
        type: DataTypes.INTEGER(11),
        allowNull: true,
        comment: 'votes',
      },
      createUserId: {
        field: 'create_user_id',
        type: DataTypes.INTEGER(11),
        allowNull: true,
        comment: 'create user id',
      },
      createTime: {
        field: 'create_time',
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: '创建时间',
      },
      updateTime: {
        field: 'update_time',
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: '更新时间',
      },
      deleteTime: {
        field: 'delete_time',
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: '删除时间',
      },
    },
    {
      tableName: 'tbl_article',
      timestamps: false,
    }
  );
  Model.associate = () => {
    db.Article.belongsTo(db.User, {
      as: 'CreateUser',
      foreignKey: 'createUserId',
      targetKey: 'id',
      constraints: false,
    });
  };
  return Model;
};
