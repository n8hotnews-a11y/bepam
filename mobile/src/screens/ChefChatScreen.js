import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';

import { subscriptionService } from '../services/subscriptionService';
import { supabase } from '../services/supabaseConfig';
import { Alert } from 'react-native';
import { chatSessionService } from '../services/chatSessionService';

const FormattedText = ({ text, style, isUser }) => {
    if (!text) return null;

    // Split by ** and handle bold parts
    const segments = text.split(/(\*\*.*?\*\*)/g);

    return (
        <Text style={style}>
            {segments.map((segment, index) => {
                if (segment.startsWith('**') && segment.endsWith('**')) {
                    return (
                        <Text key={index} style={{ fontFamily: FONTS.bold }}>
                            {segment.slice(2, -2)}
                        </Text>
                    );
                }
                return segment;
            })}
        </Text>
    );
};

const ChefChatScreen = ({ route, navigation }) => {
    const { screenContext = 'default', contextData = null } = route.params || {};

    const [messages, setMessages] = useState(() => {
        const history = chatSessionService.getHistory();
        if (history.length > 0) return history;

        return [
            {
                id: '1',
                text: contextData?.greeting || 'Chào bạn! Tôi là Bếp Trưởng AI. Bạn cần tôi giúp gì hôm nay?',
                isUser: false,
                timestamp: new Date(),
            }
        ];
    });

    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const flatListRef = useRef(null);

    useEffect(() => {
        checkPremiumStatus();
    }, []);

    const checkPremiumStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const status = await subscriptionService.getSubscriptionStatus(user.id);
            setIsPremium(status.isPremium || status.is_premium); // Handle both case styles if uncertain, though service returns snake_case usually or mapped. Service returns is_premium.
        }
    };

    const quickSuggestions = contextData?.suggestions || [
        'Gợi ý món ăn hôm nay',
        'Cách bảo quản rau tươi',
        'Món gì ngon với trứng?'
    ];

    const sendMessage = async (text) => {
        const messageText = typeof text === 'string' ? text : inputText;
        if (!messageText.trim() || loading) return;

        const userMsgCount = messages.filter(m => m.isUser).length;
        // Gating logic removed: All users have unlimited chat.

        const userMessage = {
            id: Date.now().toString(),
            text: messageText,
            isUser: true,
            timestamp: new Date(),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        chatSessionService.setHistory(newMessages);

        setInputText('');
        setLoading(true);

        // Prepare history for API
        const history = messages.map(m => ({
            role: m.isUser ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));

        // Add context to the prompt
        const systemPrompt = contextData?.systemPrompt || '';
        const finalPrompt = systemPrompt ? `[Context: ${systemPrompt}] ${messageText}` : messageText;

        const result = await recipeService.chatWithChef(finalPrompt, history);

        if (result.success) {
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                text: result.text,
                isUser: false,
                timestamp: new Date(),
            };
            const updatedHistory = [...newMessages, aiMessage];
            setMessages(updatedHistory);
            chatSessionService.setHistory(updatedHistory);
        } else {
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                text: 'Xin lỗi, tôi gặp chút trục trặc. Bạn có thể thử lại sau giây lát được không?',
                isUser: false,
                timestamp: new Date(),
            };
            const updatedHistory = [...newMessages, errorMessage];
            setMessages(updatedHistory);
            chatSessionService.setHistory(updatedHistory);
        }

        setLoading(false);
    };

    const handleQuickSuggestion = (suggestion) => {
        sendMessage(suggestion);
    };

    useEffect(() => {
        if (flatListRef.current) {
            setTimeout(() => {
                flatListRef.current.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, loading]);

    const renderMessage = ({ item }) => (
        <View style={[styles.messageBubble, item.isUser ? styles.userBubble : styles.aiBubble]}>
            {!item.isUser && (
                <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>👨‍🍳</Text>
                </View>
            )}
            <View style={[styles.messageContent, item.isUser ? styles.userContent : styles.aiContent]}>
                <FormattedText
                    text={item.text}
                    style={[styles.messageText, item.isUser && styles.userText]}
                    isUser={item.isUser}
                />
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="chevron-left" size={32} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Bếp Trưởng AI</Text>
                        <View style={styles.onlineIndicator}>
                            <View style={styles.greenDot} />
                            <Text style={styles.onlineText}>Đang trực tuyến</Text>
                        </View>
                    </View>
                    <View style={styles.placeholder} />
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.chatContainer}
                    showsVerticalScrollIndicator={false}
                />

                {/* Suggestions */}
                <View>
                    {!loading && messages.length < 5 && (
                        <View style={styles.suggestionsWrapper}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.suggestionsContainer}
                            >
                                {quickSuggestions.map((suggestion, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.suggestionChip}
                                        onPress={() => handleQuickSuggestion(suggestion)}
                                    >
                                        <Text style={styles.suggestionText}>{suggestion}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {loading && (
                        <View style={styles.typingIndicator}>
                            <View style={styles.aiAvatar}>
                                <Text style={styles.aiAvatarText}>👨‍🍳</Text>
                            </View>
                            <View style={styles.typingDots}>
                                <ActivityIndicator size="small" color={COLORS.primary} />
                                <Text style={styles.typingText}>Đang suy nghĩ...</Text>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Hỏi về món ăn, mẹo nấu..."
                        placeholderTextColor={COLORS.textMuted}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                        onPress={() => sendMessage()}
                        disabled={!inputText.trim() || loading}
                    >
                        <MaterialIcons name="send" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                </View>
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
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        fontSize: 18, // Title size special for this header
        color: COLORS.textPrimary,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    greenDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.success,
    },
    onlineText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success,
    },
    placeholder: {
        width: 40,
    },
    chatContainer: {
        padding: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    messageBubble: {
        flexDirection: 'row',
        marginBottom: SPACING.md,
        maxWidth: '85%',
    },
    userBubble: {
        alignSelf: 'flex-end',
    },
    aiBubble: {
        alignSelf: 'flex-start',
    },
    aiAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    aiAvatarText: {
        fontSize: 22,
    },
    messageContent: {
        padding: SPACING.md,
        borderRadius: RADIUS.lg,
        maxWidth: '100%',
    },
    userContent: {
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 4,
    },
    aiContent: {
        backgroundColor: COLORS.backgroundCard,
        borderBottomLeftRadius: 4,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    messageText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    userText: {
        color: COLORS.textOnPrimary,
    },
    suggestionsWrapper: {
        height: 60,
        marginBottom: SPACING.md,
    },
    suggestionsContainer: {
        paddingHorizontal: SPACING.xl,
        alignItems: 'center',
    },
    suggestionChip: {
        backgroundColor: COLORS.backgroundCard,
        paddingHorizontal: SPACING.md,
        paddingVertical: 10,
        borderRadius: RADIUS.pill,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        marginRight: SPACING.sm,
        alignSelf: 'center',
    },
    suggestionText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.sm,
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        gap: SPACING.sm,
    },
    typingText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: SPACING.md,
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: SPACING.sm,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.xl,
        paddingHorizontal: 18,
        paddingVertical: 12,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: COLORS.grayLight,
    },
});

export default ChefChatScreen;
