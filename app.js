const STORAGE_KEY = "iptv-library-v1";
const APP_VERSION = 1;
const HLS_CDN_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";
const BLOCKED_STREAMS_KEY = "iptv-browser-blocked-streams-v1";
const CHANNEL_SCAN_RESULTS_KEY = "iptv-channel-scan-results-v1";
const IMPORTED_M3U_STATE_KEY = "iptv-imported-m3u-state-v1";
const SETTINGS_KEY = "iptv-settings-v1";
const CHANNEL_HISTORY_KEY = "iptv-channel-history-v1";
const CHANNEL_SCAN_TIMEOUT_MS = 8000;
const CHANNEL_SCAN_CONCURRENCY = 4;
const ASPECT_MODES = ["fit", "contain", "cover", "fill", "tab-max", "pip"];
const BOOST_LEVELS = [1, 1.5, 2, 3];
const CHANNEL_HISTORY_LIMIT = 30;

const persistedImportedM3uState = loadImportedM3uState();
const persistedSettings = loadSettings();
const persistedChannelHistory = loadChannelHistory();

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
  selectedGroupId: "all",
  importedM3uChannels: persistedImportedM3uState.channels,
  importedM3uScanResults: persistedImportedM3uState.scanResults,
  lastPreviewedM3uId: "",
  m3uSearchQuery: persistedImportedM3uState.searchQuery,
  m3uScanFilter: persistedImportedM3uState.scanFilter,
  m3uVisibleCount: 1000,
  m3uPageSize: 1000,
  settings: persistedSettings,
  channelHistory: persistedChannelHistory
};

const playerState = {
  activeChannel: null,
  hlsInstance: null,
  mpegtsInstance: null,
  chromecastReady: false,
  audioContext: null,
  gainNode: null,
  mediaSourceNode: null,
  boostIndex: BOOST_LEVELS.findIndex((level) => level === persistedSettings.volumeBoost),
  aspectMode: persistedSettings.defaultAspect,
  playbackQueue: [],
  stallRecoveryTimer: null,
  miniPlayerDrag: {
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    holdTimer: null,
    pending: false,
    startClientX: 0,
    startClientY: 0,
    initialized: false
  }
};

const failedImageUrls = new Set();
const browserBlockedStreamUrls = loadBlockedStreamUrls();
const channelScanResults = loadChannelScanResults();
let hlsLibraryLoadPromise = null;

const refs = {
  appShell: document.querySelector(".app-shell"),
  groupList: document.getElementById("groupList"),
  channelGrid: document.getElementById("channelGrid"),
  currentGroupTitle: document.getElementById("currentGroupTitle"),
  channelCount: document.getElementById("channelCount"),
  emptyState: document.getElementById("emptyState"),
  addGroupBtn: document.getElementById("addGroupBtn"),
  addChannelBtn: document.getElementById("addChannelBtn"),
  addPlaylistBtn: document.getElementById("addPlaylistBtn"),
  scanChannelsBtn: document.getElementById("scanChannelsBtn"),
  scanStatus: document.getElementById("scanStatus"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  m3uImportInput: document.getElementById("m3uImportInput"),
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
  playerHistoryBtn: document.getElementById("playerHistoryBtn"),
  playerChannelUpBtn: document.getElementById("playerChannelUpBtn"),
  playerChannelDownBtn: document.getElementById("playerChannelDownBtn"),
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
  miniPlayerChannelUpBtn: document.getElementById("miniPlayerChannelUpBtn"),
  miniPlayerChannelDownBtn: document.getElementById("miniPlayerChannelDownBtn"),
  miniPlayerRestoreBtn: document.getElementById("miniPlayerRestoreBtn"),
  miniPlayerStopBtn: document.getElementById("miniPlayerStopBtn"),
  m3uDialog: document.getElementById("m3uDialog"),
  m3uSummary: document.getElementById("m3uSummary"),
  m3uSearchWrap: document.getElementById("m3uSearchWrap"),
  m3uScanFilter: document.getElementById("m3uScanFilter"),
  m3uSearchInput: document.getElementById("m3uSearchInput"),
  m3uList: document.getElementById("m3uList"),
  m3uEmpty: document.getElementById("m3uEmpty"),
  m3uItemTemplate: document.getElementById("m3uItemTemplate"),
  m3uAddAllBtn: document.getElementById("m3uAddAllBtn"),
  m3uLoadMoreBtn: document.getElementById("m3uLoadMoreBtn"),
  networkStreamForm: document.getElementById("networkStreamForm"),
  networkScanChannelsBtn: document.getElementById("networkScanChannelsBtn"),
  networkScanStatus: document.getElementById("networkScanStatus"),
  networkStreamUrl: document.getElementById("networkStreamUrl"),
  networkStreamTitle: document.getElementById("networkStreamTitle"),
  networkStreamGroup: document.getElementById("networkStreamGroup"),
  networkStreamLogo: document.getElementById("networkStreamLogo"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsForm: document.getElementById("settingsForm"),
  settingsDefaultAspect: document.getElementById("settingsDefaultAspect"),
  settingsAvoidMiniOverlap: document.getElementById("settingsAvoidMiniOverlap"),
  settingsAutoPipOnMinimize: document.getElementById("settingsAutoPipOnMinimize"),
  playerAspectBtn: document.getElementById("playerAspectBtn"),
  playerBoostBtn: document.getElementById("playerBoostBtn"),
  playerScreenshotBtn: document.getElementById("playerScreenshotBtn"),
  playerPipBtn: document.getElementById("playerPipBtn"),
  historyDialog: document.getElementById("historyDialog"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
  historyClearBtn: document.getElementById("historyClearBtn")
};

initialize();

function initialize() {
  bindEvents();
  hydrateSettingsUi();
  applyAspectMode(playerState.aspectMode);
  updateBoostButton();
  updatePipButton();
  render();
  updateNowPlayingBar();
  initializeCastSupport();
  registerServiceWorker();
}

function bindEvents() {
  refs.addGroupBtn.addEventListener("click", () => openGroupDialog());
  refs.addChannelBtn.addEventListener("click", () => openChannelDialog());
  refs.addPlaylistBtn.addEventListener("click", openM3uDialogForNetworkUrl);
  refs.scanChannelsBtn?.addEventListener("click", scanChannels);
  refs.networkScanChannelsBtn?.addEventListener("click", scanImportedM3uChannels);
  refs.exportBtn.addEventListener("click", exportLibrary);
  refs.settingsBtn?.addEventListener("click", openSettingsDialog);
  refs.importInput.addEventListener("change", importLibrary);
  refs.m3uImportInput.addEventListener("change", importM3uPlaylist);
  refs.m3uAddAllBtn.addEventListener("click", addAllImportedChannels);
  refs.m3uLoadMoreBtn.addEventListener("click", () => {
    state.m3uVisibleCount += state.m3uPageSize;
    renderM3uChannels();
  });
  refs.m3uSearchInput.addEventListener("input", (event) => {
    state.m3uSearchQuery = event.target.value.trim().toLowerCase();
    saveImportedM3uState();
    state.m3uVisibleCount = state.m3uPageSize;
    renderM3uChannels();
  });
  refs.m3uScanFilter.addEventListener("change", (event) => {
    state.m3uScanFilter = event.target.value;
    saveImportedM3uState();
    state.m3uVisibleCount = state.m3uPageSize;
    renderM3uChannels();
  });
  refs.networkStreamForm.addEventListener("submit", onNetworkStreamSubmit);
  refs.m3uDialog.addEventListener("click", (event) => {
    if (event.target === refs.m3uDialog) {
      refs.m3uDialog.close();
    }
  });
  refs.m3uDialog.addEventListener("close", syncMiniPlayerContainer);
  refs.m3uDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    refs.m3uDialog.close();
  });

  refs.groupForm.addEventListener("submit", onGroupSubmit);
  refs.channelForm.addEventListener("submit", onChannelSubmit);
  refs.channelImage.addEventListener("blur", () => {
    validateImageFieldInline();
  });

  refs.deleteGroupBtn.addEventListener("click", deleteCurrentGroup);
  refs.deleteChannelBtn.addEventListener("click", deleteCurrentChannel);
  refs.playerCastBtn.addEventListener("click", onPlayerCastClick);
  refs.playerSystemBtn.addEventListener("click", onSystemPlayerClick);
  refs.playerChannelUpBtn.addEventListener("click", () => switchPlayerChannel(-1));
  refs.playerChannelDownBtn.addEventListener("click", () => switchPlayerChannel(1));
  refs.playerHistoryBtn?.addEventListener("click", openHistoryDialog);
  refs.playerAspectBtn?.addEventListener("click", cycleAspectMode);
  refs.playerBoostBtn?.addEventListener("click", cycleVolumeBoost);
  refs.playerScreenshotBtn?.addEventListener("click", capturePlayerScreenshot);
  refs.playerPipBtn?.addEventListener("click", togglePictureInPicture);
  refs.playerCloseBtn.addEventListener("click", minimizePlayer);
  refs.playerStopBtn.addEventListener("click", stopPlayer);
  refs.nowPlayingOpenBtn.addEventListener("click", openActiveChannelInPlayer);
  refs.nowPlayingCastBtn.addEventListener("click", onPlayerCastClick);
  refs.miniPlayerChannelUpBtn.addEventListener("click", () => switchPlayerChannel(-1));
  refs.miniPlayerChannelDownBtn.addEventListener("click", () => switchPlayerChannel(1));
  refs.miniPlayerRestoreBtn.addEventListener("click", openActiveChannelInPlayer);
  refs.miniPlayerStopBtn.addEventListener("click", stopPlayer);
  refs.miniPlayer.addEventListener("pointerdown", startMiniPlayerDrag);
  window.addEventListener("pointermove", onMiniPlayerDragMove);
  window.addEventListener("pointerup", endMiniPlayerDrag);
  window.addEventListener("pointercancel", endMiniPlayerDrag);
  window.addEventListener("resize", () => updateContentInsetsForMiniPlayer());
  refs.settingsForm?.addEventListener("submit", onSettingsSubmit);
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
  refs.playerVideo.addEventListener("enterpictureinpicture", updatePipButton);
  refs.playerVideo.addEventListener("leavepictureinpicture", updatePipButton);
  refs.historyClearBtn?.addEventListener("click", clearChannelHistory);

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
  const visibleQueue = channels.map((channel) => mapLibraryChannelToPlaybackChannel(channel));

  channels.forEach((channel) => {
    const card = refs.channelCardTemplate.content.firstElementChild.cloneNode(true);
    const groupName = state.library.groups.find((group) => group.id === channel.groupId)?.name ?? "Unassigned";
    const isPlaying = isSamePlaybackChannel(channel, playerState.activeChannel);

    const editBtn = card.querySelector(".card-edit");
    const link = card.querySelector(".card-link");
    const image = card.querySelector(".card-image");
    const title = card.querySelector(".card-title");
    const groupText = card.querySelector(".card-group");
    const statusBadge = card.querySelector(".card-status");

    card.classList.toggle("playing", isPlaying);
    card.setAttribute("aria-current", isPlaying ? "true" : "false");

    editBtn.addEventListener("click", () => openChannelDialog(channel.id));
    link.href = channel.streamUrl;
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      openPlayer(channel, visibleQueue, { keepPresentation: Boolean(playerState.activeChannel) });
    });

    if (channel.imageUrl) {
      applyImageWithFallback(image, channel.imageUrl, `${channel.name} poster`);
    } else {
      image.removeAttribute("src");
      image.alt = "Channel image placeholder";
    }

    title.textContent = channel.name;
    groupText.textContent = groupName;

    const scanResult = channelScanResults.get(channel.streamUrl);
    const blockedByBrowser = browserBlockedStreamUrls.has(channel.streamUrl);

    statusBadge.classList.remove("success", "warning", "error");

    if (scanResult) {
      statusBadge.textContent = scanResult.label;
      statusBadge.classList.add(scanResult.level);
      statusBadge.classList.remove("hidden");
    } else if (blockedByBrowser) {
      statusBadge.textContent = "Browser-blocked (403)";
      statusBadge.classList.add("error");
      statusBadge.classList.remove("hidden");
    } else {
      statusBadge.textContent = "";
      statusBadge.classList.add("hidden");
    }

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
  pruneBlockedStreamUrls();

  if (isActiveChannel) {
    playerState.activeChannel = null;
    stopPlayer();
  }

  saveLibrary();
  refs.channelDialog.close();
  render();
}

function exportLibrary() {
  const choice = window.prompt("Export format:\n1) JSON\n2) M3U\n\nEnter 1 or 2:", "1");
  if (!choice) {
    return;
  }

  const date = new Date().toISOString().split("T")[0];
  const link = document.createElement("a");
  let blob;

  if (choice === "2") {
    const m3uContent = buildM3uExportContent();
    blob = new Blob([m3uContent], { type: "application/x-mpegURL" });
    link.download = `iptv-library-${date}.m3u`;
  } else {
    const data = JSON.stringify(buildExportPayload(), null, 2);
    blob = new Blob([data], { type: "application/json" });
    link.download = `iptv-library-${date}.json`;
  }

  const url = URL.createObjectURL(blob);

  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}

function buildM3uExportContent() {
  const lines = ["#EXTM3U"];

  state.library.channels.forEach((channel) => {
    const groupName = state.library.groups.find((group) => group.id === channel.groupId)?.name ?? "Imported";
    const logoPart = channel.imageUrl ? ` tvg-logo=\"${channel.imageUrl}\"` : "";
    const groupPart = groupName ? ` group-title=\"${groupName}\"` : "";
    lines.push(`#EXTINF:-1${logoPart}${groupPart},${channel.name}`);
    lines.push(channel.streamUrl);
  });

  return `${lines.join("\n")}\n`;
}

async function importM3uPlaylist(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsedChannels = parseM3uText(text);

    state.importedM3uChannels = parsedChannels;
    state.importedM3uScanResults = new Map();
    state.m3uSearchQuery = "";
    state.m3uScanFilter = "all";
    state.m3uVisibleCount = state.m3uPageSize;
    setImportedScanStatus("");
    refs.m3uScanFilter.value = "all";
    refs.m3uSearchInput.value = "";
    saveImportedM3uState();
    renderM3uChannels();
    refs.m3uDialog.showModal();

    if (parsedChannels.length === 0) {
      window.alert(
        "No channel entries were detected. This can happen if the file uses unsupported formatting or is a media-segment playlist instead of a channel playlist."
      );
    }
  } catch {
    window.alert("Failed to parse M3U/M3U8 file.");
  } finally {
    refs.m3uImportInput.value = "";
  }
}

