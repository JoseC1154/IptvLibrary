const STORAGE_KEY = "iptv-library-v1";
const APP_VERSION = 1;

const seedData = {
  version: APP_VERSION,
  groups: [
    { id: "group-kids", name: "Kids Channel" },
    { id: "group-movies", name: "Movie Channel" }
  ],
  channels: [
    {
      id: "ch-cartoon",
      name: "Cartoon Mix",
      groupId: "group-kids",
      streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "ch-cinema",
      name: "Cinema Plus",
      groupId: "group-movies",
      streamUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      imageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80"
    }
  ]
};

const state = {
  library: loadLibrary(),
  selectedGroupId: "all"
};

const playerState = {
  activeChannel: null,
  hlsInstance: null,
  chromecastReady: false,
  stallRecoveryTimer: null
};

const refs = {
  groupList: document.getElementById("groupList"),
  channelGrid: document.getElementById("channelGrid"),
  currentGroupTitle: document.getElementById("currentGroupTitle"),
  channelCount: document.getElementById("channelCount"),
  emptyState: document.getElementById("emptyState"),
  addGroupBtn: document.getElementById("addGroupBtn"),
  addChannelBtn: document.getElementById("addChannelBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  groupDialog: document.getElementById("groupDialog"),
  groupForm: document.getElementById("groupForm"),
  groupDialogTitle: document.getElementById("groupDialogTitle"),
  groupId: document.getElementById("groupId"),
  groupName: document.getElementById("groupName"),
  deleteGroupBtn: document.getElementById("deleteGroupBtn"),
  channelDialog: document.getElementById("channelDialog"),
  channelForm: document.getElementById("channelForm"),
  channelDialogTitle: document.getElementById("channelDialogTitle"),
  channelId: document.getElementById("channelId"),
  channelName: document.getElementById("channelName"),
  channelGroup: document.getElementById("channelGroup"),
  channelUrl: document.getElementById("channelUrl"),
  channelImage: document.getElementById("channelImage"),
  channelImageFeedback: document.getElementById("channelImageFeedback"),
  channelImagePreview: document.getElementById("channelImagePreview"),
  deleteChannelBtn: document.getElementById("deleteChannelBtn"),
  channelCardTemplate: document.getElementById("channelCardTemplate"),
  playerDialog: document.getElementById("playerDialog"),
  playerTitle: document.getElementById("playerTitle"),
  playerSubtitle: document.getElementById("playerSubtitle"),
  playerVideoHost: document.getElementById("playerVideoHost"),
  playerVideo: document.getElementById("playerVideo"),
  playerStatus: document.getElementById("playerStatus"),
  playerCastBtn: document.getElementById("playerCastBtn"),
  playerSystemBtn: document.getElementById("playerSystemBtn"),
  playerOpenExternal: document.getElementById("playerOpenExternal"),
  playerCloseBtn: document.getElementById("playerCloseBtn"),
  playerStopBtn: document.getElementById("playerStopBtn"),
  nowPlayingBar: document.getElementById("nowPlayingBar"),
  nowPlayingTitle: document.getElementById("nowPlayingTitle"),
  nowPlayingSubtitle: document.getElementById("nowPlayingSubtitle"),
  nowPlayingOpenBtn: document.getElementById("nowPlayingOpenBtn"),
  nowPlayingCastBtn: document.getElementById("nowPlayingCastBtn"),
  miniPlayer: document.getElementById("miniPlayer"),
  miniPlayerVideoHost: document.getElementById("miniPlayerVideoHost"),
  miniPlayerRestoreBtn: document.getElementById("miniPlayerRestoreBtn"),
  miniPlayerStopBtn: document.getElementById("miniPlayerStopBtn")
};

initialize();

function initialize() {
  bindEvents();
  render();
  updateNowPlayingBar();
  initializeCastSupport();
  registerServiceWorker();
}

function bindEvents() {
  refs.addGroupBtn.addEventListener("click", () => openGroupDialog());
  refs.addChannelBtn.addEventListener("click", () => openChannelDialog());
  refs.exportBtn.addEventListener("click", exportLibrary);
  refs.importInput.addEventListener("change", importLibrary);

  refs.groupForm.addEventListener("submit", onGroupSubmit);
  refs.channelForm.addEventListener("submit", onChannelSubmit);
  refs.channelImage.addEventListener("blur", () => {
    validateImageFieldInline();
  });

  refs.deleteGroupBtn.addEventListener("click", deleteCurrentGroup);
  refs.deleteChannelBtn.addEventListener("click", deleteCurrentChannel);
  refs.playerCastBtn.addEventListener("click", onPlayerCastClick);
  refs.playerSystemBtn.addEventListener("click", onSystemPlayerClick);
  refs.playerCloseBtn.addEventListener("click", minimizePlayer);
  refs.playerStopBtn.addEventListener("click", stopPlayer);
  refs.nowPlayingOpenBtn.addEventListener("click", openActiveChannelInPlayer);
  refs.nowPlayingCastBtn.addEventListener("click", onPlayerCastClick);
  refs.miniPlayerRestoreBtn.addEventListener("click", openActiveChannelInPlayer);
  refs.miniPlayerStopBtn.addEventListener("click", stopPlayer);
  refs.playerDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    minimizePlayer();
  });
  refs.playerDialog.addEventListener("click", (event) => {
    if (event.target === refs.playerDialog) {
      minimizePlayer();
    }
  });
  refs.playerVideo.addEventListener("error", () => {
    setPlayerStatus(
      "Playback failed. This stream may be blocked by CORS, georestrictions, or unsupported format. Try Open External or Cast.",
      "error"
    );
  });
  refs.playerVideo.addEventListener("waiting", tryRecoverPlayback);
  refs.playerVideo.addEventListener("stalled", tryRecoverPlayback);

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.close);
      dialog.close();
    });
  });
}

