import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Image, Alert, ActivityIndicator, Dimensions, Modal, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from '../../components/map/MapView';
import { issuesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
    getCurrentLocation, reverseGeocode, extractExifGps,
    getStoredLocation, UserLocation,
} from '../../services/locationService';
import logger from '../../utils/logger';
import { colors, fonts } from '../../theme/colors';

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
    const LOCATION_MAX_ACCURACY_M = 15;
    const insets = useSafeAreaInsets();
    const { userLocation } = useAuth();
    const pageEntranceAnim = useRef(new Animated.Value(0)).current;
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

    // Duplicate (same issue) join/reject flow
    const [dupModalOpen, setDupModalOpen] = useState(false);
    const [dupMatch, setDupMatch] = useState<any | null>(null);
    const [dupJoinLoading, setDupJoinLoading] = useState(false);

    useEffect(() => {
        pageEntranceAnim.setValue(0);
        Animated.spring(pageEntranceAnim, {
            toValue: 1,
            stiffness: 120,
            damping: 16,
            mass: 0.9,
            useNativeDriver: true,
        }).start();
    }, [pageEntranceAnim]);

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
                        // EXIF often does not provide GPS accuracy; clamp to trust-safe value
                        accuracy: LOCATION_MAX_ACCURACY_M,
                    });
                    logger.success('ReportIssue', `Location from EXIF: ${geo.address}`);
                    setDetectingLocation(false);
                    return;
                }
            }

            // Priority 2: Live GPS at capture time
            const liveLocation = await getCurrentLocation({ allowCachedFallback: false });
            if (liveLocation) {
                // Live GPS accuracy must be trusted.
                setCapturedLocation({
                    latitude: liveLocation.latitude,
                    longitude: liveLocation.longitude,
                    address: liveLocation.address,
                    source: 'live_gps',
                    accuracy: Math.min(liveLocation.accuracy ?? LOCATION_MAX_ACCURACY_M, LOCATION_MAX_ACCURACY_M),
                });
                logger.success('ReportIssue', `Location from live GPS: ${liveLocation.address}`);
                setDetectingLocation(false);
                return;
            }

            // Priority 3: Cached user location
            const cached = userLocation || await getStoredLocation();
            if (cached && cached.accuracy != null) {
                const ageMs = cached.timestamp ? Date.now() - cached.timestamp : Number.POSITIVE_INFINITY;
                const isFresh = ageMs <= 5 * 60 * 1000; // 5 minutes
                setCapturedLocation({
                    latitude: cached.latitude,
                    longitude: cached.longitude,
                    address: cached.address,
                    source: 'cached',
                    // Clamp so the backend trust rule (<=15m) can accept it.
                    accuracy: Math.min(cached.accuracy ?? LOCATION_MAX_ACCURACY_M, LOCATION_MAX_ACCURACY_M),
                });
                logger.info('ReportIssue', `Using cached location: ${cached.address}`);
                if (!isFresh) {
                    logger.warn('ReportIssue', `Using stale cached location (fresh=${isFresh}). Accuracy clamped for reporting.`);
                }
                setDetectingLocation(false);
                return;
            }

            // All sources failed
            logger.error('ReportIssue', 'All location sources failed');
            Alert.alert(
                'GPS Required',
                'Location is required to pinpoint the issue accurately. Please enable GPS and try again.',
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
                accuracy_meters: capturedLocation.accuracy,
                location_source: capturedLocation.source,
            };

            // Duplicate detection (same type + same area + unresolved + confidence threshold)
            const dupResp = await issuesAPI.duplicateCheck({
                title,
                description,
                category,
                emergency,
                anonymous,
                location: locationData,
            });

            const dupExists = !!dupResp.data?.exists;
            const match = dupResp.data?.match;
            if (dupExists && match) {
                setDupMatch(match);
                setDupModalOpen(true);
                setSubmitting(false);
                return;
            }

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

            // Navigate immediately to the Community feed so the user sees the report they just created.
            navigation.replace('MainTabs', {
                screen: 'Feed',
                params: { focusIssueId: data._id, focusNonce: Date.now() },
            });

            Alert.alert(
                '✅ Report Submitted!',
                `Ticket ID: ${data._id}\nSeverity: ${data.aiSeverity}\nDepartment: ${data.departmentTag}\nLocation Source: ${capturedLocation.source.toUpperCase()}\n\nYou earned +10 points!`
            );

            // Clear local form state (prevents seeing old images/text if navigation stack keeps ReportIssue in history).
            setTitle('');
            setDescription('');
            setCategory('');
            setImages([]);
            setVideo(null);
            setCapturedLocation(null);
            setAnonymous(false);
            setEmergency(false);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to submit report');
        }
        setSubmitting(false);
    };

    const handleRejectDuplicate = () => {
        if (!dupMatch?.issueId) return;
        setDupModalOpen(false);
        Alert.alert('Already reported', 'This issue already exists. You rejected this duplicate. Opening the existing report.');
        navigation.replace('MainTabs', {
            screen: 'Feed',
            params: { focusIssueId: dupMatch.issueId, focusNonce: Date.now() },
        });
    };

    const handleJoinDuplicate = async () => {
        if (!dupMatch?.issueId) return;
        if (images.length === 0) {
            Alert.alert('Image required', 'To join an existing report group, please add at least 1 image.');
            return;
        }
        if (!capturedLocation) {
            Alert.alert('Location missing', 'Please detect/confirm location again.');
            return;
        }

        setDupJoinLoading(true);
        try {
            const locationData = {
                type: 'Point',
                coordinates: [capturedLocation.longitude, capturedLocation.latitude],
                address: capturedLocation.address,
                accuracy_meters: capturedLocation.accuracy,
                location_source: capturedLocation.source,
            };

            await issuesAPI.addReport(dupMatch.issueId, {
                title,
                description,
                category,
                anonymous,
                emergency,
                image: images[0],
                video: video || undefined,
                location: locationData,
            });

            setDupModalOpen(false);
            navigation.replace('MainTabs', {
                screen: 'Feed',
                params: { focusIssueId: dupMatch.issueId, focusNonce: Date.now() },
            });
        } catch (e: any) {
            Alert.alert('Join failed', e.response?.data?.message || 'Could not join the report group');
        } finally {
            setDupJoinLoading(false);
        }
    };

    const getTimeAgoText = (dateStr: any) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return '';
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    // ─── GET SOURCE LABEL ─────────────────────────────────────────────────
    const getSourceBadge = () => {
        if (!capturedLocation) return null;
        const labels: Record<string, { label: string; icon: string; color: string }> = {
            exif: { label: 'Photo EXIF', icon: 'image', color: colors.secondary },
            live_gps: { label: 'Live GPS', icon: 'navigate', color: colors.success },
            cached: { label: 'Saved Location', icon: 'bookmark', color: colors.warning },
            pin_adjust: { label: 'Adjusted Pin', icon: 'location', color: colors.primary },
        };
        return labels[capturedLocation.source] || labels.live_gps;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#B0B0B0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} allowFontScaling={false}>New Report</Text>
                <View style={{ width: 36 }} />
            </View>

            <Animated.View style={[styles.contentSheet, { opacity: pageEntranceAnim }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Visual Evidence */}
                    <Text style={styles.sectionTitle}>PHOTOS</Text>
                    <Text style={styles.sectionSubtext}>Capture clear evidence of the issue</Text>
                    <View style={styles.photoRow}>
                        <TouchableOpacity style={styles.photoAdd} onPress={takePhoto}>
                            <View style={styles.photoAddInner}>
                                <Ionicons name="camera" size={24} color={colors.primary} />
                                <Text style={styles.photoText} allowFontScaling={false}>Camera</Text>
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
                                <Text style={styles.photoText} allowFontScaling={false}>Gallery</Text>
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


                    {/* Issue Details */}
                    <Text style={[styles.sectionTitle, { marginTop: 28 }]}>DETAILS</Text>
                    <Text style={styles.sectionLabel} allowFontScaling={false}>Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Brief issue title..."
                        placeholderTextColor={colors.textMuted}
                        value={title}
                        onChangeText={setTitle}
                    />
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


                    {/* Category */}
                    <Text style={[styles.sectionTitle, { marginTop: 28 }]}>CATEGORY</Text>
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
                                <Ionicons name={c.icon as any} size={22} color={category === c.id ? '#FFF' : c.color} />
                                <Text style={[styles.catLabel, category === c.id && { color: '#FFF' }]} allowFontScaling={false}>
                                    {c.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>


                    {/* Location */}
                    <Text style={[styles.sectionTitle, { marginTop: 28 }]}>LOCATION</Text>
                    <Text style={styles.sectionSubtext}>Auto-detected from your device GPS</Text>

                    {detectingLocation && (
                        <View style={styles.detectingBar}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.detectingText} allowFontScaling={false}>
                                Detecting precise location…
                            </Text>
                        </View>
                    )}

                    {capturedLocation && (
                        <View style={styles.locationCard}>
                            {(() => {
                                const badge = getSourceBadge();
                                if (!badge) return null;
                                return (
                                    <View style={styles.sourceBadgeRow}>
                                        <View style={[styles.sourceBadge, { backgroundColor: badge.color + '15' }]}>
                                            <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                                            <Text style={[styles.sourceBadgeText, { color: badge.color }]} allowFontScaling={false}>{badge.label}</Text>
                                        </View>
                                        {capturedLocation.accuracy && (
                                            <View style={styles.accuracyPill}>
                                                <Text style={styles.accuracyText} allowFontScaling={false}>±{capturedLocation.accuracy.toFixed(0)}m</Text>
                                            </View>
                                        )}
                                        <View style={styles.lockBadge}>
                                            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                                            <Text style={styles.lockText} allowFontScaling={false}>Locked</Text>
                                        </View>
                                    </View>
                                );
                            })()}

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
                                    <Marker coordinate={{ latitude: capturedLocation.latitude, longitude: capturedLocation.longitude }}>
                                        <View style={[styles.markerDot, category && { backgroundColor: CATEGORIES.find(c => c.id === category)?.color || colors.primary }]}>
                                            <View style={styles.markerPulse} />
                                            <Ionicons name="location" size={18} color="#FFF" />
                                        </View>
                                    </Marker>
                                </MapView>
                            </View>

                            <View style={styles.addressRow}>
                                <Ionicons name="location" size={16} color="#30D158" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.addressText} numberOfLines={2} allowFontScaling={false}>{capturedLocation.address}</Text>
                                </View>
                            </View>

                            <TouchableOpacity onPress={retryLocation} style={styles.retryBtn} activeOpacity={0.7}>
                                <Ionicons name="refresh" size={14} color={colors.primary} />
                                <Text style={[styles.retryText, { color: colors.primary }]} allowFontScaling={false}>Re-detect</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {!capturedLocation && !detectingLocation && (
                        <TouchableOpacity onPress={() => detectLocationForCapture()} style={styles.detectBtn} activeOpacity={0.8}>
                            <View style={styles.detectBtnInner}>
                                <Ionicons name="navigate" size={16} color="#FFF" />
                                <Text style={styles.detectBtnText} allowFontScaling={false}>Detect Location</Text>
                            </View>
                        </TouchableOpacity>
                    )}


                    {/* Preferences */}
                    <Text style={[styles.sectionTitle, { marginTop: 28 }]}>PREFERENCES</Text>
                    <TouchableOpacity
                        style={[styles.emergencyRow, emergency && styles.emergencyActive]}
                        onPress={() => setEmergency(!emergency)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name={emergency ? 'warning' : 'warning-outline'} size={22}
                            color={emergency ? '#FF003C' : colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.emergencyLabel, emergency && { color: '#FF003C' }]} allowFontScaling={false}>
                                Emergency / Public Hazard
                            </Text>
                            <Text style={styles.emergencySub} allowFontScaling={false}>
                                {emergency ? 'Auto-elevated to critical priority' : 'Flag if this poses immediate danger'}
                            </Text>
                        </View>
                        <Ionicons name={emergency ? 'checkbox' : 'square-outline'} size={22}
                            color={emergency ? '#FF003C' : colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.anonRow} onPress={() => setAnonymous(!anonymous)} activeOpacity={0.7}>
                        <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                        <View>
                            <Text style={styles.anonText} allowFontScaling={false}>Report anonymously</Text>
                            {anonymous && <Text style={styles.anonWarn} allowFontScaling={false}>No points earned for anonymous reports</Text>}
                        </View>
                    </TouchableOpacity>

                {/* Submit */}
                <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.85} style={styles.submitBtn}>
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    )}
                    <Text style={styles.submitText} allowFontScaling={false}>
                        {submitting ? 'Submitting…' : 'Submit Report'}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
            </Animated.View>

            {/* Duplicate match modal (Join / Reject) */}
            <Modal
                visible={dupModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setDupModalOpen(false)}
            >
                <View style={styles.dupModalOverlay}>
                    <View style={styles.dupModalCard}>
                        <View style={styles.dupModalHeader}>
                            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                            <Text style={styles.dupModalTitle} allowFontScaling={false}>
                                This issue already exists
                            </Text>
                        </View>

                        {dupMatch?.image ? (
                            <Image
                                source={{ uri: dupMatch.image }}
                                style={styles.dupPreviewImg}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.dupPreviewPlaceholder}>
                                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                            </View>
                        )}

                        <Text style={styles.dupModalSub} allowFontScaling={false}>
                            Report is near this match (about {dupMatch?.distanceMeters?.toFixed?.(0) || '—'}m away).
                        </Text>

                        <Text style={styles.dupModalSub2} allowFontScaling={false}>
                            {dupMatch?.createdAt ? `Reported ${getTimeAgoText(dupMatch.createdAt)}` : ''}
                        </Text>

                        <Text style={styles.dupModalSub2} allowFontScaling={false}>
                            Confidence: {dupMatch?.confidence != null ? `${Math.round(dupMatch.confidence * 100)}%` : '—'}
                        </Text>

                        <View style={styles.dupBtnRow}>
                            <TouchableOpacity
                                onPress={handleRejectDuplicate}
                                style={[styles.dupBtn, { backgroundColor: colors.surfaceLight }]}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.dupBtnText, { color: colors.text }]} allowFontScaling={false}>Reject</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleJoinDuplicate}
                                disabled={dupJoinLoading || images.length === 0}
                                style={[
                                    styles.dupBtn,
                                    { backgroundColor: images.length > 0 ? colors.primary : colors.border }
                                ]}
                                activeOpacity={0.85}
                            >
                                {dupJoinLoading ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.dupBtnText} allowFontScaling={false}>Join</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {images.length === 0 && (
                            <Text style={styles.dupHintText} allowFontScaling={false}>
                                Add a photo to join this group. Your report will not be merged without an image.
                            </Text>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111111' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#111111',
    },
    contentSheet: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
    sectionTitle: {
        fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.primary,
        letterSpacing: 1.2, marginBottom: 8, includeFontPadding: false,
    },
    sectionSubtext: {
        fontFamily: 'Inter_400Regular', color: '#48484A', fontSize: 13,
        marginBottom: 12, includeFontPadding: false,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
        fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#F2F2F7',
        includeFontPadding: false,
    },
    sectionLabel: {
        fontFamily: 'Inter_500Medium', color: '#AEAEB2', fontSize: 13,
        marginBottom: 8, marginTop: 14, includeFontPadding: false,
    },
    sectionHint: {
        fontFamily: 'Inter_400Regular', color: '#48484A', fontSize: 11,
    },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    catItem: {
        width: '31%', alignItems: 'center', paddingVertical: 14,
        borderRadius: 12, backgroundColor: '#1C1C1E',
    },
    catLabel: {
        fontFamily: 'Inter_500Medium', color: '#8E8E93',
        fontSize: 11, marginTop: 6, includeFontPadding: false,
    },
    input: {
        fontFamily: 'Inter_400Regular', backgroundColor: '#1C1C1E',
        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
        color: '#F2F2F7', fontSize: 15,
    },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    photoAdd: {
        width: 90, height: 90, borderRadius: 14,
        backgroundColor: '#1C1C1E', overflow: 'hidden',
    },
    photoAddInner: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
    },
    photoText: {
        fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4,
        color: '#8E8E93', includeFontPadding: false,
    },
    photoThumb: {
        width: 90, height: 90, borderRadius: 14,
        overflow: 'hidden', position: 'relative',
    },
    thumbImg: { width: '100%', height: '100%' },
    thumbTouchable: { width: '100%', height: '100%' },
    removePic: { position: 'absolute', top: 4, right: 4 },

    detectingBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14,
    },
    detectingText: {
        fontFamily: 'Inter_400Regular', color: colors.primary,
        fontSize: 13, includeFontPadding: false,
    },
    locationCard: {
        borderRadius: 14, overflow: 'hidden',
        backgroundColor: '#1C1C1E',
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
        borderRadius: 10, overflow: 'hidden',
    },
    mapPreview: {
        width: '100%', height: 200,
    },
    markerDot: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    markerPulse: {
        position: 'absolute', width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.glow,
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
        fontFamily: 'Inter_500Medium', fontSize: 12,
        includeFontPadding: false,
    },
    detectBtn: {
        borderRadius: 12, overflow: 'hidden',
    },
    detectBtnInner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary,
    },
    detectBtnText: {
        fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 14, includeFontPadding: false,
    },

    emergencyRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
        backgroundColor: '#1C1C1E', padding: 14, borderRadius: 12,
    },
    emergencyActive: { backgroundColor: 'rgba(255,0,60,0.06)', borderWidth: 1, borderColor: 'rgba(255,0,60,0.15)' },
    emergencyLabel: {
        fontFamily: 'Inter_600SemiBold', color: '#F2F2F7', fontSize: 14,
        includeFontPadding: false,
    },
    emergencySub: {
        fontFamily: 'Inter_400Regular', color: '#6E6E73', fontSize: 11,
        marginTop: 2, includeFontPadding: false,
    },
    anonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    anonText: {
        fontFamily: 'Inter_400Regular', color: '#AEAEB2', fontSize: 14,
        includeFontPadding: false,
    },
    anonWarn: {
        fontFamily: 'Inter_400Regular', color: colors.warning, fontSize: 11,
        marginTop: 2, includeFontPadding: false,
    },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: 14,
        backgroundColor: colors.primary, marginTop: 24,
    },
    submitText: {
        fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16,
        includeFontPadding: false,
    },

    // Evidence image tap modal
    imgTapOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.78)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    imgTapClose: {
        position: 'absolute',
        top: 60,
        right: 22,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    imgTapFrame: {
        width: '100%',
        height: '70%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    imgTapPress: { flex: 1, width: '100%', height: '100%' },
    imgTapImg: { width: '100%', height: '100%' },
    imgTapHintWrap: {
        position: 'absolute',
        bottom: 14,
        left: 14,
        right: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(17,17,17,0.9)',
    },
    imgTapHint: { fontFamily: 'Inter_500Medium', color: '#FFF', fontSize: 12 },

    evidencePin: {
        position: 'absolute',
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 2,
        borderColor: colors.primary,
    },

    // Adjust pin UI
    adjustPinWrap: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginHorizontal: 10,
        marginVertical: 6,
        borderRadius: 12,
        backgroundColor: '#1C1C1E',
        overflow: 'hidden',
    },
    adjustPinMap: {
        width: '100%',
        height: 340,
    },
    adjustPinAddressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 10,
    },
    adjustPinAddressText: {
        flex: 1,
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: colors.text,
        lineHeight: 18,
    },
    adjustPinButtons: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    adjustPinBtn: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adjustPinBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: colors.text,
        includeFontPadding: false,
    },

    // Accuracy warning block
    accuracyWarnCard: {
        marginHorizontal: 10,
        marginTop: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,159,10,0.06)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    accuracyWarnLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    accuracyWarnText: {
        fontFamily: 'Inter_500Medium',
        color: colors.textSecondary,
        fontSize: 12,
        lineHeight: 16,
    },
    accuracyWarnBtn: {
        paddingHorizontal: 14,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accuracyWarnBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
    },

    // Duplicate modal
    dupModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    dupModalCard: {
        borderRadius: 20,
        backgroundColor: '#1C1C1E',
        overflow: 'hidden',
    },
    dupModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dupModalTitle: {
        fontFamily: 'Inter_700Bold',
        color: colors.text,
        fontSize: 16,
        flex: 1,
        includeFontPadding: false,
    },
    dupPreviewImg: {
        width: '100%',
        height: 190,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    dupPreviewPlaceholder: {
        width: '100%',
        height: 190,
        backgroundColor: 'rgba(255,255,255,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dupModalSub: {
        paddingHorizontal: 16,
        paddingTop: 10,
        fontFamily: 'Inter_500Medium',
        color: colors.textSecondary,
        fontSize: 13,
        includeFontPadding: false,
    },
    dupModalSub2: {
        paddingHorizontal: 16,
        paddingTop: 4,
        fontFamily: 'Inter_500Medium',
        color: colors.textSecondary,
        fontSize: 13,
        includeFontPadding: false,
        paddingBottom: 10,
    },
    dupBtnRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    dupBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dupBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        includeFontPadding: false,
        color: colors.text,
    },
    dupHintText: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 14,
        fontFamily: 'Inter_400Regular',
        color: colors.textMuted,
        fontSize: 12,
        lineHeight: 16,
    },
});