function openM3uDialogForNetworkUrl() {
  refs.m3uSearchInput.value = state.m3uSearchQuery;
  refs.m3uScanFilter.value = state.m3uScanFilter;
  renderM3uChannels();

  if (!refs.m3uDialog.open) {
    refs.m3uDialog.showModal();
  }

  refs.networkStreamUrl.focus();
}

function parseM3uText(text) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const lines = normalizedText.split(/\r?\n/).map((line) => line.trim());
  const channels = [];
  let pendingMeta = {};

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      pendingMeta = parseExtinf(line);
      continue;
    }

    if (line.startsWith("#EXTGRP:")) {
      pendingMeta.groupTitle = line.slice(8).trim();
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (isLikelyStreamLine(line)) {
      const streamUrl = cleanImportedStreamUrl(line);
      if (!streamUrl) {
        pendingMeta = {};
        continue;
      }

      const name = resolveImportedChannelName(pendingMeta, line, channels.length + 1);
      channels.push({
        id: createId("m3u"),
        name,
        streamUrl,
        imageUrl: normalizeImageUrl(pendingMeta.logo || ""),
        groupName: pendingMeta.groupTitle || "Imported"
      });
      pendingMeta = {};
    }
  }

  return channels;
}

function parseExtinf(line) {
  const result = {
    name: "",
    tvgName: "",
    logo: "",
    groupTitle: ""
  };

  const commaIndex = line.indexOf(",");
  if (commaIndex !== -1) {
    result.name = line.slice(commaIndex + 1).trim();
  }

  const logoMatch = line.match(/tvg-logo=["']([^"']+)["']/i);
  if (logoMatch) {
    result.logo = logoMatch[1].trim();
  }

  const tvgNameMatch = line.match(/tvg-name=["']([^"']+)["']/i);
  if (tvgNameMatch) {
    result.tvgName = tvgNameMatch[1].trim();
  }

  const groupMatch = line.match(/group-title=["']([^"']+)["']/i);
  if (groupMatch) {
    result.groupTitle = groupMatch[1].trim();
  }

  return result;
}

function isLikelyStreamLine(line) {
  return /^[a-z][a-z0-9+.-]*:/i.test(line) || line.startsWith("//");
}

function cleanImportedStreamUrl(line) {
  const trimmed = line.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("#")) {
    return "";
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return trimmed;
}

function resolveImportedChannelName(meta, streamUrl, fallbackIndex) {
  const fromMeta = (meta.tvgName || meta.name || "").trim();
  if (fromMeta) {
    return fromMeta;
  }

  const fromUrl = extractNameFromUrl(streamUrl);
  if (fromUrl) {
    return fromUrl;
  }

  return `Channel ${fallbackIndex}`;
}

function extractNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!lastSegment) {
      return "";
    }

    return decodeURIComponent(lastSegment)
      .replace(/\.(m3u8|mpd|mp4|ts|m4s)$/i, "")
      .replace(/[._-]+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function renderM3uChannels() {
  const channels = state.importedM3uChannels;
  refs.m3uSearchWrap.classList.toggle("hidden", channels.length === 0);

  const searchFilteredChannels = state.m3uSearchQuery
    ? channels.filter((channel) => {
      const haystack = `${channel.name} ${channel.groupName} ${channel.streamUrl}`.toLowerCase();
      return haystack.includes(state.m3uSearchQuery);
    })
    : channels;

  const filteredChannels = applyM3uScanFilter(searchFilteredChannels);

  refs.m3uList.textContent = "";
  const visibleChannels = filteredChannels.slice(0, state.m3uVisibleCount);
  const hasMore = visibleChannels.length < filteredChannels.length;

  refs.m3uAddAllBtn.disabled = filteredChannels.length === 0;
  refs.m3uLoadMoreBtn.classList.toggle("hidden", !hasMore);

  refs.m3uSummary.textContent = channels.length
    ? hasActiveM3uFilters()
      ? `${visibleChannels.length} of ${filteredChannels.length} filtered (${channels.length} total)`
      : `${visibleChannels.length} of ${channels.length} channels shown`
    : "No channels found in file.";

  refs.m3uEmpty.classList.toggle("hidden", visibleChannels.length > 0);
  if (channels.length > 0 && filteredChannels.length === 0 && hasActiveM3uFilters()) {
    refs.m3uEmpty.textContent = "No channels match your current filters.";
  } else {
    refs.m3uEmpty.textContent = "Import an M3U/M3U8 file to view channels.";
  }

  visibleChannels.forEach((channel) => {
    const row = refs.m3uItemTemplate.content.firstElementChild.cloneNode(true);
    if (channel.id === state.lastPreviewedM3uId) {
      row.classList.add("last-previewed");
    }


    const image = row.querySelector(".m3u-item-image");
    const title = row.querySelector(".m3u-item-title");
    const subtitle = row.querySelector(".m3u-item-subtitle");
    const playBtn = row.querySelector(".m3u-play-btn");
    const addBtn = row.querySelector(".m3u-add-btn");
    const groupSelect = row.querySelector(".m3u-group-select");
    const itemStatus = row.querySelector(".m3u-item-status");
    const scanResult = state.importedM3uScanResults.get(channel.streamUrl);
    const alreadyAdded = state.library.channels.some(
      (item) => item.streamUrl === channel.streamUrl && item.name.toLowerCase() === channel.name.toLowerCase()
    );

    title.textContent = channel.name;
    subtitle.textContent = `${channel.groupName} • ${channel.streamUrl}`;
    populateM3uGroupSelect(groupSelect, channel.groupName);

    if (scanResult) {
      itemStatus.textContent = scanResult.label;
      itemStatus.classList.remove("hidden", "success", "warning", "error");
      itemStatus.classList.add(scanResult.level);
    } else {
      itemStatus.textContent = "";
      itemStatus.classList.remove("success", "warning", "error");
      itemStatus.classList.add("hidden");
    }

    if (channel.imageUrl) {
      applyImageWithFallback(image, channel.imageUrl, `${channel.name} logo`);
    } else {
      image.removeAttribute("src");
      image.alt = "Channel logo placeholder";
    }

    playBtn.addEventListener("click", () => {
      const hadActiveChannel = Boolean(playerState.activeChannel);
      const channelForPlay = {
        id: channel.id,
        name: channel.name,
        groupId: ensureGroupByName(channel.groupName),
        streamUrl: channel.streamUrl,
        imageUrl: channel.imageUrl
      };
      const filteredQueue = filteredChannels.map(mapImportedChannelToPlaybackChannel);

      state.lastPreviewedM3uId = channel.id;
      openPlayer(channelForPlay, filteredQueue, { keepPresentation: hadActiveChannel });
      if (!hadActiveChannel) {
        minimizePlayer();
      }
      renderM3uChannels();
    });

    addBtn.addEventListener("click", () => {
      const targetGroupId = resolveGroupIdFromSelection(groupSelect.value, channel.groupName);
      addImportedChannelToLibrary(channel, targetGroupId);
      addBtn.textContent = "Added";
      addBtn.disabled = true;
      groupSelect.disabled = true;
    });

    if (alreadyAdded) {
      row.classList.add("already-added");
      subtitle.textContent = `${channel.groupName} • Already in library`;
      addBtn.textContent = "Added";
      addBtn.disabled = true;
      groupSelect.disabled = true;
    }

    refs.m3uList.appendChild(row);
  });
}

function addAllImportedChannels() {
  if (!state.importedM3uChannels.length) {
    return;
  }

  const filteredChannels = applyM3uScanFilter(
    state.m3uSearchQuery
      ? state.importedM3uChannels.filter((channel) => {
        const haystack = `${channel.name} ${channel.groupName} ${channel.streamUrl}`.toLowerCase();
        return haystack.includes(state.m3uSearchQuery);
      })
      : state.importedM3uChannels
  );

  if (!filteredChannels.length) {
    window.alert("No channels match the current filters.");
    return;
  }

  let addedCount = 0;

  filteredChannels.forEach((channel) => {
    const exists = state.library.channels.some(
      (item) => item.streamUrl === channel.streamUrl && item.name.toLowerCase() === channel.name.toLowerCase()
    );

    if (exists) {
      return;
    }

    addImportedChannelToLibrary(channel);
    addedCount += 1;
  });

  renderM3uChannels();
  window.alert(`Added ${addedCount} channel${addedCount === 1 ? "" : "s"} from filtered playlist.`);
}

async function onNetworkStreamSubmit(event) {
  event.preventDefault();

  const networkChannel = buildNetworkChannelFromForm();
  if (!networkChannel) {
    return;
  }

  const loadedPlaylist = await tryLoadPlaylistFromUrl(networkChannel.streamUrl, networkChannel.groupName, {
    autoAddSingle: true,
    fallbackName: networkChannel.name,
    fallbackImageUrl: networkChannel.imageUrl
  });
  if (loadedPlaylist) {
    return;
  }

  window.alert("Could not parse playlist data from this URL.");
}

async function tryLoadPlaylistFromUrl(url, fallbackGroupName = "Imported", options = {}) {
  const { autoAddSingle = false, fallbackName = "", fallbackImageUrl = "" } = options;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Playlist request forbidden (403)");
      }
      throw new Error("Playlist request failed");
    }

    const text = await response.text();
    let parsedChannels = parseM3uText(text).map((channel) => ({
      ...channel,
      groupName: channel.groupName || fallbackGroupName || "Imported"
    }));

    if (!parsedChannels.length && isHlsManifestText(text)) {
      parsedChannels = [
        {
          id: createId("m3u"),
          name: fallbackName || extractNameFromUrl(url) || "Network Stream",
          streamUrl: url,
          imageUrl: normalizeImageUrl(fallbackImageUrl || ""),
          groupName: fallbackGroupName || "Imported"
        }
      ];
    }

    if (!parsedChannels.length) {
      return false;
    }

    if (autoAddSingle && parsedChannels.length === 1) {
      const [singleChannel] = parsedChannels;
      const exists = state.library.channels.some(
        (item) =>
          item.streamUrl === singleChannel.streamUrl &&
          item.name.toLowerCase() === singleChannel.name.toLowerCase()
      );

      if (!exists) {
        addImportedChannelToLibrary(singleChannel);
      }

      state.importedM3uChannels = parsedChannels;
      state.importedM3uScanResults = new Map();
      state.m3uSearchQuery = "";
      state.m3uScanFilter = "all";
      state.m3uVisibleCount = state.m3uPageSize;
      setImportedScanStatus("");
      refs.m3uScanFilter.value = "all";
      refs.m3uSearchInput.value = "";
      saveImportedM3uState();
      renderM3uChannels();
      if (!refs.m3uDialog.open) {
        refs.m3uDialog.showModal();
      }

      refs.m3uSummary.textContent = "1 channel loaded and linked";
      window.alert("Single-channel M3U parsed. Channel link added to your library.");
      return true;
    }

    state.importedM3uChannels = parsedChannels;
    state.importedM3uScanResults = new Map();
    state.m3uSearchQuery = "";
    state.m3uScanFilter = "all";
    state.m3uVisibleCount = state.m3uPageSize;
    setImportedScanStatus("");
    refs.m3uScanFilter.value = "all";
    refs.m3uSearchInput.value = "";
    saveImportedM3uState();
    renderM3uChannels();
    if (!refs.m3uDialog.open) {
      refs.m3uDialog.showModal();
    }
    refs.m3uSummary.textContent = `${parsedChannels.length} channels loaded from URL`;
    return true;
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("403")) {
      window.alert(
        "This provider blocks browser-based requests (HTTP 403). The same URL may work in VLC but not in-browser. Use System Player/Open External for this stream."
      );
      return false;
    }

    window.alert("Could not load playlist URL. The host may block CORS or require authentication.");
    return false;
  }
}

function isHlsManifestText(text) {
  const normalized = text.trim();
  if (!normalized.startsWith("#EXTM3U")) {
    return false;
  }

  return /#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE|ENDLIST)/i.test(normalized);
}

function buildNetworkChannelFromForm() {
  const streamUrl = refs.networkStreamUrl.value.trim();
  if (!streamUrl) {
    return null;
  }

  const titleInput = refs.networkStreamTitle.value.trim();
  const groupName = refs.networkStreamGroup.value.trim() || "Imported";
  const logoUrl = normalizeImageUrl(refs.networkStreamLogo.value);
  const fallbackName = extractNameFromUrl(streamUrl) || "Network Stream";

  return {
    id: createId("network"),
    name: titleInput || fallbackName,
    streamUrl,
    imageUrl: logoUrl,
    groupName
  };
}

function addImportedChannelToLibrary(channel, groupIdOverride = "") {
  const groupId = groupIdOverride || ensureGroupByName(channel.groupName);

  state.library.channels.push({
    id: createId("channel"),
    name: channel.name,
    groupId,
    streamUrl: channel.streamUrl,
    imageUrl: channel.imageUrl
  });

  const importedScanResult = state.importedM3uScanResults.get(channel.streamUrl);
  if (importedScanResult) {
    channelScanResults.set(channel.streamUrl, importedScanResult);
    saveChannelScanResults();

    if (importedScanResult.reason === "forbidden") {
      browserBlockedStreamUrls.add(channel.streamUrl);
      saveBlockedStreamUrls();
    } else if (importedScanResult.reason === "ok" && browserBlockedStreamUrls.has(channel.streamUrl)) {
      browserBlockedStreamUrls.delete(channel.streamUrl);
      saveBlockedStreamUrls();
    }
  }

  saveLibrary();
  render();
}

