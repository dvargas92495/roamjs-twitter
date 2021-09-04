import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { APIGatewayProxyResult, APIGatewayProxyEvent } from "aws-lambda";
import axios, { AxiosPromise } from "axios";
import AWS from "aws-sdk";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
export const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10", credentials });
export const ses = new AWS.SES({ apiVersion: "2010-12-01", credentials });

export const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
};

export const twitterOAuth = new OAuth({
  consumer: {
    key: process.env.TWITTER_CONSUMER_KEY || "",
    secret: process.env.TWITTER_CONSUMER_SECRET || "",
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

export const userError = (body: string): APIGatewayProxyResult => ({
  statusCode: 400,
  body,
  headers,
});

export const wrapAxios = (
  req: AxiosPromise<Record<string, unknown>>
): Promise<APIGatewayProxyResult> =>
  req
    .then((r) => ({
      statusCode: 200,
      body: JSON.stringify(r.data),
      headers,
    }))
    .catch((e) => ({
      statusCode: e.response?.status || 500,
      body: e.response?.data ? JSON.stringify(e.response.data) : e.message,
      headers,
    }));

export const getRoamJSUser = (event: APIGatewayProxyEvent) =>
  axios.get(`${process.env.ROAMJS_API_URL}/user`, {
    headers: {
      Authorization: process.env.ROAMJS_DEVELOPER_TOKEN,
      "x-roamjs-token":
        event.headers.Authorization || event.headers.authorization,
      "x-roamjs-service": "social",
    },
  });
