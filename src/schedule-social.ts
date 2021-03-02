import subMinutes from "date-fns/subMinutes";
import AWS from "aws-sdk";
import startOfMinute from "date-fns/startOfMinute";
import addSeconds from "date-fns/addSeconds";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10", credentials });

export const handler = async () => {
  const now = startOfMinute(new Date());
  const toMinute = addSeconds(now, 30);
  const lastMinute = subMinutes(toMinute, 1);
  console.log("Querying posts from", lastMinute, "to", now);
  const items = await dynamo
    .query({
      TableName: "RoamJSSocial",
      IndexName: "primary-index",
      KeyConditionExpression: "#d BETWEEN :l AND :h",
      ExpressionAttributeValues: {
        ":l": {
          S: lastMinute.toJSON(),
        },
        ":h": {
          S: toMinute.toJSON(),
        },
      },
      ExpressionAttributeNames: {
        "#d": "date",
      },
    })
    .promise();
  console.log("Found", items.Count);
};
