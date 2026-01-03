// Content script for redirecting blocked sites to safe page
import { sendMessage } from '../shared/utils.js';
import { MESSAGE_TYPES } from '../shared/constants.js';

async function redirectToSafePage() {
    const currentUrl = window.location.href;
    const safePageUrl = chrome.runtime.getURL(`src/components/safe-page/safe.html?url=${encodeURIComponent(currentUrl)}`);
    window.location.replace(safePageUrl);
}

// Check if current page should be redirected
(async () => {
    const res = await sendMessage({ type: MESSAGE_TYPES.getState });
    if (res && res.ok && res.data.blocklist) {
        const currentUrl = window.location.href;
        const currentDomain = window.location.hostname.replace(/^www\./, '');

        // Check if current domain is in blocklist
        if (res.data.blocklist.includes(currentDomain)) {
            await redirectToSafePage();
            return;
        }

        // Check if URL contains blocked keywords (if keyword blocking is enabled)
        const toggleRes = await sendMessage({ type: MESSAGE_TYPES.getUrlKeywordToggle });
        if (toggleRes && toggleRes.ok && toggleRes.data.enabled) {
            const keywordsRes = await sendMessage({ type: MESSAGE_TYPES.getKeywords });
            if (keywordsRes && keywordsRes.ok && keywordsRes.data.keywords) {
                const urlLower = currentUrl.toLowerCase();
                for (const keyword of keywordsRes.data.keywords) {
                    if (urlLower.includes(keyword.toLowerCase())) {
                        await redirectToSafePage();
                        return;
                    }
                }
            }
        }
    }
})();
