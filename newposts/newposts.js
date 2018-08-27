var uuidv4 = require('uuid/v4');
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var sns = new AWS.SNS();

exports.handler = async event => {
  let recordId = uuidv4();
  let voice = event['voice'];
  let text = event['text'];
  console.log('Generating new DynamoDB record, with ID: ' + recordId);
  console.log('Input Text: ' + text);
  console.log('Selected voice: ' + voice);

  // Creating new record in DynamoDB table
  await new Promise((resolve, reject) => {
    dynamodb.put(
      {
        Item: {
          id: recordId,
          text: text,
          voice: voice,
          status: 'PROCESSING'
        },
        TableName: process.env.DB_TABLE_NAME
      },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });

  // Sending notification about new post to SNS
  await new Promise((resolve, reject) => {
    sns.publish(
      { TopicArn: process.env.SNS_TOPIC, Message: recordId },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });

  return recordId;
};
