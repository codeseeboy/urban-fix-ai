import React, { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../../theme/colors';

interface IssueCardProps {
    issue: any;
    onPress: () => void;
    index: number;
}

export const IssueCard = ({ issue, onPress, index }: IssueCardProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 100, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 100, useNativeDriver: true }),
        ]).start();
    }, []);

    const severityColor =
        issue.aiSeverity === 'Critical' ? '#FF003C' :
            issue.aiSeverity === 'High' ? '#FF453A' :
                issue.aiSeverity === 'Medium' ? '#FFD60A' : '#30D158';

    const severityBg =
        issue.aiSeverity === 'Critical' ? '#FF003C15' :
            issue.aiSeverity === 'High' ? '#FF453A15' :
                issue.aiSeverity === 'Medium' ? '#FFD60A15' : '#30D15815';

    const statusIcon =
        issue.status === 'Resolved' ? 'checkmark-circle' :
            issue.status === 'InProgress' ? 'time' :
                issue.status === 'Acknowledged' ? 'eye' : 'radio-button-on';

    const statusColor =
        issue.status === 'Resolved' ? colors.success :
            issue.status === 'InProgress' ? '#FF6B35' :
                issue.status === 'Acknowledged' ? colors.secondary : colors.textMuted;

    return (
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.cardOuter}>
                <View style={styles.card}>
                    {/* Glow Top Line */}
                    <LinearGradient
                        colors={[severityColor + '60', 'transparent']}
                        style={styles.glowLine}
                    />

                    {/* Header Row */}
                    <View style={styles.header}>
                        <View style={styles.userInfo}>
                            <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.avatarGradient}>
                                <Text style={styles.avatarText}>{(issue.user?.name || 'U')[0].toUpperCase()}</Text>
                            </LinearGradient>
                            <View>
                                <Text style={styles.userName}>{issue.user?.name || 'Citizen'}</Text>
                                <View style={styles.timeRow}>
                                    <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                                    <Text style={styles.time}>{issue.timeAgo || '2h ago'}</Text>
                                </View>
                            </View>
                        </View>
                        <View style={[styles.severityBadge, { backgroundColor: severityBg, borderColor: severityColor + '40' }]}>
                            <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
                            <Text style={[styles.severityText, { color: severityColor }]}>{issue.aiSeverity || 'Low'}</Text>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{issue.title}</Text>

                    {/* Image */}
                    {issue.image && (
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: issue.image }} style={styles.image} />
                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.imageOverlay} />
                            {/* Location on image */}
                            <View style={styles.locationOnImage}>
                                <Ionicons name="location" size={12} color="#FFF" />
                                <Text style={styles.locationOnImageText}>{issue.location?.address || 'Unknown'}</Text>
                            </View>
                        </View>
                    )}

                    {/* Tags Row */}
                    <View style={styles.tagsRow}>
                        <View style={styles.deptTag}>
                            <Ionicons name="pricetag" size={11} color={colors.primary} />
                            <Text style={styles.deptText}>{issue.departmentTag || 'General'}</Text>
                        </View>
                        <View style={[styles.statusTag, { backgroundColor: statusColor + '12' }]}>
                            <Ionicons name={statusIcon as any} size={12} color={statusColor} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{issue.status || 'Submitted'}</Text>
                        </View>
                        {issue.aiSeverity === 'Critical' && (
                            <View style={styles.urgentTag}>
                                <Ionicons name="flame" size={11} color="#FF003C" />
                                <Text style={styles.urgentText}>Urgent</Text>
                            </View>
                        )}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                            <Ionicons name="heart-outline" size={20} color={colors.textSecondary} />
                            <Text style={styles.actionCount}>{issue.upvotes?.length || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                            <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                            <Text style={styles.actionCount}>{issue.commentCount || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                            <Ionicons name="share-social-outline" size={19} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.actionSpacer} />
                        <TouchableOpacity activeOpacity={0.7}>
                            <Ionicons name="bookmark-outline" size={19} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    cardOuter: { marginBottom: 14 },
    card: {
        backgroundColor: colors.surface, borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
    },
    glowLine: { height: 2, width: '100%' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    },
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarGradient: {
        width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFF' },
    userName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
    time: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11 },
    severityBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
        borderWidth: 1,
    },
    severityDot: { width: 6, height: 6, borderRadius: 3 },
    severityText: { fontFamily: 'Inter_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    title: {
        fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 15,
        paddingHorizontal: 16, marginBottom: 10, lineHeight: 22,
    },
    imageContainer: { position: 'relative', marginHorizontal: 12, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
    image: { width: '100%', height: 200, borderRadius: radius.lg },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
    locationOnImage: {
        position: 'absolute', bottom: 8, left: 10,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    locationOnImageText: { fontFamily: 'Inter_500Medium', color: '#FFF', fontSize: 11 },
    tagsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap' },
    deptTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primary + '12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    deptText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 11 },
    statusTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    urgentTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#FF003C12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    urgentText: { fontFamily: 'Inter_700Bold', color: '#FF003C', fontSize: 10 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    footer: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 20,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionCount: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 13 },
    actionSpacer: { flex: 1 },
});