function render() {
  ensureActiveChannelStillExists();
  renderGroups();
  renderChannels();
  updateNowPlayingBar();
}

function renderGroups() {
  refs.groupList.textContent = "";

  refs.groupList.appendChild(createGroupButton({ id: "all", name: "All Channels" }));

  state.library.groups.forEach((group) => {
    refs.groupList.appendChild(createGroupButton(group));
  });

  if (state.selectedGroupId !== "all" && !state.library.groups.some((group) => group.id === state.selectedGroupId)) {
    state.selectedGroupId = "all";
  }
}

function createGroupButton(group) {
  const button = document.createElement("button");
  button.className = `group-item ${state.selectedGroupId === group.id ? "active" : ""}`;
  button.type = "button";
  button.textContent = group.name;

  button.addEventListener("click", () => {
    state.selectedGroupId = group.id;
    render();
  });

  if (group.id !== "all") {
    button.addEventListener("dblclick", () => openGroupDialog(group.id));
  }

  return button;
}

function renderChannels() {
  refs.channelGrid.textContent = "";

  const channels = state.selectedGroupId === "all"
    ? [...state.library.channels]
    : state.library.channels.filter((channel) => channel.groupId === state.selectedGroupId);

  const selectedGroupName = state.selectedGroupId === "all"
    ? "All Channels"
    : state.library.groups.find((group) => group.id === state.selectedGroupId)?.name ?? "Channels";

  refs.currentGroupTitle.textContent = selectedGroupName;
  refs.channelCount.textContent = `${channels.length} channel${channels.length === 1 ? "" : "s"}`;
  refs.emptyState.classList.toggle("hidden", channels.length > 0);

  channels.forEach((channel) => {
    const card = refs.channelCardTemplate.content.firstElementChild.cloneNode(true);
    const groupName = state.library.groups.find((group) => group.id === channel.groupId)?.name ?? "Unassigned";

    const editBtn = card.querySelector(".card-edit");
    const link = card.querySelector(".card-link");
    const image = card.querySelector(".card-image");
    const title = card.querySelector(".card-title");
    const groupText = card.querySelector(".card-group");

    editBtn.addEventListener("click", () => openChannelDialog(channel.id));
    link.href = channel.streamUrl;
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      openPlayer(channel);
    });

    if (channel.imageUrl) {
      image.src = channel.imageUrl;
      image.alt = `${channel.name} poster`;
      image.addEventListener(
        "error",
        () => {
          image.removeAttribute("src");
        },
        { once: true }
      );
    } else {
      image.removeAttribute("src");
      image.alt = "Channel image placeholder";
    }

    title.textContent = channel.name;
    groupText.textContent = groupName;

    refs.channelGrid.appendChild(card);
  });
}

