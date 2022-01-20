import addStyle from "roamjs-components/dom/addStyle";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import createPageTitleObserver from "roamjs-components/dom/createPageTitleObserver";
import genericError from "roamjs-components/dom/genericError";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import getUids from "roamjs-components/dom/getUids";
import toRoamDate from "roamjs-components/date/toRoamDate";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageTitleByHtmlElement from "roamjs-components/dom/getPageTitleByHtmlElement";
import parseRoamDateUid from "roamjs-components/date/parseRoamDateUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import runExtension from "roamjs-components/util/runExtension";
import isTagOnPage from "roamjs-components/queries/isTagOnPage";
import axios from "axios";
import { render } from "./TweetOverlay";
import { render as feedRender } from "./TwitterFeed";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import updateBlock from "roamjs-components/writes/updateBlock";
import getRenderRoot from "roamjs-components/util/getRenderRoot";
import TwitterLogo from "./TwitterLogo.svg";
import Dashboard, { ScheduledTweet } from "./ScheduledDashboard";
import createBlock from "roamjs-components/writes/createBlock";
import getOrderByBlockUid from "roamjs-components/queries/getOrderByBlockUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import apiGet from "roamjs-components/util/apiGet";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";

addStyle(`div.roamjs-twitter-count {
  position: relative;
}

.roamjs-twitter-feed-embed {
  display: inline-block;
  vertical-align: middle;
}

.roamjs-datepicker {
  background: transparent;
  align-self: center;
}

textarea:focus {
  outline: none;
  outline-offset: 0;
}

div:focus {
  outline: none;
  outline-offset: 0;
}`);

const TWITTER_REFERENCES_COMMAND = "twitter-references";
const CONFIG = "roam/js/twitter";

const twitterReferencesListener = async (
  _: {
    [key: string]: string;
  },
  blockUid: string
) => {
  const pageTitle = getPageTitleByHtmlElement(document.activeElement)
    .textContent;

  const twitterSearch = axios.get<{ statuses: { id_str: string }[] }>(
    `${process.env.API_URL}/twitter-search?query=${encodeURIComponent(
      pageTitle
    )}`
  );

  twitterSearch
    .then(async (response) => {
      const statuses = response.data.statuses;
      const count = statuses.length;
      if (count === 0) {
        return window.roamAlphaAPI.updateBlock({
          block: {
            string: "No tweets found!",
            uid: blockUid,
          },
        });
      }
      const bullets = statuses.map(
        (i: { id_str: string }) =>
          `https://twitter.com/i/web/status/${i.id_str}`
      );
      const order = getOrderByBlockUid(blockUid);
      const parentUid = getParentUidByBlockUid(blockUid);
      return Promise.all([
        updateBlock({ uid: blockUid, text: bullets[0] }),
        ...bullets.slice(1).map((text, i) =>
          createBlock({
            parentUid,
            order: order + i + 1,
            node: { text },
          })
        ),
      ]);
    })
    .catch(genericError);
};

