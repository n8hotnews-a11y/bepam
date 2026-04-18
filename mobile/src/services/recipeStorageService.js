import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistent Recipe Storage Service
 * Lưu trữ vĩnh viễn (không TTL) dữ liệu đầy đủ của các món ăn đã xem/yêu thích/nấu.
 * Dùng AsyncStorage (localStorage trên React Native) → miễn phí, nhanh, offline.
 * 
 * Khác với cacheService (có TTL sẽ tự xóa), service này lưu vĩnh viễn
 * cho đến khi user xóa app hoặc gọi clear thủ công.
 */

const STORAGE_PREFIX = '@ComNhaRecipeStore_';
const INDEX_KEY = '@ComNhaRecipeStore_INDEX';

// Giới hạn tối đa số món lưu trữ để tránh chiếm quá nhiều bộ nhớ
const MAX_STORED_RECIPES = 200;

export const recipeStorageService = {
    /**
     * Lưu một recipe đầy đủ vào persistent storage
     * @param {Object} recipe - Đối tượng recipe có ít nhất { id, title }
     */
    async saveRecipe(recipe) {
        if (!recipe || !recipe.id) return;
        try {
            const key = STORAGE_PREFIX + recipe.id;
            // Chỉ lưu các field cần thiết để tiết kiệm dung lượng
            const compactRecipe = {
                id: recipe.id,
                title: recipe.title,
                image: recipe.image,
                readyInMinutes: recipe.readyInMinutes,
                servings: recipe.servings,
                healthScore: recipe.healthScore,
                extendedIngredients: recipe.extendedIngredients,
                analyzedInstructions: recipe.analyzedInstructions,
                instructions: recipe.instructions,
                sourceUrl: recipe.sourceUrl,
                spoonacularScore: recipe.spoonacularScore,
                nutrition: recipe.nutrition,
                savedAt: Date.now(),
            };

            await AsyncStorage.setItem(key, JSON.stringify(compactRecipe));

            // Cập nhật index (để quản lý & cleanup)
            await this._updateIndex(recipe.id, recipe.title);

            return true;
        } catch (error) {
            console.error('[RecipeStorage] saveRecipe error:', error);
            return false;
        }
    },

    /**
     * Lấy một recipe từ persistent storage theo ID
     * @param {string} recipeId 
     * @returns {Object|null} recipe data hoặc null
     */
    async getRecipe(recipeId) {
        if (!recipeId) return null;
        try {
            const key = STORAGE_PREFIX + recipeId;
            const data = await AsyncStorage.getItem(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.error('[RecipeStorage] getRecipe error:', error);
            return null;
        }
    },

    /**
     * Tìm recipe theo title (fuzzy match)
     * @param {string} title 
     * @returns {Object|null}
     */
    async getRecipeByTitle(title) {
        if (!title) return null;
        try {
            const index = await this._getIndex();
            const titleLower = title.toLowerCase().trim();

            // Tìm exact match hoặc partial match
            const matchedId = Object.keys(index).find(id => {
                const storedTitle = index[id]?.toLowerCase?.() || '';
                return storedTitle === titleLower || 
                       storedTitle.includes(titleLower) || 
                       titleLower.includes(storedTitle);
            });

            if (matchedId) {
                return await this.getRecipe(matchedId);
            }
            return null;
        } catch (error) {
            console.error('[RecipeStorage] getRecipeByTitle error:', error);
            return null;
        }
    },

    /**
     * Xóa một recipe
     */
    async removeRecipe(recipeId) {
        try {
            await AsyncStorage.removeItem(STORAGE_PREFIX + recipeId);
            const index = await this._getIndex();
            delete index[recipeId];
            await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
            return true;
        } catch (error) {
            return false;
        }
    },

    /**
     * Lấy tổng số recipe đã lưu
     */
    async getStoredCount() {
        try {
            const index = await this._getIndex();
            return Object.keys(index).length;
        } catch {
            return 0;
        }
    },

    // === PRIVATE HELPERS ===

    async _getIndex() {
        try {
            const data = await AsyncStorage.getItem(INDEX_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    },

    async _updateIndex(recipeId, title) {
        try {
            const index = await this._getIndex();
            index[recipeId] = title;

            // Cleanup nếu vượt quá giới hạn: xóa các recipe cũ nhất
            const ids = Object.keys(index);
            if (ids.length > MAX_STORED_RECIPES) {
                // Lấy danh sách và sort theo savedAt → xóa cũ nhất
                const toRemoveCount = ids.length - MAX_STORED_RECIPES;
                const recipePromises = ids.map(async (id) => {
                    const data = await AsyncStorage.getItem(STORAGE_PREFIX + id);
                    const parsed = data ? JSON.parse(data) : null;
                    return { id, savedAt: parsed?.savedAt || 0 };
                });
                const recipes = await Promise.all(recipePromises);
                recipes.sort((a, b) => a.savedAt - b.savedAt);

                for (let i = 0; i < toRemoveCount; i++) {
                    const oldId = recipes[i].id;
                    await AsyncStorage.removeItem(STORAGE_PREFIX + oldId);
                    delete index[oldId];
                }
                console.log(`[RecipeStorage] Cleaned up ${toRemoveCount} old recipes`);
            }

            await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
        } catch (error) {
            console.error('[RecipeStorage] _updateIndex error:', error);
        }
    }
};
