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
      streamUrl: "https://example.com/cartoon.m3u8",
      imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "ch-cinema",
      name: "Cinema Plus",
      groupId: "group-movies",
      streamUrl: "https://example.com/cinema.m3u8",
      imageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80"
    }
  ]
};

const state = {
  library: loadLibrary(),
  selectedGroupId: "all"
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
  channelCardTemplate: document.getElementById("channelCardTemplate")
};

initialize();

function initialize() {
  bindEvents();
  render();
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

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.close);
      dialog.close();
    });
  });
}

function render() {
  renderGroups();
  renderChannels();
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
    const imageIsReachable = await validateImageUrlReachable(payload.imageUrl);
    if (!imageIsReachable) {
      setImageFeedback("Image URL could not be reached. Please use a valid public internet image URL.", "error");
      setImagePreview("");
      refs.channelImage.focus();
      return;
    }

    setImageFeedback("Image URL looks good.", "success");
    setImagePreview(payload.imageUrl);
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

  state.library.channels = state.library.channels.filter((item) => item.id !== channelId);
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

  const imageIsReachable = await validateImageUrlReachable(normalizedUrl);
  if (!imageIsReachable) {
    setImageFeedback("Image URL could not be reached.", "error");
    setImagePreview("");
    return;
  }

  setImageFeedback("Image URL looks good.", "success");
  setImagePreview(normalizedUrl);
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
