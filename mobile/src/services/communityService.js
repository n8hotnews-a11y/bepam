import { supabase } from './supabaseConfig';

export const communityService = {
    /**
     * Fetch all available residences
     */
    async getResidences() {
        try {
            const { data, error } = await supabase
                .from('residences')
                .select('*')
                .order('name');

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('getResidences Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update user's residence
     */
    async updateUserResidence(userId, residenceId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({ residence_id: residenceId })
                .eq('id', userId)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                return {
                    success: false,
                    error: "Không thể cập nhật hồ sơ. Có thể hồ sơ của bạn chưa được khởi tạo."
                };
            }

            return { success: true };
        } catch (error) {
            console.error('updateUserResidence Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetch listings for a specific residence
     */
    async getListings(residenceId, category = null) {
        try {
            let query = supabase
                .from('community_listings')
                .select(`
                    *,
                    user:user_id!inner (email)
                `)
                .eq('residence_id', residenceId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('getListings Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Create a new community listing
     */
    async createListing(listingData) {
        try {
            const { data, error } = await supabase
                .from('community_listings')
                .insert([listingData])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('createListing Error:', error);
            return { success: false, error: error.message };
        }
    },

    // --- RESIDENT GROUPS ---

    /**
     * Get groups for a residence
     */
    async getGroups(residenceId) {
        try {
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('residence_id', residenceId);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('getGroups Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Join a group
     */
    async joinGroup(groupId, userId) {
        try {
            const { error } = await supabase
                .from('group_members')
                .insert({ group_id: groupId, user_id: userId });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('joinGroup Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get posts for a group
     */
    async getGroupPosts(groupId) {
        try {
            const { data, error } = await supabase
                .from('group_posts')
                .select(`
                    *,
                    user:user_id (email)
                `)
                .eq('group_id', groupId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('getGroupPosts Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Create a post in a group
     */
    async createGroupPost(groupId, userId, content, images = []) {
        try {
            const { data, error } = await supabase
                .from('group_posts')
                .insert({
                    group_id: groupId,
                    user_id: userId,
                    content,
                    images
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('createGroupPost Error:', error);
            return { success: false, error: error.message };
        }
    },

    // --- STORES & SUPERMARKETS ---

    /**
     * Get nearby stores
     */
    async getStores() {
        try {
            const { data, error } = await supabase
                .from('stores')
                .select('*');

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('getStores Error:', error);
            return { success: false, error: error.message };
        }
    }
};
