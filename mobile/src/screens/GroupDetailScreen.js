import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    TextInput,
    Image,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { communityService } from '../services/communityService';
import { supabase } from '../services/supabaseConfig';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { vi } from 'date-fns/locale/vi';

const GroupDetailScreen = ({ route, navigation }) => {
    const { group } = route.params;
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        getUser();
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setLoading(true);
        const result = await communityService.getGroupPosts(group.id);
        if (result.success) {
            setPosts(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim()) return;

        setIsPosting(true);
        try {
            const result = await communityService.createGroupPost(group.id, currentUser.id, newPostContent);
            if (result.success) {
                setNewPostContent('');
                fetchPosts();
            } else {
                Alert.alert('Lỗi', 'Không thể đăng bài lúc này.');
            }
        } catch (error) {
            console.error('Create post error:', error);
        } finally {
            setIsPosting(false);
        }
    };

    const renderPostItem = ({ item }) => (
        <View style={styles.postCard}>
            <View style={styles.postHeader}>
                <View style={styles.avatarMini}>
                    <Text style={styles.avatarText}>{item.user?.email?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
                <View style={styles.postHeaderInfo}>
                    <Text style={styles.postAuthor}>{item.user?.email?.split('@')[0] || 'Cư dân'}</Text>
                    <Text style={styles.postTime}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: vi })}
                    </Text>
                </View>
                <TouchableOpacity>
                    <MaterialIcons name="more-horiz" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
            </View>
            <Text style={styles.postContent}>{item.content}</Text>
            {item.images && item.images.length > 0 && (
                <Image source={{ uri: item.images[0] }} style={styles.postImage} />
            )}
            <View style={styles.postFooter}>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialIcons name="favorite-border" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>{item.likes_count || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialIcons name="chat-bubble-outline" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>Bình luận</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialIcons name="share" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{group.name}</Text>
                    <Text style={styles.headerSub}>{group.type === 'official' ? 'Chính thức' : 'Sở thích'}</Text>
                </View>
                <TouchableOpacity style={styles.backBtn}>
                    <MaterialIcons name="info-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {loading && !refreshing ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator color={COLORS.primary} size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={posts}
                        renderItem={renderPostItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchPosts();
                        }}
                        refreshing={refreshing}
                        ListHeaderComponent={
                            <View style={styles.inputCard}>
                                <View style={styles.avatarMini}>
                                    <Text style={styles.avatarText}>{currentUser?.email?.[0]?.toUpperCase() || '?'}</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Bạn đang nghĩ gì?"
                                    multiline
                                    value={newPostContent}
                                    onChangeText={setNewPostContent}
                                />
                                <TouchableOpacity
                                    style={[styles.sendBtn, !newPostContent.trim() && styles.sendBtnDisabled]}
                                    onPress={handleCreatePost}
                                    disabled={!newPostContent.trim() || isPosting}
                                >
                                    {isPosting ? <ActivityIndicator size="small" color={COLORS.white} /> : <MaterialIcons name="send" size={20} color={COLORS.white} />}
                                </TouchableOpacity>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="chat" size={64} color={COLORS.border} />
                                <Text style={styles.emptyTitle}>Chưa có bài viết nào</Text>
                                <Text style={styles.emptySub}>Hãy là người đầu tiên chia sẻ nhé!</Text>
                            </View>
                        }
                    />
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
        backgroundColor: COLORS.background,
    },
    backBtn: {
        padding: 4,
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: SPACING.sm,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        fontFamily: FONTS.bold,
    },
    headerSub: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    listContent: {
        padding: SPACING.md,
    },
    inputCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    avatarMini: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
        fontSize: 14,
    },
    input: {
        flex: 1,
        marginLeft: SPACING.sm,
        marginRight: SPACING.sm,
        fontSize: 16,
        color: COLORS.textPrimary,
        maxHeight: 100,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: COLORS.textMuted,
    },
    postCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    postHeaderInfo: {
        flex: 1,
        marginLeft: SPACING.sm,
    },
    postAuthor: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    postTime: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    postContent: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        lineHeight: 22,
        marginBottom: SPACING.sm,
    },
    postImage: {
        width: '100%',
        height: 200,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
    },
    postFooter: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        paddingTop: SPACING.sm,
        gap: SPACING.lg,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        fontFamily: FONTS.medium,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
    },
    emptySub: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        marginTop: 4,
    },
});

export default GroupDetailScreen;
