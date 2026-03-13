import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    FlatList, KeyboardAvoidingView, Platform, Animated,
    Dimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { chatbotAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
    actions?: string[];
    issues?: Array<{ id: string; title: string; status?: string; severity?: string }>;
    loading?: boolean;
}

const QUICK_ACTIONS = [
    { id: 'nearby', label: 'Issues near me', icon: 'location-outline', message: 'Check my area for issues' },
    { id: 'weekly', label: 'Weekly report', icon: 'bar-chart-outline', message: 'Show me the weekly report' },
    { id: 'my_status', label: 'My reports', icon: 'document-text-outline', message: 'What is the status of my issues?' },
    { id: 'critical', label: 'Critical', icon: 'alert-circle-outline', message: 'Show critical issues' },
    { id: 'stats', label: 'Stats', icon: 'stats-chart-outline', message: 'Show me the statistics' },
    { id: 'help', label: 'Help', icon: 'help-circle-outline', message: 'What can you help me with?' },
];

export default function ChatbotScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, userLocation } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

        // Welcome message
        setMessages([{
            id: 'welcome',
            text: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm your UrbanFix AI assistant.\n\nI can help you check nearby issues, get status updates, view weekly reports, and more.\n\nTap a quick action below or type your question!`,
            sender: 'bot',
            timestamp: new Date(),
            actions: ['Check my area', 'Weekly report', 'My reports'],
        }]);
    }, []);

    const scrollToEnd = useCallback(() => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || sending) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            text: text.trim(),
            sender: 'user',
            timestamp: new Date(),
        };

        const loadingMsg: ChatMessage = {
            id: `loading-${Date.now()}`,
            text: '',
            sender: 'bot',
            timestamp: new Date(),
            loading: true,
        };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setInput('');
        setSending(true);
        scrollToEnd();

        try {
            const location = userLocation ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
            } : undefined;

            const { data } = await chatbotAPI.sendMessage(text.trim(), location);

            const botMsg: ChatMessage = {
                id: `bot-${Date.now()}`,
                text: data.text,
                sender: 'bot',
                timestamp: new Date(),
                actions: data.actions,
                issues: data.issues,
            };

            setMessages(prev => prev.filter(m => !m.loading).concat(botMsg));
        } catch (error: any) {
            const errorMsg: ChatMessage = {
                id: `error-${Date.now()}`,
                text: 'Sorry, I couldn\'t process that. Please check your connection and try again.',
                sender: 'bot',
                timestamp: new Date(),
                actions: ['Try again', 'Help'],
            };
            setMessages(prev => prev.filter(m => !m.loading).concat(errorMsg));
        }

        setSending(false);
        scrollToEnd();
    }, [sending, userLocation, scrollToEnd]);

    const handleQuickAction = useCallback((message: string) => {
        sendMessage(message);
    }, [sendMessage]);

    const handleIssuePress = useCallback((issueId: string) => {
        navigation.navigate('IssueDetail', { issueId });
    }, [navigation]);

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
        const isUser = item.sender === 'user';

        if (item.loading) {
            return (
                <View style={[styles.msgRow, styles.botRow]}>
                    <View style={styles.botAvatar}>
                        <Ionicons name="chatbubble-ellipses" size={16} color="#0A84FF" />
                    </View>
                    <View style={[styles.msgBubble, styles.botBubble]}>
                        <View style={styles.typingDots}>
                            <ActivityIndicator size="small" color="#0A84FF" />
                            <Text style={styles.typingText}>Thinking...</Text>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.msgRow, isUser ? styles.userRow : styles.botRow]}>
                {!isUser && (
                    <View style={styles.botAvatar}>
                        <Ionicons name="sparkles" size={14} color="#0A84FF" />
                    </View>
                )}
                <View style={{ maxWidth: width * 0.78, flexShrink: 1 }}>
                    <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.botBubble]}>
                        <Text style={[styles.msgText, isUser && styles.userText]}>
                            {item.text}
                        </Text>
                    </View>

                    {/* Issue chips */}
                    {item.issues && item.issues.length > 0 && (
                        <View style={styles.issueChipsRow}>
                            {item.issues.slice(0, 4).map((issue) => (
                                <TouchableOpacity
                                    key={issue.id}
                                    style={styles.issueChip}
                                    onPress={() => handleIssuePress(issue.id)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.issueChipText} numberOfLines={1}>
                                        {issue.title}
                                    </Text>
                                    <Ionicons name="open-outline" size={12} color="#0A84FF" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Suggested actions */}
                    {item.actions && item.actions.length > 0 && (
                        <View style={styles.actionsRow}>
                            {item.actions.map((action, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.actionChip}
                                    onPress={() => handleQuickAction(action)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.actionChipText}>{action}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        );
    }, [handleQuickAction, handleIssuePress]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerTitle}>UrbanFix AI</Text>
                </View>
                <View style={{ width: 38 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Quick actions strip */}
                {messages.length <= 1 && (
                    <Animated.View style={[styles.quickActionsWrap, { opacity: fadeAnim }]}>
                        <FlatList
                            data={QUICK_ACTIONS}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={i => i.id}
                            contentContainerStyle={styles.quickActionsContent}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.quickAction}
                                    onPress={() => handleQuickAction(item.message)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.quickActionIcon}>
                                        <Ionicons name={item.icon as any} size={18} color="#0A84FF" />
                                    </View>
                                    <Text style={styles.quickActionLabel}>{item.label}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </Animated.View>
                )}

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={i => i.id}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToEnd}
                />

                {/* Input */}
                <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
                    <View style={styles.inputWrap}>
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder="Ask about issues, reports, stats..."
                            placeholderTextColor={colors.textMuted}
                            value={input}
                            onChangeText={setInput}
                            multiline
                            maxLength={500}
                            onSubmitEditing={() => sendMessage(input)}
                            blurOnSubmit={false}
                        />
                        <TouchableOpacity
                            onPress={() => sendMessage(input)}
                            disabled={!input.trim() || sending}
                            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.3 }]}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['#0A84FF', '#0055CC']}
                                style={styles.sendBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="send" size={16} color="#FFF" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerDot: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: '#30D158',
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text, letterSpacing: -0.3 },

    // Quick actions
    quickActionsWrap: {
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    quickActionsContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
    quickAction: {
        alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        minWidth: 80,
    },
    quickActionIcon: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: 'rgba(10,132,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    quickActionLabel: {
        fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.textSecondary,
    },

    // Messages
    messagesList: { padding: 16, paddingBottom: 8 },
    msgRow: { marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end' },
    userRow: { justifyContent: 'flex-end' },
    botRow: { justifyContent: 'flex-start', gap: 8 },

    botAvatar: {
        width: 28, height: 28, borderRadius: 10,
        backgroundColor: 'rgba(10,132,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(10,132,255,0.15)',
    },

    msgBubble: {
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 16, maxWidth: width * 0.78,
    },
    userBubble: {
        backgroundColor: '#0A84FF',
        borderBottomRightRadius: 4,
    },
    botBubble: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        borderBottomLeftRadius: 4,
    },
    msgText: {
        fontFamily: 'Inter_400Regular', fontSize: 14,
        color: colors.textSecondary, lineHeight: 21,
    },
    userText: { color: '#FFFFFF' },

    typingDots: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 4,
    },
    typingText: {
        fontFamily: 'Inter_400Regular', fontSize: 13,
        color: colors.textMuted,
    },

    // Issue chips
    issueChipsRow: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 6,
        marginTop: 8, marginLeft: 36,
    },
    issueChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 10, backgroundColor: 'rgba(10,132,255,0.08)',
        borderWidth: 1, borderColor: 'rgba(10,132,255,0.15)',
        maxWidth: width * 0.6,
    },
    issueChipText: {
        fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0A84FF',
        flex: 1,
    },

    // Action suggestions
    actionsRow: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 6,
        marginTop: 8, marginLeft: 36,
    },
    actionChip: {
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    actionChipText: {
        fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.text,
    },

    // Input bar
    inputBar: {
        paddingHorizontal: 12, paddingTop: 8,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
    },
    inputWrap: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
    },
    input: {
        flex: 1, fontFamily: 'Inter_400Regular', color: colors.text,
        fontSize: 15, maxHeight: 100, paddingVertical: 6,
    },
    sendBtn: {},
    sendBtnGradient: {
        width: 36, height: 36, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
});
