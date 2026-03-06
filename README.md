# Only Subscribed

A lightweight web app that directly loads videos from your **logged-in YouTube subscriptions**.

## Core behavior

- Pulls your subscribed channels automatically (no manual channel entry).
- Shows latest videos in grid or list.
- No recommendations, no comments, no Shorts.
- Lets you filter by specific subscribed channel.

## Setup

This app uses the YouTube Data API v3 from the browser.

1. Create a Google Cloud project.
2. Enable **YouTube Data API v3**.
3. Create:
   - an **API Key**
   - an **OAuth 2.0 Client ID** (Web application)
4. Add your local origin (for example `http://localhost:4173`) to allowed JavaScript origins.

## Run locally

```bash
python -m http.server 4173
```

Open `http://localhost:4173`.

## Use

1. Paste your OAuth Client ID and API Key.
2. Click **Save keys**.
3. Click **Sign in with Google**.
4. Click **Refresh subscriptions feed**.

The app then fetches your subscriptions from your logged-in account automatically.
