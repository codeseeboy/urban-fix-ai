import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/colors';
import api from '../../services/api';

export default function SuggestedFollows({ navigation }: any) {
    const [pages, setPages] = useState<any[]>([]);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const { data } = await api.get('/municipal/suggested');
            setPages(data);
        } catch (e) {
            console.log(e);
        }
    };

    if (hidden || pages.length === 0) return null;

    const renderItem = ({ item }: any) => (
        <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('MunicipalProfile', { pageId: item._id })}>
            <Image source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} style={styles.avatar} />
            <View style={styles.content}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.handle}>@{item.handle}</Text>
            </View>
            <View style={styles.followBtn}>
                <Text style={styles.followText}>View</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Suggested for You</Text>
                <TouchableOpacity onPress={() => setHidden(true)}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
            <FlatList
                horizontal
                data={pages}
                renderItem={renderItem}
                keyExtractor={p => p._id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
    title: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
    card: {
        width: 260, marginRight: 12, backgroundColor: colors.surface,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
    },
    cover: { display: 'none' }, // Hiding cover to make it a compact row card as per "middle of feed" style
    coverImg: { display: 'none' },
    content: { flex: 1, marginTop: 0, alignItems: 'flex-start' },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 0, backgroundColor: colors.surfaceLight },
    name: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text, marginTop: 0, textAlign: 'left' },
    handle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textMuted, marginBottom: 0 },
    followBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    followText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFF' },
});
