import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import headers from "roamjs-components/backend/headers";
import { dynamo, s3 } from "./common/common";

export const handler = awsGetRoamJSUser<{
  scheduleDate: string;
  payload: string;
  uuid: string;
}>((_, { scheduleDate, payload, uuid }) => {
  return dynamo
    .updateItem({
      TableName: "RoamJSSocial",
      Key: {
        uuid: { S: uuid },
      },
      UpdateExpression: "SET #d = :d",
      ExpressionAttributeNames: {
        "#d": "date",
      },
      ExpressionAttributeValues: {
        ":d": { S: scheduleDate },
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
      body: JSON.stringify({ success: true }),
      headers,
    }));
});
