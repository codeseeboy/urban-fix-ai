import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { issuesAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

const CATEGORIES = [
    { id: 'roads', icon: 'car-outline', label: 'Roads' },
    { id: 'lighting', icon: 'bulb-outline', label: 'Lighting' },
    { id: 'trash', icon: 'trash-outline', label: 'Garbage' },
    { id: 'water', icon: 'water-outline', label: 'Water' },
    { id: 'parks', icon: 'leaf-outline', label: 'Parks' },
    { id: 'other', icon: 'ellipse-outline', label: 'Other' },
];

export default function ReportIssueScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [locationData, setLocationData] = useState<any>(null);
    const [locationName, setLocationName] = useState<string | null>(null);
    const [anonymous, setAnonymous] = useState(false);
    const [emergency, setEmergency] = useState(false);
    const [video, setVideo] = useState<string | null>(null);
    const [videoThumb, setVideoThumb] = useState<string | null>(null);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const pickImage = async () => {
        logger.tap('ReportIssue', 'Pick from Gallery');
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
        if (!result.canceled && result.assets[0]) setImages([...images, result.assets[0].uri]);
    };

    const takePhoto = async () => {
        logger.tap('ReportIssue', 'Take Photo');
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled && result.assets[0]) setImages([...images, result.assets[0].uri]);
    };

    const pickVideo = async () => {
        logger.tap('ReportIssue', 'Pick Video');
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8
        });
        if (!result.canceled && result.assets[0]) {
            setVideo(result.assets[0].uri);
            // In a real app we'd generate a thumbnail, for now just show a video icon or placeholder
        }
    };

    const takeVideo = async () => {
        logger.tap('ReportIssue', 'Take Video');
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') { Alert.alert('Permission needed'); return; }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8
        });
        if (!result.canceled && result.assets[0]) {
            setVideo(result.assets[0].uri);
        }
    };

    const handleMapSelect = async (coords: { latitude: number; longitude: number }) => {
        try {
            const geo = await Location.reverseGeocodeAsync(coords);
            const addr = geo.length ? `${geo[0].name || ''}, ${geo[0].district || geo[0].city || ''}` : 'Pinned Location';
            setLocationData({ type: 'Point', coordinates: [coords.longitude, coords.latitude], address: addr });
            setLocationName(addr);
        } catch (e) {
            console.log('Reverse geocode error:', e);
        }
    };

    const getLocation = async () => {
        logger.tap('ReportIssue', 'Detect Location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed'); return; }
        const loc = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        const addr = geo.length ? `${geo[0].name || ''}, ${geo[0].city || ''}` : 'Location detected';
        setLocationData({ type: 'Point', coordinates: [loc.coords.longitude, loc.coords.latitude], address: addr });
        setLocationName(addr);
    };

    const handleSubmit = async () => {
        logger.tap('ReportIssue', 'Submit Report', { title, category, anonymous, emergency, hasImage: images.length > 0, hasVideo: !!video, hasLocation: !!locationData });
        if (!title || !category) { Alert.alert('Required', 'Please add a title and category.'); return; }
        setSubmitting(true);
        try {
            const { data } = await issuesAPI.create({
                title, description, category, anonymous, emergency,
                image: images[0] || undefined,
                video: video || undefined,
                location: locationData,
            });
            Alert.alert(
                '✅ Report Submitted!',
                `Ticket ID: ${data._id}\nAI Severity: ${data.aiSeverity}\nDepartment: ${data.departmentTag}\n\nYou earned +10 points!`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to submit report');
        }
        setSubmitting(false);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Report Issue</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.catGrid}>
                    {CATEGORIES.map((c) => (
                        <TouchableOpacity key={c.id} onPress={() => setCategory(c.id)}
                            style={[styles.catItem, category === c.id && styles.catActive]} activeOpacity={0.7}>
                            <Ionicons name={c.icon as any} size={22} color={category === c.id ? '#FFF' : colors.textSecondary} />
                            <Text style={[styles.catLabel, category === c.id && { color: '#FFF' }]}>{c.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Title</Text>
                <TextInput style={styles.input} placeholder="Brief issue title..." placeholderTextColor={colors.textMuted}
                    value={title} onChangeText={setTitle} />

                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the issue in detail..."
                    placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription}
                    multiline numberOfLines={4} textAlignVertical="top" />

                <Text style={styles.label}>Visual Evidence (Photos & Video)</Text>
                <View style={styles.photoRow}>
                    <TouchableOpacity style={styles.photoAdd} onPress={takePhoto}>
                        <Ionicons name="camera" size={24} color={colors.primary} />
                        <Text style={styles.photoText}>Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoAdd} onPress={takeVideo}>
                        <Ionicons name="videocam" size={24} color={colors.primary} />
                        <Text style={styles.photoText}>Video</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoAdd} onPress={pickImage}>
                        <Ionicons name="images" size={24} color={colors.primary} />
                        <Text style={styles.photoText}>Library</Text>
                    </TouchableOpacity>

                    {images.map((uri, i) => (
                        <View key={`img-${i}`} style={styles.photoThumb}>
                            <Image source={{ uri }} style={styles.thumbImg} />
                            <TouchableOpacity style={styles.removePic} onPress={() => setImages(images.filter((_, j) => j !== i))}>
                                <Ionicons name="close-circle" size={18} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {video && (
                        <View style={styles.photoThumb}>
                            <View style={[styles.thumbImg, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="play-circle" size={32} color="#FFF" />
                                <Text style={{ color: '#FFF', fontSize: 10, marginTop: 4 }}>Video</Text>
                            </View>
                            <TouchableOpacity style={styles.removePic} onPress={() => setVideo(null)}>
                                <Ionicons name="close-circle" size={18} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <Text style={styles.label}>Location</Text>
                <View style={styles.locationGroup}>
                    <TouchableOpacity style={[styles.locationBtn, { flex: 1 }]} onPress={getLocation} activeOpacity={0.7}>
                        <Ionicons name={locationName ? 'checkmark-circle' : 'navigate'} size={18} color={locationName ? colors.success : colors.primary} />
                        <Text style={[styles.locationText, locationName && { color: colors.success }]}>{locationName || 'Detect'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mapPinBtn} onPress={() => setShowMapPicker(true)}>
                        <Ionicons name="map" size={18} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Emergency flag */}
                <TouchableOpacity style={[styles.emergencyRow, emergency && styles.emergencyRowActive]} onPress={() => setEmergency(!emergency)} activeOpacity={0.7}>
                    <Ionicons name={emergency ? 'warning' : 'warning-outline'} size={22} color={emergency ? '#FF003C' : colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.emergencyLabel, emergency && { color: '#FF003C' }]}>Emergency / Public Hazard</Text>
                        <Text style={styles.emergencySub}>{emergency ? '⚡ Auto-elevated to critical priority' : 'Flag if this poses immediate danger'}</Text>
                    </View>
                    <Ionicons name={emergency ? 'checkbox' : 'square-outline'} size={22} color={emergency ? '#FF003C' : colors.textMuted} />
                </TouchableOpacity>

                {/* Anonymous toggle */}
                <TouchableOpacity style={styles.anonRow} onPress={() => setAnonymous(!anonymous)} activeOpacity={0.7}>
                    <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                    <View>
                        <Text style={styles.anonText}>Report anonymously</Text>
                        {anonymous && <Text style={styles.anonWarn}>⚠ No points earned for anonymous reports</Text>}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.85} style={styles.submitWrap}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name={submitting ? 'sync' : 'paper-plane'} size={18} color="#FFF" />
                        <Text style={styles.submitText}>{submitting ? 'AI Analyzing & Submitting...' : 'Submit Report'}</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Map Picker Modal */}
            {showMapPicker && (
                <View style={styles.mapModal}>
                    <View style={styles.mapHeader}>
                        <Text style={styles.mapTitle}>Select Location</Text>
                        <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.closeMap}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        <MapView
                            style={{ flex: 1 }}
                            initialRegion={{
                                latitude: locationData?.coordinates[1] || 28.6139,
                                longitude: locationData?.coordinates[0] || 77.209,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            onPress={(e) => handleMapSelect(e.nativeEvent.coordinate)}
                        >
                            <Marker
                                coordinate={{
                                    latitude: locationData?.coordinates[1] || 28.6139,
                                    longitude: locationData?.coordinates[0] || 77.209,
                                }}
                                draggable
                                onDragEnd={(e) => handleMapSelect(e.nativeEvent.coordinate)}
                            />
                        </MapView>
                        <View style={styles.mapTip}>
                            <Text style={styles.mapTipText}>Tap on the map or drag the pin to select the precise location</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.confirmMapBtn} onPress={() => setShowMapPicker(false)}>
                        <Text style={styles.confirmMapText}>Confirm Location</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
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
    label: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, marginBottom: 10, marginTop: 16 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catItem: {
        width: '31%', alignItems: 'center', paddingVertical: 14, borderRadius: radius.md,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    catActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catLabel: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 11, marginTop: 4 },
    input: {
        fontFamily: 'Inter_400Regular', backgroundColor: colors.surface, borderRadius: radius.md,
        paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 15,
        borderWidth: 1, borderColor: colors.border,
    },
    textArea: { minHeight: 100 },
    photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    photoAdd: {
        width: 80, height: 80, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary + '40',
        borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary + '08',
    },
    photoText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 10, marginTop: 2 },
    photoThumb: { width: 80, height: 80, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
    thumbImg: { width: '100%', height: '100%' },
    removePic: { position: 'absolute', top: 2, right: 2 },
    locationBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
        borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border,
    },
    locationText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 14 },
    anonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    anonText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14 },
    anonWarn: { fontFamily: 'Inter_400Regular', color: colors.warning, fontSize: 11, marginTop: 2 },
    emergencyRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16,
        backgroundColor: colors.surface, padding: 14, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border,
    },
    emergencyRowActive: { borderColor: '#FF003C40', backgroundColor: '#FF003C08' },
    emergencyLabel: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    emergencySub: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 2 },
    submitWrap: { borderRadius: radius.md, overflow: 'hidden', marginTop: 24 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: radius.md },
    submitText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
    locationGroup: { flexDirection: 'row', gap: 10 },
    mapPinBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    mapModal: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 1000 },
    mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 50 },
    mapTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
    closeMap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    mapTip: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(26,26,37,0.9)', padding: 12, borderRadius: radius.md, alignItems: 'center' },
    mapTipText: { fontFamily: 'Inter_400Regular', color: '#FFF', fontSize: 12, textAlign: 'center' },
    confirmMapBtn: { backgroundColor: colors.primary, margin: 20, padding: 16, borderRadius: radius.md, alignItems: 'center' },
    confirmMapText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
});