function openGroupDialog(groupId = "") {
  if (!groupId) {
    refs.groupDialogTitle.textContent = "Add Group";
    refs.groupId.value = "";
    refs.groupName.value = "";
    refs.deleteGroupBtn.classList.add("hidden");
  } else {
    const group = state.library.groups.find((item) => item.id === groupId);
    if (!group) {
      return;
    }

    refs.groupDialogTitle.textContent = "Edit Group";
    refs.groupId.value = group.id;
    refs.groupName.value = group.name;
    refs.deleteGroupBtn.classList.remove("hidden");
  }

  refs.groupDialog.showModal();
}

function onGroupSubmit(event) {
  event.preventDefault();

  const id = refs.groupId.value.trim();
  const name = refs.groupName.value.trim();

  if (!name) {
    return;
  }

  if (id) {
    const group = state.library.groups.find((item) => item.id === id);
    if (group) {
      group.name = name;
    }
  } else {
    state.library.groups.push({ id: createId("group"), name });
  }

  saveLibrary();
  refs.groupDialog.close();
  render();
}

function deleteCurrentGroup() {
  const groupId = refs.groupId.value;
  if (!groupId) {
    return;
  }

  const targetGroup = state.library.groups.find((group) => group.id === groupId);
  if (!targetGroup) {
    return;
  }

  const channelCount = state.library.channels.filter((channel) => channel.groupId === groupId).length;
  const confirmed = window.confirm(
    `Delete "${targetGroup.name}" and ${channelCount} channel${channelCount === 1 ? "" : "s"}?`
  );

  if (!confirmed) {
    return;
  }

  state.library.groups = state.library.groups.filter((group) => group.id !== groupId);
  state.library.channels = state.library.channels.filter((channel) => channel.groupId !== groupId);
  state.selectedGroupId = "all";

  saveLibrary();
  refs.groupDialog.close();
  render();
}

function openChannelDialog(channelId = "") {
  populateGroupSelect();
  setImageFeedback("");
  setImagePreview("");

  if (!channelId) {
    refs.channelDialogTitle.textContent = "Add Channel";
    refs.channelId.value = "";
    refs.channelName.value = "";
    refs.channelUrl.value = "";
    refs.channelImage.value = "";
    refs.channelGroup.value = state.selectedGroupId !== "all" ? state.selectedGroupId : refs.channelGroup.options[0]?.value ?? "";
    refs.deleteChannelBtn.classList.add("hidden");
  } else {
    const channel = state.library.channels.find((item) => item.id === channelId);
    if (!channel) {
      return;
    }

    refs.channelDialogTitle.textContent = "Edit Channel";
    refs.channelId.value = channel.id;
    refs.channelName.value = channel.name;
    refs.channelUrl.value = channel.streamUrl;
    refs.channelImage.value = channel.imageUrl ?? "";
    refs.channelGroup.value = channel.groupId;
    refs.deleteChannelBtn.classList.remove("hidden");
  }

  refs.channelDialog.showModal();
}

function populateGroupSelect() {
  refs.channelGroup.textContent = "";

  state.library.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    refs.channelGroup.appendChild(option);
  });
}

