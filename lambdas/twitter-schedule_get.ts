import { dynamo, getRoamJSUser, headers } from "./common/common";
import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = (event) =>
  getRoamJSUser(event).then(() =>
    dynamo
      .query({
        TableName: "RoamJSSocial",
        IndexName: "user-index",
        ExpressionAttributeNames: {
          "#u": "userId",
          "#c": "channel",
        },
        ExpressionAttributeValues: {
          ":u": { S: event.headers.Authorization },
          ":c": { S: "twitter" },
        },
        KeyConditionExpression: "#u = :u AND #c = :c",
      })
      .promise()
      .then(({ Items }) => ({
        statusCode: 200,
        body: JSON.stringify({
          scheduledTweets: (Items || []).map((item) => ({
            uuid: item.uuid.S,
            blockUid: JSON.parse(item.payload.S).blocks?.[0]?.uid,
            createdDate: item.created.S,
            scheduledDate: item.date.S,
            status: item.status.S,
            message: item.message?.S,
          })),
        }),
        headers,
      }))
  );
