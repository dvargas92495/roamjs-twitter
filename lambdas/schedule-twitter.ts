import subMinutes from "date-fns/subMinutes";
import startOfMinute from "date-fns/startOfMinute";
import addSeconds from "date-fns/addSeconds";
import querystring from "querystring";
import axios from "axios";
import FormData from "form-data";
import { dynamo, ses, twitterOAuth, s3 } from "./common/common";
import meterRoamJSUser from "roamjs-components/backend/meterRoamJSUser";

const ATTACHMENT_REGEX = /!\[[^\]]*\]\(([^\s)]*)\)/g;
const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWITTER_MAX_SIZE = 5000000;

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
}): Promise<{ media_ids: string[]; attachmentsError: string }> => {
  if (!attachmentUrls.length) {
    return Promise.resolve({ media_ids: [], attachmentsError: "" });
  }
  const getPostOpts = (data: FormData) => ({
    headers: {
      ...twitterOAuth.toHeader(
        twitterOAuth.authorize(
          {
            url: UPLOAD_URL,
            method: "POST",
          },
          { key, secret }
        )
      ),
      ...data.getHeaders(),
    },
  });

  const media_ids = [] as string[];
  for (const attachmentUrl of attachmentUrls) {
    const attachment = await axios
      .get(attachmentUrl, { responseType: "arraybuffer" })
      .then((r) => ({
        data: r.data as ArrayBuffer,
        type: r.headers["content-type"],
        size: r.headers["content-length"],
      }));
    const media_category = toCategory(attachment.type);

    const initData = new FormData();
    initData.append("command", "INIT");
    initData.append("total_bytes", attachment.size);
    initData.append("media_type", attachment.type);
    initData.append("media_category", media_category);
    const { media_id, error } = await axios
      .post(UPLOAD_URL, initData, getPostOpts(initData))
      .then((r) => ({
        media_id: r.data.media_id_string,
        error: "",
      }))
      .catch((e) => ({
        error: e.response.data.error,
        media_id: "",
        command: "INIT",
        mediaType: attachment.type,
      }));
    if (error) {
      return Promise.reject({ roamjsError: error });
    }

    const data = Buffer.from(attachment.data).toString("base64");
    for (let i = 0; i < data.length; i += TWITTER_MAX_SIZE) {
      const appendData = new FormData();
      appendData.append("command", "APPEND");
      appendData.append("media_id", media_id);
      appendData.append("media_data", data.slice(i, i + TWITTER_MAX_SIZE));
      appendData.append("segment_index", i / TWITTER_MAX_SIZE);
      const { success, ...rest } = await axios
        .post(UPLOAD_URL, appendData, getPostOpts(appendData))
        .then(() => ({ success: true }))
        .catch((error) => ({
          success: false,
          error,
          command: `APPEND${i}`,
          mediaType: attachment.type,
        }));
      if (!success) {
        return Promise.reject(rest);
      }
    }
    const finalizeData = new FormData();
    finalizeData.append("command", "FINALIZE");
    finalizeData.append("media_id", media_id);
    const { success, ...rest } = await axios
      .post(UPLOAD_URL, finalizeData, getPostOpts(finalizeData))
      .then(() => ({ success: true }))
      .catch((error) => ({
        success: false,
        error,
        response: error.response?.data,
        command: `FINALIZE`,
        mediaType: attachment.type,
      }));
    if (!success) {
      return Promise.reject(rest);
    }

    if (media_category !== "tweet_image") {
      const url = `https://upload.twitter.com/1.1/media/upload.json?${querystring.stringify(
        { command: "STATUS", media_id }
      )}`;
      await new Promise<void>((resolve, reject) => {
        const getStatus = () => {
          return axios
            .get(url, {
              headers: twitterOAuth.toHeader(
                twitterOAuth.authorize(
                  {
                    url,
                    method: "GET",
                  },
                  { key, secret }
                )
              ),
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
        };
        return getStatus();
      });
    }

    media_ids.push(media_id);
  }
  return { media_ids, attachmentsError: "" };
};

const channelHandler = async ({
  oauth,
  uuid,
}: {
  oauth: string;
  uuid: string;
}): Promise<string> => {
  const { blocks } = await s3
    .getObject({
      Bucket: "roamjs-data",
      Key: `twitter/scheduled/${uuid}.json`,
    })
    .promise()
    .then(
      (r) => JSON.parse(r.Body.toString()) as { blocks: { text: string }[] }
    );
  const { oauth_token: key, oauth_token_secret: secret } = JSON.parse(oauth);

  let in_reply_to_status_id = "";
  let failureIndex = -1;
  return blocks
    .map(({ text }, index) => async () => {
      if (failureIndex >= 0) {
        return {
          success: false,
          message: `Skipped sending tweet due to failing to send tweet ${failureIndex}`,
        };
      }
      const attachmentUrls: string[] = [];
      const content = text.replace(ATTACHMENT_REGEX, (_, url) => {
        attachmentUrls.push(
          url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
        );
        return "";
      });
      const { media_ids, attachmentsError } = await uploadAttachments({
        attachmentUrls,
        key,
        secret,
      }).catch(async (e) => {
        await ses
          .sendEmail({
            Destination: {
              ToAddresses: ["support@roamjs.com"],
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `Scheduled Tweet while trying to upload attachments.\n\n${JSON.stringify(
                    {
                      message: e.response?.data || e.message || e,
                      attachmentUrls,
                    },
                    null,
                    4
                  )}`,
                },
              },
              Subject: {
                Charset: "UTF-8",
                Data: `Social - Scheduled Tweet Failed`,
              },
            },
            Source: "support@roamjs.com",
          })
          .promise();
        const attachmentsError =
          e.roamjsError || "Email support@roamjs.com for help!";
        return { media_ids: [] as string[], attachmentsError };
      });
      if (media_ids.length < attachmentUrls.length) {
        failureIndex = index;
        return {
          success: false,
          message: `Some attachments failed to upload. ${attachmentsError}`,
        };
      }
      const data = {
        status: content,
        ...(media_ids.length ? { media_ids } : {}),
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
    .reduce((prev, cur) => {
      return prev.then((outputs) =>
        cur().then((output) => {
          outputs.push(output);
          return outputs;
        })
      );
    }, Promise.resolve([] as { message: string; success: boolean }[]))
    .then((tweets) =>
      failureIndex >= 0
        ? Promise.reject(tweets[failureIndex].message)
        : Promise.resolve(tweets[0].message)
    );
};

export const handler = async () => {
  const now = startOfMinute(new Date());
  const toMinute = addSeconds(now, 30);
  const lastMinute = subMinutes(toMinute, 1);

  return dynamo
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
          S: process.env.NODE_ENV === "development" ? "development" : "twitter",
        },
      },
      ExpressionAttributeNames: {
        "#d": "date",
        "#c": "channel",
      },
    })
    .promise()
    .then((results) =>
      Promise.all(
        results.Items.map((i) =>
          channelHandler({
            oauth: i.oauth.S,
            uuid: i.uuid.S,
          })
            .then((message) => ({
              uuid: i.uuid.S,
              success: true,
              message,
              email: i.userId.S,
            }))
            .catch((message) => ({
              uuid: i.uuid.S,
              success: false,
              email: i.userId.S,
              message,
            }))
        )
      )
    )
    .then((items) =>
      items.forEach(({ uuid, success, message, email }) =>
        dynamo
          .updateItem({
            TableName: "RoamJSSocial",
            Key: { uuid: { S: uuid } },
            UpdateExpression: "SET #s = :s, #m = :m, #u = :u",
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
      )
    );
};
