import subMinutes from "date-fns/subMinutes";
import AWS from "aws-sdk";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10", credentials });

export const handler = async () => {
  const now = new Date();
  const lastMinute = subMinutes(now, 1);
  console.log("Querying posts from", lastMinute, "to", now);
  const Items = await dynamo
    .query({
      TableName: "RoamJSSocial",
      IndexName: "primary-index",
      KeyConditionExpression: "date >= :l AND date <= :h",
      ExpressionAttributeValues: {
        ":l": {
          S: lastMinute.toJSON(),
        },
        ":h": {
          S: now.toJSON(),
        },
      },
    })
    .promise();
  console.log("Found", Items.Count);
};