function populateM3uGroupSelect(selectEl, preferredGroupName = "Imported") {
  selectEl.textContent = "";

  const normalizedPreferred = (preferredGroupName || "Imported").trim() || "Imported";
  let matchedExisting = false;

  state.library.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = `id:${group.id}`;
    option.textContent = group.name;

    if (group.name.toLowerCase() === normalizedPreferred.toLowerCase()) {
      option.selected = true;
      matchedExisting = true;
    }

    selectEl.appendChild(option);
  });

  if (!matchedExisting) {
    const createOption = document.createElement("option");
    createOption.value = `create:${normalizedPreferred}`;
    createOption.textContent = `${normalizedPreferred} (new)`;
    createOption.selected = true;
    selectEl.appendChild(createOption);
  }
}

function resolveGroupIdFromSelection(selectionValue, fallbackGroupName = "Imported") {
  if (selectionValue.startsWith("id:")) {
    const id = selectionValue.slice(3);
    if (state.library.groups.some((group) => group.id === id)) {
      return id;
    }
  }

  if (selectionValue.startsWith("create:")) {
    const name = selectionValue.slice(7).trim();
    if (name) {
      return ensureGroupByName(name);
    }
  }

  return ensureGroupByName(fallbackGroupName);
}

function ensureGroupByName(groupName) {
  const normalizedName = (groupName || "Imported").trim() || "Imported";
  const existing = state.library.groups.find(
    (group) => group.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (existing) {
    return existing.id;
  }

  const newGroup = { id: createId("group"), name: normalizedName };
  state.library.groups.push(newGroup);
  return newGroup.id;
}

async function importLibrary(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    const importedState = parseImportedState(imported);
    if (!importedState) {
      throw new Error("Invalid file format");
    }

    state.library = importedState.library;
    state.selectedGroupId = "all";
    browserBlockedStreamUrls.clear();
    importedState.blockedStreamUrls.forEach((url) => browserBlockedStreamUrls.add(url));

    channelScanResults.clear();
    importedState.channelScanResults.forEach((result, url) => channelScanResults.set(url, result));

    state.importedM3uChannels = importedState.importedM3uState.channels;
    state.importedM3uScanResults = importedState.importedM3uState.scanResults;
    state.m3uSearchQuery = importedState.importedM3uState.searchQuery;
    state.m3uScanFilter = importedState.importedM3uState.scanFilter;
    state.m3uVisibleCount = state.m3uPageSize;

    refs.m3uSearchInput.value = state.m3uSearchQuery;
    refs.m3uScanFilter.value = state.m3uScanFilter;

    saveBlockedStreamUrls();
    saveChannelScanResults();
    saveImportedM3uState();
    saveLibrary();
    setImportedScanStatus("");
    renderM3uChannels();
    render();
  } catch (error) {
    window.alert("Import failed. Please use a valid exported library JSON file.");
  } finally {
    refs.importInput.value = "";
  }
}

function buildExportPayload() {
  return {
    exportVersion: 2,
    exportedAt: new Date().toISOString(),
    library: state.library,
    blockedStreamUrls: [...browserBlockedStreamUrls],
    channelScanResults: Object.fromEntries(channelScanResults.entries()),
    importedM3uState: {
      channels: state.importedM3uChannels,
      scanResults: Object.fromEntries(state.importedM3uScanResults.entries()),
      searchQuery: state.m3uSearchQuery,
      scanFilter: state.m3uScanFilter
    }
  };
}

function parseImportedState(value) {
  const libraryValue = value?.library ?? value;
  if (!isValidLibrary(libraryValue)) {
    return null;
  }

  const library = normalizeLibrary(libraryValue);
  const libraryUrls = new Set(library.channels.map((channel) => channel.streamUrl));

  const blockedStreamUrls = normalizeBlockedStreamUrls(value?.blockedStreamUrls, libraryUrls);
  const channelScanMap = normalizeScanResultsMap(value?.channelScanResults, libraryUrls);
  const importedM3uState = normalizeImportedM3uState(value?.importedM3uState);

  return {
    library,
    blockedStreamUrls,
    channelScanResults: channelScanMap,
    importedM3uState
  };
}

function normalizeBlockedStreamUrls(rawBlockedUrls, allowedUrls = null) {
  if (!Array.isArray(rawBlockedUrls)) {
    return new Set();
  }

  return new Set(
    rawBlockedUrls.filter((url) => {
      if (typeof url !== "string" || !url.trim()) {
        return false;
      }

      return allowedUrls ? allowedUrls.has(url) : true;
    })
  );
}

function normalizeScanResultsMap(rawScanResults, allowedUrls = null) {
  const scanMap = new Map();
  if (!rawScanResults || typeof rawScanResults !== "object") {
    return scanMap;
  }

  Object.entries(rawScanResults).forEach(([url, result]) => {
    if (
      typeof url !== "string" ||
      !url.trim() ||
      !result ||
      typeof result !== "object" ||
      !["success", "warning", "error"].includes(result.level) ||
      typeof result.label !== "string"
    ) {
      return;
    }

    if (allowedUrls && !allowedUrls.has(url)) {
      return;
    }

    scanMap.set(url, {
      level: result.level,
      label: result.label,
      reason: typeof result.reason === "string" ? result.reason : ""
    });
  });

  return scanMap;
}

function normalizeImportedM3uState(rawImportedState) {
  const fallback = {
    channels: [],
    scanResults: new Map(),
    searchQuery: "",
    scanFilter: "all"
  };

  if (!rawImportedState || typeof rawImportedState !== "object") {
    return fallback;
  }

  const channels = Array.isArray(rawImportedState.channels)
    ? rawImportedState.channels
      .filter((channel) =>
        channel &&
        typeof channel.id === "string" &&
        typeof channel.name === "string" &&
        typeof channel.streamUrl === "string"
      )
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        streamUrl: channel.streamUrl,
        imageUrl: typeof channel.imageUrl === "string" ? channel.imageUrl : "",
        groupName: typeof channel.groupName === "string" && channel.groupName.trim() ? channel.groupName : "Imported"
      }))
    : [];

  const importedUrls = new Set(channels.map((channel) => channel.streamUrl));
  const scanResults = normalizeScanResultsMap(rawImportedState.scanResults, importedUrls);

  const allowedFilters = new Set(["all", "not-scanned", "reachable", "cors", "404", "country", "blocked", "issues"]);
  const scanFilter = typeof rawImportedState.scanFilter === "string" && allowedFilters.has(rawImportedState.scanFilter)
    ? rawImportedState.scanFilter
    : "all";

  return {
    channels,
    scanResults,
    searchQuery: typeof rawImportedState.searchQuery === "string" ? rawImportedState.searchQuery.toLowerCase() : "",
    scanFilter
  };
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
  pruneBlockedStreamUrls();
  pruneChannelScanResults();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
}

async function scanChannels() {
  const allStreamUrls = [...new Set(state.library.channels.map((channel) => channel.streamUrl).filter(Boolean))];
  if (!allStreamUrls.length) {
    setScanStatus("No channels to scan.");
    return;
  }

  if (refs.scanChannelsBtn?.disabled) {
    return;
  }

  if (refs.scanChannelsBtn) {
    refs.scanChannelsBtn.disabled = true;
  }
  if (refs.networkScanChannelsBtn) {
    refs.networkScanChannelsBtn.disabled = true;
  }

  let processed = 0;
  let reachable = 0;
  let blocked = 0;
  let issues = 0;
  let blockedSetChanged = false;

  setScanStatus(`Scanning ${processed}/${allStreamUrls.length}...`);

  try {
    await runWithConcurrency(allStreamUrls, CHANNEL_SCAN_CONCURRENCY, async (streamUrl) => {
      const result = await probeStreamUrl(streamUrl);
      channelScanResults.set(streamUrl, result);

      if (result.level === "success") {
        reachable += 1;
        if (browserBlockedStreamUrls.delete(streamUrl)) {
          blockedSetChanged = true;
        }
      } else if (result.reason === "forbidden") {
        blocked += 1;
        if (!browserBlockedStreamUrls.has(streamUrl)) {
          browserBlockedStreamUrls.add(streamUrl);
          blockedSetChanged = true;
        }
      } else {
        issues += 1;
      }

      processed += 1;
      setScanStatus(`Scanning ${processed}/${allStreamUrls.length}...`);

      if (processed % 8 === 0 || processed === allStreamUrls.length) {
        renderChannels();
      }
    });

    saveChannelScanResults();
    if (blockedSetChanged) {
      saveBlockedStreamUrls();
    }

    setScanStatus(`Scan complete: ${reachable} reachable, ${blocked} blocked, ${issues} with issues.`);
    renderChannels();
  } catch {
    setScanStatus("Scan interrupted. Try again.");
  } finally {
    if (refs.scanChannelsBtn) {
      refs.scanChannelsBtn.disabled = false;
    }
    if (refs.networkScanChannelsBtn) {
      refs.networkScanChannelsBtn.disabled = false;
    }
  }
}

