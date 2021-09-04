import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import { wrapAxios, userError } from "./common/common";

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
