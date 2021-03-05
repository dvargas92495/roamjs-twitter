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
/*
const toCategory = (mime: string) => {
  if (mime.startsWith("video")) {
    return "tweet_video";
  } else if (mime.endsWith("gif")) {
    return "tweet_gif";
  } else {
    return "tweet_image";
  }
};
const uploadAttachments = async ({
  attachmentUrls,
  key,
  secret,
}: {
  attachmentUrls: string[];
  key: string;
  secret: string;
}): Promise<string[]> => {
  if (!attachmentUrls.length) {
    return Promise.resolve([]);
  }
  const mediaIds = [];
  for (const attachmentUrl of attachmentUrls) {
    const attachment = await axios
      .get(attachmentUrl, { responseType: "arraybuffer" })
      .then((r) => r.data as Blob);
    const media_category = toCategory(attachment.type);
    const { media_id, error } = await axios
      .post(UPLOAD_URL, {
        key,
        secret,
        params: {
          command: "INIT",
          total_bytes: attachment.size,
          media_type: attachment.type,
          media_category,
        },
      })
      .then((r) => ({ media_id: r.data.media_id_string, error: "" }))
      .catch((e) => ({ error: e.response.data.error, media_id: "" }));
    if (error) {
      return Promise.reject({ roamjsError: error });
    }
    const reader = new FileReader();
    const data = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(attachment);
    });
    for (let i = 0; i < data.length; i += TWITTER_MAX_SIZE) {
      await axios.post(UPLOAD_URL, {
        key,
        secret,
        params: {
          command: "APPEND",
          media_id,
          media_data: data.slice(i, i + TWITTER_MAX_SIZE),
          segment_index: i / TWITTER_MAX_SIZE,
        },
      });
    }
    await axios.post(UPLOAD_URL, {
      key,
      secret,
      params: { command: "FINALIZE", media_id },
    });

    if (media_category !== "tweet_image") {
      await new Promise<void>((resolve, reject) => {
        const getStatus = () =>
          axios
            .post(UPLOAD_URL, {
              key,
              secret,
              params: { command: "STATUS", media_id },
            })
            .then((r) => r.data.processing_info)
            .then(({ state, check_after_secs, error }) => {
              if (state === "succeeded") {
                resolve();
              } else if (state === "failed") {
                reject(error.message);
              } else {
                setTimeout(getStatus, check_after_secs * 1000);
              }
            });
        return getStatus();
      });
    }

    mediaIds.push(media_id);
  }
  return mediaIds;
};*/

const channelHandler = {
  twitter: async ({
    oauth,
    payload,
  }: {
    oauth: string;
    payload: string;
  }): Promise<string> => {
    const { blocks } = JSON.parse(payload) as { blocks: { text: string }[] };
    const { oauth_token: key, oauth_token_secret: secret } = JSON.parse(oauth);

    let in_reply_to_status_id = "";
    let failureIndex = -1;
    const tweets = await Promise.all(
      blocks.map(({ text }, index) => {
        if (failureIndex >= 0) {
          return {
            success: false,
            message: `Skipped sending tweet due to failing to send tweet ${failureIndex}`,
          };
        }
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
        const oauthHeaders = twitterOAuth.toHeader(
          twitterOAuth.authorize(
            {
              url,
              method: "POST",
            },
            { key, secret }
          )
        );
        return axios
          .post(
            url,
            {},
            {
              headers: oauthHeaders,
            }
          )
          .then((r) => {
            const {
              id_str,
              user: { screen_name },
            } = r.data;
            in_reply_to_status_id = id_str;
            return {
              success: true,
              message: `https://twitter.com/${screen_name}/status/${id_str}`,
            };
          })
          .catch((e) => {
            failureIndex = index;
            return {
              success: false,
              message: e.response?.data?.errors
                ? (e.response?.data?.errors as { code: number }[])
                    .map(({ code }) => {
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
                : (e.message as string),
            };
          });
      })
    );
    return failureIndex >= 0
      ? Promise.reject(tweets[failureIndex].message)
      : Promise.resolve(tweets[0].message);
  },
};
const channels = Object.keys(channelHandler);

export const handler = async () => {
  const now = startOfMinute(new Date());
  const toMinute = addSeconds(now, 30);
  const lastMinute = subMinutes(toMinute, 1);

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
            })
              .then((message) => ({ uuid: i.uuid.S, success: true, message }))
              .catch((message) => ({ uuid: i.uuid.S, success: false, message }))
          )
        )
    )
  );
  items.forEach(({ uuid, success, message }) =>
    dynamo
      .updateItem({
        TableName: "RoamJSSocial",
        Key: { uuid: { S: uuid } },
        UpdateExpression: "SET #s = :s, #m = :m",
        ExpressionAttributeNames: {
          "#s": "status",
          "#m": "message",
        },
        ExpressionAttributeValues: {
          ":s": { S: success ? "SUCCESS" : "FAILED" },
          ":m": { S: message },
        },
      })
      .promise()
  );
};
