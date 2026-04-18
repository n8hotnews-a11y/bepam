import { supabase } from './supabaseConfig';

export const authService = {
    // Sign in with email and password
    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);

            let errorMessage = 'Đã có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.';
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Email hoặc mật khẩu không chính xác.';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Vui lòng xác thực email của bạn trước khi đăng nhập.';
            } else if (error.message.includes('Invalid email')) {
                errorMessage = 'Định dạng email không hợp lệ.';
            } else if (error.message.includes('Network request failed') || error.name === 'AuthRetryableFetchError') {
                errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn và thử lại.';
            }
            
            return { success: false, error: errorMessage };
        }
    },

    // Register with email and password
    async register(email, password, fullName) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    },
                    emailRedirectTo: 'exp://mobile'
                }
            });
            if (error) throw error;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'Đã có lỗi xảy ra khi đăng ký.';

            if (error.message.includes('already registered')) {
                errorMessage = 'Email này đã được sử dụng bởi một tài khoản khác.';
            } else if (error.message.includes('Invalid email')) {
                errorMessage = 'Địa chỉ email không hợp lệ.';
            } else if (error.message.includes('weak password')) {
                errorMessage = 'Mật khẩu quá yếu. Vui lòng nhập ít nhất 6 ký tự.';
            } else if (error.message.includes('only request this after')) {
                errorMessage = 'Vui lòng chờ một chút trước khi thử lại.';
            } else if (error.message.includes('Network request failed') || error.name === 'AuthRetryableFetchError') {
                errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
            } else {
                errorMessage = error.message;
            }

            return { success: false, error: errorMessage };
        }
    },

    // Sign out
    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    },

    // Listen to auth state changes
    subscribeToAuthChanges(callback) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
        return () => subscription.unsubscribe();
    },

    // Send password reset email
    async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }
    },

    // Phone Authentication logic will be handled directly in components 
    // because it requires a recaptcha verifier component from Expo.
    // However, we can add a helper for verification.
    async verifyOtp(confirmationResult, code) {
        try {
            const result = await confirmationResult.confirm(code);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('OTP Verification error:', error);
            return { success: false, error: error.message };
        }
    },

    // Update user profile metadata
    async updateUserProfile(updates) {
        try {
            const { data, error } = await supabase.auth.updateUser({
                data: updates
            });

            if (error) throw error;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Update Profile error:', error);
            return { success: false, error: error.message };
        }
    }
};
