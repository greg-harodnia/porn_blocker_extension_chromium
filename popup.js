function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response);
    });
  });
}

function setStatus(text, kind) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("error");
  el.classList.remove("ok");
  if (kind === "error") el.classList.add("error");
  if (kind === "ok") el.classList.add("ok");
}

function renderBlocklist(domains) {
  const ul = document.getElementById("blocklist");
  ul.innerHTML = "";

  if (!domains || domains.length === 0) {
    const li = document.createElement("li");
    li.textContent = "(empty)";
    ul.appendChild(li);
    return;
  }

  for (const d of domains) {
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "listRow";

    const label = document.createElement("span");
    label.textContent = d;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "removeBtn";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      removeDomain(d).catch((e) => setStatus(String(e?.message || e), "error"));
    });

    row.appendChild(label);
    row.appendChild(btn);
    li.appendChild(row);
    ul.appendChild(li);
  }
}

async function refresh() {
  const res = await sendMessage({ type: "getState" });
  if (!res || !res.ok) {
    setStatus(res?.error || "Failed to load state", "error");
    return;
  }

  document.getElementById("totalBlocked").textContent = String(res.totalBlocked ?? 0);
  renderBlocklist(res.userBlocklist || []);

  // Load toggle state
  const toggleRes = await sendMessage({ type: "getUrlKeywordToggle" });
  if (toggleRes && toggleRes.ok) {
    document.getElementById("urlKeywordToggle").checked = toggleRes.enabled;
  }

  setStatus("", null);
}

async function addDomain() {
  const input = document.getElementById("domainInput");
  const addBtn = document.getElementById("addBtn");
  const raw = input.value;

  addBtn.disabled = true;
  setStatus("Adding...", null);

  const res = await sendMessage({ type: "addSite", domain: raw });
  addBtn.disabled = false;

  if (!res || !res.ok) {
    setStatus(res?.error || "Failed to add site", "error");
    return;
  }

  input.value = "";
  setStatus(`Added: ${res.added}`, "ok");
  renderBlocklist(res.userBlocklist || []);
}

async function removeDomain(domain) {
  setStatus("Removing...", null);
  const res = await sendMessage({ type: "removeSite", domain });
  if (!res || !res.ok) {
    setStatus(res?.error || "Failed to remove site", "error");
    return;
  }
  setStatus(`Removed: ${res.removed}`, "ok");
  renderBlocklist(res.userBlocklist || []);
}

document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addBtn");
  const input = document.getElementById("domainInput");
  const urlKeywordToggle = document.getElementById("urlKeywordToggle");

  addBtn.addEventListener("click", () => {
    addDomain().catch((e) => setStatus(String(e?.message || e), "error"));
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addBtn.click();
  });

  urlKeywordToggle.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    const res = await sendMessage({ type: "setUrlKeywordToggle", enabled });
    if (res && res.ok) {
      setStatus(res.message || "", res.ok ? "ok" : "error");
    } else {
      setStatus(res?.error || "Failed to update setting", "error");
    }
  });

  refresh().catch((e) => setStatus(String(e?.message || e), "error"));
});