async function onChannelSubmit(event) {
  event.preventDefault();

  if (state.library.groups.length === 0) {
    window.alert("Create at least one group first.");
    return;
  }

  const id = refs.channelId.value.trim();
  const payload = {
    name: refs.channelName.value.trim(),
    groupId: refs.channelGroup.value,
    streamUrl: refs.channelUrl.value.trim(),
    imageUrl: normalizeImageUrl(refs.channelImage.value)
  };

  if (!payload.name || !payload.groupId || !payload.streamUrl) {
    return;
  }

  if (payload.imageUrl) {
    const resolvedImageUrl = await resolveWorkingImageUrl(payload.imageUrl);
    if (!resolvedImageUrl) {
      setImageFeedback("Image URL could not be reached. Please use a valid public internet image URL.", "error");
      setImagePreview("");
      refs.channelImage.focus();
      return;
    }

    payload.imageUrl = resolvedImageUrl;
    refs.channelImage.value = resolvedImageUrl;
    setImageFeedback("Image URL looks good.", "success");
    setImagePreview(resolvedImageUrl);
  } else {
    setImageFeedback("");
    setImagePreview("");
  }

  if (id) {
    const channel = state.library.channels.find((item) => item.id === id);
    if (channel) {
      Object.assign(channel, payload);
    }
  } else {
    state.library.channels.push({ id: createId("channel"), ...payload });
  }

  saveLibrary();
  refs.channelDialog.close();
  render();
}

function deleteCurrentChannel() {
  const channelId = refs.channelId.value;
  if (!channelId) {
    return;
  }

  const channel = state.library.channels.find((item) => item.id === channelId);
  if (!channel) {
    return;
  }

  const confirmed = window.confirm(`Delete channel "${channel.name}"?`);
  if (!confirmed) {
    return;
  }

  const isActiveChannel = playerState.activeChannel?.id === channel.id;

  state.library.channels = state.library.channels.filter((item) => item.id !== channelId);

  if (isActiveChannel) {
    playerState.activeChannel = null;
    stopPlayer();
  }

  saveLibrary();
  refs.channelDialog.close();
  render();
}

