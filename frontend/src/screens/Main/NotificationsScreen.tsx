/**
 * NotificationsScreen — Real-time notifications with swipe-to-delete,
 * tap-to-mark-read, clear all, and auto-polling.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
    ActivityIndicator, Animated, PanResponder, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { notificationsAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = -80;

const ICONS: Record<string, { name: string; color: string }> = {
    status: { name: 'sync-circle', color: colors.primary },
    upvote: { name: 'arrow-up-circle', color: '#FF6B35' },
    comment: { name: 'chatbubble', color: colors.secondary },
    badge: { name: 'ribbon', color: '#FFD60A' },
    points: { name: 'star', color: colors.success },
    resolved: { name: 'checkmark-circle', color: colors.success },
};

const POLL_INTERVAL = 15000; // 15s auto-refresh

/* ── Swipeable notification card ── */
function SwipeableNotifCard({ item, onDelete, onTap }: {
    item: any; onDelete: (id: string) => void; onTap: (item: any) => void;
}) {
    const icon = ICONS[item.type] || ICONS.status;
    const translateX = useRef(new Animated.Value(0)).current;
    const rowHeight = useRef(new Animated.Value(1)).current;
    const isSwiped = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 20,
            onPanResponderGrant: () => {},
            onPanResponderMove: (_, g) => {
                if (g.dx < 0) translateX.setValue(g.dx);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dx < SWIPE_THRESHOLD) {
                    isSwiped.current = true;
                    Animated.timing(translateX, {
                        toValue: -SCREEN_WIDTH,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        Animated.timing(rowHeight, {
                            toValue: 0,
                            duration: 180,
                            useNativeDriver: false,
                        }).start(() => onDelete(item._id));
                    });
                } else {
                    Animated.spring(translateX, {
                        toValue: 0,
                        friction: 8,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const deleteIconOpacity = translateX.interpolate({
        inputRange: [-100, -40, 0],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View style={{ overflow: 'hidden', maxHeight: rowHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }) }}>
            {/* Delete background */}
            <View style={styles.swipeDeleteBg}>
                <Animated.View style={{ opacity: deleteIconOpacity, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="trash-outline" size={20} color="#FFF" />
                    <Text style={styles.swipeDeleteText}>Delete</Text>
                </Animated.View>
            </View>

            {/* Card */}
            <Animated.View
                {...panResponder.panHandlers}
                style={{ transform: [{ translateX }] }}
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onTap(item)}
                    style={[styles.notifCard, !item.read && styles.notifUnread]}
                >
                    {!item.read && <View style={styles.unreadDot} />}
                    <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
                        <Ionicons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.notifTitle}>{item.title}</Text>
                        <Text style={styles.notifDesc} numberOfLines={2}>{item.desc}</Text>
                        <Text style={styles.notifTime}>{item.timeAgo}</Text>
                    </View>
                    {!item.read && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const fetchNotifs = useCallback(async () => {
        try {
            const { data } = await notificationsAPI.getAll();
            const mapped = (data.notifications || []).map((n: any) => ({
                ...n,
                timeAgo: getTimeAgo(n.createdAt),
            }));
            setNotifications(mapped);
            setUnreadCount(data.unreadCount || 0);
        } catch (e) { console.log('Notif error:', e); }
    }, []);

    // Initial load
    useEffect(() => {
        fetchNotifs().finally(() => setLoading(false));
    }, []);

    // Auto-poll when screen is focused
    useEffect(() => {
        if (!isFocused) return;
        const interval = setInterval(fetchNotifs, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [isFocused, fetchNotifs]);

    // Refresh time-ago text every minute
    useEffect(() => {
        if (!isFocused) return;
        const interval = setInterval(() => {
            setNotifications(prev => prev.map(n => ({
                ...n,
                timeAgo: getTimeAgo(n.createdAt),
            })));
        }, 60000);
        return () => clearInterval(interval);
    }, [isFocused]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifs();
        setRefreshing(false);
    };

    const markAllRead = async () => {
        try {
            await notificationsAPI.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (e) { console.log('Mark read error:', e); }
    };

    const handleTap = async (item: any) => {
        if (!item.read) {
            try {
                await notificationsAPI.markRead(item._id);
                setNotifications(prev => prev.map(n =>
                    n._id === item._id ? { ...n, read: true } : n
                ));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (e) { console.log('Mark single read error:', e); }
        }
    };

    const handleDelete = async (id: string) => {
        const wasUnread = notifications.find(n => n._id === id && !n.read);
        setNotifications(prev => prev.filter(n => n._id !== id));
        if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
        try {
            await notificationsAPI.deleteOne(id);
        } catch (e) {
            console.log('Delete error:', e);
            fetchNotifs(); // re-sync on error
        }
    };

    const handleClearAll = () => {
        if (notifications.length === 0) return;
        Alert.alert(
            'Clear All Notifications',
            'This will permanently delete all your notifications. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All', style: 'destructive',
                    onPress: async () => {
                        setNotifications([]);
                        setUnreadCount(0);
                        try {
                            await notificationsAPI.deleteAll();
                        } catch (e) {
                            console.log('Clear all error:', e);
                            fetchNotifs();
                        }
                    },
                },
            ],
        );
    };

    const renderNotif = ({ item }: any) => (
        <SwipeableNotifCard item={item} onDelete={handleDelete} onTap={handleTap} />
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {unreadCount > 0 && (
                        <Text style={styles.headerSub}>{unreadCount} unread</Text>
                    )}
                </View>
                <View style={styles.headerActions}>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllRead} style={styles.actionBtn}>
                            <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
                            <Text style={styles.actionText}>Read all</Text>
                        </TouchableOpacity>
                    )}
                    {notifications.length > 0 && (
                        <TouchableOpacity onPress={handleClearAll} style={[styles.actionBtn, styles.clearBtn]}>
                            <Ionicons name="trash-outline" size={14} color={colors.error} />
                            <Text style={[styles.actionText, { color: colors.error }]}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Swipe hint */}
            {notifications.length > 0 && !loading && (
                <View style={styles.swipeHintRow}>
                    <Ionicons name="arrow-back" size={12} color={colors.textMuted} />
                    <Text style={styles.swipeHintText}>Swipe left to delete</Text>
                </View>
            )}

            {loading ? (
                <View style={styles.loadWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotif}
                    keyExtractor={i => i._id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                            progressBackgroundColor={colors.surface}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
                            </View>
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptyText}>No notifications to show</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    /* Header */
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    },
    headerTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
    headerSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.primary, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 7,
        backgroundColor: colors.primary + '15', borderRadius: 10,
    },
    clearBtn: { backgroundColor: colors.error + '12' },
    actionText: { fontFamily: fonts.semibold, color: colors.primary, fontSize: 12 },

    /* Swipe hint */
    swipeHintRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingBottom: 6,
    },
    swipeHintText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },

    /* Loading / Empty */
    loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { alignItems: 'center', paddingTop: 80 },
    emptyIconCircle: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center',
        marginBottom: 14,
    },
    emptyTitle: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16, marginBottom: 4 },
    emptyText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13 },

    /* Notification card */
    notifCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14,
        marginBottom: 8, borderWidth: 1, borderColor: colors.border, position: 'relative',
    },
    notifUnread: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '06' },
    unreadDot: {
        position: 'absolute', top: 8, left: 8, width: 6, height: 6, borderRadius: 3,
        backgroundColor: colors.primary,
    },
    iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    notifTitle: { fontFamily: fonts.semibold, color: colors.text, fontSize: 14 },
    notifDesc: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    notifTime: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 11, marginTop: 4 },
    newBadge: {
        backgroundColor: colors.primary, borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    newBadgeText: { fontFamily: fonts.bold, color: '#FFF', fontSize: 8, letterSpacing: 0.5 },

    /* Swipe delete bg */
    swipeDeleteBg: {
        position: 'absolute', top: 0, bottom: 8, right: 0, width: 100,
        backgroundColor: colors.error, borderRadius: radius.lg,
        justifyContent: 'center', alignItems: 'center',
    },
    swipeDeleteText: { fontFamily: fonts.semibold, color: '#FFF', fontSize: 12 },
});
