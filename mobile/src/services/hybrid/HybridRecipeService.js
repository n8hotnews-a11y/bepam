import { VIETNAMESE_RECIPES as INITIAL_RECIPES } from '../../data/vietnameseRecipes';
import { hybridCache, CACHE_KEYS } from './CacheService';
import { hybridSync } from './SyncService';

// Simple EventEmitter implementation for React Native
class SimpleEventEmitter {
    constructor() {
        this.listeners = {};
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
    removeListener(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
}

class HybridRecipeService extends SimpleEventEmitter {
    constructor() {
        super();
        this._recipes = [];
        this._loading = false;
        this._initialized = false;
    }

    async initialize() {
        if (this._initialized) return;
        this._loading = true;

        try {
            // 1. Try Cache First
            const cached = await hybridCache.get(CACHE_KEYS.RECIPES);
            if (cached && cached.data) {
                console.log('[HybridRecipeService] Loaded from Cache');
                this._recipes = cached.data;
            } else {
                // 2. Fallback to Initial Bundle
                console.log('[HybridRecipeService] Loaded from Initial Bundle');
                this._recipes = INITIAL_RECIPES;
            }

            this._initialized = true;
            this.emit('recipes_updated', this._recipes);

            // 3. Trigger Background Sync
            this.syncInBackground();

        } catch (error) {
            console.error('[HybridRecipeService] Initialization error:', error);
            this._recipes = INITIAL_RECIPES; // Safety fallback
        } finally {
            this._loading = false;
        }
    }

    async syncInBackground() {
        try {
            const updatedRecipes = await hybridSync.sync();
            if (updatedRecipes) {
                this._recipes = updatedRecipes;
                this.emit('recipes_updated', this._recipes);
                console.log('[HybridRecipeService] Background sync complete and UI notified');
            }
        } catch (error) {
            console.log('[HybridRecipeService] Background sync failed (expected if offline or not configured):', error.message);
        }
    }

    // --- Public API ---

    getRecipes() {
        return this._recipes;
    }

    getRecipeById(id) {
        return this._recipes.find(r => r.id === id);
    }

    search(query, type = null) {
        if (!query && !type) return this._recipes;

        const lowerQuery = query?.toLowerCase() || '';
        return this._recipes.filter(r => {
            const matchesQuery = !query ||
                r.title.toLowerCase().includes(lowerQuery) ||
                r.ingredients.some(i => i.toLowerCase().includes(lowerQuery));

            const matchesType = !type || r.type === type;

            return matchesQuery && matchesType;
        });
    }

    async forceRefresh() {
        const fresh = await hybridSync.sync(true); // force = true
        if (fresh) {
            this._recipes = fresh;
            this.emit('recipes_updated', this._recipes);
            return true;
        }
        return false;
    }

    get isLoading() {
        return this._loading;
    }

    get metadata() {
        // Return info about when data was last updated
        return hybridCache.getMetadata(CACHE_KEYS.RECIPES);
    }
}

export const hybridRecipeService = new HybridRecipeService();
