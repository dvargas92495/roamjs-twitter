import {
  Alert,
  Button,
  Icon,
  Popover,
  Portal,
  Spinner,
  Text,
  Tooltip,
} from "@blueprintjs/core";
import { DatePicker } from "@blueprintjs/datetime";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import Twitter from "./TwitterLogo.svg";
import getEditTimeByBlockUid from "roamjs-components/queries/getEditTimeByBlockUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getUids from "roamjs-components/dom/getUids";
import updateBlock from "roamjs-components/writes/updateBlock";
import getRoamUrlByPage from "roamjs-components/dom/getRoamUrlByPage";
import resolveRefs from "roamjs-components/dom/resolveRefs";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import extractRef from "roamjs-components/util/extractRef";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getOauth from "roamjs-components/util/getOauth";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import { useOauthAccounts } from "roamjs-components/components/OauthSelect";
import apiPost from "roamjs-components/util/apiPost";
import axios from "axios";
import twitter from "twitter-text";
import addYears from "date-fns/addYears";
import endOfYear from "date-fns/endOfYear";
import format from "date-fns/format";
import addMinutes from "date-fns/addMinutes";
import startOfMinute from "date-fns/startOfMinute";
import { toFlexRegex } from "roamjs-components";

const ATTACHMENT_REGEX = /!\[[^\]]*\]\(([^\s)]*)\)/g;
const UPLOAD_URL = `${process.env.API_URL}/twitter-upload`;
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

const Error: React.FunctionComponent<{ error: string }> = ({ error }) =>
  error ? (
    <div style={{ color: "red", whiteSpace: "pre-line" }}>
      <Text>{error}</Text>
    </div>
  ) : (
    <></>
  );

const RoamRef = ({ uid }: { uid: string }) => {
  return (
    <span
      className="rm-block-ref"
      data-uid={uid}
      onClick={(e) => {
        if (e.shiftKey) {
          openBlockInSidebar(uid);
          e.preventDefault();
        } else {
          window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid } });
        }
      }}
    >
      (({uid}))
    </span>
  );
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
      .get(attachmentUrl, { responseType: "blob" })
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
};

