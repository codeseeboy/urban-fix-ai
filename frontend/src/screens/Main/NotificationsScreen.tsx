import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { notificationsAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const ICONS: Record<string, { name: string; color: string }> = {
    status: { name: 'sync-circle', color: colors.primary },
    upvote: { name: 'arrow-up-circle', color: '#FF6B35' },
    comment: { name: 'chatbubble', color: colors.secondary },
    badge: { name: 'ribbon', color: '#FFD60A' },
    points: { name: 'star', color: colors.success },
    resolved: { name: 'checkmark-circle', color: colors.success },
};

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifs = async () => {
        try {
            const { data } = await notificationsAPI.getAll();
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (e) { console.log('Notif error:', e); }
    };

    useEffect(() => {
        fetchNotifs().finally(() => setLoading(false));
    }, []);

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

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const renderNotif = ({ item }: any) => {
        const icon = ICONS[item.type] || ICONS.status;
        return (
            <View style={[styles.notifCard, !item.read && styles.notifUnread]}>
                {!item.read && <View style={styles.unreadDot} />}
                <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
                    <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifDesc}>{item.desc}</Text>
                    <Text style={styles.notifTime}>{getTimeAgo(item.createdAt)}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} unread</Text>}
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllRead} style={styles.markBtn}>
                        <Text style={styles.markText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.loadWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotif}
                    keyExtractor={i => i._id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
    headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary, marginTop: 2 },
    markBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary + '15', borderRadius: 12 },
    markText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },
    loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontFamily: 'Inter_500Medium', color: colors.textMuted, marginTop: 12 },
    notifCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: colors.border, position: 'relative',
    },
    notifUnread: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' },
    unreadDot: {
        position: 'absolute', top: 8, left: 8, width: 6, height: 6, borderRadius: 3,
        backgroundColor: colors.primary,
    },
    iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    notifTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    notifDesc: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    notifTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