async function scanImportedM3uChannels() {
  const importedStreamUrls = [...new Set(state.importedM3uChannels.map((channel) => channel.streamUrl).filter(Boolean))];
  if (!importedStreamUrls.length) {
    setImportedScanStatus("No loaded playlist channels to scan.");
    return;
  }

  if (refs.networkScanChannelsBtn?.disabled) {
    return;
  }

  refs.networkScanChannelsBtn.disabled = true;

  let processed = 0;
  let reachable = 0;
  let blocked = 0;
  let issues = 0;

  setImportedScanStatus(`Scanning ${processed}/${importedStreamUrls.length}...`);

  try {
    await runWithConcurrency(importedStreamUrls, CHANNEL_SCAN_CONCURRENCY, async (streamUrl) => {
      const result = await probeStreamUrl(streamUrl);
      state.importedM3uScanResults.set(streamUrl, result);
      channelScanResults.set(streamUrl, result);
      saveChannelScanResults();

      if (result.reason === "forbidden") {
        browserBlockedStreamUrls.add(streamUrl);
        saveBlockedStreamUrls();
      } else if (result.reason === "ok" && browserBlockedStreamUrls.has(streamUrl)) {
        browserBlockedStreamUrls.delete(streamUrl);
        saveBlockedStreamUrls();
      }

      saveImportedM3uState();

      if (result.level === "success") {
        reachable += 1;
      } else if (result.reason === "forbidden") {
        blocked += 1;
      } else {
        issues += 1;
      }

      processed += 1;
      setImportedScanStatus(`Scanning ${processed}/${importedStreamUrls.length}...`);

      if (processed % 8 === 0 || processed === importedStreamUrls.length) {
        renderM3uChannels();
      }
    });

    setImportedScanStatus(`Scan complete: ${reachable} reachable, ${blocked} blocked, ${issues} with issues.`);
    renderM3uChannels();
  } catch {
    setImportedScanStatus("Scan interrupted. Try again.");
  } finally {
    refs.networkScanChannelsBtn.disabled = false;
  }
}

function setScanStatus(message) {
  const text = (message || "").trim();
  if (!refs.scanStatus) {
    return;
  }

  refs.scanStatus.textContent = text;
  refs.scanStatus.classList.toggle("hidden", !text);
}

function setImportedScanStatus(message) {
  const text = (message || "").trim();
  if (!refs.networkScanStatus) {
    return;
  }

  refs.networkScanStatus.textContent = text;
  refs.networkScanStatus.classList.toggle("hidden", !text);
}

async function runWithConcurrency(items, concurrency, worker) {
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let index = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}

