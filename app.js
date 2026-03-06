const STORAGE_KEY = "onlySubscribed.channels";
const DEFAULT_INSTANCES = [
  "https://invidious.nerdvpn.de",
  "https://yt.artemislena.eu",
  "https://invidious.perennialte.ch",
];

const state = {
  channels: loadChannels(),
  videos: [],
  layout: "grid",
  filter: "all",
};

const refs = {
  form: document.getElementById("channelForm"),
  channelInput: document.getElementById("channelInput"),
  subscriptions: document.getElementById("subscriptions"),
  videos: document.getElementById("videos"),
  status: document.getElementById("statusText"),
  refresh: document.getElementById("refreshBtn"),
  filter: document.getElementById("channelFilter"),
  gridBtn: document.getElementById("gridBtn"),
  listBtn: document.getElementById("listBtn"),
  tpl: document.getElementById("videoTemplate"),
};

refs.form.addEventListener("submit", onAddChannel);
refs.refresh.addEventListener("click", refreshFeed);
refs.filter.addEventListener("change", (event) => {
  state.filter = event.target.value;
  renderVideos();
});
refs.gridBtn.addEventListener("click", () => setLayout("grid"));
refs.listBtn.addEventListener("click", () => setLayout("list"));

renderSubscriptions();
renderFilterOptions();
renderVideos();
if (state.channels.length > 0) {
  refreshFeed();
}

function loadChannels() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveChannels() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.channels));
}

function onAddChannel(event) {
  event.preventDefault();
  const raw = refs.channelInput.value.trim();
  const channelId = parseChannelId(raw);
  if (!channelId) {
    setStatus("Could not parse channel ID. Use a /channel/ URL or UC... ID.");
    return;
  }

  if (state.channels.some((channel) => channel.id === channelId)) {
    setStatus("Channel already exists.");
    return;
  }

  state.channels.push({ id: channelId, name: channelId });
  saveChannels();
  refs.channelInput.value = "";
  renderSubscriptions();
  renderFilterOptions();
  refreshFeed();
}

function parseChannelId(raw) {
  if (/^UC[\w-]{22}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/channel\/(UC[\w-]{22})/);
    if (match) return match[1];
  } catch {
    return null;
  }

  return null;
}

function removeChannel(channelId) {
  state.channels = state.channels.filter((channel) => channel.id !== channelId);
  state.videos = state.videos.filter((video) => video.channelId !== channelId);
  if (state.filter === channelId) state.filter = "all";
  saveChannels();
  renderSubscriptions();
  renderFilterOptions();
  renderVideos();
}

function setLayout(layout) {
  state.layout = layout;
  refs.gridBtn.classList.toggle("active", layout === "grid");
  refs.listBtn.classList.toggle("active", layout === "list");
  refs.videos.className = `videos ${layout}`;
}

async function refreshFeed() {
  if (state.channels.length === 0) {
    setStatus("Add at least one channel to load videos.");
    state.videos = [];
    renderVideos();
    return;
  }

  setStatus("Refreshing videos...");
  const collected = [];

  for (const channel of state.channels) {
    try {
      const items = await fetchChannelVideos(channel.id);
      if (items.length > 0) {
        channel.name = items[0].author || channel.id;
      }
      items.forEach((item) => {
        if (isShort(item)) return;
        collected.push(normalizeVideo(item, channel));
      });
    } catch {
      setStatus(`Some channels failed to load. Showing what we found.`);
    }
  }

  state.videos = collected.sort((a, b) => b.published - a.published);
  saveChannels();
  renderSubscriptions();
  renderFilterOptions();
  renderVideos();

  if (state.videos.length === 0) {
    setStatus("No videos found yet.");
    return;
  }

  setStatus(`Loaded ${state.videos.length} videos from your subscriptions.`);
}

async function fetchChannelVideos(channelId) {
  let lastError;
  for (const instance of DEFAULT_INSTANCES) {
    const endpoint = `${instance}/api/v1/channels/${channelId}/videos?sort_by=newest`;
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`Bad status ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No API instance available");
}

function isShort(item) {
  if (item.isShort) return true;
  if (typeof item.lengthSeconds === "number" && item.lengthSeconds <= 60) return true;
  return item.title?.toLowerCase().includes("#shorts") || false;
}

function normalizeVideo(item, channel) {
  return {
    id: item.videoId,
    title: item.title,
    channelId: channel.id,
    channelName: item.author || channel.name,
    published: new Date(item.published * 1000),
    thumb: item.videoThumbnails?.at(-1)?.url || "",
    url: `https://www.youtube.com/watch?v=${item.videoId}`,
  };
}

function renderSubscriptions() {
  refs.subscriptions.innerHTML = "";
  for (const channel of state.channels) {
    const li = document.createElement("li");
    li.className = "subscription-item";

    const text = document.createElement("span");
    text.textContent = channel.name;
    text.title = channel.id;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeChannel(channel.id));

    li.append(text, removeBtn);
    refs.subscriptions.append(li);
  }
}

function renderFilterOptions() {
  refs.filter.innerHTML = `<option value="all">All channels</option>`;
  for (const channel of state.channels) {
    const option = document.createElement("option");
    option.value = channel.id;
    option.textContent = channel.name;
    option.selected = state.filter === channel.id;
    refs.filter.append(option);
  }
}

function renderVideos() {
  refs.videos.innerHTML = "";
  refs.videos.className = `videos ${state.layout}`;

  const filtered = state.filter === "all"
    ? state.videos
    : state.videos.filter((video) => video.channelId === state.filter);

  for (const video of filtered) {
    const node = refs.tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".thumb").src = video.thumb;
    node.querySelector(".title").textContent = video.title;
    node.querySelector(".meta").textContent = `${video.channelName} • ${formatDate(video.published)}`;
    node.querySelector(".watch").href = video.url;
    refs.videos.append(node);
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function setStatus(text) {
  refs.status.textContent = text;
}
