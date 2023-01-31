# Twitter

Connects your Roam graph to Twitter!

## Usage
The RoamJS Twitter extension allows you to use your Roam graph as a client to your Twitter account! Included in this extension is the ability to:
1. Send Tweets
2. Schedule Tweets
3. Import Tweets

## Sending Tweets
In the Roam Depot Settings, a log in with Twitter button will be rendered on the configuration screen. Clicking the button will create a popup window, prompting you to authorize RoamJS to be able to send tweets on your behalf. You may need to allow popups from Roam for this to work.

To send a tweet, create a `{{tweet}}` button and nest the content of the tweet as a child.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fn5epsIriSq.png?alt=media&token=3c9d3bab-827f-4b1f-868c-8f3fbe935b9f)

The button will be replaced with a Twitter icon. Clicking the icon will render an overlay with a "Send Tweet" button.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FG7_KXjVVW6.png?alt=media&token=860e48fe-40ce-45f7-bb4f-5e5e0f96c1e5)

Clicking "Send Tweet" will send the first child as the content of the Tweet!
If the tweet button has multiple children, clicking "Send Tweet" will send each block as a tweet as part of a single Tweet thread.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fyg_J3W5Gg_.png?alt=media&token=d923e6f8-31fc-4a5d-ab59-48c2a5912db3)

Images, gifs, or videos in the Roam Block **inline with the rest of the tweet**, will be uploaded as media embedded in the tweet! The `![](url)` block text will be stripped from the tweet content. Up to four images, one gif, or one video are allowed by Twitter.

### After Sending

There are various behaviours you could configure to occur after tweets are successfully sent.

It could be useful to denote which blocks in Roam have already been sent by moving them to another page or block reference after sending. On Roam Depot Settings, you could add a block reference to the `Sent Tweets Parent` field to denote where your tweet blocks in Roam should move to after they have been successfully sent

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FcvkxdLBNN7.png?alt=media&token=57ec2385-fbbd-4cbd-bc77-105bace9c016)

This will move all the blocks sent as children of this block upon sending.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FZoIw9xhIc-.png?alt=media&token=cd839eea-3ac9-48f7-aec4-bd3976e11fe6)

The label each Sent tweet thread uses could be configured with the `Sent Tweets Label` field. It supports the following placeholders:
- `{now}` - Replaces with the current time

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FLRfaFOan-u.png?alt=media&token=354f479e-69d6-487f-9d5c-da06bff30c6f)

Instead of moving blocks to a configured destination, tweeted blocks could instead be edited upon sending. In the Roam Depot Settings, editing the `Append After Tweet` field will specify text that will get added to the end of the tweet after sending. It supports the following placeholders:
- `{link}` - The link of the published tweet.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FZV_j_jY9H5.png?alt=media&token=d1d8622a-d6e8-44e1-aecb-d3887fb96851)

Instead of appending text to individual tweet blocks, you could append text to the parent block of the tweet thread. This could be configured in the `Append To Parent` field in Roam Depot Settings. It supports the following placeholders: 
- `{link}` - The link of the first tweet of the thread 
- `{now}` - The time the tweet was successfully sent.

### Demo

<video src="https://roamjs.com/loom/59efa05227f042258dee87bc0d7387e2.mp4" controls="controls"></video>

[View on Loom](https://www.loom.com/share/59efa05227f042258dee87bc0d7387e2)

## Scheduling

With this feature enabled, you could schedule Tweets to be sent at a later date directly from within Roam. You should see a new option to schedule a tweet:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FmwKr63DHs4.png?alt=media&token=736e1395-d6bd-491b-8413-52b61caf01b0)

This will store your tweet thread in RoamJS to be sent at the time you specify. To view all of your current tweet threads, enter `Open Scheduled Tweets` from the Roam Command Palette:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FhF2CrfFnqQ.png?alt=media&token=a2bc627b-ed78-40b0-9fa0-6cd407408830)

For each scheduled tweet, you will see a clickable block reference pointing to the source tweet, the time you created the schedule, the time you scheduled the tweet for, and the current status. There are three statuses:
- `SUCCESS` - Your scheduled tweet was successfully sent and clicking this status will take you to the link on Twitter
- `PENDING` - Your tweet is still scheduled to be sent.
- `FAILED` - Your tweet failed to send. Please contact support@roamjs.com for help with this issue.

### Demo
<video src="https://roamjs.com/loom/dd902ccc4d194319aeac24e8ddbe5499.mp4" controls="controls"></video>

[View on Loom](https://www.loom.com/share/dd902ccc4d194319aeac24e8ddbe5499)

## Twitter Feed
You could configure the extension to show a feed of all tweets you liked the previous day upon opening your daily notes page.
On your Roam Depot Settings, toggle on the `Feed Enabled` switch. Now navigate to the daily notes page or to today's page. A dialog will appear and show you a feed of all the tweets that were published yesterday and that you liked.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FJf6chBjigi.png?alt=media&token=ffe896c9-aefc-45b9-bf11-6da2408cec6d)

Clicking "Import" will add a `#[[Twitter Feed]]` tag to your Daily Notes page with links to all the tweets nested below it.

By default, the Twitter feed only appears on the current daily notes page and log. You can configure the feed to appear on any daily notes page by toggling on the `Any Day` flag from your Roam Depot Settings.

By default, the Twitter feed queries the previous day's likes relative to the current daily note page, as it's meant to review a full day's of liked tweets. You can configure the feed to show the current day's tweets by toggling on the `Today` flag in your Roam Depot Settings.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F6WG01-GPas.png?alt=media&token=10bc191c-bc2e-4e38-8e93-11f687ef1f33)

By default, the tweets are imported at the top of the page. Toggle on the `Append Feed to Bottom` from your Roam Depot Settings to import the tweets to the bottom of the page.

By default, the Twitter feed just outputs links to the tweets into the daily note page. To customize the format, edit the `Feed Import Format` field from your Roam Depot Settings. There are certain placeholders that will get replaced in the format:
- `{text}` - The text of the tweet
- `{link}` - The link to the tweet
- `{handle}` - The twitter handle of the user
- `{author}` - The name of the user on Twitter

## Searching Tweets
In any page, create a `Twitter References` button by typing in `{{twitter references}}` (case-insensitive) in a block. Upon clicking the button, the extension will clear the button and fill the page in with the tweets where you've mentioned that page title. So, if you've tweeted about `books` a lot on twitter, you can head over to the `books` page on roam, and then pull all your tweets about `books`!

One caveat is that this can only pull tweets made in the last 7 days.

## Removing Wikilinks
The `Remove Wikilinks` button will strip square brackets `[[` and `#` from wikilinked pages.

`[[thisPage]]` and `#[[thisPage]]` will become `thisPage`