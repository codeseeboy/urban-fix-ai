import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
    FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme/colors';
import { municipalAPI } from '../../services/api';
import UserAvatar from '../ui/UserAvatar';

type Props = {
    visible: boolean;
    issues: any[];
    onClose: () => void;
    onOpenIssue: (issue: any) => void;
    onOpenMunicipal?: (pageId: string) => void;
};

export default function SearchSheet({ visible, issues, onClose, onOpenIssue, onOpenMunicipal }: Props) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [pages, setPages] = useState<any[]>([]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return issues.slice(0, 12);
        return issues.filter((item) => {
            const hay = [
                item.title, item.description, item.category,
                item.location?.address, item.user?.name, item.status,
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [issues, query]);

    const runMunicipalSearch = async (text: string) => {
        setQuery(text);
        if (text.trim().length < 2) {
            setPages([]);
            return;
        }
        try {
            const { data } = await municipalAPI.search(text.trim());
            setPages(Array.isArray(data) ? data.slice(0, 6) : []);
        } catch {
            setPages([]);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.header}>
                    <View style={styles.searchWrap}>
                        <Ionicons name="search" size={18} color={colors.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Search reports, streets, departments…"
                            placeholderTextColor={colors.textMuted}
                            value={query}
                            onChangeText={runMunicipalSearch}
                            autoFocus
                            returnKeyType="search"
                        />
                        {query.length > 0 && (
                            <TouchableOpacity onPress={() => { setQuery(''); setPages([]); }}>
                                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.cancel}>
                        <Text style={styles.cancelText}>Close</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={results}
                    keyExtractor={(item) => item._id}
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={
                        pages.length > 0 ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Departments</Text>
                                {pages.map((page) => (
                                    <TouchableOpacity
                                        key={page._id || page.id}
                                        style={styles.row}
                                        onPress={() => {
                                            onClose();
                                            onOpenMunicipal?.(page._id || page.id);
                                        }}
                                    >
                                        <UserAvatar name={page.name} uri={page.avatar} size={36} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.rowTitle}>{page.name}</Text>
                                            <Text style={styles.rowSub}>{page.handle || page.department || 'Municipal page'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => {
                                onClose();
                                onOpenIssue(item);
                            }}
                        >
                            <View style={styles.catDot} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.rowSub} numberOfLines={1}>
                                    {[item.category, item.location?.address].filter(Boolean).join(' · ') || 'Civic report'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyTitle}>No matching reports</Text>
                            <Text style={styles.emptySub}>Try a street name, category, or department.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    searchWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12,
        height: 44,
    },
    input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
    cancel: { paddingVertical: 8 },
    cancelText: { fontFamily: fonts.semibold, color: colors.primary, fontSize: 14 },
    section: { paddingHorizontal: 16, paddingTop: 8 },
    sectionTitle: {
        fontFamily: fonts.semibold,
        color: colors.textMuted,
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    catDot: {
        width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary,
    },
    rowTitle: { fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },
    rowSub: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12, marginTop: 2 },
    empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
    emptyTitle: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16, marginBottom: 6 },
    emptySub: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
