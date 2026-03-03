import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@ComNhaCache_';

export const cacheService = {
    /**
     * Set data to cache with a TTL (Time To Live)
     * @param {string} key 
     * @param {any} data 
     * @param {number} ttlInMinutes 
     */
    async set(key, data, ttlInMinutes = 60) {
        try {
            const expiry = Date.now() + ttlInMinutes * 60 * 1000;
            const cacheData = {
                data,
                expiry
            };
            await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    },

    /**
     * Get data from cache, check for expiry
     * @param {string} key 
     */
    async get(key) {
        try {
            const value = await AsyncStorage.getItem(CACHE_PREFIX + key);
            if (!value) return null;

            const cacheData = JSON.parse(value);
            if (Date.now() > cacheData.expiry) {
                await AsyncStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }

            return cacheData.data;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },

    /**
     * Remove specific item from cache
     * @param {string} key 
     */
    async remove(key) {
        try {
            await AsyncStorage.removeItem(CACHE_PREFIX + key);
            return true;
        } catch (error) {
            return false;
        }
    },

    /**
     * Clear all spoonacular related cache
     */
    async clearAll() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const spoonKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
            if (spoonKeys.length > 0) {
                await AsyncStorage.multiRemove(spoonKeys);
            }
            return true;
        } catch (error) {
            return false;
        }
    }
};
