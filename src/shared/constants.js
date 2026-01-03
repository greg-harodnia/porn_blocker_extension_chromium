// Shared constants for the extension
export const STORAGE_KEYS = {
  userBlocklist: "userBlocklist",
  totalBlocked: "totalBlocked",
  urlKeywordBlocking: "urlKeywordBlocking",
  userNotes: "userNotes"
};

export const RULESET_ID_BASE = 1000;
export const RULE_PRIORITY = 1;

export const MESSAGE_TYPES = {
  getUrlKeywordToggle: "getUrlKeywordToggle",
  setUrlKeywordToggle: "setUrlKeywordToggle",
  getKeywords: "getKeywords",
  contentBlocked: "contentBlocked",
  getState: "getState",
  addSite: "addSite",
  removeSite: "removeSite"
};

export const RESOURCE_TYPES = {
  main_frame: "main_frame"
};
