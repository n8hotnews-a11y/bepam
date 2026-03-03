import { supabase } from './supabaseConfig';
import { householdService } from './householdService';

const COLLECTION_NAME = 'shoppinglist';

export const shoppingListService = {
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
     * Add an item to the shopping list
     */
    async addItem(userId, itemData) {
        try {
            const scope = await this.getScope(userId);

            const insertData = {
                item_name: itemData.item_name,
                amount: itemData.amount || 1,
                unit: itemData.unit || 'cái',
                category_id: itemData.category_id || 'other',
                checked: false,
                created_at: new Date().toISOString(),
            };

            if (scope.type === 'household') {
                insertData.household_id = scope.id;
                // We typically still track who ADDED it, but data belongs to household
                insertData.user_id = userId;
            } else {
                insertData.user_id = userId;
            }

            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .insert(insertData)
                .select()
                .single();

            if (error) throw error;
            return { success: true, id: data.id };
        } catch (error) {
            console.error('Error adding shopping item:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get user's (or household's) shopping list
     */
    async getItems(userId) {
        try {
            const scope = await this.getScope(userId);

            let query = supabase.from(COLLECTION_NAME).select('*');

            if (scope.type === 'household') {
                query = query.eq('household_id', scope.id);
            } else {
                // If personal, explicitly check household_id is null OR simply by user_id
                // To avoid showing "shared" items in "personal" view if we mixed them,
                // we should stick to: personal view = only things JUST for me.
                // But for simplicity in this schema:
                query = query.eq('user_id', scope.id).is('household_id', null);
                // Note: user_id is always set even for household items in my implementation above.
                // So checking .is('household_id', null) ensures we only get personal items.
            }

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error getting shopping items:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update item status or quantity
     */
    async updateItem(itemId, updates) {
        try {
            const { error } = await supabase
                .from(COLLECTION_NAME)
                .update(updates)
                .eq('id', itemId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating shopping item:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete an item
     */
    async deleteItem(itemId) {
        try {
            // Use select() to verify the row was actually found and deleted
            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .delete()
                .eq('id', itemId)
                .select();

            if (error) {
                console.error(`[ShoppingListService] Supabase delete error:`, error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn(`[ShoppingListService] Delete failed for ID: ${itemId}. Row might not exist or RLS policy denied deletion.`);
                return { success: false, error: 'Không tìm thấy sản phẩm hoặc bạn không có quyền xoá.' };
            }

            console.log(`[ShoppingListService] Successfully deleted item: ${itemId}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting shopping item:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Add multiple items to the shopping list
     */
    async addBatchItems(userId, items) {
        try {
            const scope = await this.getScope(userId);

            const itemsToInsert = items.map(item => {
                const row = {
                    item_name: item.name,
                    amount: item.amount || 1,
                    unit: item.unit || 'phần',
                    category_id: 'other',
                    checked: false,
                    created_at: new Date().toISOString(),
                    user_id: userId
                };

                if (scope.type === 'household') {
                    row.household_id = scope.id;
                }

                return row;
            });

            const { error } = await supabase
                .from(COLLECTION_NAME)
                .insert(itemsToInsert);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error adding batch shopping items:', error);
            return { success: false, error: error.message };
        }
    }
};
