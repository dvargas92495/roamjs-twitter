import { dynamo } from "./common/common";
import { APIGatewayProxyHandler } from "aws-lambda";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser((user) =>
  dynamo
    .query({
      TableName: "RoamJSSocial",
      IndexName: "user-index",
      ExpressionAttributeNames: {
        "#u": "userId",
        "#c": "channel",
      },
      ExpressionAttributeValues: {
        ":u": { S: user.email },
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
          blockUid:
            item.blockUid?.S || JSON.parse(item.payload.S).blocks?.[0]?.uid,
          createdDate: item.created.S,
          scheduledDate: item.date.S,
          status: item.status.S,
          message: item.message?.S,
        })),
      }),
      headers,
    }))
);