function exportLibrary() {
  const data = JSON.stringify(state.library, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];

  link.href = url;
  link.download = `iptv-library-${date}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

async function importLibrary(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!isValidLibrary(imported)) {
      throw new Error("Invalid file format");
    }

    state.library = normalizeLibrary(imported);
    state.selectedGroupId = "all";
    saveLibrary();
    render();
  } catch (error) {
    window.alert("Import failed. Please use a valid exported library JSON file.");
  } finally {
    refs.importInput.value = "";
  }
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(seedData);
    }

    const parsed = JSON.parse(raw);
    if (!isValidLibrary(parsed)) {
      return structuredClone(seedData);
    }

    return normalizeLibrary(parsed);
  } catch {
    return structuredClone(seedData);
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
}

function isValidLibrary(value) {
  return (
    value &&
    Array.isArray(value.groups) &&
    Array.isArray(value.channels)
  );
}

function normalizeLibrary(value) {
  const safeGroups = value.groups
    .filter((group) => group && typeof group.id === "string" && typeof group.name === "string" && group.name.trim())
    .map((group) => ({ id: group.id, name: group.name.trim() }));

  const groupIdSet = new Set(safeGroups.map((group) => group.id));

  const safeChannels = value.channels
    .filter(
      (channel) =>
        channel &&
        typeof channel.id === "string" &&
        typeof channel.name === "string" &&
        typeof channel.streamUrl === "string" &&
        typeof channel.groupId === "string" &&
        groupIdSet.has(channel.groupId)
    )
    .map((channel) => ({
      id: channel.id,
      name: channel.name.trim(),
      groupId: channel.groupId,
      streamUrl: channel.streamUrl.trim(),
      imageUrl: typeof channel.imageUrl === "string" ? channel.imageUrl.trim() : ""
    }));

  return {
    version: APP_VERSION,
    groups: safeGroups,
    channels: safeChannels
  };
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeImageUrl(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

async function validateImageFieldInline() {
  const normalizedUrl = normalizeImageUrl(refs.channelImage.value);

  if (!normalizedUrl) {
    setImageFeedback("");
    setImagePreview("");
    return;
  }

  const resolvedImageUrl = await resolveWorkingImageUrl(normalizedUrl);
  if (!resolvedImageUrl) {
    setImageFeedback("Image URL could not be reached.", "error");
    setImagePreview("");
    return;
  }

  if (resolvedImageUrl !== normalizedUrl) {
    refs.channelImage.value = resolvedImageUrl;
    setImageFeedback("Image URL auto-corrected and validated.", "success");
  } else {
    setImageFeedback("Image URL looks good.", "success");
  }

  setImagePreview(resolvedImageUrl);
}

function validateImageUrlReachable(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const image = new Image();

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, timeoutMs);

    image.onload = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(true);
      }
    };

    image.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(false);
      }
    };

    image.src = url;
  });
}

async function resolveWorkingImageUrl(url) {
  const candidates = buildImageUrlCandidates(url);

  for (const candidate of candidates) {
    const reachable = await validateImageUrlReachable(candidate);
    if (reachable) {
      return candidate;
    }
  }

  return "";
}

function buildImageUrlCandidates(url) {
  const trimmedToExtension = trimToImageExtension(url);
  const candidates = [];

  if (trimmedToExtension && trimmedToExtension !== url) {
    candidates.push(trimmedToExtension, url);
    return candidates;
  }

  candidates.push(url);
  return candidates;
}

function trimToImageExtension(url) {
  const match = url.match(/^(https?:\/\/[^?#]+?\.(?:png|jpe?g|gif|webp|avif|svg))/i);
  return match ? match[1] : "";
}

function setImageFeedback(message, type = "") {
  refs.channelImageFeedback.textContent = message;

  refs.channelImageFeedback.classList.remove("hidden", "error", "success");
  if (!message) {
    refs.channelImageFeedback.classList.add("hidden");
    return;
  }

  if (type) {
    refs.channelImageFeedback.classList.add(type);
  }
}

function setImagePreview(url) {
  if (!url) {
    refs.channelImagePreview.removeAttribute("src");
    refs.channelImagePreview.classList.add("hidden");
    return;
  }

  refs.channelImagePreview.src = url;
  refs.channelImagePreview.classList.remove("hidden");
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("sw.js");
  } catch {
    // no-op
  }
}

function openPlayer(channel) {
  if (!channel?.streamUrl) {
    return;
  }

  playerState.activeChannel = channel;
  updateNowPlayingBar();
  refs.playerTitle.textContent = channel.name;

  const groupName = state.library.groups.find((group) => group.id === channel.groupId)?.name ?? "Channel";
  refs.playerSubtitle.textContent = groupName;
  refs.playerOpenExternal.href = channel.streamUrl;

  setPlayerStatus("");
  updateCastButtonVisibility();
  moveVideoToDialogHost();
  refs.miniPlayer.classList.add("hidden");

  if (!refs.playerDialog.open) {
    refs.playerDialog.showModal();
  }

  startVideoPlayback(channel.streamUrl);
}

function stopPlayer() {
  clearStallRecoveryTimer();
  destroyHlsInstance();
  refs.playerVideo.pause();
  refs.playerVideo.removeAttribute("src");
  refs.playerVideo.load();
  moveVideoToDialogHost();
  refs.miniPlayer.classList.add("hidden");
  playerState.activeChannel = null;
  updateNowPlayingBar();
  setPlayerStatus("");

  if (refs.playerDialog.open) {
    refs.playerDialog.close();
  }
}

function minimizePlayer() {
  if (!playerState.activeChannel) {
    if (refs.playerDialog.open) {
      refs.playerDialog.close();
    }
    return;
  }

  moveVideoToMiniHost();
  refs.miniPlayer.classList.remove("hidden");

  if (refs.playerDialog.open) {
    refs.playerDialog.close();
  }
}

function openActiveChannelInPlayer() {
  if (!playerState.activeChannel) {
    return;
  }

  openPlayer(playerState.activeChannel);
}

function startVideoPlayback(streamUrl) {
  clearStallRecoveryTimer();
  destroyHlsInstance();
  refs.playerVideo.pause();
  refs.playerVideo.removeAttribute("src");
  refs.playerVideo.load();

  if (isLikelyHlsStream(streamUrl) && window.Hls?.isSupported?.()) {
    const hlsInstance = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startPosition: -1,
      backBufferLength: 90,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      manifestLoadingTimeOut: 15000,
      levelLoadingTimeOut: 15000,
      fragLoadingTimeOut: 20000,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      fragLoadingMaxRetry: 6
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(refs.playerVideo);
    hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
      if (Number.isFinite(hlsInstance.liveSyncPosition)) {
        refs.playerVideo.currentTime = hlsInstance.liveSyncPosition;
      }

      refs.playerVideo.play().catch(() => {
        setPlayerStatus("Press play to start the stream.");
      });
    });
    hlsInstance.on(window.Hls.Events.ERROR, (_event, data) => {
      const details = `${data?.details ?? ""}`.toLowerCase();
      const corsLike = details.includes("xhr") || details.includes("network") || details.includes("manifest");

      if (data?.fatal) {
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          setPlayerStatus("Network interruption detected. Attempting stream recovery...");
          hlsInstance.startLoad();
          return;
        }

        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          setPlayerStatus("Media decode issue detected. Attempting recovery...");
          hlsInstance.recoverMediaError();
          return;
        }

        if (corsLike) {
          setPlayerStatus(
            "Unable to play in-browser (likely CORS or network restriction). Try Open External/Cast or use a stream that sends Access-Control-Allow-Origin.",
            "error"
          );
          return;
        }

        setPlayerStatus("Unable to play this stream in browser.", "error");
        return;
      }

      if (data?.details === window.Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
        setPlayerStatus("Buffer stalled. Attempting to continue playback...");
        hlsInstance.startLoad();
      }
    });

    playerState.hlsInstance = hlsInstance;
    return;
  }

  refs.playerVideo.src = streamUrl;
  refs.playerVideo.preload = "auto";
  refs.playerVideo.play().catch(() => {
    setPlayerStatus("Press play to start the stream.");
  });
}

function destroyHlsInstance() {
  if (playerState.hlsInstance) {
    playerState.hlsInstance.destroy();
    playerState.hlsInstance = null;
  }
}

function tryRecoverPlayback() {
  if (!playerState.activeChannel) {
    return;
  }

  clearStallRecoveryTimer();
  playerState.stallRecoveryTimer = window.setTimeout(() => {
    if (playerState.hlsInstance) {
      playerState.hlsInstance.startLoad();
    }

    refs.playerVideo.play().catch(() => {
      setPlayerStatus("Playback paused while buffering. Press play to continue.");
    });
  }, 1200);
}

function clearStallRecoveryTimer() {
  if (playerState.stallRecoveryTimer) {
    window.clearTimeout(playerState.stallRecoveryTimer);
    playerState.stallRecoveryTimer = null;
  }
}

function isLikelyHlsStream(url) {
  return /\.m3u8($|\?)/i.test(url);
}

function setPlayerStatus(message, type = "") {
  refs.playerStatus.textContent = message;
  refs.playerStatus.classList.remove("hidden", "error", "success");

  if (!message) {
    refs.playerStatus.classList.add("hidden");
    return;
  }

  if (type) {
    refs.playerStatus.classList.add(type);
  }
}

function initializeCastSupport() {
  window.__onGCastApiAvailable = (isAvailable) => {
    if (!isAvailable) {
      return;
    }

    try {
      cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });
      playerState.chromecastReady = true;
      updateCastButtonVisibility();
    } catch {
      playerState.chromecastReady = false;
      updateCastButtonVisibility();
    }
  };

  if (window.cast?.framework && window.chrome?.cast) {
    window.__onGCastApiAvailable(true);
  } else {
    updateCastButtonVisibility();
  }
}

async function onPlayerCastClick() {
  if (!playerState.activeChannel?.streamUrl) {
    window.alert("Open a channel first.");
    return;
  }

  if (playerState.chromecastReady) {
    try {
      await castToChromecast(playerState.activeChannel);
      setPlayerStatus("Casting to Chromecast device.", "success");
      return;
    } catch {
      setPlayerStatus("Chromecast failed. Trying browser device picker...", "error");
    }
  }

  if (refs.playerVideo.remote?.prompt) {
    try {
      await refs.playerVideo.remote.prompt();
      return;
    } catch {
      // no-op
    }
  }

  if (typeof refs.playerVideo.webkitShowPlaybackTargetPicker === "function") {
    refs.playerVideo.webkitShowPlaybackTargetPicker();
    return;
  }

  await handoffToSystemPlayer(playerState.activeChannel.streamUrl);
  setPlayerStatus("Attempted system-player handoff. Use your computer's native casting routes/devices.", "success");
}

async function onSystemPlayerClick() {
  if (!playerState.activeChannel?.streamUrl) {
    window.alert("Open a channel first.");
    return;
  }

  await handoffToSystemPlayer(playerState.activeChannel.streamUrl);
  setPlayerStatus("Attempted to open in system player.", "success");
}

async function handoffToSystemPlayer(streamUrl) {
  const vlcUrl = `vlc://${streamUrl.replace(/^https?:\/\//i, "")}`;

  try {
    window.location.href = vlcUrl;
  } catch {
    // no-op
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: playerState.activeChannel?.name ?? "IPTV Stream",
        text: "Open this stream in a system media player",
        url: streamUrl
      });
      return;
    } catch {
      // no-op
    }
  }

  window.open(streamUrl, "_blank", "noopener,noreferrer");
}

