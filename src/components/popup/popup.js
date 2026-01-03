// Popup script for managing blocked sites

// Constants
const STORAGE_KEYS = {
  userBlocklist: "userBlocklist",
  totalBlocked: "totalBlocked",
  urlKeywordBlocking: "urlKeywordBlocking",
  userNotes: "userNotes"
};

const MESSAGE_TYPES = {
  getUrlKeywordToggle: "getUrlKeywordToggle",
  setUrlKeywordToggle: "setUrlKeywordToggle",
  getKeywords: "getKeywords",
  contentBlocked: "contentBlocked",
  getState: "getState",
  addSite: "addSite",
  removeSite: "removeSite"
};

// Utility functions
function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => resolve(response));
    } catch (_e) {
      resolve(null);
    }
  });
}

class PopupUI {
  static setStatus(text, kind) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("error");
    el.classList.remove("ok");
    if (kind === "error") el.classList.add("error");
    if (kind === "ok") el.classList.add("ok");
  }

  static renderBlocklist(domains) {
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
        PopupController.removeDomain(d).catch((e) => PopupUI.setStatus(String(e?.message || e), "error"));
      });

      row.appendChild(label);
      row.appendChild(btn);
      li.appendChild(row);
      ul.appendChild(li);
    }
  }
}

class PopupController {
  static async refresh() {
    const res = await sendMessage({ type: MESSAGE_TYPES.getState });
    if (!res || !res.ok) {
      PopupUI.setStatus(res?.error || "Failed to load state", "error");
      return;
    }

    document.getElementById("totalBlocked").textContent = String(res.totalBlocked ?? 0);
    PopupUI.renderBlocklist(res.userBlocklist || []);

    // Load toggle state
    const toggleRes = await sendMessage({ type: MESSAGE_TYPES.getUrlKeywordToggle });
    console.log('Toggle state loaded:', toggleRes); // Debug log
    if (toggleRes && toggleRes.ok) {
      const enabled = toggleRes.enabled;
      document.getElementById("urlKeywordToggle").checked = enabled;
      console.log('Toggle checkbox set to:', enabled); // Debug log
    } else {
      console.error('Failed to load toggle state:', toggleRes); // Debug log
    }

    PopupUI.setStatus("", null);
  }

  static async addDomain() {
    const input = document.getElementById("domainInput");
    const addBtn = document.getElementById("addBtn");
    const raw = input.value;

    addBtn.disabled = true;
    PopupUI.setStatus("Adding...", null);

    const res = await sendMessage({ type: MESSAGE_TYPES.addSite, domain: raw });
    addBtn.disabled = false;

    if (!res || !res.ok) {
      PopupUI.setStatus(res?.error || "Failed to add site", "error");
      return;
    }

    input.value = "";
    PopupUI.setStatus(`Added: ${res.added}`, "ok");
    console.log('Add site response:', res); // Debug log
    console.log('User blocklist from response:', res.userBlocklist); // Debug log
    
    // Refresh the entire state to ensure UI is updated correctly
    await PopupController.refresh();
  }

  static async removeDomain(domain) {
    PopupUI.setStatus("Removing...", null);
    const res = await sendMessage({ type: MESSAGE_TYPES.removeSite, domain });
    if (!res || !res.ok) {
      PopupUI.setStatus(res?.error || "Failed to remove site", "error");
      return;
    }
    PopupUI.setStatus(`Removed: ${res.removed}`, "ok");
    console.log('Remove site response:', res); // Debug log
    console.log('User blocklist from response:', res.userBlocklist); // Debug log
    
    // Refresh the entire state to ensure UI is updated correctly
    await PopupController.refresh();
  }
}

// Initialize event listeners
document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addBtn");
  const input = document.getElementById("domainInput");
  const urlKeywordToggle = document.getElementById("urlKeywordToggle");

  addBtn.addEventListener("click", () => {
    PopupController.addDomain().catch((e) => PopupUI.setStatus(String(e?.message || e), "error"));
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addBtn.click();
  });

  urlKeywordToggle.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    console.log('Toggle changed to:', enabled); // Debug log
    const res = await sendMessage({ type: MESSAGE_TYPES.setUrlKeywordToggle, enabled });
    if (res && res.ok) {
      PopupUI.setStatus(res.message || "Setting updated", "ok");
      console.log('Toggle saved successfully:', res.message); // Debug log
    } else {
      PopupUI.setStatus(res?.error || "Failed to update setting", "error");
      console.error('Toggle save failed:', res); // Debug log
      // Revert the toggle if save failed
      e.target.checked = !enabled;
    }
  });

  PopupController.refresh().catch((e) => PopupUI.setStatus(String(e?.message || e), "error"));
});
