import { supabase } from './supabaseConfig';

export const SUBSCRIPTION_PACKAGES = [
    {
        id: 'monthly',
        name: 'Gói Tháng',
        price: 49000,
        currency: 'VND',
        durationMonth: 1,
        description: 'Thanh toán hàng tháng. Hủy bất kỳ lúc nào.'
    },
    {
        id: 'yearly',
        name: 'Gói Năm',
        price: 499000,
        currency: 'VND',
        durationMonth: 12,
        description: 'Tiết kiệm 17% so với gói tháng. Thanh toán một lần.'
    }
];

export const subscriptionService = {
    /**
     * Get current user subscription status
     */
    async getSubscriptionStatus(user_id) {
        // ALWAYS return premium status as per user request to remove subscription plan
        return { 
            is_premium: true, 
            tier: 'premium',
            endDate: '2099-12-31T23:59:59Z' 
        };
    },

    /**
     * Process a MOCK payment
     */
    async purchaseSubscription(user_id, packageId) {
        try {
            const pkg = SUBSCRIPTION_PACKAGES.find(p => p.id === packageId);
            if (!pkg) throw new Error("Invalid package");

            // 1. Create Payment Record (Pending)
            const { data: paymentData, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    user_id,
                    amount: pkg.price,
                    currency: pkg.currency,
                    provider: 'mock',
                    status: 'success', // Auto success for mock
                    package_type: pkg.id
                })
                .select()
                .maybeSingle();

            if (paymentError) throw paymentError;

            // 2. Update User Profile
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(now.getMonth() + pkg.durationMonth);

            const { error: userError } = await supabase
                .from('users')
                .update({
                    is_premium: true,
                    subscription_tier: pkg.id,
                    subscription_end_date: endDate.toISOString(),
                    auto_renew: true
                })
                .eq('id', user_id);

            if (userError) throw userError;

            return { success: true, message: 'Thanh toán thành công!' };

        } catch (error) {
            console.error('Purchase Error:', error);
            return { success: false, error: error.message };
        }
    }
};
