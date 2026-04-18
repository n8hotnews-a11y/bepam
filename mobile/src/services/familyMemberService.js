import { supabase } from './supabaseConfig';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const COLLECTION_NAME = 'familymembers';

export const familyMemberService = {
    /**
     * Get all family members for a user
     */
    async getFamilyMembers(user_id) {
        try {
            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .select('*')
                .eq('user_id', user_id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, members: data };
        } catch (error) {
            console.error('Error getting family members:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Add a new family member
     */
    async addFamilyMember(user_id, memberData) {
        try {
            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .insert({
                    ...memberData,
                    user_id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();
            if (error) throw error;
            return { success: true, id: data.id };
        } catch (error) {
            console.error('Error adding family member:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update family member
     */
    async updateFamilyMember(memberId, memberData) {
        try {
            const { error } = await supabase
                .from(COLLECTION_NAME)
                .update({
                    ...memberData,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', memberId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating family member:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete family member
     */
    async deleteFamilyMember(memberId) {
        try {
            const { error } = await supabase
                .from(COLLECTION_NAME)
                .delete()
                .eq('id', memberId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting family member:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Helper to upload any file to Supabase Storage
     */
    async uploadFile(bucket, user_id, fileUri, fileName) {
        try {
            let base64;

            // Handle different URI types
            if (fileUri.startsWith('ph://') || fileUri.startsWith('content://')) {
                // For iOS photo library and Android content URIs
                // Copy to cache first, then read
                const cacheFile = FileSystem.cacheDirectory + 'temp_' + Date.now();
                await FileSystem.copyAsync({ from: fileUri, to: cacheFile });
                base64 = await FileSystem.readAsStringAsync(cacheFile, {
                    encoding: 'base64',
                });
                // Clean up temp file
                await FileSystem.deleteAsync(cacheFile, { idempotent: true });
            } else {
                // For file:// URIs
                base64 = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: 'base64',
                });
            }

            const arrayBuffer = decode(base64);
            const path = `${user_id}/${fileName}`;

            const { data, error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
            return { success: true, url: publicUrl };
        } catch (error) {
            console.error(`Error uploading to ${bucket}:`, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Upload avatar image
     */
    async uploadAvatar(user_id, imageUri, fileName = 'avatar.jpg') {
        return this.uploadFile('avatars', user_id, imageUri, fileName);
    },

    /**
     * Upload medical record (image or document)
     */
    async uploadMedicalRecord(user_id, fileUri, fileName) {
        return this.uploadFile('medical_records', user_id, fileUri, fileName);
    },

    /**
     * Delete file from Storage
     */
    async deleteFile(bucket, fileUrl) {
        try {
            if (!fileUrl) return { success: true };
            const url = new URL(fileUrl);
            const path = url.pathname.split('/').slice(-2).join('/');
            const { error } = await supabase.storage.from(bucket).remove([path]);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error(`Error deleting from ${bucket}:`, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete avatar
     */
    async deleteAvatar(avatarUrl) {
        return this.deleteFile('avatars', avatarUrl);
    },

    /**
     * Get family constraints for recipe personalization
     */
    async getFamilyConstraints(user_id) {
        try {
            const result = await this.getFamilyMembers(user_id);
            if (!result.success) return result;

            const members = result.members;

            // Aggregate dietary preferences and health conditions
            const allPreferences = new Set();
            const allConditions = new Set();

            members.forEach(member => {
                // Add dietary preferences
                member.dietary_preferences?.forEach(pref => allPreferences.add(pref));

                // Add health conditions
                member.health_conditions?.predefined?.forEach(cond => allConditions.add(cond));
                if (member.health_conditions?.notes) {
                    // Simple keyword extraction for notes
                    const keywords = ['tiểu đường', 'huyết áp', 'dị ứng', 'lactose'];
                    keywords.forEach(keyword => {
                        if (member.health_conditions.notes.toLowerCase().includes(keyword)) {
                            allConditions.add(keyword);
                        }
                    });
                }
            });

            return {
                success: true,
                constraints: {
                    dietaryPreferences: Array.from(allPreferences),
                    healthConditions: Array.from(allConditions),
                    memberCount: members.length
                }
            };
        } catch (error) {
            console.error('Error getting family constraints:', error);
            return { success: false, error: error.message };
        }
    }
};