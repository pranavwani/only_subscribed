const STORAGE_KEYS = {
  config: "onlySubscribed.config",
};

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";
const MAX_VIDEOS_PER_CHANNEL = 6;

const state = {
  config: loadConfig(),
  channels: [],
  videos: [],
  layout: "grid",
  filter: "all",
  signedIn: false,
};

const refs = {
  subscriptions: document.getElementById("subscriptions"),
  videos: document.getElementById("videos"),
  status: document.getElementById("statusText"),
  filter: document.getElementById("channelFilter"),
  gridBtn: document.getElementById("gridBtn"),
  listBtn: document.getElementById("listBtn"),
  refresh: document.getElementById("refreshBtn"),
  signIn: document.getElementById("signInBtn"),
  signOut: document.getElementById("signOutBtn"),
  clientIdInput: document.getElementById("clientIdInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
  tpl: document.getElementById("videoTemplate"),
};

let tokenClient;

refs.clientIdInput.value = state.config.clientId || "";
refs.apiKeyInput.value = state.config.apiKey || "";

refs.gridBtn.addEventListener("click", () => setLayout("grid"));
refs.listBtn.addEventListener("click", () => setLayout("list"));
refs.refresh.addEventListener("click", refreshFeed);
refs.signIn.addEventListener("click", signIn);
refs.signOut.addEventListener("click", signOut);
refs.saveConfigBtn.addEventListener("click", saveConfigFromInputs);
refs.filter.addEventListener("change", (event) => {
  state.filter = event.target.value;
  renderVideos();
});

renderSubscriptions();
renderFilterOptions();
renderVideos();

window.addEventListener("load", async () => {
  if (!window.gapi || !window.google) {
    setStatus("Google scripts did not load. Check your connection and refresh.");
    return;
  }

  try {
    await initializeGoogleApi();
    setStatus("Ready. Save keys and sign in to load your subscribed feed.");
  } catch (error) {
    setStatus(`Google API init failed: ${error.message}`);
  }
});

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.config)) || { apiKey: "", clientId: "" };
  } catch {
    return { apiKey: "", clientId: "" };
  }
}

function saveConfig(config) {
  state.config = config;
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
}

function saveConfigFromInputs() {
  const nextConfig = {
    clientId: refs.clientIdInput.value.trim(),
    apiKey: refs.apiKeyInput.value.trim(),
  };

  saveConfig(nextConfig);
  setStatus("Keys saved. Now click Sign in with Google.");
}

async function initializeGoogleApi() {
  await new Promise((resolve) => gapi.load("client", resolve));

  if (!state.config.apiKey) {
    setStatus("Enter API key and client ID, then click Save keys.");
    return;
  }

  await gapi.client.init({
    apiKey: state.config.apiKey,
    discoveryDocs: [DISCOVERY_DOC],
  });

  if (!state.config.clientId) {
    setStatus("Enter OAuth Client ID and API key, save keys, then sign in.");
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.config.clientId,
    scope: SCOPES,
    callback: () => {
      state.signedIn = true;
      setStatus("Signed in. Loading your subscriptions...");
      refreshFeed();
    },
  });
}

function signIn() {
  if (!state.config.apiKey || !state.config.clientId) {
    setStatus("Add API key and OAuth Client ID first, then save keys.");
    return;
  }

  if (!tokenClient) {
    setStatus("Initializing Google API... try again in a moment.");
    return;
  }

  tokenClient.requestAccessToken({ prompt: "consent" });
}

function signOut() {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
  }

  state.signedIn = false;
  state.channels = [];
  state.videos = [];
  state.filter = "all";
  renderSubscriptions();
  renderFilterOptions();
  renderVideos();
  setStatus("Signed out.");
}