async function castToChromecast(channel) {
  const context = cast.framework.CastContext.getInstance();
  let session = context.getCurrentSession();

  if (!session) {
    await context.requestSession();
    session = context.getCurrentSession();
  }

  if (!session) {
    throw new Error("No active cast session");
  }

  const mimeType = detectMimeType(channel.streamUrl);
  const mediaInfo = new chrome.cast.media.MediaInfo(channel.streamUrl, mimeType);
  const metadata = new chrome.cast.media.GenericMediaMetadata();
  metadata.title = channel.name;

  if (channel.imageUrl) {
    metadata.images = [new chrome.cast.Image(channel.imageUrl)];
  }

  mediaInfo.metadata = metadata;

  const request = new chrome.cast.media.LoadRequest(mediaInfo);
  request.autoplay = true;
  await session.loadMedia(request);
}

function detectMimeType(url) {
  if (/\.m3u8($|\?)/i.test(url)) {
    return "application/vnd.apple.mpegurl";
  }

  if (/\.mpd($|\?)/i.test(url)) {
    return "application/dash+xml";
  }

  if (/\.mp4($|\?)/i.test(url)) {
    return "video/mp4";
  }

  return "video/*";
}

function updateCastButtonVisibility() {
  const canUseRemotePlayback = !!refs.playerVideo.remote?.prompt;
  const canUseAirPlayPicker = typeof refs.playerVideo.webkitShowPlaybackTargetPicker === "function";
  const available = playerState.chromecastReady || canUseRemotePlayback || canUseAirPlayPicker;

  refs.playerCastBtn.classList.toggle("hidden", !available);
  refs.nowPlayingCastBtn.classList.toggle("hidden", !available);
}

