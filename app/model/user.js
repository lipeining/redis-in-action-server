'use strict';
module.exports = app => {
  const db = app.model;
  const DataTypes = app.Sequelize;
  const Model = app.model.define(
    'User',
    {
      id: {
        field: 'id',
        type: DataTypes.INTEGER(11),
        allowNull: false,
        primaryKey: true,
        comment: '主键',
        autoIncrement: true,
      },
      nickName: {
        field: 'nick_name',
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: '',
        comment: '用户昵称',
      },
      email: {
        field: 'email',
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: '',
        comment: '用户邮箱',
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
      tableName: 'tbl_user',
      timestamps: false,
    }
  );
  Model.associate = () => {
    db.User.hasMany(db.Article, {
      as: 'CreatePosts',
      foreignKey: 'createUserId',
      sourceKey: 'id',
      constraints: false,
    });
  };
  return Model;
};
