
const STORAGE_KEYS = {
  userBlocklist: "userBlocklist",
  totalBlocked: "totalBlocked",
  urlKeywordBlocking: "urlKeywordBlocking"
};

const RULESET_ID_BASE = 1000;
const RULE_PRIORITY = 1;

function normalizeDomain(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^\*\./, "");
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/.*/, "");
  s = s.replace(/:.*/, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\.+$/, "");

  if (!s) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (!s.includes(".")) return null;
  return s;
}

async function loadSeedBlocklist() {
  const url = chrome.runtime.getURL("blocklist.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load blocklist.json: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeDomain).filter(Boolean);
}

function normalizeKeyword(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[^a-z0-9- ]/g, "");
  s = s.trim();
  if (!s) return null;
  return s;
}

async function loadSeedKeywords() {
  const url = chrome.runtime.getURL("keywords.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load keywords.json: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeKeyword).filter(Boolean);
}

async function getUserBlocklist() {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.userBlocklist);
  const list = obj[STORAGE_KEYS.userBlocklist];
  if (!Array.isArray(list)) return [];
  return list.map(normalizeDomain).filter(Boolean);
}

async function setUserBlocklist(list) {
  const normalized = Array.from(new Set(list.map(normalizeDomain).filter(Boolean))).sort();
  await chrome.storage.local.set({
    [STORAGE_KEYS.userBlocklist]: normalized
  });
  return normalized;
}

function buildRules(domains, keywords) {
  const rules = [];
  let id = RULESET_ID_BASE;

  for (const domain of domains) {
    rules.push({
      id,
      priority: RULE_PRIORITY,
      action: { type: "block" },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame"]
      }
    });
    id += 1;
  }

  for (const keyword of keywords) {
    rules.push({
      id,
      priority: RULE_PRIORITY,
      action: { type: "block" },
      condition: {
        urlFilter: `*${keyword}*`,
        resourceTypes: ["main_frame"]
      }
    });
    id += 1;
  }

  return rules;
}

async function syncDynamicRules(domains, keywords) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const addRules = buildRules(domains, keywords);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

async function ensureInitialized() {
  const seed = await loadSeedBlocklist();
  const user = await getUserBlocklist();
  const merged = Array.from(new Set([...seed, ...user])).sort();
  
  // Check if URL keyword blocking is enabled
  const settings = await chrome.storage.local.get(STORAGE_KEYS.urlKeywordBlocking);
  const urlKeywordBlockingEnabled = settings[STORAGE_KEYS.urlKeywordBlocking] === true;
  
  if (urlKeywordBlockingEnabled) {
    const keywords = await loadSeedKeywords().catch(() => []);
    await syncDynamicRules(merged, keywords);
  } else {
    await syncDynamicRules(merged, []);
  }

  const obj = await chrome.storage.local.get(STORAGE_KEYS.totalBlocked);
  if (typeof obj[STORAGE_KEYS.totalBlocked] !== "number") {
    await chrome.storage.local.set({ [STORAGE_KEYS.totalBlocked]: 0 });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialized().catch(() => {});
});

chrome.runtime.onStartup?.addListener(() => {
  ensureInitialized().catch(() => {});
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    if (!info || !info.rule) return;
    if (typeof info.rule.ruleId !== "number" || info.rule.ruleId < RULESET_ID_BASE) return;
    const obj = await chrome.storage.local.get(STORAGE_KEYS.totalBlocked);
    const current = typeof obj[STORAGE_KEYS.totalBlocked] === "number" ? obj[STORAGE_KEYS.totalBlocked] : 0;
    await chrome.storage.local.set({ [STORAGE_KEYS.totalBlocked]: current + 1 });
  });
}

ensureInitialized().catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== "string") {
      sendResponse({ ok: false, error: "Invalid message" });
      return;
    }

    if (message.type === "getUrlKeywordToggle") {
      const obj = await chrome.storage.local.get(STORAGE_KEYS.urlKeywordBlocking);
      const enabled = obj[STORAGE_KEYS.urlKeywordBlocking] === true;
      sendResponse({ ok: true, enabled });
      return;
    }

    if (message.type === "setUrlKeywordToggle") {
      const enabled = message.enabled === true;
      await chrome.storage.local.set({ [STORAGE_KEYS.urlKeywordBlocking]: enabled });
      
      // Re-initialize blocking rules with new setting
      await ensureInitialized();
      
      sendResponse({ ok: true, message: enabled ? "URL keyword blocking enabled" : "URL keyword blocking disabled" });
      return;
    }

    if (message.type === "contentBlocked") {
      const obj = await chrome.storage.local.get(STORAGE_KEYS.totalBlocked);
      const current = typeof obj[STORAGE_KEYS.totalBlocked] === "number" ? obj[STORAGE_KEYS.totalBlocked] : 0;
      await chrome.storage.local.set({ [STORAGE_KEYS.totalBlocked]: current + 1 });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "getState") {
      await ensureInitialized();
      const [seed, user, stats] = await Promise.all([
        loadSeedBlocklist().catch(() => []),
        getUserBlocklist(),
        chrome.storage.local.get(STORAGE_KEYS.totalBlocked)
      ]);
      const merged = Array.from(new Set([...seed, ...user])).sort();
      const totalBlocked = typeof stats[STORAGE_KEYS.totalBlocked] === "number" ? stats[STORAGE_KEYS.totalBlocked] : 0;
      sendResponse({ ok: true, totalBlocked, blocklist: merged, userBlocklist: user });
      return;
    }

    if (message.type === "addSite") {
      const domain = normalizeDomain(message.domain);
      if (!domain) {
        sendResponse({ ok: false, error: "Please enter a valid domain (example.com)" });
        return;
      }

      const user = await getUserBlocklist();
      if (!user.includes(domain)) user.push(domain);
      const updatedUser = await setUserBlocklist(user);

      const seed = await loadSeedBlocklist().catch(() => []);
      const keywords = await loadSeedKeywords().catch(() => []);
      const merged = Array.from(new Set([...seed, ...updatedUser])).sort();
      await syncDynamicRules(merged, keywords);

      sendResponse({ ok: true, added: domain, userBlocklist: updatedUser, blocklist: merged });
      return;
    }

    if (message.type === "removeSite") {
      const domain = normalizeDomain(message.domain);
      if (!domain) {
        sendResponse({ ok: false, error: "Please enter a valid domain (example.com)" });
        return;
      }

      const user = await getUserBlocklist();
      const updatedUser = user.filter((d) => d !== domain);
      await setUserBlocklist(updatedUser);

      const seed = await loadSeedBlocklist().catch(() => []);
      const keywords = await loadSeedKeywords().catch(() => []);
      const merged = Array.from(new Set([...seed, ...updatedUser])).sort();
      await syncDynamicRules(merged, keywords);

      sendResponse({ ok: true, removed: domain, userBlocklist: updatedUser, blocklist: merged });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })().catch((err) => {
    sendResponse({ ok: false, error: String(err?.message || err) });
  });

  return true;
});

