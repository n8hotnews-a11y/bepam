import { supabase } from './supabaseConfig';
import { inventoryService } from './inventoryService';
import { mealPlanService } from './mealPlanService';
import { shoppingListService } from './shoppingListService';
import { recipeService } from './recipeService';

const COOKING_HISTORY_TABLE = 'cooking_history';

/**
 * Service to manage cooking workflow and inventory deduction
 */
export const cookingService = {
    /**
     * Get recipe ingredients for a meal plan item
     * @param {string} recipeId - The recipe ID from the meal plan
     * @returns {Promise<{success: boolean, ingredients?: Array, error?: string}>}
     */
    async getRecipeIngredients(recipeId, recipeTitle = null) {
        try {
            let result = await recipeService.getRecipeDetails(recipeId);

            // Fallback: Reconstruct AI Recipe if missing locally
            if (!result.success && recipeTitle && typeof recipeId !== 'undefined' && String(recipeId).startsWith('ai_')) {
                console.log('[CookingService] Attempting to reconstruct AI recipe:', recipeTitle);
                result = await recipeService.reconstructAIRecipe(recipeTitle);
            }

            if (!result.success) {
                return { success: false, error: result.error };
            }

            const ingredients = result.data.extendedIngredients?.map(ing => ({
                name: ing.nameClean || ing.name,
                amount: Math.round(ing.amount * 10) / 10,
                unit: ing.unit || '',
                originalAmount: ing.amount,
            })) || [];

            return { success: true, ingredients };
        } catch (error) {
            console.error('Error getting recipe ingredients:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Match recipe ingredients with user's inventory
     * @param {string} userId - User ID
     * @param {Array} recipeIngredients - List of ingredients from recipe
     * @returns {Promise<{success: boolean, matched?: Array, error?: string}>}
     */
    async matchWithInventory(userId, recipeIngredients) {
        try {
            const invResult = await inventoryService.getItems(userId);
            if (!invResult.success) {
                return { success: false, error: invResult.error };
            }

            const inventory = invResult.items;

            const matched = recipeIngredients.map(ing => {
                // Find matching item in inventory (fuzzy match)
                const inventoryItem = inventory.find(item => {
                    const itemName = item.item_name.toLowerCase();
                    const ingName = ing.name.toLowerCase();
                    return itemName.includes(ingName) || ingName.includes(itemName);
                });

                return {
                    ...ing,
                    inventoryItemId: inventoryItem?.id || null,
                    inventoryItemName: inventoryItem?.item_name || null,
                    availableAmount: inventoryItem?.amount || 0,
                    availableUnit: inventoryItem?.unit || ing.unit,
                    isAvailable: !!inventoryItem,
                    willBeEmpty: inventoryItem ? (inventoryItem.amount <= ing.amount) : false,
                    amountToDeduct: Math.min(ing.amount, inventoryItem?.amount || 0),
                };
            });

            return { success: true, matched };
        } catch (error) {
            console.error('Error matching with inventory:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark a meal plan item as cooked and deduct ingredients
     * @param {string} userId - User ID
     * @param {string} planId - Meal plan ID
     * @param {Array} ingredientsUsed - List of ingredients actually used with amounts
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, depleted?: Array, error?: string}>}
     */
    async markAsCooked(userId, planId, ingredientsUsed, options = {}) {
        try {
            const { addDepletedToShoppingList = false, notes = '', recipeInfo = {} } = options;

            // 1. Get the meal plan item or use fallback recipe info
            let planData = {
                recipe_id: recipeInfo.recipeId,
                recipe_title: recipeInfo.recipeTitle,
            };

            if (planId) {
                const { data: fetchedPlan, error: planError } = await supabase
                    .from('mealplans')
                    .select('*')
                    .eq('id', planId)
                    .single();

                if (!planError && fetchedPlan) {
                    planData = fetchedPlan;

                    // 2. Update meal plan status
                    await supabase
                        .from('mealplans')
                        .update({
                            status: 'cooked',
                            cooked_at: new Date().toISOString(),
                        })
                        .eq('id', planId);
                }
            }

            // 3. Deduct ingredients from inventory
            const depleted = [];
            for (const ing of ingredientsUsed) {
                if (ing.inventoryItemId && ing.amountToDeduct > 0) {
                    const deductResult = await inventoryService.deductQuantity(
                        ing.inventoryItemId,
                        ing.amountToDeduct
                    );

                    if (deductResult.depleted) {
                        depleted.push({
                            name: ing.name,
                            unit: ing.unit,
                        });
                    }
                }
            }

            // 4. Add depleted items to shopping list if requested
            if (addDepletedToShoppingList && depleted.length > 0) {
                for (const item of depleted) {
                    await shoppingListService.addItem(userId, {
                        item_name: item.name,
                        amount: 1,
                        unit: item.unit,
                        notes: `Đã hết sau khi nấu ${planData.recipe_title || 'món ăn'}`,
                    });
                }
            }

            // 5. Save to cooking history
            await this.saveCookingHistory(userId, {
                meal_plan_id: planId,
                recipe_id: planData.recipe_id || planData.recipeId,
                recipe_title: planData.recipe_title || planData.recipeTitle,
                ingredients_used: ingredientsUsed,
                notes,
            });


            return {
                success: true,
                depleted,
                message: `Đã cập nhật tủ lạnh. ${depleted.length > 0 ? `${depleted.length} nguyên liệu đã hết.` : ''}`,
            };
        } catch (error) {
            console.error('Error marking as cooked:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Save cooking history record
     */
    async saveCookingHistory(userId, data) {
        try {
            const { error } = await supabase
                .from(COOKING_HISTORY_TABLE)
                .insert({
                    user_id: userId,
                    meal_plan_id: data.meal_plan_id,
                    recipe_id: data.recipe_id,
                    recipe_title: data.recipe_title,
                    cooked_at: new Date().toISOString(),
                    ingredients_used: data.ingredients_used,
                    notes: data.notes || '',
                });

            if (error) {
                console.warn('Could not save cooking history:', error);
                // Don't fail the whole operation
            }

            return { success: true };
        } catch (error) {
            console.error('Error saving cooking history:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get cooking history for a user
     * @param {string} userId - User ID
     * @param {Object} options - Filter options (startDate, endDate, limit)
     */
    async getCookingHistory(userId, options = {}) {
        try {
            const { startDate, endDate, limit = 50 } = options;

            let query = supabase
                .from(COOKING_HISTORY_TABLE)
                .select('*')
                .eq('user_id', userId)
                .order('cooked_at', { ascending: false })
                .limit(limit);

            if (startDate) {
                query = query.gte('cooked_at', startDate);
            }
            if (endDate) {
                query = query.lte('cooked_at', endDate);
            }

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, history: data };
        } catch (error) {
            console.error('Error getting cooking history:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Quick mark as cooked without ingredient confirmation
     * Uses recipe defaults for deduction
     */
    async quickMarkAsCooked(userId, planId) {
        try {
            // Get meal plan
            const { data: planData, error: planError } = await supabase
                .from('mealplans')
                .select('*')
                .eq('id', planId)
                .single();

            if (planError) throw planError;

            // Get recipe ingredients
            const ingResult = await this.getRecipeIngredients(planData.recipe_id);
            if (!ingResult.success) {
                return { success: false, error: ingResult.error };
            }

            // Match with inventory
            const matchResult = await this.matchWithInventory(userId, ingResult.ingredients);
            if (!matchResult.success) {
                return { success: false, error: matchResult.error };
            }

            // Mark as cooked with default amounts
            return await this.markAsCooked(userId, planId, matchResult.matched, {
                addDepletedToShoppingList: true,
            });
        } catch (error) {
            console.error('Error in quick mark as cooked:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get statistics about cooking activity
     */
    async getCookingStats(userId) {
        try {
            const { data, error } = await supabase
                .from(COOKING_HISTORY_TABLE)
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;

            const totalMealsCooked = data.length;
            const thisWeek = data.filter(h => {
                const cookedDate = new Date(h.cooked_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return cookedDate >= weekAgo;
            }).length;

            // Count ingredients used
            const ingredientCounts = {};
            data.forEach(h => {
                if (h.ingredients_used) {
                    h.ingredients_used.forEach(ing => {
                        const name = ing.name?.toLowerCase();
                        if (name) {
                            ingredientCounts[name] = (ingredientCounts[name] || 0) + 1;
                        }
                    });
                }
            });

            const topIngredients = Object.entries(ingredientCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }));

            return {
                success: true,
                stats: {
                    totalMealsCooked,
                    mealsThisWeek: thisWeek,
                    topIngredients,
                },
            };
        } catch (error) {
            console.error('Error getting cooking stats:', error);
            return { success: false, error: error.message };
        }
    },
};
