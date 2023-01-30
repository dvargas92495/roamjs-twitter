import addStyle from "roamjs-components/dom/addStyle";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import genericError from "roamjs-components/dom/genericError";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import getUids from "roamjs-components/dom/getUids";
import getPageTitleByHtmlElement from "roamjs-components/dom/getPageTitleByHtmlElement";
import runExtension from "roamjs-components/util/runExtension";
import { render } from "./TweetOverlay";
import loadTwitterFeed from "./TwitterFeed";
import updateBlock from "roamjs-components/writes/updateBlock";
import TwitterLogo from "./TwitterLogo.svg";
import loadTwitterScheduling from "./ScheduledDashboard";
import createBlock from "roamjs-components/writes/createBlock";
import getOrderByBlockUid from "roamjs-components/queries/getOrderByBlockUid";
import apiGet from "roamjs-components/util/apiGet";
import React from "react";
import OauthPanel from "roamjs-components/components/OauthPanel";
import apiPost from "roamjs-components/util/apiPost";
import { addTokenDialogCommand } from "roamjs-components/components/TokenDialog";

const TWITTER_REFERENCES_COMMAND = "twitter-references";

const twitterReferencesListener = async (
  _: {
    [key: string]: string;
  },
  blockUid: string
) => {
  const pageTitle = getPageTitleByHtmlElement(document.activeElement)
    .textContent;

  const twitterSearch = apiGet<{ statuses: { id_str: string }[] }>({
    path: `twitter-search`,
    data: { query: pageTitle },
  });

  twitterSearch
    .then(async (response) => {
      const { statuses } = response;
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

export default runExtension({
  migratedTo: "Twitter",
  run: async (args) => {
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
    const toggleTwitterFeed = loadTwitterFeed(args);
    const toggleTwitterScheduling = loadTwitterScheduling(args);
    args.extensionAPI.settings.panel.create({
      tabTitle: "Twitter",
      settings: [
        {
          id: "oauth",
          name: "Log In",
          description: "Log into Twitter to connect your account to Roam!",
          action: {
            type: "reactComponent",
            component: () =>
              React.createElement(OauthPanel, {
                service: "twitter",
                getPopoutUrl: (state: string): Promise<string> =>
                  apiPost<{ token: string }>({
                    path: `twitter-login`,
                    data: { state },
                  }).then(
                    (r) =>
                      `https://api.twitter.com/oauth/authenticate?oauth_token=${r.token}`
                  ),
                getAuthData: (data: string): Promise<Record<string, string>> =>
                  apiPost({
                    path: `twitter-auth`,
                    data: JSON.parse(data),
                  }),
                ServiceIcon: TwitterLogo,
              }),
          },
        },
        {
          id: "sent",
          action: { type: "input", placeholder: "((abcdefghi))" },
          name: "Sent Tweets Parent",
          description: "Block reference to move sent tweets under.",
        },
        {
          id: "label",
          action: { type: "input", placeholder: "((abcdefghi))" },
          name: "Sent Tweets Label",
          description:
            "The label of the block that will be the parent of sent tweets",
        },
        {
          id: "append-text",
          action: { type: "input", placeholder: "#tweeted" },
          name: "Append After Tweet",
          description: "Text to append at the end of a sent tweet block",
        },
        {
          id: "append-parent",
          action: { type: "input", placeholder: "#tweeted" },
          name: "Append To Parent",
          description:
            "Text to append at the end of the parent block that sent the tweet thread",
        },
        {
          action: {
            type: "switch",
            onChange: (e) => toggleTwitterFeed(e.target.checked),
          },
          id: "feed-enabled",
          name: "Feed Enabled",
          description:
            "Whether or not to enable the Twitter feed displaying liked tweets from the last day",
        },
        {
          action: { type: "switch" },
          id: "any-day",
          name: "Feed on any day",
          description:
            "Whether or not the twitter feed should appear any time you appear on a daily note page",
        },
        {
          action: { type: "switch" },
          id: "bottom",
          name: "Append Feed to Bottom",
          description:
            "Whether to import today's tweets to the top or bottom of the daily note page",
        },
        {
          action: { type: "input", placeholder: "{link}" },
          id: "feed-format",
          name: "Feed Import Format",
          description:
            "The format each tweet will use when imported to the daily note page.",
        },
        {
          action: { type: "switch" },
          id: "today",
          name: "Feed Same Day",
          description:
            "Whether to query tweets liked on the same day of the Daily Note Page instead of the previous day.",
        },
        {
          action: {
            type: "switch",
            onChange: (e) => toggleTwitterScheduling(e.target.checked),
          },
          id: "scheduling-enabled",
          name: "Scheduling Enabled",
          description: "Whether or not the scheduling features are enabled",
        },
        {
          action: { type: "switch" },
          id: "mark-blocks",
          name: "Mark Scheduled Blocks",
          description:
            "Whether to mark blocks in your graph with an icon that shows they are already scheduled. Requires refreshing to take effect.",
        },
        {
          action: { type: "switch" },
          id: "parse-tags",
          name: "Remove Wikilinks",
          description:
            "Whether or not to remove wikilinks ([[thisPage]] and #[[thisPage]]) from tweets before sending",
        },
      ],
    });

    createButtonObserver({
      shortcut: "tweet",
      attribute: "write-tweet",
      render: (b: HTMLButtonElement) => {
        const { blockUid } = getUidsFromButton(b);
        render({
          parent: b.parentElement,
          blockUid,
          extensionAPI: args.extensionAPI,
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
            extensionAPI: args.extensionAPI,
          });
        }
      },
    });

    createButtonObserver({
      attribute: TWITTER_REFERENCES_COMMAND,
      render: (b) => {
        b.onclick = () =>
          twitterReferencesListener({}, getUidsFromButton(b).blockUid);
      },
    });

    addTokenDialogCommand();
    if (args.extensionAPI.settings.get("scheduling-enabled"))
      toggleTwitterScheduling(true);
    return () => {
      toggleTwitterScheduling(false);
    };
  },
});
