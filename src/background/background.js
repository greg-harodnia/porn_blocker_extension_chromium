// Background service worker for porn blocker extension
import { STORAGE_KEYS, RULESET_ID_BASE, RULE_PRIORITY, MESSAGE_TYPES, RESOURCE_TYPES } from '../shared/constants.js';
import { normalizeDomain, normalizeKeyword, createResponse } from '../shared/utils.js';
import { 
  loadSeedBlocklist, 
  loadSeedKeywords, 
  getUserBlocklist, 
  setUserBlocklist, 
  getTotalBlocked,
  incrementTotalBlocked,
  initializeTotalBlocked,
  getUrlKeywordToggle,
  setUrlKeywordToggle
} from '../shared/storage.js';

// Rule management
class RuleManager {
  static buildRules(domains, keywords) {
    const rules = [];
    let id = RULESET_ID_BASE;

    for (const domain of domains) {
      rules.push({
        id,
        priority: RULE_PRIORITY,
        action: {
          type: "redirect",
          redirect: {
            extensionPath: "/src/components/safe-page/safe.html"
          }
        },
        condition: {
          urlFilter: `||${domain}^`,
          resourceTypes: [RESOURCE_TYPES.main_frame]
        }
      });
      id += 1;
    }

    for (const keyword of keywords) {
      rules.push({
        id,
        priority: RULE_PRIORITY,
        action: {
          type: "redirect",
          redirect: {
            extensionPath: "/src/components/safe-page/safe.html"
          }
        },
        condition: {
          urlFilter: `*${keyword}*`,
          resourceTypes: [RESOURCE_TYPES.main_frame]
        }
      });
      id += 1;
    }

    return rules;
  }

  static async syncDynamicRules(domains, keywords) {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map((r) => r.id);
    const addRules = this.buildRules(domains, keywords);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  }
}

// Initialization
class ExtensionInitializer {
  static async ensureInitialized() {
    try {
      const [seed, user, urlKeywordBlockingEnabled] = await Promise.all([
        loadSeedBlocklist().catch(() => []),
        getUserBlocklist(),
        getUrlKeywordToggle()
      ]);

      const merged = Array.from(new Set([...seed, ...user])).sort();

      if (urlKeywordBlockingEnabled) {
        const keywords = await loadSeedKeywords().catch(() => []);
        await RuleManager.syncDynamicRules(merged, keywords);
      } else {
        await RuleManager.syncDynamicRules(merged, []);
      }

      await initializeTotalBlocked();
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  }
}

// Message handlers
class MessageHandler {
  static async handleGetUrlKeywordToggle() {
    const enabled = await getUrlKeywordToggle();
    return { ok: true, enabled }; // Original format - direct properties
  }

  static async handleSetUrlKeywordToggle(message) {
    const enabled = message.enabled === true;
    await setUrlKeywordToggle(enabled);
    await ExtensionInitializer.ensureInitialized();
    return { ok: true, message: enabled ? "URL keyword blocking enabled" : "URL keyword blocking disabled" }; // Original format
  }

  static async handleGetKeywords() {
    const keywords = await loadSeedKeywords().catch(() => []);
    return createResponse(true, { keywords });
  }

  static async handleContentBlocked() {
    await incrementTotalBlocked();
    return createResponse(true);
  }

  static async handleGetState() {
    await ExtensionInitializer.ensureInitialized();
    const [seed, user, totalBlocked] = await Promise.all([
      loadSeedBlocklist().catch(() => []),
      getUserBlocklist(),
      getTotalBlocked()
    ]);
    const merged = Array.from(new Set([...seed, ...user])).sort();
    return { ok: true, totalBlocked, blocklist: merged, userBlocklist: user }; // Original format
  }

  static async handleAddSite(message) {
    const domain = normalizeDomain(message.domain);
    if (!domain) {
      return createResponse(false, null, "Please enter a valid domain (example.com)");
    }

    const user = await getUserBlocklist();
    if (!user.includes(domain)) user.push(domain);
    const updatedUser = await setUserBlocklist(user);

    const [seed, keywords] = await Promise.all([
      loadSeedBlocklist().catch(() => []),
      loadSeedKeywords().catch(() => [])
    ]);
    const merged = Array.from(new Set([...seed, ...updatedUser])).sort();
    await RuleManager.syncDynamicRules(merged, keywords);

    return createResponse(true, { 
      added: domain, 
      userBlocklist: updatedUser, 
      blocklist: merged 
    });
  }

  static async handleRemoveSite(message) {
    const domain = normalizeDomain(message.domain);
    if (!domain) {
      return createResponse(false, null, "Please enter a valid domain (example.com)");
    }

    const user = await getUserBlocklist();
    const updatedUser = user.filter((d) => d !== domain);
    await setUserBlocklist(updatedUser);

    const [seed, keywords] = await Promise.all([
      loadSeedBlocklist().catch(() => []),
      loadSeedKeywords().catch(() => [])
    ]);
    const merged = Array.from(new Set([...seed, ...updatedUser])).sort();
    await RuleManager.syncDynamicRules(merged, keywords);

    return createResponse(true, { 
      removed: domain, 
      userBlocklist: updatedUser, 
      blocklist: merged 
    });
  }
}

// Event listeners
chrome.runtime.onInstalled.addListener(() => {
  ExtensionInitializer.ensureInitialized().catch(() => {});
});

chrome.runtime.onStartup?.addListener(() => {
  ExtensionInitializer.ensureInitialized().catch(() => {});
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    if (!info || !info.rule) return;
    if (typeof info.rule.ruleId !== "number" || info.rule.ruleId < RULESET_ID_BASE) return;
    await incrementTotalBlocked();
  });
}

// Message routing
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== "string") {
      sendResponse(createResponse(false, null, "Invalid message"));
      return;
    }

    try {
      let response;
      switch (message.type) {
        case MESSAGE_TYPES.getUrlKeywordToggle:
          response = await MessageHandler.handleGetUrlKeywordToggle();
          break;
        case MESSAGE_TYPES.setUrlKeywordToggle:
          response = await MessageHandler.handleSetUrlKeywordToggle(message);
          break;
        case MESSAGE_TYPES.getKeywords:
          response = await MessageHandler.handleGetKeywords();
          break;
        case MESSAGE_TYPES.contentBlocked:
          response = await MessageHandler.handleContentBlocked();
          break;
        case MESSAGE_TYPES.getState:
          response = await MessageHandler.handleGetState();
          break;
        case MESSAGE_TYPES.addSite:
          response = await MessageHandler.handleAddSite(message);
          break;
        case MESSAGE_TYPES.removeSite:
          response = await MessageHandler.handleRemoveSite(message);
          break;
        default:
          response = createResponse(false, null, "Unknown message type");
      }
      sendResponse(response);
    } catch (error) {
      sendResponse(createResponse(false, null, String(error?.message || error)));
    }
  })();

  return true;
});

// Initial setup
ExtensionInitializer.ensureInitialized().catch(() => {});
