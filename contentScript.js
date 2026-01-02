let keywordsCache = null;
let blocked = false;
let observer = null;
let debounceTimer = null;

function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => resolve(response));
    } catch (_e) {
      resolve(null);
    }
  });
}

async function getKeywords() {
  if (Array.isArray(keywordsCache)) return keywordsCache;
  const res = await sendMessage({ type: "getKeywords" });
  if (res && res.ok && Array.isArray(res.keywords)) {
    keywordsCache = res.keywords;
    return keywordsCache;
  }
  keywordsCache = [];
  return keywordsCache;
}

function findMatch(text, keywords) {
  if (!text) return null;
  const hay = text.toLowerCase();
  for (const kw of keywords) {
    if (!kw) continue;
    if (hay.includes(kw)) return kw;
  }
  return null;
}

async function blockPage(keyword) {
  if (blocked) return;
  blocked = true;

  await sendMessage({ type: "contentBlocked", url: location.href, keyword });

  const target = chrome.runtime.getURL(
    `blocked.html?reason=content&keyword=${encodeURIComponent(keyword)}&url=${encodeURIComponent(location.href)}`
  );
  location.replace(target);
}

async function scanNow() {
  if (blocked) return;
  const keywords = await getKeywords();
  if (!keywords || keywords.length === 0) return;

  const body = document.body;
  if (!body) return;

  const text = body.innerText || body.textContent || "";
  const match = findMatch(text, keywords);
  if (match) {
    await blockPage(match);
  }
}

function scheduleScan() {
  if (blocked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    scanNow().catch(() => {});
  }, 400);
}

function startObserving() {
  if (observer || !document.body) return;
  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

(async () => {
  await scanNow().catch(() => {});
  startObserving();
  scheduleScan();
})();
