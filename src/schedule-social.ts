import subMinutes from "date-fns/subMinutes";
import AWS from "aws-sdk";
import startOfMinute from "date-fns/startOfMinute";
import addSeconds from "date-fns/addSeconds";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10", credentials });
const channels = ["twitter"];

export const handler = async () => {
  const now = startOfMinute(new Date());
  const toMinute = addSeconds(now, 30);
  const lastMinute = subMinutes(toMinute, 1);
  console.log("Querying posts from", lastMinute, "to", toMinute);
  const items = Promise.all(
    channels.map((channel) =>
      dynamo
        .query({
          TableName: "RoamJSSocial",
          IndexName: "primary-index",
          KeyConditionExpression: "#c = :c AND #d BETWEEN :l AND :h",
          ExpressionAttributeValues: {
            ":l": {
              S: lastMinute.toJSON(),
            },
            ":h": {
              S: toMinute.toJSON(),
            },
            ":c": {
              S: channel,
            },
          },
          ExpressionAttributeNames: {
            "#d": "date",
            "#c": "channel",
          },
        })
        .promise()
        .then((result) => ({ result, channel }))
    )
  ).then((results) =>
    results
      .filter(({ result }) => result.Count > 0)
      .map(({ result, channel }) => ({
        items: result.Items.map((i) => i.uuid.S),
        channel,
      }))
  );
  console.log("Found", JSON.stringify(items, null, 4));
};
