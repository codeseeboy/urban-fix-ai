import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { issuesAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const getColor = (s: string) => s === 'Critical' ? '#FF003C' : s === 'High' ? '#FF453A' : s === 'Medium' ? '#FFD60A' : '#30D158';

export default function MapScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [issues, setIssues] = useState<any[]>([]);

    useEffect(() => {
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        try {
            const { data } = await issuesAPI.getFeed();
            setIssues(data);
        } catch (e) { console.log('Map error:', e); }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Issue Map</Text>
                <Text style={styles.headerSub}>{issues.length} issues pinned</Text>
            </View>

            <MapView
                style={styles.map}
                initialRegion={{ latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
            >
                <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
                {issues.filter(i => i.location?.coordinates).map((m) => (
                    <Marker key={m._id}
                        coordinate={{ latitude: m.location.coordinates[1], longitude: m.location.coordinates[0] }}
                        title={m.title} description={`${m.aiSeverity} • ${m.status}`}
                        onCalloutPress={() => navigation.navigate('IssueDetail', { issueId: m._id })}
                    >
                        <View style={[styles.pin, { backgroundColor: getColor(m.aiSeverity) }]}>
                            <Ionicons name="alert" size={14} color="#FFF" />
                        </View>
                    </Marker>
                ))}
            </MapView>

            <View style={styles.legend}>
                {['Critical', 'High', 'Medium', 'Low'].map((s) => (
                    <View key={s} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: getColor(s) }]} />
                        <Text style={styles.legendText}>{s}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
    headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    map: { flex: 1 },
    pin: {
        width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
    },
    legend: {
        position: 'absolute', bottom: 90, left: 16,
        flexDirection: 'row', gap: 12,
        backgroundColor: 'rgba(10,10,15,0.9)', borderRadius: radius.md, padding: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontFamily: 'Inter_500Medium', color: colors.text, fontSize: 11 },
});
