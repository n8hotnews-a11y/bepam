import { supabase } from './supabaseConfig';
import { householdService } from './householdService';

const INVENTORIES_COLLECTION = 'inventories';

export const inventoryService = {
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

    // Add item to inventory
    async addItem(userId, item) {
        try {
            const scope = await this.getScope(userId);

            const insertData = {
                ...item,
                status: 'In-stock',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            if (scope.type === 'household') {
                insertData.household_id = scope.id;
                insertData.user_id = userId; // Owner/Creator
            } else {
                insertData.user_id = userId;
            }

            const { data, error } = await supabase
                .from(INVENTORIES_COLLECTION)
                .insert(insertData)
                .select()
                .single();
            if (error) throw error;
            return { success: true, id: data.id };
        } catch (error) {
            console.error('Error adding item: ', error);
            return { success: false, error };
        }
    },

    // Get all items for a user (or household)
    async getItems(userId) {
        try {
            const scope = await this.getScope(userId);

            let query = supabase.from(INVENTORIES_COLLECTION).select('*');

            if (scope.type === 'household') {
                query = query.eq('household_id', scope.id);
            } else {
                query = query.eq('user_id', scope.id).is('household_id', null);
            }

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, items: data };
        } catch (error) {
            console.error('Error getting items: ', error);
            return { success: false, error };
        }
    },

    // Update item
    async updateItem(itemId, itemData) {
        try {
            const { error } = await supabase
                .from(INVENTORIES_COLLECTION)
                .update({
                    ...itemData,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating item: ', error);
            return { success: false, error };
        }
    },

    // Delete item
    async deleteItem(itemId) {
        try {
            const { error } = await supabase
                .from(INVENTORIES_COLLECTION)
                .delete()
                .eq('id', itemId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting item: ', error);
            return { success: false, error };
        }
    },

    /**
     * Deduct quantity from an inventory item
     * If quantity reaches 0 or below, delete the item
     * @param {string} itemId - Item ID to deduct from
     * @param {number} amount - Amount to deduct
     * @returns {Promise<{success: boolean, depleted?: boolean, newAmount?: number, error?: any}>}
     */
    async deductQuantity(itemId, amount) {
        try {
            // First get current amount
            const { data: item, error: getError } = await supabase
                .from(INVENTORIES_COLLECTION)
                .select('amount, item_name')
                .eq('id', itemId)
                .single();

            if (getError) throw getError;

            const currentAmount = parseFloat(item.amount) || 0;
            const deductAmount = parseFloat(amount) || 0;
            const newAmount = currentAmount - deductAmount;

            if (newAmount <= 0) {
                // Delete item if depleted
                await this.deleteItem(itemId);
                return { success: true, depleted: true, newAmount: 0, itemName: item.item_name };
            }

            // Update with new amount
            const { error: updateError } = await supabase
                .from(INVENTORIES_COLLECTION)
                .update({
                    amount: newAmount,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);

            if (updateError) throw updateError;

            return { success: true, depleted: false, newAmount, itemName: item.item_name };
        } catch (error) {
            console.error('Error deducting quantity:', error);
            return { success: false, error };
        }
    },

    /**
     * Batch deduct multiple items
     * @param {string} userId - User ID (Not strictly needed if we operate on ItemIDs, but good for context if we needed access check)
     * @param {Array<{itemId: string, amount: number}>} deductions - List of deductions
     * @returns {Promise<{success: boolean, results: Array, depleted: Array}>}
     */
    async batchDeduct(userId, deductions) {
        const results = [];
        const depleted = [];

        for (const { itemId, amount } of deductions) {
            if (!itemId || !amount) continue;

            const result = await this.deductQuantity(itemId, amount);
            results.push({
                itemId,
                ...result,
            });

            if (result.success && result.depleted) {
                depleted.push({
                    itemId,
                    itemName: result.itemName,
                });
            }
        }

        return {
            success: true,
            results,
            depleted,
        };
    },

    /**
     * Find inventory item by name (fuzzy match) within SCOPE
     * @param {string} userId - User ID to define scope
     * @param {string} itemName - Name to search for
     * @returns {Promise<{success: boolean, item?: object, error?: any}>}
     */
    async findItemByName(userId, itemName) {
        try {
            // Re-use getItems to ensure we respect household scope
            const { items, error } = await this.getItems(userId);

            if (error) throw error;
            if (!items) return { success: true, item: null };

            const searchName = itemName.toLowerCase().trim();

            // Try exact match first
            let match = items.find(item =>
                item.item_name.toLowerCase().trim() === searchName
            );

            // Try partial match
            if (!match) {
                match = items.find(item => {
                    const name = item.item_name.toLowerCase();
                    return name.includes(searchName) || searchName.includes(name);
                });
            }

            if (match) {
                return { success: true, item: match };
            }

            return { success: true, item: null };
        } catch (error) {
            console.error('Error finding item by name:', error);
            return { success: false, error };
        }
    },

    /**
     * Get item by ID
     * @param {string} itemId - Item ID
     */
    async getItemById(itemId) {
        try {
            const { data, error } = await supabase
                .from(INVENTORIES_COLLECTION)
                .select('*')
                .eq('id', itemId)
                .single();

            if (error) throw error;
            return { success: true, item: data };
        } catch (error) {
            console.error('Error getting item by ID:', error);
            return { success: false, error };
        }
    },
};
