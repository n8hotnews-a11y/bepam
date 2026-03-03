import { supabase } from './supabaseConfig';

export const favoriteService = {
    /**
     * Get all favorites for a user
     */
    async getFavorites(userId) {
        try {
            const { data, error } = await supabase
                .from('favorite_recipes')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('getFavorites Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Check if a recipe is favorited
     */
    async isFavorite(userId, recipeId) {
        try {
            const { data, error } = await supabase
                .from('favorite_recipes')
                .select('id')
                .eq('user_id', userId)
                .eq('recipe_id', recipeId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('isFavorite Error:', error);
                return false;
            }

            return !!data;
        } catch (error) {
            console.error('isFavorite Error:', error);
            return false;
        }
    },

    /**
     * Add a recipe to favorites
     */
    async addFavorite(userId, recipe) {
        try {
            const { error } = await supabase
                .from('favorite_recipes')
                .insert({
                    user_id: userId,
                    recipe_id: recipe.id,
                    recipe_title: recipe.title,
                    recipe_image: recipe.image
                });

            if (error) {
                if (error.code === '23505') { // Unique violation
                    return { success: true, message: 'Already favorited' };
                }
                throw error;
            }
            return { success: true };
        } catch (error) {
            console.error('addFavorite Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Remove a recipe from favorites
     */
    async removeFavorite(userId, recipeId) {
        try {
            const { error } = await supabase
                .from('favorite_recipes')
                .delete()
                .eq('user_id', userId)
                .eq('recipe_id', recipeId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('removeFavorite Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Pick a random favorite to suggest for cooking
     */
    async suggestFavoriteToCook(userId) {
        try {
            const { data, error } = await supabase
                .from('favorite_recipes')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;

            if (!data || data.length === 0) return null;

            // Simple random logic for now
            const randomIndex = Math.floor(Math.random() * data.length);
            return data[randomIndex];
        } catch (error) {
            console.error('suggestFavoriteToCook Error:', error);
            return null;
        }
    }
};
