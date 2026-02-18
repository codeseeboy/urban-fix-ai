import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { issuesAPI, gamificationAPI, workflowAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

export default function AdminDashboard({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalIssues: 0, resolved: 0, critical: 0, inProgress: 0, pending: 0 });
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [statsRes, issuesRes] = await Promise.all([
                gamificationAPI.getStats(),
                issuesAPI.getFeed('high_priority'),
            ]);
            setStats(statsRes.data);
            setIssues(issuesRes.data);
        } catch (e) { console.log('Admin fetch error:', e); }
        setLoading(false);
    };

    const handleStatusChange = (issueId: string, issueTitle: string) => {
        Alert.alert('Update Status', `Select new status for "${issueTitle}"`, [
            { text: 'Acknowledge', onPress: () => updateStatus(issueId, 'Acknowledged') },
            { text: 'In Progress', onPress: () => updateStatus(issueId, 'InProgress') },
            { text: 'Resolved', onPress: () => updateStatus(issueId, 'Resolved') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const updateStatus = async (issueId: string, status: string) => {
        try {
            await workflowAPI.updateStatus(issueId, status, `Status changed to ${status} by admin`);
            Alert.alert('✅ Updated', `Issue status changed to ${status}`);
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to update');
        }
    };

    const handleAssign = (issueId: string) => {
        Alert.alert('Assign Department', 'Select department:', [
            { text: 'Roads', onPress: () => assignDept(issueId, 'Roads') },
            { text: 'Sanitation', onPress: () => assignDept(issueId, 'Sanitation') },
            { text: 'Electricity', onPress: () => assignDept(issueId, 'Electricity') },
            { text: 'Water', onPress: () => assignDept(issueId, 'Water') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const assignDept = async (issueId: string, dept: string) => {
        try {
            await workflowAPI.assign(issueId, { departmentTag: dept });
            Alert.alert('✅ Assigned', `Issue assigned to ${dept} department`);
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to assign');
        }
    };

    const getSevColor = (s: string) => s === 'Critical' ? '#FF003C' : s === 'High' ? '#FF453A' : s === 'Medium' ? '#FFD60A' : '#30D158';

    const STATS_DATA = [
        { label: 'Total Issues', value: stats.totalIssues, icon: 'document-text', color: colors.primary },
        { label: 'Resolved', value: stats.resolved, icon: 'checkmark-circle', color: colors.success },
        { label: 'In Progress', value: stats.inProgress, icon: 'sync', color: colors.warning },
        { label: 'Critical', value: stats.critical, icon: 'alert-circle', color: colors.error },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Admin Panel</Text>
                    <Text style={styles.headerSub}>Municipal Dashboard</Text>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="settings-outline" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Live Stats */}
                    <View style={styles.statsGrid}>
                        {STATS_DATA.map((s) => (
                            <View key={s.label} style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                                    <Ionicons name={s.icon as any} size={18} color={s.color} />
                                </View>
                                <Text style={styles.statValue}>{s.value}</Text>
                                <Text style={styles.statLabel}>{s.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.actionsRow}>
                            {[
                                { icon: 'people', label: 'Assign', color: colors.primary },
                                { icon: 'analytics', label: 'Reports', color: '#FF6B35' },
                                { icon: 'megaphone', label: 'Broadcast', color: colors.success },
                            ].map((a) => (
                                <TouchableOpacity key={a.label} style={styles.actionCard} activeOpacity={0.7}>
                                    <LinearGradient colors={[a.color, a.color + 'CC']} style={styles.actionIcon}>
                                        <Ionicons name={a.icon as any} size={22} color="#FFF" />
                                    </LinearGradient>
                                    <Text style={styles.actionLabel}>{a.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Issue Queue */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Priority Issue Queue</Text>
                        {issues.map((q) => (
                            <TouchableOpacity key={q._id} style={styles.queueItem} activeOpacity={0.7}
                                onPress={() => navigation.navigate('IssueDetail', { issueId: q._id })}>
                                <View style={[styles.queueDot, { backgroundColor: getSevColor(q.aiSeverity) }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.queueTitle} numberOfLines={1}>{q.title}</Text>
                                    <View style={styles.queueMeta}>
                                        <Text style={styles.queueDept}>{q.departmentTag}</Text>
                                        <Text style={styles.queueTime}>• {q.timeAgo}</Text>
                                        <Text style={styles.queueStatus}>• {q.status}</Text>
                                    </View>
                                </View>
                                <View style={styles.queueActions}>
                                    <TouchableOpacity onPress={() => handleStatusChange(q._id, q.title)} style={styles.queueBtn}>
                                        <Ionicons name="sync" size={16} color={colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleAssign(q._id)} style={styles.queueBtn}>
                                        <Ionicons name="people" size={16} color="#FF6B35" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
    headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
    statCard: { width: '47%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border },
    statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    statValue: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 24 },
    statLabel: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, marginTop: 2 },
    section: { paddingHorizontal: 16, marginTop: 24 },
    sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text, marginBottom: 12 },
    actionsRow: { flexDirection: 'row', gap: 10 },
    actionCard: { flex: 1, alignItems: 'center', paddingVertical: 16, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
    actionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionLabel: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 12 },
    queueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    queueDot: { width: 6, height: 6, borderRadius: 3, marginRight: 12 },
    queueTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    queueMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    queueDept: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12 },
    queueTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12 },
    queueStatus: { fontFamily: 'Inter_400Regular', color: colors.primary, fontSize: 12 },
    queueActions: { flexDirection: 'row', gap: 6 },
    queueBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
});