const TwitterContent: React.FunctionComponent<{
  blockUid: string;
  configUid: string;
  tweetId?: string;
  close: () => void;
  setDialogMessage: (m: string) => void;
}> = ({ close, blockUid, tweetId, setDialogMessage, configUid }) => {
  const message = useMemo(
    () =>
      getBasicTreeByParentUid(blockUid).map((t) => ({
        ...t,
        text: resolveRefs(t.text),
      })),
    [blockUid]
  );
  const [error, setError] = useState("");
  const [tweetsSent, setTweetsSent] = useState(0);
  const { accountLabel, accountDropdown } = useOauthAccounts("twitter");
  const onClick = useCallback(async () => {
    setError("");
    const oauth = getOauth("twitter");
    if (oauth === "{}") {
      setError(
        "Need to log in with Twitter to send Tweets! Head to roam/js/twitter page to log in."
      );
      return;
    }
    const { oauth_token: key, oauth_token_secret: secret } = JSON.parse(oauth);
    const tree = getBasicTreeByParentUid(configUid);
    const sentBlockUid = getSettingValueFromTree({
      tree,
      key: "sent",
    })
      .replace("((", "")
      .replace("))", "");
    const sentLabel = getSettingValueFromTree({
      tree,
      key: "label",
      defaultValue: "Sent at {now}",
    });
    const appendText = getSettingValueFromTree({
      tree,
      key: "append text",
    });
    const sentBlockIsValid =
      sentBlockUid && !!getEditTimeByBlockUid(sentBlockUid);
    const sourceUid = window.roamAlphaAPI.util.generateUID();
    if (sentBlockIsValid) {
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": sentBlockUid, order: 0 },
        block: {
          string: sentLabel.replace(/{now}/g, new Date().toLocaleString()),
          uid: sourceUid,
        },
      });
    }
    let in_reply_to_status_id = tweetId;
    let success = true;
    const links: string[] = [];
    for (let index = 0; index < message.length; index++) {
      setTweetsSent(index + 1);
      const { text, uid } = message[index];
      const attachmentUrls: string[] = [];
      const content = text.replace(ATTACHMENT_REGEX, (_, url) => {
        attachmentUrls.push(
          url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
        );
        return "";
      });
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
      success = await axios
        .post(`${process.env.API_URL}/twitter-tweet`, {
          key,
          secret,
          content,
          in_reply_to_status_id,
          auto_populate_reply_metadata: !!in_reply_to_status_id,
          media_ids,
        })
        .then((r) => {
          const {
            id_str,
            user: { screen_name },
          } = r.data;
          in_reply_to_status_id = id_str;
          const link = `https://twitter.com/${screen_name}/status/${id_str}`;
          links.push(link);
          if (appendText) {
            window.roamAlphaAPI.updateBlock({
              block: {
                uid,
                string: `${text} ${appendText.replace("{link}", link)}`,
              },
            });
          }
          if (sentBlockIsValid) {
            window.roamAlphaAPI.moveBlock({
              location: { "parent-uid": sourceUid, order: index },
              block: { uid },
            });
          }
          return true;
        })
        .catch((e) => {
          if (sentBlockIsValid && index === 0) {
            window.roamAlphaAPI.deleteBlock({ block: { uid: sourceUid } });
          }
          setError(
            e.response?.data?.errors
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
              : e.message
          );
          setTweetsSent(0);
          return false;
        });
      if (!success) {
        break;
      }
    }
    if (success) {
      const appendParent = getSettingValueFromTree({
        tree,
        key: "append parent",
      });
      if (appendParent) {
        const text = getTextByBlockUid(blockUid);
        updateBlock({
          uid: blockUid,
          text: `${text}${appendParent
            .replace(/{link}/g, links[0])
            .replace(/{now}/g, new Date().toLocaleString())}`,
        });
      }
      close();
    }
  }, [setTweetsSent, close, setError, tweetId, accountLabel]);

  const initialDate = useMemo(
    () => addMinutes(startOfMinute(new Date()), 1),
    []
  );
  const schedulingEnabled = useMemo(
    () =>
      getBasicTreeByParentUid(configUid).some((t) =>
        toFlexRegex("scheduling").test(t.text)
      ),
    [configUid]
  );
  const [showSchedule, setShowSchedule] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const openSchedule = useCallback(() => setShowSchedule(true), [
    setShowSchedule,
  ]);
  const closeSchedule = useCallback(() => setShowSchedule(false), [
    setShowSchedule,
  ]);
  const onScheduleClick = useCallback(() => {
    const oauth = getOauth("twitter", accountLabel);
    if (oauth === "{}") {
      setError(
        "Need to log in with Twitter to schedule Tweets! Head to roam/js/twitter page to log in."
      );
      return;
    }
    setLoading(true);
    apiPost("twitter-schedule", {
      scheduleDate: scheduleDate.toJSON(),
      payload: JSON.stringify({ blocks: message, tweetId }),
      oauth,
    })
      .then(() => {
        setLoading(false);
        setDialogMessage(
          `Tweet Successfully Scheduled to post at ${format(
            scheduleDate,
            "yyyy/MM/dd hh:mm:ss a"
          )}!`
        );
      })
      .catch((e) => {
        setError(e.response?.data);
        setLoading(false);
        return false;
      })
      .then((success: boolean) => success && close());
  }, [
    setError,
    close,
    setLoading,
    scheduleDate,
    setDialogMessage,
    message,
    tweetId,
    accountLabel,
    apiPost,
  ]);
  return (
    <div style={{ padding: 16, maxWidth: 400 }}>
      {showSchedule ? (
        <>
          <Button icon="arrow-left" minimal onClick={closeSchedule} />
          <div>
            <DatePicker
              value={scheduleDate}
              onChange={setScheduleDate}
              minDate={initialDate}
              maxDate={addYears(endOfYear(new Date()), 5)}
              timePrecision={"minute"}
              highlightCurrentDay
              className={"roamjs-datepicker"}
              timePickerProps={{ useAmPm: true, showArrowButtons: true }}
            />
            <div>
              <Button
                text={"Schedule"}
                onClick={onScheduleClick}
                id={"roamjs-send-schedule-button"}
                style={{marginRight: 16}}
              />
              {loading && <Spinner size={Spinner.SIZE_SMALL} />}
            </div>
            <Error error={error} />
          </div>
        </>
      ) : (
        <>
          {accountDropdown}
          <Button
            text={tweetId ? "Send Reply" : "Send Tweet"}
            onClick={onClick}
          />
          {tweetsSent > 0 && (
            <div>
              Sending {tweetsSent} of {message.length} tweets.{" "}
              <Spinner size={Spinner.SIZE_SMALL} />
            </div>
          )}
          <Error error={error} />
          <div style={{ marginTop: 16 }}>
            {schedulingEnabled ? (
              <Button
                text={tweetId ? "Schedule Reply" : "Schedule Tweet"}
                onClick={openSchedule}
                id={"roamjs-schedule-tweet-button"}
              />
            ) : (
              <Tooltip
                content={
                  "The scheduling feature is under development and will soon be available!"
                  /*<span>
                    To enable the Scheduling feature, head to your
                    <a
                      onClick={() =>
                        window.roamAlphaAPI.ui.mainWindow.openPage({
                          page: { title: "roam/js/twitter" },
                        })
                      }
                    >
                      <span className="rm-page-ref__brackets">[[</span>
                      <span
                        tabIndex={-1}
                        className="rm-page-ref rm-page-ref--link"
                      >
                        roam/js/twitter
                      </span>
                      <span className="rm-page-ref__brackets">]]</span>
                    </a>{" "}
                    page!
                      </span>*/
                }
              >
                <Button
                  text={tweetId ? "Schedule Reply" : "Schedule Tweet"}
                  id={"roamjs-schedule-tweet-button"}
                  disabled={true}
                />
              </Tooltip>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const TweetOverlay: React.FunctionComponent<{
  blockUid: string;
  configUid: string;
  tweetId?: string;
  childrenRef?: HTMLDivElement;
  unmount: () => void;
}> = ({ childrenRef, blockUid, unmount, tweetId, configUid }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const rootRef = useRef(null);
  const calcCounts = useCallback(
    () =>
      getBasicTreeByParentUid(blockUid).map((t) => {
        const { weightedLength, valid } = twitter.parseTweet(
          resolveRefs(t.text).replace(ATTACHMENT_REGEX, "")
        );
        return {
          count: weightedLength,
          valid,
          uid: t.uid,
        };
      }),
    [blockUid]
  );
  const calcBlocks = useCallback(
    () =>
      Array.from(childrenRef?.children || [])
        .filter((c) => c.className.includes("roam-block-container"))
        .map(
          (c) =>
            Array.from(c.children).find((c) =>
              c.className.includes("rm-block-main")
            ) as HTMLDivElement
        ),
    [childrenRef]
  );
  const [counts, setCounts] = useState(calcCounts);
  const blocks = useRef(calcBlocks());
  const { valid, validMessage } = useMemo(() => {
    const empty: string[] = [];
    const tooLong: string[] = [];
    const valid = counts.every(({ valid, count, uid }) => {
      if (!valid) {
        if (count === 0) empty.push(uid);
        else tooLong.push(uid);
      }
      return valid;
    });
    return {
      valid,
      validMessage: valid
        ? ""
        : `The tweet thread is invalid:\n${
            empty.length
              ? `- These tweets are empty: ${empty
                  .map((s) => `((${s}))`)
                  .join(", ")}\n`
              : ""
          }${
            tooLong.length
              ? `- These tweets are too long: ${tooLong
                  .map((s) => `((${s}))`)
                  .join(", ")}\n`
              : ""
          }`,
    };
  }, [counts]);
  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  const closeDialog = useCallback(() => {
    setDialogMessage("");
    close();
  }, [setDialogMessage]);
  const inputCallback = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA") {
        const textarea = target as HTMLTextAreaElement;
        const { blockUid: currentUid } = getUids(textarea);
        blocks.current = calcBlocks();
        setCounts(
          calcCounts().map((c) => {
            if (c.uid === currentUid) {
              const { weightedLength, valid } = twitter.parseTweet(
                resolveRefs(textarea.value).replace(ATTACHMENT_REGEX, "")
              );
              return { uid: currentUid, count: weightedLength, valid };
            } else {
              return c;
            }
          })
        );
      }
    },
    [blockUid, setCounts, calcCounts, calcBlocks, blocks]
  );
  useEffect(() => {
    if (childrenRef) {
      childrenRef.addEventListener("input", inputCallback);
      return () => childrenRef.removeEventListener("input", inputCallback);
    }
  }, [childrenRef, inputCallback]);
  useEffect(() => {
    if (rootRef.current && !document.contains(rootRef.current.targetElement)) {
      unmount();
    }
  });
  const aOnClick = useCallback(() => {
    window.roamAlphaAPI.ui.mainWindow.openPage({
      page: { title: "roam/js/twitter" },
    });
    closeDialog();
  }, [closeDialog]);
  return (
    <>
      <Popover
        target={
          valid ? (
            <Twitter
              style={{
                width: 15,
                marginLeft: 4,
                cursor: "pointer",
              }}
              onClick={open}
            />
          ) : (
            <Tooltip
              hoverCloseDelay={5000}
              content={
                <span style={{ whiteSpace: "pre" }}>
                  {validMessage
                    .split(/(\(\([\w\d-]{9,10}\)\))/g)
                    .map((e, i) =>
                      BLOCK_REF_REGEX.test(e) ? (
                        <RoamRef key={i} uid={extractRef(e)} />
                      ) : (
                        <React.Fragment key={i}>{e}</React.Fragment>
                      )
                    )}
                </span>
              }
            >
              <Twitter
                style={{
                  width: 15,
                  marginLeft: 4,
                  cursor: "not-allowed",
                }}
              />
            </Tooltip>
          )
        }
        content={
          <TwitterContent
            configUid={configUid}
            blockUid={blockUid}
            tweetId={tweetId}
            close={close}
            setDialogMessage={setDialogMessage}
          />
        }
        isOpen={isOpen}
        onInteraction={(next) => setIsOpen(next && valid)}
        ref={rootRef}
      />
      {counts
        .filter((_, i) => !!blocks.current[i])
        .map(({ count, uid }, i) => (
          <Portal
            container={blocks.current[i]}
            key={uid}
            className={"roamjs-twitter-count"}
          >
            <span style={{ color: count > 280 ? "red" : "black" }}>
              {count}/280
            </span>
          </Portal>
        ))}
      <Alert
        isOpen={!!dialogMessage}
        onClose={closeDialog}
        canEscapeKeyCancel
        canOutsideClickCancel
      >
        <p>{dialogMessage}</p>
        <p>
          Visit the{" "}
          <a onClick={aOnClick}>
            <span className="rm-page-ref__brackets">[[</span>
            <span tabIndex={-1} className="rm-page-ref rm-page-ref--link">
              roam/js/twitter
            </span>
            <span className="rm-page-ref__brackets">]]</span>
          </a>{" "}
          page to track the tweet's status.
        </p>
      </Alert>
    </>
  );
};

export const render = ({
  parent,
  blockUid,
  tweetId,
  configUid,
}: {
  parent: HTMLSpanElement;
  blockUid: string;
  configUid: string;
  tweetId?: string;
}): void => {
  const childrenRef = parent.closest(".rm-block-main")
    ?.nextElementSibling as HTMLDivElement;
  if (childrenRef) {
    Array.from(
      childrenRef.getElementsByClassName("roamjs-twitter-count")
    ).forEach((s) => s.remove());
  }
  ReactDOM.render(
    <TweetOverlay
      configUid={configUid}
      blockUid={blockUid}
      tweetId={tweetId}
      childrenRef={childrenRef}
      unmount={() => ReactDOM.unmountComponentAtNode(parent)}
    />,
    parent
  );
};

export default TweetOverlay;
