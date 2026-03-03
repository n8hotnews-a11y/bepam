import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
    RECIPES: 'hybrid_recipes_data',
    METADATA: 'hybrid_recipes_metadata',
};

const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

class CacheService {
    /**
     * Store data in cache with metadata
     * @param {string} key 
     * @param {any} data 
     * @param {object} options { ttl, version, source }
     */
    async set(key, data, options = {}) {
        try {
            const metadata = {
                timestamp: Date.now(),
                version: options.version || '1.0.0',
                source: options.source || 'bundle',
                ttl: options.ttl || DEFAULT_TTL,
            };

            const payload = {
                data,
                metadata,
            };

            await AsyncStorage.setItem(key, JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error('[CacheService] Error setting cache:', error);
            return false;
        }
    }

    /**
     * Retrieve data from cache if not expired
     * @param {string} key 
     * @returns {any|null}
     */
    async get(key) {
        try {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) return null;

            const { data, metadata } = JSON.parse(raw);

            // Check expiry
            const isExpired = Date.now() - metadata.timestamp > metadata.ttl;
            if (isExpired) {
                console.log(`[CacheService] Cache expired for key: ${key}`);
                return null;
            }

            return { data, metadata };
        } catch (error) {
            console.error('[CacheService] Error getting cache:', error);
            return null;
        }
    }

    /**
     * Get specific metadata for a key
     */
    async getMetadata(key) {
        const cached = await this.get(key);
        return cached ? cached.metadata : null;
    }

    /**
     * Clear cache for a key
     */
    async clear(key) {
        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all hybrid cache
     */
    async clearAll() {
        try {
            const keys = Object.values(CACHE_KEYS);
            await AsyncStorage.multiRemove(keys);
            return true;
        } catch (error) {
            return false;
        }
    }
}

export const hybridCache = new CacheService();
export { CACHE_KEYS };
