import { dynamo } from "./common/common";
import { APIGatewayProxyHandler } from "aws-lambda";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";

export const handler: APIGatewayProxyHandler = (event, c, ca) => {
  const { id } = event.queryStringParameters || {};
  return awsGetRoamJSUser((user) =>
    id
      ? dynamo
          .getItem({
            TableName: "RoamJSSocial",
            Key: { uuid: { S: id } },
          })
          .promise()
          .then((r) => ({
            statusCode: 200,
            body: JSON.stringify({
              uuid: r.Item.uuid.S,
              blockUid:
                r.Item.blockUid?.S ||
                JSON.parse(r.Item.payload.S).blocks?.[0]?.uid,
              createdDate: r.Item.created.S,
              scheduledDate: r.Item.date.S,
              status: r.Item.status.S,
              message: r.Item.message?.S,
            }),
            headers,
          }))
      : dynamo
          .query({
            TableName: "RoamJSSocial",
            IndexName: "user-index",
            ExpressionAttributeNames: {
              "#u": "userId",
              "#c": "channel",
            },
            ExpressionAttributeValues: {
              ":u": { S: user.email },
              ":c": {
                S:
                  process.env.NODE_ENV === "development"
                    ? "development"
                    : "twitter",
              },
            },
            KeyConditionExpression: "#u = :u AND #c = :c",
          })
          .promise()
          .then(({ Items }) => ({
            statusCode: 200,
            body: JSON.stringify({
              scheduledTweets: (Items || []).map((item) => ({
                uuid: item.uuid.S,
                blockUid:
                  item.blockUid?.S ||
                  JSON.parse(item.payload.S).blocks?.[0]?.uid,
                createdDate: item.created.S,
                scheduledDate: item.date.S,
                status: item.status.S,
                message: item.message?.S,
              })),
            }),
            headers,
          }))
  )(event, c, ca);
};