async function probeStreamUrl(streamUrl) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHANNEL_SCAN_TIMEOUT_MS);

  try {
    const response = await fetch(streamUrl, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      signal: controller.signal
    });

    if (response.ok) {
      return {
        level: "success",
        label: "Scan: Reachable",
        reason: "ok"
      };
    }

    if (response.status === 403) {
      return {
        level: "error",
        label: "Scan: Blocked (403)",
        reason: "forbidden"
      };
    }

    if (response.status === 404) {
      return {
        level: "warning",
        label: "Scan: HTTP 404",
        reason: "not-found"
      };
    }

    if (response.status === 451) {
      return {
        level: "error",
        label: "Scan: Country/Geo blocked",
        reason: "country"
      };
    }

    if (response.status === 401) {
      return {
        level: "error",
        label: "Scan: Unauthorized (401)",
        reason: "unauthorized"
      };
    }

    if (response.status >= 400) {
      return {
        level: "warning",
        label: `Scan: HTTP ${response.status}`,
        reason: "http"
      };
    }

    return {
      level: "warning",
      label: "Scan: Needs manual check",
      reason: "uncertain"
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        level: "warning",
        label: "Scan: Timeout",
        reason: "timeout"
      };
    }

    const message = String(error?.message || "").toLowerCase();
    if (message.includes("403") || message.includes("forbidden")) {
      return {
        level: "error",
        label: "Scan: Blocked (403)",
        reason: "forbidden"
      };
    }

    return {
      level: "warning",
      label: "Scan: CORS/Network",
      reason: "cors"
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function hasActiveM3uFilters() {
  return Boolean(state.m3uSearchQuery) || state.m3uScanFilter !== "all";
}

function applyM3uScanFilter(channels) {
  const filter = state.m3uScanFilter;
  if (filter === "all") {
    return channels;
  }

  return channels.filter((channel) => {
    const result = state.importedM3uScanResults.get(channel.streamUrl);
    return matchesScanFilter(result, filter);
  });
}

function matchesScanFilter(result, filter) {
  if (filter === "not-scanned") {
    return !result;
  }

  if (!result) {
    return false;
  }

  switch (filter) {
    case "reachable":
      return result.reason === "ok";
    case "cors":
      return result.reason === "cors";
    case "404":
      return result.reason === "not-found";
    case "country":
      return result.reason === "country";
    case "blocked":
      return ["forbidden", "unauthorized", "country"].includes(result.reason);
    case "issues":
      return result.reason !== "ok";
    default:
      return true;
  }
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

function openPlayer(channel, playbackQueue = null, options = {}) {
  if (!channel?.streamUrl) {
    return;
  }

  const keepPresentation = Boolean(options.keepPresentation);
  const miniWasVisible = !refs.miniPlayer.classList.contains("hidden");
  const dialogWasOpen = refs.playerDialog.open;

  playerState.activeChannel = channel;
  if (Array.isArray(playbackQueue) && playbackQueue.length > 0) {
    playerState.playbackQueue = playbackQueue.map((item) => normalizePlaybackChannel(item)).filter(Boolean);
  } else if (!Array.isArray(playerState.playbackQueue) || playerState.playbackQueue.length === 0) {
    playerState.playbackQueue = getFallbackPlaybackQueue();
  }

  recordChannelHistory(channel);
  updateNowPlayingBar();
  refs.playerTitle.textContent = channel.name;

  const groupName = state.library.groups.find((group) => group.id === channel.groupId)?.name ?? "Channel";
  refs.playerSubtitle.textContent = groupName;
  refs.playerOpenExternal.href = channel.streamUrl;

  setPlayerStatus("");
  updateCastButtonVisibility();
  updatePlayerChannelButtons();
  if (keepPresentation && miniWasVisible) {
    moveVideoToMiniHost();
    refs.miniPlayer.classList.remove("hidden");
    syncMiniPlayerContainer();
    if (refs.playerDialog.open) {
      refs.playerDialog.close();
    }
  } else {
    moveVideoToDialogHost();
    refs.miniPlayer.classList.add("hidden");
    if (!refs.playerDialog.open) {
      refs.playerDialog.showModal();
    }
  }

  updateContentInsetsForMiniPlayer();
  applyAspectMode(playerState.aspectMode);
  updatePipButton();
  renderChannels();

  startVideoPlayback(channel.streamUrl);
}

function stopPlayer() {
  clearStallRecoveryTimer();
  destroyHlsInstance();
  destroyMpegtsInstance();
  refs.playerVideo.pause();
  if (document.pictureInPictureElement === refs.playerVideo && document.exitPictureInPicture) {
    document.exitPictureInPicture().catch(() => {
      // no-op
    });
  }
  refs.playerVideo.removeAttribute("src");
  refs.playerVideo.load();
  moveVideoToDialogHost();
  refs.miniPlayer.classList.add("hidden");
  syncMiniPlayerContainer();
  resetMiniPlayerPosition();
  updateContentInsetsForMiniPlayer();
  playerState.activeChannel = null;
  playerState.playbackQueue = [];
  updateNowPlayingBar();
  updatePlayerChannelButtons();
  setPlayerStatus("");
  renderChannels();

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
  syncMiniPlayerContainer();
  updateContentInsetsForMiniPlayer();

  if (state.settings.autoPipOnMinimize) {
    togglePictureInPicture(true);
  }

  if (refs.playerDialog.open) {
    refs.playerDialog.close();
  }
}

function openActiveChannelInPlayer() {
  if (!playerState.activeChannel) {
    return;
  }

  openPlayer(playerState.activeChannel, playerState.playbackQueue);
}

function cycleAspectMode() {
  const currentIndex = Math.max(0, ASPECT_MODES.indexOf(playerState.aspectMode));
  const nextMode = ASPECT_MODES[(currentIndex + 1) % ASPECT_MODES.length];
  playerState.aspectMode = nextMode;
  state.settings.defaultAspect = nextMode;
  saveSettings();
  hydrateSettingsUi();
  applyAspectMode(nextMode);

  if (nextMode === "tab-max") {
    setPlayerStatus("Aspect mode set to Max in Tab.", "success");
  }
}

function applyAspectMode(mode) {
  const safeMode = ASPECT_MODES.includes(mode) ? mode : "fit";
  playerState.aspectMode = safeMode;
  refs.playerVideoHost.classList.remove(
    "aspect-fit",
    "aspect-contain",
    "aspect-cover",
    "aspect-fill",
    "aspect-tab-max"
  );
  if (safeMode !== "pip") {
    refs.playerVideoHost.classList.add(`aspect-${safeMode}`);
  }
  refs.playerAspectBtn.textContent = `Aspect: ${formatAspectLabel(safeMode)}`;

  if (safeMode === "pip") {
    togglePictureInPicture(true);
  }
}

function formatAspectLabel(mode) {
  switch (mode) {
    case "contain":
      return "Contain";
    case "cover":
      return "Cover";
    case "fill":
      return "Stretch";
    case "tab-max":
      return "Max Tab";
    case "pip":
      return "Detach";
    default:
      return "16:9";
  }
}

async function cycleVolumeBoost() {
  await initializeAudioBoostGraph();

  const baseIndex = playerState.boostIndex >= 0 ? playerState.boostIndex : 0;
  playerState.boostIndex = (baseIndex + 1) % BOOST_LEVELS.length;
  const gainValue = BOOST_LEVELS[playerState.boostIndex];

  if (playerState.gainNode) {
    playerState.gainNode.gain.value = gainValue;
  }

  state.settings.volumeBoost = gainValue;
  saveSettings();
  updateBoostButton();
}

function updateBoostButton() {
  const currentLevel = Number(state.settings.volumeBoost) || 1;
  const levelPct = Math.round(currentLevel * 100);
  refs.playerBoostBtn.textContent = `Boost: ${levelPct}%`;
}

async function initializeAudioBoostGraph() {
  if (playerState.gainNode && playerState.audioContext && playerState.mediaSourceNode) {
    if (playerState.audioContext.state === "suspended") {
      await playerState.audioContext.resume();
    }
    return;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    setPlayerStatus("Audio boost is not supported in this browser.", "error");
    return;
  }

  try {
    const audioContext = new AudioContextCtor();
    const sourceNode = audioContext.createMediaElementSource(refs.playerVideo);
    const gainNode = audioContext.createGain();

    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    playerState.audioContext = audioContext;
    playerState.mediaSourceNode = sourceNode;
    playerState.gainNode = gainNode;
    playerState.boostIndex = Math.max(0, BOOST_LEVELS.findIndex((level) => level === state.settings.volumeBoost));
    gainNode.gain.value = BOOST_LEVELS[playerState.boostIndex];

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch {
    setPlayerStatus("Could not initialize audio boost.", "error");
  }
}

function capturePlayerScreenshot() {
  if (!playerState.activeChannel) {
    setPlayerStatus("Open a channel first.", "error");
    return;
  }

  const video = refs.playerVideo;
  if (!video.videoWidth || !video.videoHeight) {
    setPlayerStatus("Wait for video frames before taking a screenshot.", "error");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    setPlayerStatus("Screenshot capture failed.", "error");
    return;
  }

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const libraryChannel = state.library.channels.find((channel) => channel.id === playerState.activeChannel.id);
    if (libraryChannel) {
      libraryChannel.imageUrl = dataUrl;
      playerState.activeChannel = libraryChannel;
      saveLibrary();
      render();
    }

    const download = document.createElement("a");
    const safeName = playerState.activeChannel.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "channel";
    download.href = dataUrl;
    download.download = `${safeName}-thumbnail.jpg`;
    download.click();

    setPlayerStatus("Screenshot captured and set as thumbnail.", "success");
  } catch {
    setPlayerStatus("Screenshot blocked by stream security/CORS policy.", "error");
  }
}

async function togglePictureInPicture(forceEnable = false) {
  if (!document.pictureInPictureEnabled) {
    setPlayerStatus("PiP is not supported in this browser.", "error");
    return;
  }

  if (!playerState.activeChannel) {
    setPlayerStatus("Open a channel first.", "error");
    return;
  }

  try {
    if (document.pictureInPictureElement === refs.playerVideo && !forceEnable) {
      await document.exitPictureInPicture();
      return;
    }

    if (document.pictureInPictureElement !== refs.playerVideo) {
      await refs.playerVideo.requestPictureInPicture();
      setPlayerStatus("Detached to Picture-in-Picture.", "success");
    }
  } catch {
    setPlayerStatus("Picture-in-Picture request failed.", "error");
  } finally {
    updatePipButton();
  }
}

function updatePipButton() {
  if (!refs.playerPipBtn) {
    return;
  }

  refs.playerPipBtn.textContent = document.pictureInPictureElement === refs.playerVideo
    ? "Attached"
    : "Detach (PiP)";
}

function recordChannelHistory(channel) {
  const entry = {
    id: channel.id || createId("history"),
    name: channel.name || "Channel",
    groupId: channel.groupId || "",
    groupName: state.library.groups.find((group) => group.id === channel.groupId)?.name || "Channel",
    streamUrl: channel.streamUrl,
    imageUrl: channel.imageUrl || "",
    playedAt: new Date().toISOString()
  };

  state.channelHistory = state.channelHistory.filter((item) => !isSamePlaybackChannel(item, entry));
  state.channelHistory.unshift(entry);
  if (state.channelHistory.length > CHANNEL_HISTORY_LIMIT) {
    state.channelHistory = state.channelHistory.slice(0, CHANNEL_HISTORY_LIMIT);
  }

  saveChannelHistory();
}

function openHistoryDialog() {
  renderHistoryDialog();
  refs.historyDialog.showModal();
}

function renderHistoryDialog() {
  refs.historyList.textContent = "";
  const hasHistory = state.channelHistory.length > 0;
  refs.historyEmpty.classList.toggle("hidden", hasHistory);

  if (!hasHistory) {
    return;
  }

  state.channelHistory.forEach((item) => {
    const row = document.createElement("article");
    row.className = "m3u-item glass";

    const main = document.createElement("div");
    main.className = "m3u-item-main";

    const image = document.createElement("img");
    image.className = "m3u-item-image";
    if (item.imageUrl) {
      applyImageWithFallback(image, item.imageUrl, `${item.name} logo`);
    } else {
      image.alt = "Channel logo placeholder";
    }

    const textWrap = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "m3u-item-title";
    title.textContent = item.name;

    const subtitle = document.createElement("p");
    subtitle.className = "m3u-item-subtitle";
    subtitle.textContent = `${item.groupName} • ${new Date(item.playedAt).toLocaleString()}`;

    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);
    main.appendChild(image);
    main.appendChild(textWrap);

    const actions = document.createElement("div");
    actions.className = "m3u-item-actions";
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "btn tiny primary";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => {
      const playable = {
        id: item.id,
        name: item.name,
        groupId: item.groupId,
        streamUrl: item.streamUrl,
        imageUrl: item.imageUrl
      };
      openPlayer(playable, playerState.playbackQueue, { keepPresentation: Boolean(playerState.activeChannel) });
      refs.historyDialog.close();
    });
    actions.appendChild(playBtn);

    row.appendChild(main);
    row.appendChild(actions);
    refs.historyList.appendChild(row);
  });
}

function clearChannelHistory() {
  state.channelHistory = [];
  saveChannelHistory();
  renderHistoryDialog();
}

function switchPlayerChannel(step) {
  if (!playerState.activeChannel) {
    return;
  }

  const navigableChannels = getNavigablePlaybackChannels();
  if (navigableChannels.length < 2) {
    setPlayerStatus("No other channels in the current list.");
    updatePlayerChannelButtons();
    return;
  }

  const currentIndex = findPlaybackChannelIndex(navigableChannels, playerState.activeChannel);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeCurrentIndex + step + navigableChannels.length) % navigableChannels.length;
  const nextChannel = navigableChannels[nextIndex];

  openPlayer(nextChannel, navigableChannels, { keepPresentation: true });
}

function updatePlayerChannelButtons() {
  const hasChoices = getNavigablePlaybackChannels().length > 1;

  refs.playerChannelUpBtn.disabled = !hasChoices;
  refs.playerChannelDownBtn.disabled = !hasChoices;
  refs.miniPlayerChannelUpBtn.disabled = !hasChoices;
  refs.miniPlayerChannelDownBtn.disabled = !hasChoices;
}

function getNavigablePlaybackChannels() {
  const activeChannel = playerState.activeChannel;
  if (!activeChannel) {
    return [];
  }

  const scopedQueue = (playerState.playbackQueue || []).filter(Boolean);
  const scopedContainsActive = scopedQueue.some((channel) => isSamePlaybackChannel(channel, activeChannel));
  if (scopedQueue.length && scopedContainsActive) {
    return scopedQueue;
  }

  return getFallbackPlaybackQueue();
}

function getFallbackPlaybackQueue() {
  const activeChannel = playerState.activeChannel;
  if (!activeChannel) {
    return [];
  }

  const filteredImportedChannels = getFilteredImportedM3uChannels();
  const importedContainsActive = filteredImportedChannels.some((channel) => isSamePlaybackChannel(channel, activeChannel));
  if (filteredImportedChannels.length && importedContainsActive) {
    return filteredImportedChannels.map(mapImportedChannelToPlaybackChannel);
  }

  if (activeChannel.groupId && state.library.groups.some((group) => group.id === activeChannel.groupId)) {
    return state.library.channels
      .filter((channel) => channel.groupId === activeChannel.groupId)
      .map((channel) => mapLibraryChannelToPlaybackChannel(channel));
  }

  if (state.selectedGroupId === "all") {
    return state.library.channels.map((channel) => mapLibraryChannelToPlaybackChannel(channel));
  }

  return state.library.channels
    .filter((channel) => channel.groupId === state.selectedGroupId)
    .map((channel) => mapLibraryChannelToPlaybackChannel(channel));
}

