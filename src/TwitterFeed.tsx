import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  Intent,
  Spinner,
} from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import createBlock from "roamjs-components/writes/createBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getOauth from "roamjs-components/util/getOauth";
import getOauthAccounts from "roamjs-components/util/getOauthAccounts";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import subDays from "date-fns/subDays";
import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import TweetEmbed from "react-tweet-embed";
import type { OnloadArgs } from "roamjs-components/types/native";
import isTagOnPage from "roamjs-components/queries/isTagOnPage";
import parseRoamDateUid from "roamjs-components/date/parseRoamDateUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import createPageTitleObserver from "roamjs-components/dom/createPageTitleObserver";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getRenderRoot from "roamjs-components/util/getRenderRoot";
import apiGet from "roamjs-components/util/apiGet";

type Tweet = {
  id: string;
  text: string;
  handle: string;
  author: string;
  checked: boolean;
};

const getOrder = (parentUid: string) => {
  const tree = getBasicTreeByParentUid(
    getPageUidByPageTitle("roam/js/twitter")
  );
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
  isToday,
}: {
  title: string;
  format: string;
  isToday: boolean;
}): React.ReactElement => {
  const date = useMemo(() => window.roamAlphaAPI.util.pageTitleToDate(title), [
    title,
  ]);
  const dayToQuery = useMemo(() => (isToday ? date : subDays(date, 1)), [
    date,
    isToday,
  ]);
  const roamDate = useMemo(
    () => window.roamAlphaAPI.util.dateToPageTitle(dayToQuery),
    [dayToQuery]
  );
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
    const parentUid = window.roamAlphaAPI.util.dateToPageUid(date);
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
    apiGet<{ tweets: Omit<Tweet, "checked">[] }>({
      path: `twitter-feed`,
      data: {
        from: startOfDay(dayToQuery).toJSON(),
        to: endOfDay(dayToQuery).toJSON(),
      },
      authorization: `${key}:${secret}`,
    })
      .then((r) => {
        setTweets(r.tweets.map((t) => ({ ...t, checked: true })));
      })
      .catch((r) => setError(r.response?.data || r.message))
      .finally(() => setLoading(false));
  }, [setTweets, dayToQuery, activeAccount]);
  const onClick = useCallback(() => {
    createBlock({
      parentUid: window.roamAlphaAPI.util.dateToPageUid(date),
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
  props: Parameters<typeof TwitterFeed>[0]
): void => ReactDOM.render(<TwitterFeed {...props} />, parent);

const loadTwitterFeed = (args: OnloadArgs) => {
  const unloads = new Set<() => void>();
  return (enabled: boolean) => {
    if (enabled) {
      const isAnyDay = !!args.extensionAPI.settings.get("any-day");
      const isToday = !!args.extensionAPI.settings.get("today");
      const format =
        (args.extensionAPI.settings.get("feed-format") as string) || "{link}";
      const callback = ({ title, d }: { d: HTMLDivElement; title: string }) => {
        if (!isTagOnPage({ tag: "Twitter Feed", title })) {
          const parent = document.createElement("div");
          parent.id = "roamjs-twitter-feed";
          d.firstElementChild.insertBefore(
            parent,
            d.firstElementChild.firstElementChild.nextElementSibling
          );
          render(parent, { title, format, isToday });
        }
      };
      if (isAnyDay) {
        const listener = (e?: HashChangeEvent) => {
          const d = document.getElementsByClassName(
            "roam-article"
          )[0] as HTMLDivElement;
          if (d) {
            const url = e?.newURL || window.location.href;
            const uid = url.match(/\/page\/(.*)$/)?.[1] || "";
            const attribute = `data-roamjs-${uid}`;
            if (!isNaN(parseRoamDateUid(uid).valueOf())) {
              // React's rerender crushes the old article/heading
              setTimeout(() => {
                if (!d.hasAttribute(attribute)) {
                  d.setAttribute(attribute, "true");
                  callback({
                    d: document.getElementsByClassName(
                      "roam-article"
                    )[0] as HTMLDivElement,
                    title: getPageTitleByPageUid(uid),
                  });
                }
              }, 1);
            } else {
              d.removeAttribute(attribute);
            }
          }
        };
        window.addEventListener("hashchange", listener);
      } else {
        const title = window.roamAlphaAPI.util.dateToPageTitle(new Date());
        createPageTitleObserver({
          title,
          log: true,
          callback: (d: HTMLDivElement) => callback({ d, title }),
        });
      }
      window.roamAlphaAPI.ui.commandPalette.addCommand({
        label: "Open Twitter Feed",
        callback: () => {
          const title = getPageTitleByPageUid(getCurrentPageUid());
          const root = getRenderRoot("twitter-feed");
          root.id = root.id.replace(/-root$/, "");
          render(root, { format, title, isToday });
        },
      });
    } else {
      unloads.forEach((u) => u());
      unloads.clear();
    }
  };
};

export default loadTwitterFeed;
