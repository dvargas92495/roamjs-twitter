import { v4 } from "uuid";
import { dynamo } from "./common/common";
import { APIGatewayProxyHandler } from "aws-lambda";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import headers from "roamjs-components/backend/headers";

export const handler: APIGatewayProxyHandler = (event, c, ca) => {
  const { scheduleDate, oauth, payload } = JSON.parse(event.body || "{}");
  const uuid = v4();
  const date = new Date().toJSON();
  return awsGetRoamJSUser((user) =>
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
          userId: { S: user.email },
          channel: { S: "twitter" },
        },
      })
      .promise()
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers,
      }))
  )(event, c, ca);
};
