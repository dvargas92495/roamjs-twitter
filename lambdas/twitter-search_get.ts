import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import type { AxiosPromise } from "axios";
import headers from "roamjs-components/backend/headers";

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { username, query } = event.queryStringParameters;
  if (!username) {
    return userError("username is required");
  }
  if (!query) {
    return userError("query is required");
  }
  const twitterBearerTokenResponse = await wrapAxios(
    axios.post(
      `https://api.twitter.com/oauth2/token`,
      {},
      {
        params: {
          grant_type: "client_credentials",
        },
        auth: {
          username: process.env.TWITTER_CONSUMER_KEY,
          password: process.env.TWITTER_CONSUMER_SECRET,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
      }
    )
  );

  const body = JSON.parse(twitterBearerTokenResponse.body);
  const twitterBearerToken = body.access_token;

  const opts = {
    headers: {
      Authorization: `Bearer ${twitterBearerToken}`,
    },
  };

  return wrapAxios(
    axios.get(
      `https://api.twitter.com/1.1/search/tweets.json?q=from%3A${username}%20${encodeURIComponent(
        query
      )}%20AND%20-filter:retweets`,
      opts
    )
  );
};
