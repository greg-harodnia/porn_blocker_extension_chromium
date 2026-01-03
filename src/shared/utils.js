// Shared utility functions
export function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => resolve(response));
    } catch (_e) {
      resolve(null);
    }
  });
}

export function normalizeDomain(input) {
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

export function normalizeKeyword(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[^a-z0-9- ]/g, "");
  s = s.trim();
  if (!s) return null;
  return s;
}

export function getQueryParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name) || "";
}

export function createResponse(ok, data = null, error = null) {
  const response = { ok };
  if (data !== null) response.data = data;
  if (error) response.error = error;
  return response;
}