function updateNowPlayingBar() {
  const channel = playerState.activeChannel;

  if (!channel) {
    refs.nowPlayingBar.classList.add("hidden");
    refs.miniPlayer.classList.add("hidden");
    refs.nowPlayingTitle.textContent = "Now Playing";
    refs.nowPlayingSubtitle.textContent = "No channel selected";
    return;
  }

  const groupName = state.library.groups.find((group) => group.id === channel.groupId)?.name ?? "Channel";
  refs.nowPlayingTitle.textContent = channel.name;
  refs.nowPlayingSubtitle.textContent = groupName;
  refs.nowPlayingBar.classList.remove("hidden");
}

function moveVideoToDialogHost() {
  if (refs.playerVideo.parentElement !== refs.playerVideoHost) {
    refs.playerVideoHost.appendChild(refs.playerVideo);
  }
}

function moveVideoToMiniHost() {
  if (refs.playerVideo.parentElement !== refs.miniPlayerVideoHost) {
    refs.miniPlayerVideoHost.appendChild(refs.playerVideo);
  }
}

function ensureActiveChannelStillExists() {
  if (!playerState.activeChannel) {
    return;
  }

  const updatedChannel = state.library.channels.find((channel) => channel.id === playerState.activeChannel.id);
  if (!updatedChannel) {
    stopPlayer();
    return;
  }

  playerState.activeChannel = updatedChannel;
}