function mapLibraryChannelToPlaybackChannel(channel) {
  return normalizePlaybackChannel(channel);
}

function normalizePlaybackChannel(channel) {
  if (!channel?.streamUrl) {
    return null;
  }

  return {
    id: channel.id || createId("playback"),
    name: channel.name || "Channel",
    groupId: channel.groupId || "",
    streamUrl: channel.streamUrl,
    imageUrl: channel.imageUrl || ""
  };
}

function getFilteredImportedM3uChannels() {
  const searchFilteredChannels = state.m3uSearchQuery
    ? state.importedM3uChannels.filter((channel) => {
      const haystack = `${channel.name} ${channel.groupName} ${channel.streamUrl}`.toLowerCase();
      return haystack.includes(state.m3uSearchQuery);
    })
    : state.importedM3uChannels;

  return applyM3uScanFilter(searchFilteredChannels);
}

function mapImportedChannelToPlaybackChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    groupId: resolvePlaybackGroupId(channel),
    streamUrl: channel.streamUrl,
    imageUrl: channel.imageUrl
  };
}

function resolvePlaybackGroupId(channel) {
  if (channel.groupId && state.library.groups.some((group) => group.id === channel.groupId)) {
    return channel.groupId;
  }

  const groupName = channel.groupName?.trim();
  if (groupName) {
    const existingGroup = state.library.groups.find((group) => group.name.toLowerCase() === groupName.toLowerCase());
    if (existingGroup) {
      return existingGroup.id;
    }
  }

  return playerState.activeChannel?.groupId || "";
}

function findPlaybackChannelIndex(channels, targetChannel) {
  return channels.findIndex((channel) => isSamePlaybackChannel(channel, targetChannel));
}

function isSamePlaybackChannel(left, right) {
  if (!left || !right) {
    return false;
  }

  if (left.id && right.id && left.id === right.id) {
    return true;
  }

  return (
    left.streamUrl === right.streamUrl &&
    String(left.name || "").toLowerCase() === String(right.name || "").toLowerCase()
  );
}

async function startVideoPlayback(streamUrl) {
  clearStallRecoveryTimer();
  destroyHlsInstance();
  destroyMpegtsInstance();
  refs.playerVideo.pause();
  refs.playerVideo.removeAttribute("src");
  refs.playerVideo.load();

  if (isLikelyHlsStream(streamUrl)) {
    await ensureHlsLibraryLoaded();
  }

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
      const httpCode = extractHttpStatusFromHlsError(data);
      const forbiddenLike = httpCode === 403 || /\b403\b/.test(details);

      if (data?.fatal) {
        if (forbiddenLike) {
          browserBlockedStreamUrls.add(streamUrl);
          saveBlockedStreamUrls();
          renderChannels();
          setPlayerStatus(
            "Stream host rejected browser playback (403). Try System Player/Open External; VLC may still work.",
            "error"
          );
          return;
        }

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
        fallbackToNativePlayback(streamUrl);
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

  if (isLikelyMpegTsStream(streamUrl) && window.mpegts?.getFeatureList?.().mseLivePlayback) {
    try {
      const player = window.mpegts.createPlayer({
        type: "mpegts",
        url: streamUrl,
        isLive: true
      });

      player.attachMediaElement(refs.playerVideo);
      player.load();
      player.play().catch(() => {
        setPlayerStatus("Press play to start the stream.");
      });

      if (window.mpegts.Events?.ERROR) {
        player.on(window.mpegts.Events.ERROR, () => {
          setPlayerStatus("MPEG-TS playback failed in-browser. Try Open External or System Player.", "error");
        });
      }

      playerState.mpegtsInstance = player;
      return;
    } catch {
      setPlayerStatus("MPEG-TS stream initialization failed.", "error");
    }
  }

  refs.playerVideo.src = streamUrl;
  refs.playerVideo.preload = "auto";
  refs.playerVideo.play().catch(() => {
    setPlayerStatus("Press play to start the stream.");
  });
}

function fallbackToNativePlayback(streamUrl) {
  refs.playerVideo.src = streamUrl;
  refs.playerVideo.preload = "auto";
  refs.playerVideo.play().catch(() => {
    // no-op; status message already set by caller
  });
}

async function ensureHlsLibraryLoaded() {
  if (window.Hls) {
    return;
  }

  if (!hlsLibraryLoadPromise) {
    hlsLibraryLoadPromise = loadExternalScript(HLS_CDN_URL);
  }

  try {
    await hlsLibraryLoadPromise;
  } catch {
    setPlayerStatus("HLS library failed to load. Trying native playback.", "error");
  }
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.Hls) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Script load failed")), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Script load failed"));
    document.head.appendChild(script);
  });
}

function destroyHlsInstance() {
  if (playerState.hlsInstance) {
    playerState.hlsInstance.destroy();
    playerState.hlsInstance = null;
  }
}

