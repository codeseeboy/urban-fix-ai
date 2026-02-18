import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Share, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { issuesAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

export default function IssueDetailScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { issueId } = route.params;
    const [issue, setIssue] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [following, setFollowing] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => { fetchIssue(); }, []);

    const fetchIssue = async () => {
        try {
            const { data } = await issuesAPI.getById(issueId);
            setIssue(data);
            setComments(data.comments || []);
            setFollowing((data.followers || []).includes(user?._id));
        } catch (e) { Alert.alert('Error', 'Failed to load issue'); }
        setLoading(false);
    };

    const handleUpvote = async () => {
        logger.tap('IssueDetail', 'Upvote');
        try {
            const { data } = await issuesAPI.upvote(issueId);
            setIssue((prev: any) => ({
                ...prev,
                upvotes: data.upvoted ? [...prev.upvotes, user?._id] : prev.upvotes.filter((u: string) => u !== user?._id),
            }));
        } catch (e) { console.log('Upvote error'); }
    };

    const handleDownvote = async () => {
        logger.tap('IssueDetail', 'Downvote');
        try {
            const { data } = await issuesAPI.downvote(issueId);
            setIssue((prev: any) => ({
                ...prev,
                downvotes: data.downvoted ? [...(prev.downvotes || []), user?._id] : (prev.downvotes || []).filter((u: string) => u !== user?._id),
            }));
        } catch (e) { console.log('Downvote error'); }
    };

    const handleFollow = async () => {
        logger.tap('IssueDetail', 'Follow Issue');
        try {
            const { data } = await issuesAPI.followIssue(issueId);
            setFollowing(data.following);
            if (data.following) Alert.alert('Following', 'You will receive updates for this issue.');
        } catch (e) { console.log('Follow error'); }
    };

    const handleShare = async () => {
        logger.tap('IssueDetail', 'Share Issue');
        try {
            await Share.share({
                title: issue.title,
                message: `🚨 ${issue.title}\n📍 ${issue.location?.address || 'Unknown'}\n🔴 Severity: ${issue.aiSeverity}\nStatus: ${issue.status}\n\nReported on UrbanFix AI — Help make our city better!\n#UrbanFixAI`,
            });
        } catch (e) { console.log('Share error'); }
    };

    const handleComment = async () => {
        if (!newComment.trim()) return;
        setPosting(true);
        try {
            const { data } = await issuesAPI.addComment(issueId, newComment.trim());
            setComments(prev => [...prev, data]);
            setNewComment('');
        } catch (e) { Alert.alert('Error', 'Failed to post comment'); }
        setPosting(false);
    };

    const getSevColor = (s: string) => s === 'Critical' ? '#FF003C' : s === 'High' ? '#FF453A' : s === 'Medium' ? '#FFD60A' : '#30D158';
    const getStatusColor = (s: string) => s === 'Resolved' ? colors.success : s === 'InProgress' ? colors.primary : s === 'Acknowledged' ? colors.secondary : colors.warning;

    if (loading) return <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
    if (!issue) return <View style={[styles.container, { paddingTop: insets.top }]}><Text style={styles.errorText}>Issue not found</Text></View>;

    return (
        <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Issue Details</Text>
                <TouchableOpacity onPress={handleFollow} style={[styles.followBtn, following && styles.followBtnActive]}>
                    <Ionicons name={following ? 'bookmark' : 'bookmark-outline'} size={18} color={following ? '#FFF' : colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Image */}
                {issue.image && (
                    <View style={styles.imageWrap}>
                        <Image source={{ uri: issue.image }} style={styles.image} />
                        <View style={styles.imgOverlay}>
                            <View style={[styles.sevBadge, { backgroundColor: getSevColor(issue.aiSeverity) }]}>
                                <Text style={styles.sevText}>{issue.aiSeverity}</Text>
                            </View>
                        </View>
                        {issue.emergency && (
                            <View style={styles.emergencyOverlay}>
                                <Ionicons name="warning" size={14} color="#FFF" />
                                <Text style={styles.emergencyText}>EMERGENCY</Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.content}>
                    {/* Title + meta */}
                    <Text style={styles.title}>{issue.title}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>📍 {issue.location?.address || 'Unknown'}</Text>
                        <Text style={styles.metaText}>• {issue.timeAgo}</Text>
                    </View>

                    {/* AI Tags */}
                    <View style={styles.tagsRow}>
                        {issue.aiTags?.map((t: string, i: number) => (
                            <View key={i} style={styles.tagChip}>
                                <Text style={styles.tagText}>🤖 {t}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Description */}
                    <Text style={styles.description}>{issue.description}</Text>

                    {/* Priority Bar */}
                    <View style={styles.priorityCard}>
                        <View style={styles.priorityHeader}>
                            <Text style={styles.priorityLabel}>Priority Score</Text>
                            <Text style={styles.priorityValue}>{issue.priorityScore}/100</Text>
                        </View>
                        <View style={styles.priorityBar}>
                            <LinearGradient colors={['#30D158', '#FFD60A', '#FF453A']}
                                style={[styles.priorityFill, { width: `${Math.min(100, issue.priorityScore)}%` }]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        </View>
                    </View>

                    {/* Resolution Proof (Before/After) */}
                    {issue.status === 'Resolved' && issue.resolutionProof && (
                        <View style={styles.resolutionCard}>
                            <View style={styles.resolutionHeader}>
                                <Ionicons name="checkmark-seal" size={20} color={colors.success} />
                                <Text style={styles.resolutionTitle}>Issue Resolved</Text>
                            </View>

                            <View style={styles.comparisonRow}>
                                <TouchableOpacity style={styles.compareItem} onPress={() => setPreviewImage(issue.image)}>
                                    <Image source={{ uri: issue.image }} style={styles.compareImg} />
                                    <View style={styles.compareLabel}><Text style={styles.compareLabelText}>BEFORE</Text></View>
                                </TouchableOpacity>
                                <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
                                <TouchableOpacity style={styles.compareItem} onPress={() => setPreviewImage(issue.resolutionProof.afterImage)}>
                                    <Image source={{ uri: issue.resolutionProof.afterImage }} style={styles.compareImg} />
                                    <View style={[styles.compareLabel, { backgroundColor: colors.success }]}><Text style={styles.compareLabelText}>AFTER</Text></View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.officialRemarkBox}>
                                <View style={styles.remarkHeader}>
                                    <Text style={styles.remarkDept}>Municipal {issue.departmentTag} Team</Text>
                                    <Text style={styles.remarkTime}>{new Date(issue.resolutionProof.resolvedAt).toLocaleDateString()}</Text>
                                </View>
                                <Text style={styles.remarkText}>{issue.resolutionProof.workerRemarks}</Text>
                            </View>
                        </View>
                    )}

                    {/* Status Timeline */}
                    <Text style={styles.sectionTitle}>Status Timeline</Text>
                    {issue.statusTimeline?.map((s: any, i: number) => (
                        <View key={i} style={styles.timelineItem}>
                            <View style={[styles.timelineDot, { backgroundColor: getStatusColor(s.status) }]} />
                            {i < issue.statusTimeline.length - 1 && <View style={styles.timelineLine} />}
                            <View style={[styles.timelineContent, s.dept && styles.officialTimeline]}>
                                <View style={styles.timelineHeaderRow}>
                                    <Text style={styles.timelineStatus}>{s.status}</Text>
                                    {s.dept && (
                                        <View style={styles.deptTimelineBadge}>
                                            <Text style={styles.deptTimelineText}>{s.dept}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.timelineComment}>{s.comment}</Text>
                                {s.dept && <Text style={styles.officialLabel}>OFFICIAL UPDATE</Text>}
                                <Text style={styles.timelineTime}>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(s.timestamp).toLocaleDateString()}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleUpvote}>
                            <Ionicons name={issue.upvotes?.includes(user?._id) ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                                size={24} color={issue.upvotes?.includes(user?._id) ? colors.primary : colors.textSecondary} />
                            <Text style={styles.actionText}>{issue.upvotes?.length || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleDownvote}>
                            <Ionicons name={(issue.downvotes || []).includes(user?._id) ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                                size={24} color={(issue.downvotes || []).includes(user?._id) ? '#FF453A' : colors.textSecondary} />
                            <Text style={styles.actionText}>{(issue.downvotes || []).length}</Text>
                        </TouchableOpacity>
                        <View style={styles.actionBtn}>
                            <Ionicons name="chatbubble-outline" size={22} color={colors.textSecondary} />
                            <Text style={styles.actionText}>{comments.length}</Text>
                        </View>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Comments */}
                    <Text style={styles.sectionTitle}>Comments</Text>
                    {comments.length === 0 && <Text style={styles.emptyText}>No comments yet. Be the first!</Text>}
                    {comments.map((c: any, i: number) => (
                        <View key={c._id || i} style={styles.commentCard}>
                            <View style={styles.commentHeader}>
                                <LinearGradient colors={c.user?.role === 'admin' ? ['#FF6B35', '#FF3C00'] : [colors.primary, '#0055CC']} style={styles.commentAvatar}>
                                    <Text style={styles.commentAvatarText}>{(c.user?.name || '?')[0]}</Text>
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.commentNameRow}>
                                        <Text style={styles.commentName}>{c.user?.name || 'Unknown'}</Text>
                                        {c.user?.role === 'admin' && (
                                            <View style={styles.officialBadge}><Text style={styles.officialText}>OFFICIAL</Text></View>
                                        )}
                                    </View>
                                    <Text style={styles.commentTime}>{c.timeAgo}</Text>
                                </View>
                            </View>
                            <Text style={styles.commentText}>{c.text}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Comment Input */}
            <View style={[styles.commentInput, { paddingBottom: insets.bottom + 8 }]}>
                <TextInput style={styles.commentField} placeholder="Add a comment..." placeholderTextColor={colors.textMuted}
                    value={newComment} onChangeText={setNewComment} />
                <TouchableOpacity onPress={handleComment} disabled={posting || !newComment.trim()}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.sendBtn}>
                        <Ionicons name="send" size={16} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
            {/* Image Preview Modal */}
            <Modal visible={!!previewImage} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewImage(null)}>
                        <Ionicons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>
                    {previewImage && <Image source={{ uri: previewImage }} style={styles.modalImg} resizeMode="contain" />}
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.text },
    followBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '30' },
    followBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    errorText: { fontFamily: 'Inter_500Medium', color: colors.error, textAlign: 'center', marginTop: 40 },
    imageWrap: { position: 'relative' },
    image: { width: '100%', height: 220 },
    imgOverlay: { position: 'absolute', top: 12, right: 12 },
    sevBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
    sevText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 12 },
    emergencyOverlay: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF003CDD', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    emergencyText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 11, letterSpacing: 0.5 },
    content: { padding: 16 },
    title: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 20 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    metaText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tagChip: { backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 11 },
    description: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 14 },
    priorityCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginTop: 16, borderWidth: 1, borderColor: colors.border },
    priorityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    priorityLabel: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13 },
    priorityValue: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 13 },
    priorityBar: { height: 6, backgroundColor: colors.surfaceLight, borderRadius: 3, overflow: 'hidden' },
    priorityFill: { height: 6, borderRadius: 3 },
    sectionTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16, marginTop: 20, marginBottom: 12 },
    timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: 12 },
    timelineLine: { position: 'absolute', left: 4, top: 16, width: 2, height: 36, backgroundColor: colors.border },
    timelineContent: { flex: 1 },
    timelineStatus: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    timelineComment: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    timelineTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 2 },
    actionsRow: { flexDirection: 'row', gap: 24, marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, fontSize: 13 },
    emptyText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 13 },
    commentCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    commentAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    commentAvatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 13 },
    commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    commentName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13 },
    officialBadge: { backgroundColor: '#FF6B35', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    officialText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 8 },
    commentTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11 },
    commentText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
    commentInput: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingTop: 10,
        backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    },
    commentField: { flex: 1, fontFamily: 'Inter_400Regular', color: colors.text, fontSize: 14, backgroundColor: colors.surfaceLight, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
    sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },

    // Resolution Card
    resolutionCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, marginTop: 16, borderWidth: 1, borderColor: colors.success + '30' },
    resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    resolutionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.success },
    comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
    compareItem: { flex: 1, position: 'relative' },
    compareImg: { width: '100%', height: 120, borderRadius: radius.md },
    compareLabel: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    compareLabelText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 9 },
    officialRemarkBox: { backgroundColor: colors.surfaceLight, padding: 12, borderRadius: radius.md },
    remarkHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    remarkDept: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
    remarkTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted },
    remarkText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

    // Timeline Enhancements
    timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    officialTimeline: { backgroundColor: colors.primary + '08', padding: 10, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.primary + '20' },
    deptTimelineBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    deptTimelineText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: colors.primary },
    officialLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: colors.primary, marginTop: 6, letterSpacing: 0.5 },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    modalImg: { width: '100%', height: '80%' },
});
