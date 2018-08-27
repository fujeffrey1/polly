var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

const scan = () => {
  return new Promise((resolve, reject) => {
    dynamodb.scan(
      {
        TableName: process.env.DB_TABLE_NAME
      },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
};

const query = postId => {
  return new Promise((resolve, reject) => {
    dynamodb.query(
      {
        KeyConditionExpression: 'id = :postId',
        ExpressionAttributeValues: {
          ':postId': postId
        },
        TableName: process.env.DB_TABLE_NAME
      },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
};

exports.handler = async event => {
  let postId = event['postId'];
  let items;
  if (postId === '*') items = await scan();
  else items = await query(postId);

  return items.Items;
};
