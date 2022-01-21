import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";
import { twitterOAuth } from "./common/common";
import headers from "roamjs-components/backend/headers";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { state } = JSON.parse(event.body);
  const data = {
    oauth_callback: `https://roamjs.com/oauth?auth=true&state=${state}`,
  };
  const oauthHeaders = twitterOAuth.toHeader(
    twitterOAuth.authorize({
      data,
      url: "https://api.twitter.com/oauth/request_token",
      method: "POST",
    })
  );

  return axios
    .post("https://api.twitter.com/oauth/request_token", data, {
      headers: oauthHeaders,
    })
    .then((r) => {
      const parsedData = Object.fromEntries(
        r.data.split("&").map((s: string) => s.split("="))
      );
      if (parsedData.oauth_callback_confirmed) {
        return {
          statusCode: 200,
          body: JSON.stringify({ token: parsedData.oauth_token }),
          headers,
        };
      } else {
        return {
          statusCode: 500,
          body: "Oauth Callback was not Confirmed",
          headers,
        };
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
