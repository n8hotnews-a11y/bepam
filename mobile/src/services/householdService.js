import { supabase } from './supabaseConfig';

export const householdService = {
    /**
     * Create a new household
     */
    async createHousehold(name, userId) {
        try {
            // Generate a random 6-char invite code
            // Note: Ideally this should be done on backend to ensure uniqueness properly,
            // but for MVP we can try here or use the database function if exposed via RPC.
            // Let's try calling RPC if available, else simple JS generation.

            const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            const { data, error } = await supabase
                .from('households')
                .insert({
                    name,
                    created_by: userId,
                    invite_code: inviteCode
                })
                .select()
                .single();

            if (error) throw error;

            // Automatically add creator as admin
            await this.addMember(data.id, userId, 'admin');

            return { success: true, household: data };
        } catch (error) {
            console.error('Create Household Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Add member to household
     */
    async addMember(householdId, userId, role = 'member') {
        try {
            const { error } = await supabase
                .from('household_members')
                .insert({
                    household_id: householdId,
                    user_id: userId,
                    role
                });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Add Member Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Join household by Invite Code
     */
    async joinByCode(inviteCode, userId) {
        try {
            // 1. Find household
            const { data: household, error: findError } = await supabase
                .from('households')
                .select('id, name')
                .eq('invite_code', inviteCode.toUpperCase())
                .single();

            if (findError || !household) throw new Error("Mã mời không hợp lệ");

            // 2. Check if already member
            const { data: existing } = await supabase
                .from('household_members')
                .select('id')
                .eq('household_id', household.id)
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) throw new Error("Bạn đã là thành viên của gia đình này");

            // 3. Add member
            return await this.addMember(household.id, userId, 'member');

        } catch (error) {
            console.error('Join Household Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get user's household (assuming single household per user for MVP)
     */
    async getUserHousehold(userId) {
        try {
            const { data, error } = await supabase
                .from('household_members')
                .select(`
                    role,
                    households (
                        id,
                        name,
                        invite_code,
                        created_at
                    )
                `)
                .eq('user_id', userId)
                .maybeSingle(); // Assuming 1 household per user for simplicity

            if (error) throw error;
            if (!data) return { success: true, household: null };

            return { success: true, household: { ...data.households, role: data.role } };
        } catch (error) {
            console.error('Get Household Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get all members of a household
     */
    async getHouseholdMembers(householdId) {
        try {
            const { data, error } = await supabase
                .from('household_members')
                .select(`
                    role,
                    joined_at,
                    user:user_id (email)
                `)
                .eq('household_id', householdId);

            if (error) throw error;
            return { success: true, members: data };
        } catch (error) {
            console.error('Get Members Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Leave household
     */
    async leaveHousehold(householdId, userId) {
        try {
            const { error } = await supabase
                .from('household_members')
                .delete()
                .eq('household_id', householdId)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Leave Household Error:', error);
            return { success: false, error: error.message };
        }
    }
};
