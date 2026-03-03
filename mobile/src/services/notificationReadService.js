import { supabase } from './supabaseConfig';

/**
 * Service to manage read status of food expiry notifications using database
 */
export const notificationReadService = {
    /**
     * Get all read notification IDs for a user
     * Returns a Set of item IDs that have been marked as read
     */
    async getReadNotifications() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return new Set();

            const { data, error } = await supabase
                .from('food_warnings_read')
                .select('inventory_item_id')
                .eq('user_id', user.id);

            if (error) {
                console.error('Error loading read notifications:', error);
                return new Set();
            }

            return new Set(data?.map(item => item.inventory_item_id) || []);
        } catch (error) {
            console.error('Error loading read notifications:', error);
            return new Set();
        }
    },

    /**
     * Mark a notification as read
     * @param {string} itemId - The ID of the food item
     */
    async markAsRead(itemId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            // Mark both expired and expiring_soon warnings as read
            const { error } = await supabase
                .from('food_warnings_read')
                .upsert([
                    {
                        user_id: user.id,
                        inventory_item_id: itemId,
                        warning_type: 'expired',
                        read_at: new Date().toISOString()
                    },
                    {
                        user_id: user.id,
                        inventory_item_id: itemId,
                        warning_type: 'expiring_soon',
                        read_at: new Date().toISOString()
                    }
                ], {
                    onConflict: 'user_id,inventory_item_id,warning_type'
                });

            if (error) {
                console.error('Error marking notification as read:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    },

    /**
     * Mark multiple notifications as read
     * @param {string[]} itemIds - Array of food item IDs
     */
    async markMultipleAsRead(itemIds) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !itemIds.length) return false;

            // Create records for both warning types
            const records = [];
            itemIds.forEach(itemId => {
                records.push({
                    user_id: user.id,
                    inventory_item_id: itemId,
                    warning_type: 'expired',
                    read_at: new Date().toISOString()
                });
                records.push({
                    user_id: user.id,
                    inventory_item_id: itemId,
                    warning_type: 'expiring_soon',
                    read_at: new Date().toISOString()
                });
            });

            const { error } = await supabase
                .from('food_warnings_read')
                .upsert(records, {
                    onConflict: 'user_id,inventory_item_id,warning_type'
                });

            if (error) {
                console.error('Error marking multiple notifications as read:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error marking multiple notifications as read:', error);
            return false;
        }
    },

    /**
     * Unmark a notification (mark as unread)
     * @param {string} itemId - The ID of the food item
     */
    async markAsUnread(itemId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { error } = await supabase
                .from('food_warnings_read')
                .delete()
                .eq('user_id', user.id)
                .eq('inventory_item_id', itemId);

            if (error) {
                console.error('Error marking notification as unread:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error marking notification as unread:', error);
            return false;
        }
    },

    /**
     * Check if a notification has been read
     * @param {string} itemId - The ID of the food item
     */
    async isRead(itemId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { data, error } = await supabase
                .from('food_warnings_read')
                .select('id')
                .eq('user_id', user.id)
                .eq('inventory_item_id', itemId)
                .limit(1);

            if (error) {
                console.error('Error checking read status:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('Error checking read status:', error);
            return false;
        }
    },

    /**
     * Clear a specific read notification (when item is deleted or updated)
     * @param {string} itemId - The ID of the food item
     */
    async clearReadStatus(itemId) {
        return await this.markAsUnread(itemId);
    },

    /**
     * Clear all read notifications for the current user
     */
    async clearAll() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { error } = await supabase
                .from('food_warnings_read')
                .delete()
                .eq('user_id', user.id);

            if (error) {
                console.error('Error clearing read notifications:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error clearing read notifications:', error);
            return false;
        }
    },

    /**
     * Clean up read notifications for items that no longer exist
     * @param {string[]} existingItemIds - Array of currently existing item IDs
     */
    async cleanup(existingItemIds) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            // Delete read notifications for items that no longer exist
            const { error } = await supabase
                .from('food_warnings_read')
                .delete()
                .eq('user_id', user.id)
                .not('inventory_item_id', 'in', `(${existingItemIds.join(',')})`);

            if (error) {
                console.error('Error cleaning up read notifications:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error cleaning up read notifications:', error);
            return false;
        }
    }
};