function destroyMpegtsInstance() {
  if (playerState.mpegtsInstance) {
    try {
      playerState.mpegtsInstance.pause();
      playerState.mpegtsInstance.unload();
      playerState.mpegtsInstance.detachMediaElement();
      playerState.mpegtsInstance.destroy();
    } catch {
      // no-op
    }
    playerState.mpegtsInstance = null;
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

function isLikelyMpegTsStream(url) {
  return /\.(ts|m2ts)($|\?)/i.test(url) || /[?&](output|format)=ts/i.test(url);
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

  await handoffToSystemPlayer(playerState.activeChannel.streamUrl, playerState.activeChannel.name);
  setPlayerStatus("Attempted system-player handoff. Use your computer's native casting routes/devices.", "success");
}

async function onSystemPlayerClick() {
  if (!playerState.activeChannel?.streamUrl) {
    window.alert("Open a channel first.");
    return;
  }

  await handoffToSystemPlayer(playerState.activeChannel.streamUrl, playerState.activeChannel.name);
  setPlayerStatus("Attempted to open in system player.", "success");
}

async function handoffToSystemPlayer(streamUrl, channelName = "IPTV Stream") {
  const choice = window.prompt(
    "System Player options:\n1) Try VLC\n2) Download M3U file\n3) Copy Stream URL\n4) Open External tab\n\nEnter 1, 2, 3, or 4:",
    "2"
  );

  if (!choice) {
    return;
  }

  if (choice === "1") {
    const vlcUrl = `vlc://${streamUrl.replace(/^https?:\/\//i, "")}`;
    window.location.href = vlcUrl;
    return;
  }

  if (choice === "2") {
    downloadChannelAsM3u(streamUrl, channelName);
    return;
  }

  if (choice === "3") {
    await copyTextToClipboard(streamUrl);
    window.alert("Stream URL copied.");
    return;
  }

  window.open(streamUrl, "_blank", "noopener,noreferrer");
}

function downloadChannelAsM3u(streamUrl, channelName) {
  const safeName = channelName.replace(/[^a-z0-9-_ ]/gi, "").trim() || "iptv-stream";
  const content = `#EXTM3U\n#EXTINF:-1,${channelName}\n${streamUrl}\n`;
  const blob = new Blob([content], { type: "application/x-mpegURL" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${safeName}.m3u`;
  anchor.click();

  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function extractHttpStatusFromHlsError(data) {
  const candidates = [
    data?.response?.code,
    data?.response?.status,
    data?.networkDetails?.status,
    data?.networkDetails?.response?.status,
    data?.networkDetails?.statusCode
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }

  return 0;
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
    syncMiniPlayerContainer();
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

function startMiniPlayerDrag(event) {
  if (!refs.miniPlayer || refs.miniPlayer.classList.contains("hidden")) {
    return;
  }

  if (event.target.closest("button, a, input, select, textarea, label, video")) {
    return;
  }

  const dragState = playerState.miniPlayerDrag;
  clearMiniPlayerHoldTimer();

  dragState.pending = true;
  dragState.pointerId = event.pointerId;
  dragState.startClientX = event.clientX;
  dragState.startClientY = event.clientY;

  const delay = event.pointerType === "touch" ? 180 : 0;
  if (delay === 0) {
    activateMiniPlayerDrag(event.clientX, event.clientY, event.pointerId);
    return;
  }

  dragState.holdTimer = window.setTimeout(() => {
    activateMiniPlayerDrag(dragState.startClientX, dragState.startClientY, event.pointerId);
  }, delay);
}

function activateMiniPlayerDrag(clientX, clientY, pointerId) {
  const dragState = playerState.miniPlayerDrag;
  if (!dragState.pending || dragState.pointerId !== pointerId) {
    return;
  }

  const rect = refs.miniPlayer.getBoundingClientRect();
  dragState.active = true;
  dragState.pending = false;
  dragState.offsetX = clientX - rect.left;
  dragState.offsetY = clientY - rect.top;
  dragState.initialized = false;

  refs.miniPlayer.classList.add("dragging");

  refs.miniPlayer.setPointerCapture(pointerId);
}

function onMiniPlayerDragMove(event) {
  const dragState = playerState.miniPlayerDrag;
  if (dragState.pending && dragState.pointerId === event.pointerId) {
    const movedX = Math.abs(event.clientX - dragState.startClientX);
    const movedY = Math.abs(event.clientY - dragState.startClientY);
    if (movedX > 8 || movedY > 8) {
      clearMiniPlayerHoldTimer();
      dragState.pending = false;
      dragState.pointerId = null;
    }
    return;
  }

  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }

  if (!dragState.initialized) {
    const rect = refs.miniPlayer.getBoundingClientRect();
    refs.miniPlayer.style.left = `${rect.left}px`;
    refs.miniPlayer.style.top = `${rect.top}px`;
    refs.miniPlayer.style.right = "auto";
    refs.miniPlayer.style.bottom = "auto";
    dragState.initialized = true;
  }

  const miniRect = refs.miniPlayer.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - miniRect.width);
  const maxTop = Math.max(0, window.innerHeight - miniRect.height);

  const nextLeft = clamp(event.clientX - dragState.offsetX, 0, maxLeft);
  const nextTop = clamp(event.clientY - dragState.offsetY, 0, maxTop);

  refs.miniPlayer.style.left = `${nextLeft}px`;
  refs.miniPlayer.style.top = `${nextTop}px`;
  updateContentInsetsForMiniPlayer();
}

function endMiniPlayerDrag(event) {
  const dragState = playerState.miniPlayerDrag;
  if (dragState.pending && dragState.pointerId === event.pointerId) {
    clearMiniPlayerHoldTimer();
    dragState.pending = false;
    dragState.pointerId = null;
    return;
  }

  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }

  clearMiniPlayerHoldTimer();
  dragState.active = false;
  dragState.pointerId = null;
  dragState.initialized = false;
  refs.miniPlayer.classList.remove("dragging");
  updateContentInsetsForMiniPlayer();
}

function clearMiniPlayerHoldTimer() {
  const dragState = playerState.miniPlayerDrag;
  if (dragState.holdTimer) {
    window.clearTimeout(dragState.holdTimer);
    dragState.holdTimer = null;
  }
}

function resetMiniPlayerPosition() {
  refs.miniPlayer.style.removeProperty("left");
  refs.miniPlayer.style.removeProperty("top");
  refs.miniPlayer.style.removeProperty("right");
  refs.miniPlayer.style.removeProperty("bottom");
}

function updateContentInsetsForMiniPlayer() {
  if (!state.settings.avoidMiniOverlap) {
    refs.appShell.style.removeProperty("--content-mini-inset-right");
    refs.appShell.style.removeProperty("--content-mini-inset-bottom");
    return;
  }

  const miniVisible = !refs.miniPlayer.classList.contains("hidden") && refs.miniPlayer.isConnected;
  if (!miniVisible) {
    refs.appShell.style.removeProperty("--content-mini-inset-right");
    refs.appShell.style.removeProperty("--content-mini-inset-bottom");
    return;
  }

  const rect = refs.miniPlayer.getBoundingClientRect();
  const inRightHalf = rect.left + rect.width / 2 > window.innerWidth / 2;
  const inBottomHalf = rect.top + rect.height / 2 > window.innerHeight / 2;

  refs.appShell.style.setProperty("--content-mini-inset-right", inRightHalf ? `${Math.ceil(rect.width + 18)}px` : "0px");
  refs.appShell.style.setProperty("--content-mini-inset-bottom", inBottomHalf ? `${Math.ceil(rect.height + 18)}px` : "0px");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function syncMiniPlayerContainer() {
  const miniIsVisible = !refs.miniPlayer.classList.contains("hidden");

  if (miniIsVisible && refs.m3uDialog.open) {
    if (refs.miniPlayer.parentElement !== refs.m3uDialog) {
      refs.m3uDialog.appendChild(refs.miniPlayer);
    }
    return;
  }

  if (refs.miniPlayer.parentElement !== refs.appShell) {
    refs.appShell.appendChild(refs.miniPlayer);
  }

  updateContentInsetsForMiniPlayer();
}

function loadBlockedStreamUrls() {
  try {
    const raw = localStorage.getItem(BLOCKED_STREAMS_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);
    return normalizeBlockedStreamUrls(parsed);
  } catch {
    return new Set();
  }
}

function saveBlockedStreamUrls() {
  localStorage.setItem(BLOCKED_STREAMS_KEY, JSON.stringify([...browserBlockedStreamUrls]));
}

function loadChannelScanResults() {
  try {
    const raw = localStorage.getItem(CHANNEL_SCAN_RESULTS_KEY);
    if (!raw) {
      return new Map();
    }

    const parsed = JSON.parse(raw);
    return normalizeScanResultsMap(parsed);
  } catch {
    return new Map();
  }
}

function saveChannelScanResults() {
  const data = Object.fromEntries(channelScanResults.entries());
  localStorage.setItem(CHANNEL_SCAN_RESULTS_KEY, JSON.stringify(data));
}

function loadImportedM3uState() {
  try {
    const raw = localStorage.getItem(IMPORTED_M3U_STATE_KEY);
    if (!raw) {
      return normalizeImportedM3uState();
    }

    const parsed = JSON.parse(raw);

    return normalizeImportedM3uState(parsed);
  } catch {
    return normalizeImportedM3uState();
  }
}

function saveImportedM3uState() {
  const payload = {
    channels: state.importedM3uChannels,
    scanResults: Object.fromEntries(state.importedM3uScanResults.entries()),
    searchQuery: state.m3uSearchQuery,
    scanFilter: state.m3uScanFilter
  };

  localStorage.setItem(IMPORTED_M3U_STATE_KEY, JSON.stringify(payload));
}

function openSettingsDialog() {
  hydrateSettingsUi();
  refs.settingsDialog.showModal();
}

function hydrateSettingsUi() {
  refs.settingsDefaultAspect.value = state.settings.defaultAspect;
  refs.settingsAvoidMiniOverlap.checked = Boolean(state.settings.avoidMiniOverlap);
  refs.settingsAutoPipOnMinimize.checked = Boolean(state.settings.autoPipOnMinimize);
}

function onSettingsSubmit(event) {
  event.preventDefault();

  state.settings.defaultAspect = ASPECT_MODES.includes(refs.settingsDefaultAspect.value)
    ? refs.settingsDefaultAspect.value
    : "fit";
  state.settings.avoidMiniOverlap = refs.settingsAvoidMiniOverlap.checked;
  state.settings.autoPipOnMinimize = refs.settingsAutoPipOnMinimize.checked;
  playerState.aspectMode = state.settings.defaultAspect;

  saveSettings();
  applyAspectMode(playerState.aspectMode);
  updateContentInsetsForMiniPlayer();
  refs.settingsDialog.close();
}

function loadSettings() {
  const fallback = {
    defaultAspect: "fit",
    avoidMiniOverlap: true,
    autoPipOnMinimize: false,
    volumeBoost: 1
  };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      defaultAspect: ASPECT_MODES.includes(parsed?.defaultAspect) ? parsed.defaultAspect : fallback.defaultAspect,
      avoidMiniOverlap: typeof parsed?.avoidMiniOverlap === "boolean" ? parsed.avoidMiniOverlap : fallback.avoidMiniOverlap,
      autoPipOnMinimize:
        typeof parsed?.autoPipOnMinimize === "boolean" ? parsed.autoPipOnMinimize : fallback.autoPipOnMinimize,
      volumeBoost: BOOST_LEVELS.includes(parsed?.volumeBoost) ? parsed.volumeBoost : fallback.volumeBoost
    };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadChannelHistory() {
  try {
    const raw = localStorage.getItem(CHANNEL_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item.streamUrl === "string")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : createId("history"),
        name: typeof item.name === "string" ? item.name : "Channel",
        groupId: typeof item.groupId === "string" ? item.groupId : "",
        groupName: typeof item.groupName === "string" ? item.groupName : "Channel",
        streamUrl: item.streamUrl,
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
        playedAt: typeof item.playedAt === "string" ? item.playedAt : new Date().toISOString()
      }))
      .slice(0, CHANNEL_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveChannelHistory() {
  localStorage.setItem(CHANNEL_HISTORY_KEY, JSON.stringify(state.channelHistory));
}

function pruneBlockedStreamUrls() {
  const activeStreamUrls = new Set(state.library.channels.map((channel) => channel.streamUrl));
  let changed = false;

  for (const url of browserBlockedStreamUrls) {
    if (!activeStreamUrls.has(url)) {
      browserBlockedStreamUrls.delete(url);
      changed = true;
    }
  }

  if (changed) {
    saveBlockedStreamUrls();
  }
}

function pruneChannelScanResults() {
  const activeStreamUrls = new Set(state.library.channels.map((channel) => channel.streamUrl));
  let changed = false;

  for (const url of channelScanResults.keys()) {
    if (!activeStreamUrls.has(url)) {
      channelScanResults.delete(url);
      changed = true;
    }
  }

  if (changed) {
    saveChannelScanResults();
  }
}

function applyImageWithFallback(imageElement, imageUrl, altText) {
  const normalizedUrl = normalizeImageUrl(imageUrl);

  imageElement.alt = altText;
  if (!normalizedUrl || failedImageUrls.has(normalizedUrl)) {
    imageElement.removeAttribute("src");
    return;
  }

  imageElement.src = normalizedUrl;
  imageElement.addEventListener(
    "error",
    () => {
      failedImageUrls.add(normalizedUrl);
      imageElement.removeAttribute("src");
    },
    { once: true }
  );
}
