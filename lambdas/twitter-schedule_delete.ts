import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import headers from "roamjs-components/backend/headers";
import { dynamo } from "./common/common";

export const handler = awsGetRoamJSUser<{ uuid: string }>((_, { uuid }) =>
  dynamo
    .deleteItem({
      TableName: "RoamJSSocial",
      Key: { uuid: { S: uuid } },
    })
    .promise()
    .then(() => ({ statusCode: 204, body: "", headers }))
    .catch((e) => ({ statusCode: 500, body: e.message, headers }))
);
