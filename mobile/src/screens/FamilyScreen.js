import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    Share,
    ActivityIndicator,
    Clipboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { householdService } from '../services/householdService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast, showErrorToast } from '../components/Toast';

const FamilyScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [household, setHousehold] = useState(null);
    const [members, setMembers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    // Form states
    const [joinCode, setJoinCode] = useState('');
    const [newFamilyName, setNewFamilyName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            if (user) {
                const { household: hh } = await householdService.getUserHousehold(user.id);
                setHousehold(hh);

                if (hh) {
                    const { members: mems } = await householdService.getHouseholdMembers(hh.id);
                    setMembers(mems || []);
                }
            }
        } catch (error) {
            console.error('Load family data error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFamily = async () => {
        if (!newFamilyName.trim()) {
            Alert.alert('Vui lòng nhập tên gia đình');
            return;
        }

        setIsCreating(true);
        try {
            const result = await householdService.createHousehold(newFamilyName, currentUser.id);
            if (result.success) {
                showSuccessToast('Đã tạo gia đình thành công!');
                loadData(); // Reload to show dashboard
            } else {
                showErrorToast(result.error || 'Có lỗi xảy ra');
            }
        } catch (error) {
            showErrorToast('Lỗi kết nối');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinFamily = async () => {
        if (!joinCode.trim() || joinCode.length < 6) {
            Alert.alert('Mã gia đình không hợp lệ');
            return;
        }

        setIsJoining(true);
        try {
            const result = await householdService.joinByCode(joinCode, currentUser.id);
            if (result.success) {
                showSuccessToast('Chào mừng bạn về nhà!');
                loadData();
            } else {
                Alert.alert('Lỗi', result.error || 'Mã mời không đúng hoặc bạn đã tham gia.');
            }
        } catch (error) {
            showErrorToast('Lỗi kết nối');
        } finally {
            setIsJoining(false);
        }
    };

    const handleCopyCode = () => {
        if (household?.invite_code) {
            Clipboard.setString(household.invite_code);
            showSuccessToast('Đã sao chép mã mời');
        }
    };

    const handleShareCode = async () => {
        try {
            await Share.share({
                message: `Tham gia gia đình "${household.name}" trên Bếp Ấm với mã: ${household.invite_code}`,
            });
        } catch (error) {
            console.log(error);
        }
    };

    const handleLeaveFamily = () => {
        Alert.alert(
            "Rời gia đình?",
            "Bạn sẽ không còn nhìn thấy tủ lạnh và thực đơn chung nữa.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Rời đi",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        await householdService.leaveHousehold(household.id, currentUser.id);
                        setHousehold(null);
                        setMembers([]);
                        setLoading(false);
                        showSuccessToast('Đã rời gia đình');
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // --- State 1: No Household ---
    if (!household) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Gia đình Bếp Ấm</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.heroSection}>
                        <View style={styles.heroIconCircle}>
                            <MaterialIcons name="family-restroom" size={60} color={COLORS.primary} />
                        </View>
                        <Text style={styles.heroTitle}>Bếp Ấm thêm vui</Text>
                        <Text style={styles.heroText}>
                            Tạo hoặc tham gia gia đình để cùng nhau quản lý tủ lạnh, lên thực đơn và đi chợ chung.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Tạo gia đình mới</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Đặt tên gia đình (VD: Nhà Tấm Cám)"
                            placeholderTextColor={COLORS.textSecondary}
                            value={newFamilyName}
                            onChangeText={setNewFamilyName}
                        />
                        <TouchableOpacity
                            style={[styles.btnPrimary, isCreating && styles.btnDisabled]}
                            onPress={handleCreateFamily}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.btnTextPrimary}>Khởi tạo ngay</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>HOẶC</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Tham gia bằng mã mời</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nhập mã 6 ký tự (VD: A1B2C3)"
                            placeholderTextColor={COLORS.textSecondary}
                            value={joinCode}
                            onChangeText={(t) => setJoinCode(t.toUpperCase())}
                            maxLength={6}
                        />
                        <TouchableOpacity
                            style={[styles.btnSecondary, isJoining && styles.btnDisabled]}
                            onPress={handleJoinFamily}
                            disabled={isJoining}
                        >
                            {isJoining ? (
                                <ActivityIndicator color={COLORS.primary} />
                            ) : (
                                <Text style={styles.btnTextSecondary}>Tham gia</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // --- State 2: Member of Household ---
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{household.name}</Text>
                <TouchableOpacity onPress={loadData} style={styles.backBtn}>
                    <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Invite Code Section */}
                <View style={styles.inviteCard}>
                    <View>
                        <Text style={styles.inviteLabel}>Mã mời thành viên</Text>
                        <Text style={styles.inviteCode}>{household.invite_code}</Text>
                    </View>
                    <View style={styles.inviteActions}>
                        <TouchableOpacity style={styles.iconBtn} onPress={handleCopyCode}>
                            <MaterialIcons name="content-copy" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={handleShareCode}>
                            <MaterialIcons name="share" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
                <Text style={styles.inviteHint}>Chia sẻ mã này cho người thân để mời họ vào nhà.</Text>

                {/* Members List */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Thành viên ({members.length})</Text>
                    <TouchableOpacity
                        style={styles.manageDetailBtn}
                        onPress={() => navigation.navigate('FamilyMembers')}
                    >
                        <Text style={styles.manageDetailText}>Quản lý chi tiết</Text>
                        <MaterialIcons name="chevron-right" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.membersList}>
                    {members.map((mem) => (
                        <View key={mem.user_id} style={styles.memberItem}>
                            <View style={styles.memberAvatar}>
                                <Text style={styles.avatarText}>
                                    {mem.user?.email?.[0]?.toUpperCase() || 'U'}
                                </Text>
                            </View>
                            <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>
                                    {mem.user?.email?.split('@')[0] || 'Thành viên'}
                                    {mem.user_id === currentUser.id && ' (Bạn)'}
                                </Text>
                                <Text style={styles.memberRole}>
                                    {mem.role === 'admin' ? 'Chủ nhà' : 'Thành viên'}
                                </Text>
                            </View>
                            {mem.role === 'admin' && (
                                <MaterialIcons name="verified-user" size={20} color={COLORS.primary} />
                            )}
                        </View>
                    ))}
                </View>

                {/* Actions */}
                <View style={styles.footerActions}>
                    <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveFamily}>
                        <MaterialIcons name="logout" size={20} color={COLORS.danger} />
                        <Text style={styles.leaveText}>Rời khỏi gia đình</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        backgroundColor: COLORS.background,
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        fontFamily: FONTS.bold,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    // No Household Styles
    heroSection: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
        marginTop: SPACING.lg,
    },
    heroIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primaryFade,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    heroTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.primary,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    heroText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: SPACING.xl,
    },
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        ...TYPOGRAPHY.h3,
        marginBottom: SPACING.md,
        color: COLORS.textPrimary,
    },
    input: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        fontFamily: FONTS.medium,
        color: COLORS.textPrimary,
    },
    btnPrimary: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
    },
    btnTextPrimary: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
        fontSize: 16,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.xl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.borderLight,
    },
    dividerText: {
        marginHorizontal: SPACING.md,
        color: COLORS.textMuted,
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
    },
    btnSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
    },
    btnTextSecondary: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
        fontSize: 16,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    // Household Styles
    inviteCard: {
        backgroundColor: '#FFFBEB',
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    inviteLabel: {
        ...TYPOGRAPHY.caption,
        color: '#B45309',
        fontFamily: FONTS.bold,
        marginBottom: 2,
    },
    inviteCode: {
        fontSize: 24,
        fontFamily: FONTS.bold,
        color: '#D97706',
        letterSpacing: 2,
    },
    inviteActions: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    iconBtn: {
        padding: 8,
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.circle,
    },
    inviteHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        marginBottom: SPACING.xl,
        textAlign: 'center',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
    },
    manageDetailBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    manageDetailText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
        marginRight: 2,
    },
    membersList: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.sm,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    avatarText: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
        fontSize: 18,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    memberRole: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    footerActions: {
        marginTop: SPACING.xxl,
    },
    leaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.md,
        backgroundColor: '#FEF2F2',
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    leaveText: {
        marginLeft: SPACING.sm,
        color: COLORS.danger,
        fontFamily: FONTS.bold,
    }
});

export default FamilyScreen;
