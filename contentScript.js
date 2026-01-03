// Content script for redirecting blocked sites to safe page

function sendMessage(msg) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(msg, (response) => resolve(response));
        } catch (_e) {
            resolve(null);
        }
    });
}

async function redirectToSafePage() {
    const currentUrl = window.location.href;
    const safePageUrl = chrome.runtime.getURL(`safe.html?url=${encodeURIComponent(currentUrl)}`);
    window.location.replace(safePageUrl);
}

// Check if current page should be redirected
(async () => {
    const res = await sendMessage({ type: "getState" });
    if (res && res.ok && res.blocklist) {
        const currentUrl = window.location.href;
        const currentDomain = window.location.hostname.replace(/^www\./, '');

        // Check if current domain is in blocklist
        if (res.blocklist.includes(currentDomain)) {
            await redirectToSafePage();
            return;
        }

        // Check if URL contains blocked keywords (if keyword blocking is enabled)
        const toggleRes = await sendMessage({ type: "getUrlKeywordToggle" });
        if (toggleRes && toggleRes.ok && toggleRes.enabled) {
            const keywordsRes = await sendMessage({ type: "getKeywords" });
            if (keywordsRes && keywordsRes.ok && keywordsRes.keywords) {
                const urlLower = currentUrl.toLowerCase();
                for (const keyword of keywordsRes.keywords) {
                    if (urlLower.includes(keyword.toLowerCase())) {
                        await redirectToSafePage();
                        return;
                    }
                }
            }
        }
    }
})();
