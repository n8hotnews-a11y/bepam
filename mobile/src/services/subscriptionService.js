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
        try {
            if (!user_id) return { is_premium: false, tier: 'free' };

            const { data, error } = await supabase
                .from('users')
                .select('is_premium, subscription_tier, subscription_end_date')
                .eq('id', user_id)
                .maybeSingle(); // Use maybeSingle to avoid 0 rows error

            if (error) {
                // Handle case where columns don't exist yet (42703 is Undefined Column in Postgres)
                if (error.code === '42703') {
                    console.warn('Database missing subscription columns. Defaulting to Free tier.');
                    return { is_premium: false, tier: 'free' };
                }
                throw error;
            }

            if (!data) return { is_premium: false, tier: 'free' };

            // Check if expired
            if (data.is_premium && data.subscription_end_date) {
                const endDate = new Date(data.subscription_end_date);
                const now = new Date();
                if (endDate < now) {
                    // Expired, update DB (background) and return free
                    // In real app, database trigger or edge function should handle this
                    return { is_premium: false, tier: 'free', message: 'Expired' };
                }
            }

            return {
                is_premium: data.is_premium,
                tier: data.subscription_tier,
                endDate: data.subscription_end_date
            };
        } catch (error) {
            console.error('Get Subscription Error:', error);
            // Default to free on error to be safe
            return { is_premium: false, tier: 'free' };
        }
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
