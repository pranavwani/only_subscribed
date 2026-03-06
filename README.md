# Subscribed Feed

A lightweight web app that shows only videos from channels you subscribe to.

## What it does

- Shows latest videos from your subscribed channels.
- Excludes Shorts.
- No recommendations, comments, or unrelated feed items.
- Switch between grid and list layouts.

## Run locally

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## How to use

1. Add a YouTube channel URL (`/channel/UC...`) or a channel ID (`UC...`).
2. Click **Refresh feed**.
3. Use the dropdown to filter to a specific channel.
4. Toggle Grid/List as preferred.

Subscriptions are stored in `localStorage`.
