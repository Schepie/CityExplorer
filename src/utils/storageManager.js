/**
 * Centralized Storage Manager
 * Handles safe localStorage writes with automatic purging on QuotaExceededError.
 */

/**
 * Safely sets an item in localStorage.
 * If quota is exceeded, it prunes old items with a specific prefix and tries again.
 * 
 * @param {string} key - The key to set 
 * @param {any} value - The value to set (will be stringified)
 * @param {string} prefixToPrune - Prefix for items that are safe to delete (e.g., 'poi_')
 */
export const safeSetItem = (key, value, prefixToPrune = 'poi_') => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    try {
        localStorage.setItem(key, stringValue);
        return true;
    } catch (e) {
        if (isQuotaExceeded(e)) {
            console.warn(`[StorageManager] Quota exceeded for "${key}". Attempting to prune "${prefixToPrune}" items...`);

            // 1. Gather all prunable keys
            const prunable = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefixToPrune)) {
                    try {
                        const item = JSON.parse(localStorage.getItem(k));
                        prunable.push({ key: k, timestamp: item.timestamp || 0 });
                    } catch {
                        prunable.push({ key: k, timestamp: 0 });
                    }
                }
            }

            // 2. Sort by timestamp (Oldest first)
            prunable.sort((a, b) => a.timestamp - b.timestamp);

            // 3. Delete several oldest until we can save or run out of items
            let prunedCount = 0;
            for (const item of prunable) {
                localStorage.removeItem(item.key);
                prunedCount++;

                // Prune at least 5 items at once to avoid frequent retries
                if (prunedCount < 5 && prunedCount < prunable.length) continue;

                try {
                    localStorage.setItem(key, stringValue);
                    console.log(`[StorageManager] Successfully saved "${key}" after pruning ${prunedCount} items.`);
                    return true;
                } catch (retryError) {
                    if (!isQuotaExceeded(retryError)) throw retryError;
                }
            }

            console.error(`[StorageManager] Failed to save "${key}" even after pruning all "${prefixToPrune}" items.`);
        } else {
            console.error(`[StorageManager] Unexpected error saving "${key}":`, e);
        }
        return false;
    }
};

/**
 * Checks if an error is a LocalStorage quota error.
 */
function isQuotaExceeded(e) {
    return (
        e instanceof DOMException &&
        (e.code === 22 ||
            e.code === 1014 ||
            e.name === 'QuotaExceededError' ||
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    );
}

/**
 * Returns estimated storage usage in bytes.
 */
export const getStorageUsage = () => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += (key.length + localStorage.getItem(key).length) * 2; // UTF-16
    }
    return total;
};
