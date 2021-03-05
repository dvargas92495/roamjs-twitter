import subMinutes from "date-fns/subMinutes";
import AWS from "aws-sdk";
import startOfMinute from "date-fns/startOfMinute";
import addSeconds from "date-fns/addSeconds";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import querystring from "querystring";
import axios from "axios";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10", credentials });

const twitterOAuth = new OAuth({
  consumer: {
    key: process.env.TWITTER_CONSUMER_KEY || "",
    secret: process.env.TWITTER_CONSUMER_SECRET || "",
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

const ATTACHMENT_REGEX = /!\[[^\]]*\]\(([^\s)]*)\)/g;
const channelHandler = {
  twitter: async ({
    oauth,
    payload,
  }: {
    oauth: string;
    payload: string;
  }): Promise<boolean> => {
    const blocks = JSON.parse(payload);
    let in_reply_to_status_id = "";
    let overallSuccess = true;
    for (let index = 0; index < blocks.length; index++) {
      const { text } = blocks[index] as { text: string };

      const attachmentUrls: string[] = [];
      const content = text.replace(ATTACHMENT_REGEX, (_, url) => {
        attachmentUrls.push(url);
        return "";
      });
      /*
      const media_ids = await uploadAttachments({
        attachmentUrls,
        key,
        secret,
      }).catch((e) => {
        console.error(e.response?.data || e.message || e);
        setTweetsSent(0);
        if (e.roamjsError) {
          setError(e.roamjsError);
        } else {
          setError(
            "Some attachments failed to upload. Email support@roamjs.com for help!"
          );
        }
        return [];
      });
      if (media_ids.length < attachmentUrls.length) {
        return "";
      }
      */
      const data = {
        status: content,
        // ...(media_ids.length ? { media_ids } : {}),
        ...(in_reply_to_status_id
          ? { in_reply_to_status_id, auto_populate_reply_metadata: true }
          : {}),
      };
      const url = `https://api.twitter.com/1.1/statuses/update.json?${querystring
        .stringify(data)
        .replace(/!/g, "%21")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A")}`;
      const { oauth_token: key, oauth_token_secret: secret } = JSON.parse(
        oauth
      );
      const oauthHeaders = twitterOAuth.toHeader(
        twitterOAuth.authorize(
          {
            url,
            method: "POST",
          },
          { key, secret }
        )
      );
      const { success, message } = await axios
        .post(
          url,
          {},
          {
            headers: oauthHeaders,
          }
        )
        .then((r) => {
          const { id_str } = r.data;
          in_reply_to_status_id = id_str;
          return { success: true, message: "Successfully posted" };
        })
        .catch((e) => ({
          success: false,
          message: e.response?.data?.errors
            ? e.response?.data?.errors
                .map(({ code }: { code: number }) => {
                  switch (code) {
                    case 220:
                      return "Invalid credentials. Try logging in through the roam/js/twitter page";
                    case 186:
                      return "Tweet is too long. Make it shorter!";
                    case 170:
                      return "Tweet failed to send because it was empty.";
                    case 187:
                      return "Tweet failed to send because Twitter detected it was a duplicate.";
                    default:
                      return `Unknown error code (${code}). Email support@roamjs.com for help!`;
                  }
                })
                .join("\n")
            : e.message,
        }));
      console.log(message);

      if (!success) {
        overallSuccess = false;
        break;
      }
    }
    return Promise.resolve(overallSuccess);
  },
};
const channels = Object.keys(channelHandler);

export const handler = async () => {
  const now = startOfMinute(new Date());
  const toMinute = addSeconds(now, 30);
  const lastMinute = subMinutes(toMinute, 1);
  console.log(
    "Querying posts from",
    lastMinute.toJSON(),
    "to",
    toMinute.toJSON()
  );
  const items = await Promise.all(
    channels.map((channel: keyof typeof channelHandler) =>
      dynamo
        .query({
          TableName: "RoamJSSocial",
          IndexName: "primary-index",
          KeyConditionExpression: "#c = :c AND #d BETWEEN :l AND :h",
          ExpressionAttributeValues: {
            ":l": {
              S: lastMinute.toJSON(),
            },
            ":h": {
              S: toMinute.toJSON(),
            },
            ":c": {
              S: channel,
            },
          },
          ExpressionAttributeNames: {
            "#d": "date",
            "#c": "channel",
          },
        })
        .promise()
        .then((result) => ({ result, channel }))
    )
  ).then((results) =>
    Promise.all(
      results
        .filter(({ result }) => result.Count > 0)
        .flatMap(({ result, channel }) =>
          result.Items.map((i) =>
            channelHandler[channel]({
              oauth: i.oauth.S,
              payload: i.payload.S,
            }).then((success) => ({ uuid: i.uuid.S, success }))
          )
        )
    )
  );
  console.log("Executed:", JSON.stringify(items, null, 4));
};
