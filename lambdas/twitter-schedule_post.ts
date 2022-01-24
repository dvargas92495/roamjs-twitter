import { v4 } from "uuid";
import { dynamo, s3 } from "./common/common";
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
          blockUid: { S: JSON.parse(payload).blocks?.[0]?.uid },
          status: { S: "PENDING" },
          userId: { S: user.email },
          channel: {
            S:
              process.env.NODE_ENV === "development"
                ? "development"
                : "twitter",
          },
        },
      })
      .promise()
      .then(() =>
        s3
          .upload({
            Bucket: "roamjs-data",
            Body: payload,
            Key: `twitter/scheduled/${uuid}.json`,
            ContentType: "application/json",
          })
          .promise()
      )
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ id: uuid }),
        headers,
      }))
  )(event, c, ca);
};
