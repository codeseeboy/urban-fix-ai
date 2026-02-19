import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Image, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { issuesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
    getCurrentLocation, reverseGeocode, extractExifGps,
    getStoredLocation, UserLocation,
} from '../../services/locationService';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { id: 'roads', icon: 'car-outline', label: 'Roads', color: '#FF6B35' },
    { id: 'lighting', icon: 'bulb-outline', label: 'Lighting', color: '#FFD60A' },
    { id: 'trash', icon: 'trash-outline', label: 'Garbage', color: '#30D158' },
    { id: 'water', icon: 'water-outline', label: 'Water', color: '#5AC8FA' },
    { id: 'parks', icon: 'leaf-outline', label: 'Parks', color: '#AF52DE' },
    { id: 'other', icon: 'ellipse-outline', label: 'Other', color: '#8E8E9B' },
];

interface CapturedLocation {
    latitude: number;
    longitude: number;
    address: string;
    source: 'exif' | 'live_gps' | 'cached';
    accuracy?: number;
}

export default function ReportIssueScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { userLocation } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [capturedLocation, setCapturedLocation] = useState<CapturedLocation | null>(null);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [anonymous, setAnonymous] = useState(false);
    const [emergency, setEmergency] = useState(false);
    const [video, setVideo] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [locationLocked, setLocationLocked] = useState(true);

    // ─── AUTO-DETECT GPS (Source Hierarchy: EXIF → Live GPS → Cached) ─────
    const detectLocationForCapture = useCallback(async (exifData?: any): Promise<void> => {
        setDetectingLocation(true);
        logger.info('ReportIssue', 'Detecting location for capture...');

        try {
            // Priority 1: EXIF GPS from the image
            if (exifData) {
                const exifGps = extractExifGps(exifData);
                if (exifGps) {
                    const geo = await reverseGeocode(exifGps.latitude, exifGps.longitude);
                    setCapturedLocation({
                        latitude: exifGps.latitude,
                        longitude: exifGps.longitude,
                        address: geo.address,
                        source: 'exif',
                    });
                    logger.success('ReportIssue', `Location from EXIF: ${geo.address}`);
                    setDetectingLocation(false);
                    return;
                }
            }

            // Priority 2: Live GPS at capture time
            const liveLocation = await getCurrentLocation();
            if (liveLocation) {
                setCapturedLocation({
                    latitude: liveLocation.latitude,
                    longitude: liveLocation.longitude,
                    address: liveLocation.address,
                    source: 'live_gps',
                    accuracy: liveLocation.accuracy,
                });
                logger.success('ReportIssue', `Location from live GPS: ${liveLocation.address}`);
                setDetectingLocation(false);
                return;
            }

            // Priority 3: Cached user location
            const cached = userLocation || await getStoredLocation();
            if (cached) {
                setCapturedLocation({
                    latitude: cached.latitude,
                    longitude: cached.longitude,
                    address: cached.address,
                    source: 'cached',
                    accuracy: cached.accuracy,
                });
                logger.info('ReportIssue', `Using cached location: ${cached.address}`);
                setDetectingLocation(false);
                return;
            }

            // All sources failed
            logger.error('ReportIssue', 'All location sources failed');
            Alert.alert(
                'GPS Required',
                'UrbanFix AI needs your location to pinpoint the issue accurately. Please enable GPS and try again.',
                [{ text: 'OK' }]
            );
        } catch (err) {
            logger.error('ReportIssue', 'Location detection error', err);
        }

        setDetectingLocation(false);
    }, [userLocation]);

    // ─── IMAGE CAPTURE ────────────────────────────────────────────────────
    const takePhoto = async () => {
        logger.tap('ReportIssue', 'Take Photo');
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to capture photos.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            exif: true, // Request EXIF data for GPS extraction
        });
        if (!result.canceled && result.assets[0]) {
            setImages(prev => [...prev, result.assets[0].uri]);
            // Auto-detect location when photo is taken (only if not already detected)
            if (!capturedLocation) {
                await detectLocationForCapture(result.assets[0].exif);
            }
        }
    };

    const pickImage = async () => {
        logger.tap('ReportIssue', 'Pick from Gallery');
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            exif: true,
        });
        if (!result.canceled && result.assets[0]) {
            setImages(prev => [...prev, result.assets[0].uri]);
            if (!capturedLocation) {
                await detectLocationForCapture(result.assets[0].exif);
            }
        }
    };

    const takeVideo = async () => {
        logger.tap('ReportIssue', 'Take Video');
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setVideo(result.assets[0].uri);
            if (!capturedLocation) {
                await detectLocationForCapture();
            }
        }
    };

    // ─── RETRY LOCATION ───────────────────────────────────────────────────
    const retryLocation = async () => {
        setCapturedLocation(null);
        await detectLocationForCapture();
    };

    // ─── SUBMIT ───────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        logger.tap('ReportIssue', 'Submit Report', {
            title, category, anonymous, emergency,
            hasImage: images.length > 0, hasVideo: !!video,
            hasLocation: !!capturedLocation,
            locationSource: capturedLocation?.source,
            gpsAccuracy: capturedLocation?.accuracy,
        });

        if (!title || !category) {
            Alert.alert('Required', 'Please add a title and category.');
            return;
        }

        if (!capturedLocation) {
            Alert.alert(
                'Location Required',
                'A GPS location is required for accurate issue reporting. Please take a photo or detect your location first.',
                [{ text: 'OK' }]
            );
            return;
        }

        setSubmitting(true);
        try {
            const locationData = {
                type: 'Point',
                coordinates: [capturedLocation.longitude, capturedLocation.latitude],
                address: capturedLocation.address,
            };

            const { data } = await issuesAPI.create({
                title,
                description,
                category,
                anonymous,
                emergency,
                image: images[0] || undefined,
                video: video || undefined,
                location: locationData,
            });

            Alert.alert(
                '✅ Report Submitted!',
                `Ticket ID: ${data._id}\nAI Severity: ${data.aiSeverity}\nDepartment: ${data.departmentTag}\nLocation: ${capturedLocation.source.toUpperCase()}\n\nYou earned +10 points!`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to submit report');
        }
        setSubmitting(false);
    };

    // ─── GET SOURCE LABEL ─────────────────────────────────────────────────
    const getSourceBadge = () => {
        if (!capturedLocation) return null;
        const labels: Record<string, { label: string; icon: string; color: string }> = {
            exif: { label: 'Photo EXIF', icon: 'image', color: '#AF52DE' },
            live_gps: { label: 'Live GPS', icon: 'navigate', color: colors.success },
            cached: { label: 'Saved Location', icon: 'bookmark', color: colors.warning },
        };
        return labels[capturedLocation.source] || labels.live_gps;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} allowFontScaling={false}>Report Issue</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                {/* ── Category ─────────────────────────────────────────── */}
                <Text style={styles.sectionLabel} allowFontScaling={false}>Category</Text>
                <View style={styles.catGrid}>
                    {CATEGORIES.map((c) => (
                        <TouchableOpacity
                            key={c.id}
                            onPress={() => setCategory(c.id)}
                            style={[
                                styles.catItem,
                                category === c.id && { backgroundColor: c.color, borderColor: c.color },
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={c.icon as any}
                                size={22}
                                color={category === c.id ? '#FFF' : c.color}
                            />
                            <Text style={[
                                styles.catLabel,
                                category === c.id && { color: '#FFF' },
                            ]} allowFontScaling={false}>{c.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Title ────────────────────────────────────────────── */}
                <Text style={styles.sectionLabel} allowFontScaling={false}>Title</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Brief issue title..."
                    placeholderTextColor={colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                />

                {/* ── Description ──────────────────────────────────────── */}
                <Text style={styles.sectionLabel} allowFontScaling={false}>Description</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe the issue in detail..."
                    placeholderTextColor={colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                />

                {/* ── Visual Evidence ──────────────────────────────────── */}
                <Text style={styles.sectionLabel} allowFontScaling={false}>Visual Evidence</Text>
                <View style={styles.photoRow}>
                    <TouchableOpacity style={styles.photoAdd} onPress={takePhoto}>
                        <View style={styles.photoAddInner}>
                            <Ionicons name="camera" size={24} color={colors.primary} />
                            <Text style={styles.photoText} allowFontScaling={false}>Photo</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoAdd} onPress={takeVideo}>
                        <View style={styles.photoAddInner}>
                            <Ionicons name="videocam" size={24} color={colors.primary} />
                            <Text style={styles.photoText} allowFontScaling={false}>Video</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoAdd} onPress={pickImage}>
                        <View style={styles.photoAddInner}>
                            <Ionicons name="images" size={24} color={colors.primary} />
                            <Text style={styles.photoText} allowFontScaling={false}>Library</Text>
                        </View>
                    </TouchableOpacity>

                    {images.map((uri, i) => (
                        <View key={`img-${i}`} style={styles.photoThumb}>
                            <Image source={{ uri }} style={styles.thumbImg} />
                            <TouchableOpacity style={styles.removePic} onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}>
                                <Ionicons name="close-circle" size={18} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {video && (
                        <View style={styles.photoThumb}>
                            <View style={[styles.thumbImg, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="play-circle" size={32} color="#FFF" />
                            </View>
                            <TouchableOpacity style={styles.removePic} onPress={() => setVideo(null)}>
                                <Ionicons name="close-circle" size={18} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── GPS Location (Auto-Detected, Locked) ────────────── */}
                <Text style={styles.sectionLabel} allowFontScaling={false}>
                    Location
                    <Text style={styles.sectionHint}> • Auto-detected from GPS</Text>
                </Text>

                {detectingLocation && (
                    <View style={styles.detectingBar}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.detectingText} allowFontScaling={false}>
                            Detecting precise GPS location...
                        </Text>
                    </View>
                )}

                {capturedLocation && (
                    <View style={styles.locationCard}>
                        {/* Source badge */}
                        {(() => {
                            const badge = getSourceBadge();
                            if (!badge) return null;
                            return (
                                <View style={styles.sourceBadgeRow}>
                                    <View style={[styles.sourceBadge, { backgroundColor: badge.color + '15' }]}>
                                        <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                                        <Text style={[styles.sourceBadgeText, { color: badge.color }]}
                                            allowFontScaling={false}>{badge.label}</Text>
                                    </View>
                                    {capturedLocation.accuracy && (
                                        <View style={styles.accuracyPill}>
                                            <Text style={styles.accuracyText} allowFontScaling={false}>
                                                ±{capturedLocation.accuracy.toFixed(0)}m
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.lockBadge}>
                                        <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                                        <Text style={styles.lockText} allowFontScaling={false}>Locked</Text>
                                    </View>
                                </View>
                            );
                        })()}

                        {/* Map Preview */}
                        <View style={styles.mapPreviewWrap}>
                            <MapView
                                style={styles.mapPreview}
                                initialRegion={{
                                    latitude: capturedLocation.latitude,
                                    longitude: capturedLocation.longitude,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                }}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                pitchEnabled={false}
                                rotateEnabled={false}
                                liteMode={true}
                            >
                                <Marker coordinate={{
                                    latitude: capturedLocation.latitude,
                                    longitude: capturedLocation.longitude,
                                }}>
                                    <View style={[
                                        styles.markerDot,
                                        category && { backgroundColor: CATEGORIES.find(c => c.id === category)?.color || colors.primary },
                                    ]}>
                                        <View style={styles.markerPulse} />
                                        <Ionicons name="location" size={18} color="#FFF" />
                                    </View>
                                </Marker>
                            </MapView>
                        </View>

                        {/* Address */}
                        <View style={styles.addressRow}>
                            <Ionicons name="location" size={16} color={colors.success} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.addressText} numberOfLines={2} allowFontScaling={false}>
                                    {capturedLocation.address}
                                </Text>
                            </View>
                        </View>

                        {/* Retry button */}
                        <TouchableOpacity onPress={retryLocation} style={styles.retryBtn} activeOpacity={0.7}>
                            <Ionicons name="refresh" size={14} color={colors.primary} />
                            <Text style={styles.retryText} allowFontScaling={false}>Re-detect GPS</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* If no location and not detecting, show detect button */}
                {!capturedLocation && !detectingLocation && (
                    <TouchableOpacity onPress={() => detectLocationForCapture()} style={styles.detectBtn} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[colors.primary, '#0055CC']}
                            style={styles.detectBtnGrad}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="navigate" size={18} color="#FFF" />
                            <Text style={styles.detectBtnText} allowFontScaling={false}>Detect Location Now</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* ── Emergency ────────────────────────────────────────── */}
                <TouchableOpacity
                    style={[styles.emergencyRow, emergency && styles.emergencyActive]}
                    onPress={() => setEmergency(!emergency)}
                    activeOpacity={0.7}
                >
                    <Ionicons name={emergency ? 'warning' : 'warning-outline'} size={22}
                        color={emergency ? '#FF003C' : colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.emergencyLabel, emergency && { color: '#FF003C' }]}
                            allowFontScaling={false}>Emergency / Public Hazard</Text>
                        <Text style={styles.emergencySub} allowFontScaling={false}>
                            {emergency ? '⚡ Auto-elevated to critical priority' : 'Flag if this poses immediate danger'}
                        </Text>
                    </View>
                    <Ionicons name={emergency ? 'checkbox' : 'square-outline'} size={22}
                        color={emergency ? '#FF003C' : colors.textMuted} />
                </TouchableOpacity>

                {/* ── Anonymous ────────────────────────────────────────── */}
                <TouchableOpacity style={styles.anonRow} onPress={() => setAnonymous(!anonymous)} activeOpacity={0.7}>
                    <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                    <View>
                        <Text style={styles.anonText} allowFontScaling={false}>Report anonymously</Text>
                        {anonymous && <Text style={styles.anonWarn} allowFontScaling={false}>⚠ No points earned for anonymous reports</Text>}
                    </View>
                </TouchableOpacity>

                {/* ── Submit ───────────────────────────────────────────── */}
                <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.85} style={styles.submitWrap}>
                    <LinearGradient
                        colors={[colors.primary, '#0055CC']}
                        style={styles.submitBtn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Ionicons name="paper-plane" size={18} color="#FFF" />
                        )}
                        <Text style={styles.submitText} allowFontScaling={false}>
                            {submitting ? 'AI Analyzing & Submitting...' : 'Submit Report'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
        fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.text,
        includeFontPadding: false,
    },
    sectionLabel: {
        fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14,
        marginBottom: 10, marginTop: 18, includeFontPadding: false,
    },
    sectionHint: {
        fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11,
    },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catItem: {
        width: '31%', alignItems: 'center', paddingVertical: 14,
        borderRadius: radius.md, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
    },
    catLabel: {
        fontFamily: 'Inter_500Medium', color: colors.textSecondary,
        fontSize: 11, marginTop: 4, includeFontPadding: false,
    },
    input: {
        fontFamily: 'Inter_400Regular', backgroundColor: colors.surface,
        borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
        color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border,
    },
    textArea: { minHeight: 100 },
    photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    photoAdd: {
        width: 80, height: 80, borderRadius: radius.md,
        borderWidth: 1.5, borderColor: colors.primary + '30', borderStyle: 'dashed',
        overflow: 'hidden',
    },
    photoAddInner: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.primary + '06',
    },
    photoText: {
        fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 10, marginTop: 2,
        includeFontPadding: false,
    },
    photoThumb: {
        width: 80, height: 80, borderRadius: radius.md,
        overflow: 'hidden', position: 'relative',
    },
    thumbImg: { width: '100%', height: '100%' },
    removePic: { position: 'absolute', top: 2, right: 2 },

    // ── Location card ─────────────────────────────────────────
    detectingBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.primary + '0A', borderRadius: radius.md,
        padding: 14, borderWidth: 1, borderColor: colors.primary + '20',
    },
    detectingText: {
        fontFamily: 'Inter_400Regular', color: colors.primaryLight,
        fontSize: 13, includeFontPadding: false,
    },
    locationCard: {
        borderRadius: radius.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: colors.surface,
    },
    sourceBadgeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6,
    },
    sourceBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    sourceBadgeText: {
        fontFamily: 'Inter_600SemiBold', fontSize: 10, includeFontPadding: false,
    },
    accuracyPill: {
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    accuracyText: {
        fontFamily: 'Inter_500Medium', fontSize: 10, color: colors.textMuted,
        includeFontPadding: false,
    },
    lockBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        marginLeft: 'auto',
    },
    lockText: {
        fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textMuted,
        includeFontPadding: false,
    },
    mapPreviewWrap: {
        marginHorizontal: 10, marginVertical: 6,
        borderRadius: radius.md, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    },
    mapPreview: {
        width: '100%', height: 200,
    },
    markerDot: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5,
        shadowRadius: 8, elevation: 6,
    },
    markerPulse: {
        position: 'absolute', width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(0,122,255,0.15)',
    },
    addressRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    addressText: {
        fontFamily: 'Inter_500Medium', fontSize: 13, color: '#FFF',
        lineHeight: 18, includeFontPadding: false,
    },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
    },
    retryText: {
        fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.primary,
        includeFontPadding: false,
    },
    detectBtn: {
        borderRadius: radius.md, overflow: 'hidden',
    },
    detectBtnGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 14, borderRadius: radius.md,
    },
    detectBtnText: {
        fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 14, includeFontPadding: false,
    },

    // ── Emergency & Anonymous ─────────────────────────────────
    emergencyRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18,
        backgroundColor: colors.surface, padding: 14, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border,
    },
    emergencyActive: { borderColor: '#FF003C40', backgroundColor: '#FF003C08' },
    emergencyLabel: {
        fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14,
        includeFontPadding: false,
    },
    emergencySub: {
        fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11,
        marginTop: 2, includeFontPadding: false,
    },
    anonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    anonText: {
        fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14,
        includeFontPadding: false,
    },
    anonWarn: {
        fontFamily: 'Inter_400Regular', color: colors.warning, fontSize: 11,
        marginTop: 2, includeFontPadding: false,
    },
    submitWrap: { borderRadius: radius.md, overflow: 'hidden', marginTop: 24 },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: radius.md,
    },
    submitText: {
        fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16,
        includeFontPadding: false,
    },
});
