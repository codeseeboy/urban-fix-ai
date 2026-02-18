import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { workflowAPI } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radius } from '../../theme/colors';

export default function FieldWorkerDashboard({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchTasks(); }, []);

    const fetchTasks = async () => {
        try {
            const { data } = await workflowAPI.getAssigned(user?._id || '');
            setTasks(data);
        } catch (e) { console.log('Task fetch error:', e); }
        setLoading(false);
    };

    const handleStartWork = async (issueId: string) => {
        try {
            await workflowAPI.workerUpdate(issueId, { status: 'InProgress', comment: 'Work started by field worker' });
            Alert.alert('✅ Updated', 'Task marked as In Progress');
            fetchTasks();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Update failed'); }
    };

    const handleComplete = async (issueId: string) => {
        // Pick proof photo
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (result.canceled) return;

        try {
            await workflowAPI.workerUpdate(issueId, {
                status: 'Resolved',
                proofImage: result.assets[0].uri,
                comment: 'Work completed. Proof uploaded.',
            });
            Alert.alert('✅ Resolved!', 'Issue marked as resolved with proof photo.');
            fetchTasks();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Update failed'); }
    };

    const openGPS = (location: any) => {
        if (!location || !location.coordinates) return;
        const [lon, lat] = location.coordinates;
        const url = Platform.select({
            ios: `maps:0,0?q=${lat},${lon}`,
            android: `geo:0,0?q=${lat},${lon}`
        });
        if (url) Linking.openURL(url);
    };

    const getStatusColor = (s: string) => s === 'Resolved' ? colors.success : s === 'InProgress' ? colors.primary : colors.warning;

    const renderTask = ({ item }: any) => (
        <View style={styles.taskCard}>
            <View style={[styles.statusLine, { backgroundColor: getStatusColor(item.status) }]} />
            <View style={styles.taskContent}>
                <View style={styles.taskHeader}>
                    <View style={[styles.sevDot, { backgroundColor: item.aiSeverity === 'Critical' ? '#FF003C' : item.aiSeverity === 'High' ? '#FF453A' : '#FFD60A' }]} />
                    <Text style={styles.taskTitle} numberOfLines={2}>{item.title}</Text>
                </View>

                <View style={styles.taskMeta}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.taskLocation}>{item.location?.address || 'Unknown'}</Text>
                </View>

                <View style={[styles.taskStatus, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.taskStatusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                </View>

                {/* Task Details Panel */}
                <View style={styles.detailPanel}>
                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Priority</Text>
                            <Text style={[styles.detailValue, { color: item.aiSeverity === 'Critical' ? '#FF003C' : colors.text }]}>{item.aiSeverity}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Score</Text>
                            <Text style={styles.detailValue}>{item.priorityScore}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Ward</Text>
                            <Text style={styles.detailValue}>{item.region || 'Central'}</Text>
                        </View>
                    </View>
                    {item.emergency && (
                        <View style={styles.emergencyItem}>
                            <Ionicons name="warning" size={14} color="#FF003C" />
                            <Text style={styles.emergencyText}>EMERGENCY PROTOCOL ACTIVE</Text>
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.taskActions}>
                    <TouchableOpacity style={styles.gpsBtn} onPress={() => openGPS(item.location)}>
                        <Ionicons name="navigate-circle" size={18} color={colors.primary} />
                        <Text style={styles.gpsBtnText}>Directions</Text>
                    </TouchableOpacity>

                    {item.status === 'Acknowledged' && (
                        <TouchableOpacity style={styles.startBtn} onPress={() => handleStartWork(item._id)} activeOpacity={0.7}>
                            <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.actionGradient}>
                                <Ionicons name="play" size={14} color="#FFF" />
                                <Text style={styles.actionBtnText}>Start Work</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                    {item.status === 'InProgress' && (
                        <TouchableOpacity style={styles.startBtn} onPress={() => handleComplete(item._id)} activeOpacity={0.7}>
                            <LinearGradient colors={[colors.success, '#1BA342']} style={styles.actionGradient}>
                                <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                                <Text style={styles.actionBtnText}>Complete + Photo</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                    {item.status === 'Resolved' && (
                        <View style={styles.resolvedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={styles.resolvedText}>Completed</Text>
                        </View>
                    )}
                    <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate('IssueDetail', { issueId: item._id })}>
                        <Ionicons name="open-outline" size={14} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcome}>Welcome back,</Text>
                    <Text style={styles.userName}>{user?.name}</Text>
                </View>
                <TouchableOpacity style={styles.badge}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                    <Text style={styles.deptText}>{user?.department || 'Field Operations'}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={tasks}
                    renderItem={renderTask}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No tasks assigned to you yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
    welcome: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary },
    userName: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    deptText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.primary },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 20, paddingBottom: 100 },

    taskCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
    statusLine: { width: 5 },
    taskContent: { flex: 1, padding: 16 },
    taskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    sevDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    taskTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text, lineHeight: 20 },
    taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    taskLocation: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12 },
    taskStatus: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 8 },
    taskStatusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },

    // Detail Panel
    detailPanel: { backgroundColor: colors.surfaceLight, borderRadius: radius.md, padding: 10, marginTop: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
    detailItem: { flex: 1 },
    detailLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textMuted, marginBottom: 2 },
    detailValue: { fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.text },
    emergencyItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
    emergencyText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FF003C' },

    taskActions: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary + '10', borderRadius: radius.md, flex: 1 },
    gpsBtnText: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 12 },
    startBtn: { borderRadius: radius.md, overflow: 'hidden', flex: 1.5 },
    actionGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, justifyContent: 'center' },
    actionBtnText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 12 },
    resolvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.success + '15', borderRadius: radius.md, flex: 1.5, justifyContent: 'center' },
    resolvedText: { fontFamily: 'Inter_600SemiBold', color: colors.success, fontSize: 12 },
    viewBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },

    empty: { flex: 1, alignItems: 'center', marginTop: 100 },
    emptyText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 10, fontSize: 14 },
});
