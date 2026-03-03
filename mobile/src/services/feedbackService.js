import { supabase } from './supabaseConfig';

export const feedbackService = {
    /**
     * Submit user feedback
     * @param {string} userId - User ID (optional)
     * @param {string} content - Feedback content
     * @param {string} type - 'suggestion', 'bug', 'other'
     */
    async submitFeedback(userId, content, type = 'suggestion') {
        try {
            const payload = {
                content,
                type,
                status: 'new'
            };

            if (userId) {
                payload.user_id = userId;
            }

            const { error } = await supabase
                .from('feedbacks')
                .insert(payload);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('submitFeedback Error:', error);
            return { success: false, error: error.message };
        }
    }
};
