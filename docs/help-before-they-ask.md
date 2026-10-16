# Help before they ask

When a visitor seems stuck on your website, for example going back and forth
between the same steps or meeting the same error, the chat widget offers a hand:
a small card beside the chat button with a suggestion. The visitor can open it
as a chat or dismiss it. It is off until you turn it on.

## What it needs

- **The widget on your website.** Setup's "Add the widget to your website"
  shows the code.
- **An AI key.** An AI assistant reads the visitor's recent activity to decide
  whether to offer help, and each check is one request to your AI service. Add a
  key in **Setup → Connect an AI service**. Without one nothing is offered, even
  with the setting on.
- **A default visitor assistant.** New workspaces already have one, the starter
  assistant; it is set on the **AI** page.

## Turn it on

1. Open **Settings → Project**, **General** tab, and find **Help before they
   ask**. Setup links to it.
2. Turn on **Track contact page views with widget** and **Offer proactive help
   after visitor consent**.
3. Choose **Update**.

To make the chat button glow when a card appears, turn on **Glow effects → On
insight** in **Settings → Widget → Settings**.

## When it fires

1. The widget asks each visitor first: "Share your page activity with our AI
   assistant for help before you ask?" with **Allow proactive help** and **No
   thanks**. Nothing is collected from a visitor who says no. A visitor who
   allows it can choose **Stop sharing activity** in the widget at any time.
2. The widget records that visitor's page views, clicks and form steps, with
   the values typed into fields removed.
3. After the first 6 of those actions, and then after every 6 to 20 more (the
   gap grows the longer a visit goes without an offer), your assistant looks at
   the recent activity. It offers help only when the activity shows a concrete
   sign of being stuck; steady progress and ordinary browsing get nothing, so
   most visits never see a card.
4. A visitor who dismisses a card is not offered another for a day, then a
   week after a second dismissal, a month after a third and six months after
   that.

## Cost and privacy

Each check is one AI request on your account. The installation caps how many
checks each workspace makes a day; see [Limits and AI ceilings](PUBLIC-LIMITS.md). Activity is kept with the visitor's contact record
in your workspace and is never shown to other visitors. See
[Personal data](PRIVACY.md) for what is stored and how to erase it.
