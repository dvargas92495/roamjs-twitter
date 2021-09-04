import { v4 } from "uuid";
import { dynamo, getRoamJSUser, headers } from "./common/common";
import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = (event) => {
  const { scheduleDate, oauth, payload } = JSON.parse(event.body || "{}");
  const uuid = v4();
  const date = new Date().toJSON();
  return getRoamJSUser(event).then(() =>
    dynamo
      .putItem({
        TableName: "RoamJSSocial",
        Item: {
          uuid: { S: uuid },
          created: { S: date },
          date: { S: scheduleDate },
          oauth: { S: oauth },
          payload: { S: payload },
          status: { S: "PENDING" },
          userId: { S: event.headers.Authorization },
          channel: { S: "twitter" },
        },
      })
      .promise()
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers,
      }))
  );
};
