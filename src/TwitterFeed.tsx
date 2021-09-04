import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  Intent,
  Spinner,
} from "@blueprintjs/core";
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  createBlock,
  getChildrenLengthByPageUid,
  getTreeByPageName,
  parseRoamDate,
  toRoamDate,
  toRoamDateUid,
} from "roam-client";
import { getOauth, getOauthAccounts, MenuItemSelect } from "roamjs-components";
import subDays from "date-fns/subDays";
import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import TweetEmbed from "react-tweet-embed";

type Tweet = {
  id: string;
  text: string;
  handle: string;
  author: string;
  checked: boolean;
};

const getOrder = (parentUid: string) => {
  const tree = getTreeByPageName("roam/js/twitter");
  const isBottom = tree
    .find((t) => /feed/i.test(t.text))
    ?.children?.some?.((t) => /bottom/i.test(t.text));
  return isBottom ? getChildrenLengthByPageUid(parentUid) : 0;
};

const TweetLabel = ({ id }: { id: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <Spinner size={Spinner.SIZE_SMALL} />}
      <TweetEmbed
        id={id}
        options={{
          cards: "hidden",
          width: 280,
          conversation: "none",
        }}
        className={"roamjs-twitter-feed-embed"}
        onTweetLoadSuccess={() => setLoaded(true)}
      />
    </>
  );
};

const TwitterFeed = ({
  title,
  format,
}: {
  title: string;
  format: string;
}): React.ReactElement => {
  const date = useMemo(() => parseRoamDate(title), [title]);
  const yesterday = useMemo(() => subDays(date, 1), [date]);
  const roamDate = useMemo(() => toRoamDate(yesterday), [yesterday]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accounts = useMemo(() => getOauthAccounts("twitter"), []);
  const [activeAccount, setActiveAccount] = useState(accounts[0]);
  const onClose = useCallback(() => {
    ReactDOM.unmountComponentAtNode(
      document.getElementById("roamjs-twitter-feed")
    );
  }, [tweets]);
  const onCancel = useCallback(() => {
    const parentUid = toRoamDateUid(date);
    createBlock({
      parentUid,
      order: getOrder(parentUid),
      node: {
        text: "#[[Twitter Feed]]",
        children: [
          {
            text: "Cancelled",
            children: [],
          },
        ],
      },
    });
    onClose();
  }, [onClose, date, title]);
  useEffect(() => {
    setLoading(true);
    setTweets([]);
    setError("");
    const oauth = getOauth("twitter", activeAccount);
    if (oauth === "{}") {
      setError(
        "Need to log in with Twitter to use Daily Twitter Feed! Head to roam/js/twitter page to log in."
      );
      return;
    }
    const { oauth_token: key, oauth_token_secret: secret } = JSON.parse(oauth);
    axios
      .get<{ tweets: Omit<Tweet, "checked">[] }>(
        `${process.env.API_URL}/twitter-feed?from=${startOfDay(
          yesterday
        ).toJSON()}&to=${endOfDay(yesterday).toJSON()}`,
        {
          headers: {
            Authorization: `${key}:${secret}`,
          },
        }
      )
      .then((r) => {
        setTweets(r.data.tweets.map((t) => ({ ...t, checked: true })));
      })
      .catch((r) => setError(r.response?.data || r.message))
      .finally(() => setLoading(false));
  }, [setTweets, yesterday, activeAccount]);
  const onClick = useCallback(() => {
    createBlock({
      parentUid: toRoamDateUid(date),
      order: getOrder(title),
      node: {
        text: "#[[Twitter Feed]]",
        children: tweets
          .filter(({ checked }) => checked)
          .map((t) => ({
            text: format
              .replace(/{link}/g, `https://twitter.com/i/web/status/${t.id}`)
              .replace(/{text}/g, t.text)
              .replace(/{handle}/g, t.handle)
              .replace(/{author}/g, t.author),
          })),
      },
    });
    onClose();
  }, [tweets, onClose, title, date]);
  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      canOutsideClickClose
      canEscapeKeyClose
      title={`Twitter Feed for ${roamDate}`}
    >
      <div style={{ padding: 16 }}>
        {loading ? (
          <Spinner />
        ) : error ? (
          <span style={{ color: "darkred" }}>{error}</span>
        ) : (
          <div
            style={{
              maxHeight: 760,
              overflowY: "scroll",
              paddingBottom: 16,
              paddingLeft: 4,
            }}
          >
            {tweets.map((tweet) => (
              <Checkbox
                key={tweet.id}
                checked={tweet.checked}
                onChange={(e: React.FormEvent<HTMLInputElement>) =>
                  setTweets(
                    tweets.map((t) =>
                      t.id === tweet.id
                        ? {
                            ...t,
                            checked: (e.target as HTMLInputElement).checked,
                          }
                        : t
                    )
                  )
                }
              >
                <TweetLabel id={tweet.id} />
              </Checkbox>
            ))}
            {!tweets.length && <span>No tweets liked.</span>}
          </div>
        )}
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div
          className={Classes.DIALOG_FOOTER_ACTIONS}
          style={{
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          {accounts.length > 1 && (
            <MenuItemSelect
              activeItem={activeAccount}
              items={accounts}
              onItemSelect={(a) => setActiveAccount(a)}
              disabled={loading}
            />
          )}
          <Button
            onClick={onClick}
            intent={Intent.PRIMARY}
            style={{ marginTop: 16 }}
            disabled={loading || !!error}
          >
            {tweets.length ? "IMPORT" : "OK"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const render = (
  parent: HTMLDivElement,
  props: { title: string; format: string }
): void => ReactDOM.render(<TwitterFeed {...props} />, parent);

export default TwitterFeed;