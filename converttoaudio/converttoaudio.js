var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var polly = new AWS.Polly();
var s3 = new AWS.S3();

var promiseDBquery = function(postId) {
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

var promiseDBupdate = function(postId, url) {
  return new Promise((resolve, reject) => {
    dynamodb.update(
      {
        Key: { id: postId },
        UpdateExpression: 'set #statusAtt = :statusValue, #urlAtt = :urlValue',
        ExpressionAttributeNames: { '#statusAtt': 'status', '#urlAtt': 'url' },
        ExpressionAttributeValues: {
          ':statusValue': 'UPDATED',
          ':urlValue': url
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

var promisePolly = function(text, voice) {
  return new Promise((resolve, reject) => {
    polly.synthesizeSpeech(
      {
        OutputFormat: 'mp3',
        Text: text,
        VoiceId: voice
      },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
};

var promiseS3 = function(postId, data) {
  return new Promise((resolve, reject) => {
    s3.putObject(
      {
        ACL: 'public-read',
        Body: data,
        Bucket: process.env.BUCKET_NAME,
        Key: postId + '.mp3'
      },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
};

var promiseS3Location = function() {
  return new Promise((resolve, reject) => {
    s3.getBucketLocation(
      {
        Bucket: process.env.BUCKET_NAME
      },
      function(err, data) {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
};

exports.handler = async event => {
  let postId = event['Records'][0]['Sns']['Message'];
  console.log('Text to Speech function. Post ID in DynamoDB: ' + postId);

  // Retrieving information about the post from DynamoDB table
  let postItem = await promiseDBquery(postId);
  let text = postItem.Items[0].text;
  let voice = postItem.Items[0].voice;

  // Because single invocation of the polly synthesizeSpeech api can
  // transform text with about 1500 characters, we are dividing the
  // post into blocks of approximately 1000 characters.
  let textBlocks = [];
  while (text.length > 1100) {
    let end;
    end = text.indexOf('.', 1000);
    if (end === -1) end = text.indexOf(' ', 1000);
    textBlocks.push(text.slice(0, end));
    text = text.slice(end);
  }
  textBlocks.push(text);

  // For each block, invoke Polly API, which will transform text into audio
  let audio = [];
  let audioLength = 0;
  for (let i = 0; i < textBlocks.length; i++) {
    let response = await promisePolly(textBlocks[i], voice);
    if (response.AudioStream !== undefined) {
      audio.push(response.AudioStream);
      audioLength += response.AudioStream.length;
    }
    if (i === textBlocks.length - 1) {
      await promiseS3(postId, Buffer.concat(audio, audioLength));
    }
  }

  let location = await promiseS3Location;
  let region = location.LocationConstraint;
  let url =
    region === undefined
      ? 'https://s3.amazonaws.com/'
      : 'https://s3-' + region + '.amazonaws.com/';
  url = url + process.env.BUCKET_NAME + '/' + postId + '.mp3';

  // Updating the item in DynamoDB
  await promiseDBupdate(postId, url);

  return;
};
