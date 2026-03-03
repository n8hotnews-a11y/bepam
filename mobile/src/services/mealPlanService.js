import { supabase } from './supabaseConfig';
import { householdService } from './householdService';

const COLLECTION_NAME = 'mealplans';

const formatError = (error) => {
    return error.message || String(error);
};

export const mealPlanService = {
    /**
     * Helper to determine if we should target user_id or household_id
     */
    async getScope(userId) {
        const { household } = await householdService.getUserHousehold(userId);
        if (household) {
            return { type: 'household', id: household.id };
        }
        return { type: 'user', id: userId };
    },

    /**
     * Add a recipe to meal plan for a specific date
     */
    async addToPlan(userId, recipeId, recipeTitle, recipeImage, date, mealType = 'lunch') {
        try {
            const scope = await this.getScope(userId);

            // Put main payload in a variable
            // Note: Keys must match Supabase table columns exactly (snake_case)
            const payload = {
                user_id: userId,
                recipe_id: recipeId,
                recipe_title: recipeTitle,
                recipe_image: recipeImage,
                date, // YYYY-MM-DD
                mealType, // Needs migration to add this column
                created_at: new Date().toISOString(),
            };

            if (scope.type === 'household') {
                payload.household_id = scope.id;
            }

            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .insert(payload)
                .select()
                .single();

            if (error) {
                // If error is "Column not found" (PGRST204), try again without mealType
                if (error.code === 'PGRST204') {
                    console.warn("Database missing 'mealType' column. Retrying gracefully...");
                    delete payload.mealType;

                    const { data: retryData, error: retryError } = await supabase
                        .from(COLLECTION_NAME)
                        .insert(payload)
                        .select()
                        .single();

                    if (retryError) throw retryError;
                    return { success: true, id: retryData.id };
                }
                throw error;
            }
            return { success: true, id: data.id };
        } catch (error) {
            console.error('Error adding to meal plan:', error);
            return { success: false, error: formatError(error) };
        }
    },

    /**
     * Get meal plan for user (or household)
     */
    async getPlan(userId) {
        try {
            const scope = await this.getScope(userId);

            let query = supabase
                .from(COLLECTION_NAME)
                .select('*')
                .order('date', { ascending: true });

            if (scope.type === 'household') {
                query = query.eq('household_id', scope.id);
            } else {
                query = query.eq('user_id', scope.id).is('household_id', null);
            }

            const { data, error } = await query;
            if (error) throw error;

            return { success: true, data: data };
        } catch (error) {
            console.error('Error getting meal plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Remove from plan
     */
    async removeFromPlan(planId) {
        try {
            const { error } = await supabase
                .from(COLLECTION_NAME)
                .delete()
                .eq('id', planId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
