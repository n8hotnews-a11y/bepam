import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { familyMemberService } from '../services/familyMemberService';
import { supabase } from '../services/supabaseConfig';
import FamilyMemberCard from '../components/FamilyMemberCard';

const FamilyMembersScreen = ({ navigation }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchMembers();
        }, [])
    );

    const fetchMembers = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) return;

        setLoading(true);
        const result = await familyMemberService.getFamilyMembers(user_id);
        if (result.success) {
            setMembers(result.members);
        }
        setLoading(false);
    };

    const handleDeleteMember = (member) => {
        Alert.alert(
            'Xóa thành viên',
            `Bạn có chắc chắn muốn xóa ${member.name} khỏi danh sách thành viên gia đình?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await familyMemberService.deleteFamilyMember(member.id);
                        if (result.success) {
                            // Also delete avatar if exists
                            if (member.avatarUrl) {
                                await familyMemberService.deleteAvatar(member.avatarUrl);
                            }
                            setMembers(prev => prev.filter(m => m.id !== member.id));
                        } else {
                            Alert.alert('Lỗi', result.error || 'Không thể xóa thành viên');
                        }
                    }
                }
            ]
        );
    };

    const renderMember = ({ item }) => (
        <FamilyMemberCard
            member={item}
            onPress={() => navigation.navigate('AddEditFamilyMember', { member: item })}
            onDelete={() => handleDeleteMember(item)}
        />
    );

    if (loading) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="chevron-left" size={32} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Thành viên gia đình</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('AddEditFamilyMember')}
                    >
                        <MaterialIcons name="add" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                </View>

                {members.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.iconContainer}>
                            <View style={styles.circle}>
                                <MaterialIcons name="family-restroom" size={48} color={COLORS.grayLight} />
                            </View>
                        </View>
                        <Text style={styles.emptyTitle}>Chưa có thành viên nào</Text>
                        <Text style={styles.emptyDescription}>
                            Thêm thành viên gia đình để Bếp Ấm có thể cá nhân hóa gợi ý món ăn phù hợp với sở thích và sức khỏe của từng người.
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => navigation.navigate('AddEditFamilyMember')}
                        >
                            <MaterialIcons name="add" size={24} color={COLORS.textOnPrimary} />
                            <Text style={styles.primaryButtonText}>Thêm thành viên</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={members}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMember}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 40,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        fontFamily: FONTS.bold,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    iconContainer: {
        marginBottom: SPACING.lg,
    },
    circle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyTitle: {
        ...TYPOGRAPHY.heading2,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    emptyDescription: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.lg,
        gap: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    primaryButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textOnPrimary,
        fontFamily: FONTS.bold,
    },
    listContainer: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: 100,
    },
});

export default FamilyMembersScreen;