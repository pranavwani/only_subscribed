# Only Subscribed

A lightweight web app that loads videos from your **logged-in YouTube subscriptions**.

## Core behavior

- Pulls subscribed channels automatically (no manual channel entry).
- Shows latest videos in grid or list.
- Play videos directly inside the app via an embedded player modal.
- No recommendations, no comments, no Shorts.
- Lets you filter by subscribed channel.

## Important note about OAuth Client ID

Yes, asking every user for OAuth credentials is poor UX. This app is now configured by the app owner/developer in code (`APP_CONFIG` in `app.js`), and end users only click **Sign in with Google**.

Also: OAuth **Client ID is public by design** for browser apps (not a secret). The API key should be origin-restricted in Google Cloud.

## Setup (for app owner)

1. Create a Google Cloud project.
2. Enable **YouTube Data API v3**.
3. Create:
   - OAuth 2.0 Client ID (Web application)
   - API Key (restrict by HTTP referrer/origin)
4. Add your app origin (for example `http://localhost:4173`) to OAuth allowed JavaScript origins.
5. Edit `app.js` and set `APP_CONFIG.clientId` and `APP_CONFIG.apiKey`.

## Run locally

```bash
python -m http.server 4173
```

Open `http://localhost:4173`.