runExtension("twitter", async () => {
  const { pageUid } = await createConfigObserver({
    title: CONFIG,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              title: "oauth",
              type: "oauth",
              description: "Click the button to login to Twitter",
              options: {
                service: "twitter",
                getPopoutUrl: (state: string): Promise<string> =>
                  axios
                    .post(`${process.env.API_URL}/twitter-login`, { state })
                    .then(
                      (r) =>
                        `https://api.twitter.com/oauth/authenticate?oauth_token=${r.data.token}`
                    ),
                getAuthData: (data: string): Promise<Record<string, string>> =>
                  axios
                    .post(
                      `${process.env.API_URL}/twitter-auth`,
                      JSON.parse(data)
                    )
                    .then((r) => r.data),
                ServiceIcon: TwitterLogo,
              },
            },
            {
              title: "sent",
              type: "text",
              description: "Block reference to move sent tweets under.",
            },
            {
              title: "label",
              type: "text",
              description:
                "The label of the block that will be the parent of sent tweets",
            },
            {
              title: "append text",
              type: "text",
              description: "Text to append at the end of a sent tweet block",
            },
            {
              title: "append parent",
              type: "text",
              description:
                "Text to append at the end of the parent block that sent the tweet thread",
            },
          ],
        },
        {
          id: "feed",
          toggleable: true,
          fields: [
            {
              type: "flag",
              title: "any day",
              description:
                "Whether or not the twitter feed should appear any time you appear on a daily note page",
            },
            {
              type: "flag",
              title: "bottom",
              description:
                "Whether to import today's tweets to the top or bottom of the daily note page",
            },
            {
              type: "text",
              title: "format",
              description:
                "The format each tweet will use when imported to the daily note page.",
            },
            {
              type: "flag",
              title: "today",
              description:
                "Whether to query tweets liked on the same day of the Daily Note Page instead of the previous day.",
            },
          ],
        },
        {
          id: "scheduling",
          toggleable: "dev_price_1IQjUlFHEvC1s7vkDLgkw0DO",
          development: true,
          fields: [
            {
              type: "custom",
              title: "Dashboard",
              description:
                "View all of your pending and completed scheduled Tweets",
              options: {
                component: Dashboard,
              },
            },
            {
              type: "flag",
              title: "Mark Blocks",
              description:
                "Whether to mark blocks in your graph with an icon that shows they are already scheduled",
            },
          ],
        },
      ],
    },
  });

  createButtonObserver({
    attribute: TWITTER_REFERENCES_COMMAND,
    render: (b) => {
      b.onclick = () =>
        twitterReferencesListener({}, getUidsFromButton(b).blockUid);
    },
  });

  createButtonObserver({
    shortcut: "tweet",
    attribute: "write-tweet",
    render: (b: HTMLButtonElement) => {
      const { blockUid } = getUidsFromButton(b);
      render({
        parent: b.parentElement,
        blockUid,
        configUid: pageUid,
      });
    },
  });

  createHTMLObserver({
    className: "twitter-tweet",
    tag: "DIV",
    callback: (d: HTMLDivElement) => {
      if (!d.hasAttribute("data-roamjs-twitter-reply")) {
        d.setAttribute("data-roamjs-twitter-reply", "true");
        const block = d.closest(".roam-block") as HTMLDivElement;
        const sub = block.getElementsByTagName("sub")[0];
        const tweetMatch = /\/([a-zA-Z0-9_]{1,15})\/status\/([0-9]*)\??/.exec(
          sub?.innerText
        );
        const { blockUid } = getUids(block);
        const span = document.createElement("span");
        d.appendChild(span);
        render({
          parent: span,
          blockUid,
          tweetId: tweetMatch?.[2],
          configUid: pageUid,
        });
      }
    },
  });

  const configTree = getBasicTreeByParentUid(pageUid);
  const feed = getSubTree({ tree: configTree, key: "feed" });
  if (feed.uid) {
    const isAnyDay = feed.children.some((t) => /any day/i.test(t.text));
    const isToday = feed.children.some((t) => /today/i.test(t.text));
    const format =
      feed.children.find((t) => /format/i.test(t.text))?.children?.[0]?.text ||
      "{link}";
    const callback = ({ title, d }: { d: HTMLDivElement; title: string }) => {
      if (!isTagOnPage({ tag: "Twitter Feed", title })) {
        const parent = document.createElement("div");
        parent.id = "roamjs-twitter-feed";
        d.firstElementChild.insertBefore(
          parent,
          d.firstElementChild.firstElementChild.nextElementSibling
        );
        feedRender(parent, { title, format, isToday });
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
      const title = toRoamDate(new Date());
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
        feedRender(root, { format, title, isToday });
      },
    });
  }
  const scheduling = getSubTree({ tree: configTree, key: "scheduling" });
  if (scheduling) {
    const mark = getSubTree({ tree: scheduling.children, key: "Mark Blocks" });
    if (mark) {
      apiGet("twitter-schedule")
        .then((r) => {
          const scheduledTweets = r.data.scheduledTweets as ScheduledTweet[];
          const pendingBlockUids = new Set(
            scheduledTweets
              .filter((s) => s.status === "PENDING")
              .map((s) => s.blockUid)
          );
          const successBlockUids = new Set(
            scheduledTweets
              .filter((s) => s.status === "SUCCESS")
              .map((s) => s.blockUid)
          );
          const failedBlockUids = new Set(
            scheduledTweets
              .filter((s) => s.status === "FAILED")
              .map((s) => s.blockUid)
          );
          createBlockObserver((b) => {
            const { blockUid } = getUids(b);
            if (pendingBlockUids.has(blockUid)) {
              console.log("display pending icon");
            } else if (successBlockUids.has(blockUid)) {
              console.log("display success icon");
            } else if (failedBlockUids.has(blockUid)) {
              console.log("display failed icon");
            }
          });
        })
        .catch((e) => console.error(e.response?.data && e.message));
    }
  }
});
