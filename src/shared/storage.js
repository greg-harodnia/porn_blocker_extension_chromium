// Storage management utilities
import { STORAGE_KEYS } from './constants.js';

export async function loadSeedBlocklist() {
  const url = chrome.runtime.getURL("src/data/blocklist.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load blocklist.json: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(domain => domain.trim().toLowerCase()).filter(Boolean);
}

export async function loadSeedKeywords() {
  const url = chrome.runtime.getURL("src/data/keywords.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load keywords.json: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(keyword => keyword.trim().toLowerCase()).filter(Boolean);
}

export async function getUserBlocklist() {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.userBlocklist);
  const list = obj[STORAGE_KEYS.userBlocklist];
  if (!Array.isArray(list)) return [];
  return list.map(domain => domain.trim().toLowerCase()).filter(Boolean);
}

export async function setUserBlocklist(list) {
  const normalized = Array.from(new Set(list.map(domain => domain.trim().toLowerCase()).filter(Boolean))).sort();
  await chrome.storage.local.set({
    [STORAGE_KEYS.userBlocklist]: normalized
  });
  return normalized;
}

export async function getTotalBlocked() {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.totalBlocked);
  return typeof obj[STORAGE_KEYS.totalBlocked] === "number" ? obj[STORAGE_KEYS.totalBlocked] : 0;
}

export async function incrementTotalBlocked() {
  const current = await getTotalBlocked();
  await chrome.storage.local.set({ [STORAGE_KEYS.totalBlocked]: current + 1 });
  return current + 1;
}

export async function initializeTotalBlocked() {
  const current = await getTotalBlocked();
  if (typeof current !== "number") {
    await chrome.storage.local.set({ [STORAGE_KEYS.totalBlocked]: 0 });
    return 0;
  }
  return current;
}

export async function getUrlKeywordToggle() {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.urlKeywordBlocking);
  return obj[STORAGE_KEYS.urlKeywordBlocking] === true;
}

export async function setUrlKeywordToggle(enabled) {
  await chrome.storage.local.set({ [STORAGE_KEYS.urlKeywordBlocking]: enabled });
  return enabled;
}

export async function getUserNotes() {
  try {
    const obj = await chrome.storage.local.get(STORAGE_KEYS.userNotes);
    return obj[STORAGE_KEYS.userNotes] || [];
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
}

export async function setUserNotes(notes) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.userNotes]: notes });
  } catch (error) {
    console.error('Error saving notes:', error);
  }
}