async function refreshFeed() {
  if (!state.signedIn) {
    setStatus("Sign in first to load your subscribed channels automatically.");
    return;
  }

  setStatus("Loading subscriptions from your YouTube account...");

  try {
    const channels = await fetchAllSubscriptions();
    state.channels = channels;
    renderSubscriptions();
    renderFilterOptions();

    setStatus("Loading recent videos from subscriptions...");
    const videos = await fetchRecentVideosForChannels(channels);
    state.videos = videos.sort((a, b) => b.published - a.published);
    renderVideos();

    setStatus(`Loaded ${state.videos.length} videos from ${channels.length} subscribed channels.`);
  } catch (error) {
    setStatus(`Could not load feed: ${error.message}`);
  }
}

async function fetchAllSubscriptions() {
  const channels = [];
  let pageToken = "";

  do {
    const response = await gapi.client.youtube.subscriptions.list({
      part: "snippet",
      mine: true,
      maxResults: 50,
      pageToken,
    });

    const items = response.result.items || [];
    items.forEach((item) => {
      const channelId = item.snippet?.resourceId?.channelId;
      if (!channelId) return;
      channels.push({
        id: channelId,
        name: item.snippet.title,
      });
    });

    pageToken = response.result.nextPageToken || "";
  } while (pageToken);

  return channels;
}

async function fetchRecentVideosForChannels(channels) {
  const allVideos = [];

  for (const channel of channels) {
    const searchResponse = await gapi.client.youtube.search.list({
      part: "snippet",
      channelId: channel.id,
      order: "date",
      type: "video",
      maxResults: MAX_VIDEOS_PER_CHANNEL,
    });

    const searchItems = searchResponse.result.items || [];
    if (searchItems.length === 0) continue;

    const videoIds = searchItems.map((item) => item.id.videoId).filter(Boolean);
    if (videoIds.length === 0) continue;

    const details = await gapi.client.youtube.videos.list({
      part: "contentDetails,snippet",
      id: videoIds.join(","),
    });

    const detailById = new Map((details.result.items || []).map((item) => [item.id, item]));

    searchItems.forEach((item) => {
      const id = item.id.videoId;
      const full = detailById.get(id);
      if (!full) return;
      if (isShort(full)) return;

      allVideos.push({
        id,
        title: item.snippet.title,
        channelId: channel.id,
        channelName: item.snippet.channelTitle || channel.name,
        published: new Date(item.snippet.publishedAt),
        thumb: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    });
  }

  return allVideos;
}

function isShort(videoItem) {
  const duration = videoItem.contentDetails?.duration;
  const seconds = parseIsoDurationToSeconds(duration);
  if (seconds !== null && seconds <= 60) return true;

  const title = videoItem.snippet?.title || "";
  return title.toLowerCase().includes("#shorts");
}

function parseIsoDurationToSeconds(input) {
  if (!input || typeof input !== "string") return null;
  const match = input.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function setLayout(layout) {
  state.layout = layout;
  refs.gridBtn.classList.toggle("active", layout === "grid");
  refs.listBtn.classList.toggle("active", layout === "list");
  refs.videos.className = `videos ${layout}`;
}

function renderSubscriptions() {
  refs.subscriptions.innerHTML = "";
  state.channels.forEach((channel) => {
    const li = document.createElement("li");
    li.className = "subscription-item";
    li.textContent = channel.name;
    li.title = channel.id;
    refs.subscriptions.append(li);
  });
}

function renderFilterOptions() {
  refs.filter.innerHTML = `<option value="all">All subscriptions</option>`;
  state.channels.forEach((channel) => {
    const option = document.createElement("option");
    option.value = channel.id;
    option.textContent = channel.name;
    option.selected = state.filter === channel.id;
    refs.filter.append(option);
  });
}

function renderVideos() {
  refs.videos.innerHTML = "";
  refs.videos.className = `videos ${state.layout}`;

  const visibleVideos = state.filter === "all"
    ? state.videos
    : state.videos.filter((video) => video.channelId === state.filter);

  visibleVideos.forEach((video) => {
    const node = refs.tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".thumb").src = video.thumb;
    node.querySelector(".title").textContent = video.title;
    node.querySelector(".meta").textContent = `${video.channelName} • ${formatDate(video.published)}`;
    node.querySelector(".watch").href = video.url;
    refs.videos.append(node);
  });
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function setStatus(message) {
  refs.status.textContent = message;
}
