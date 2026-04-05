import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image,
    Animated, Dimensions, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme/colors';

const { width: SW, height: SH } = Dimensions.get('window');

interface CameraPortalProps {
    visible: boolean;
    images: string[];
    onTakePhoto: () => void;
    onPickGallery: () => void;
    onRemoveImage: (index: number) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export default function CameraPortal({
    visible, images, onTakePhoto, onPickGallery,
    onRemoveImage, onConfirm, onClose,
}: CameraPortalProps) {
    const insets = useSafeAreaInsets();
    const bgOp = useRef(new Animated.Value(0)).current;
    const contentY = useRef(new Animated.Value(SH)).current;
    const titleOp = useRef(new Animated.Value(0)).current;
    const titleY = useRef(new Animated.Value(-30)).current;
    const btnScale = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0)).current;
    const confirmScale = useRef(new Animated.Value(0.8)).current;
    const confirmOp = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            bgOp.setValue(0); contentY.setValue(SH); titleOp.setValue(0);
            titleY.setValue(-30); btnScale.setValue(0);

            Animated.stagger(100, [
                Animated.timing(bgOp, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(contentY, { toValue: 0, stiffness: 120, damping: 18, mass: 0.9, useNativeDriver: true }),
                Animated.parallel([
                    Animated.timing(titleOp, { toValue: 1, duration: 400, useNativeDriver: true }),
                    Animated.spring(titleY, { toValue: 0, stiffness: 200, damping: 18, useNativeDriver: true }),
                ]),
                Animated.spring(btnScale, { toValue: 1, stiffness: 200, damping: 12, useNativeDriver: true }),
            ]).start();

            Animated.loop(Animated.sequence([
                Animated.timing(glowPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(glowPulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
            ])).start();
        }
    }, [visible]);

    useEffect(() => {
        if (images.length > 0) {
            confirmOp.setValue(0); confirmScale.setValue(0.8);
            Animated.parallel([
                Animated.timing(confirmOp, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(confirmScale, { toValue: 1, stiffness: 200, damping: 14, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.timing(confirmOp, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
    }, [images.length]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(bgOp, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(contentY, { toValue: SH, duration: 350, useNativeDriver: true }),
        ]).start(() => onClose());
    };

    if (!visible) return null;

    const glowOp = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] });

    return (
        <Animated.View style={[styles.overlay, { opacity: bgOp }]}>
            <Animated.View style={[styles.container, { paddingTop: insets.top + 10, transform: [{ translateY: contentY }] }]}>
                {/* Close button */}
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                    <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>

                {/* Header */}
                <Animated.View style={[styles.header, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
                    <View style={styles.aiLabel}>
                        <Text style={styles.aiLabelText} allowFontScaling={false}>UrbanFix AI</Text>
                    </View>
                    <Text style={styles.title} allowFontScaling={false}>Capture Issue Evidence</Text>
                    <Text style={styles.subtitle} allowFontScaling={false}>
                        Take clear photos of the civic issue for AI analysis
                    </Text>
                </Animated.View>

                {/* Camera & Gallery buttons */}
                <Animated.View style={[styles.btnRow, { transform: [{ scale: btnScale }] }]}>
                    {/* Camera button */}
                    <TouchableOpacity style={styles.captureBtn} onPress={onTakePhoto} activeOpacity={0.8}>
                        <Animated.View style={[styles.captureBtnGlow, { opacity: glowOp }]} />
                        <View style={styles.captureBtnInner}>
                            <View style={styles.captureBtnRing}>
                                <Ionicons name="camera" size={36} color="#FFF" />
                            </View>
                        </View>
                        <Text style={styles.captureBtnLabel} allowFontScaling={false}>Take Photo</Text>
                    </TouchableOpacity>

                    {/* Gallery button */}
                    <TouchableOpacity style={styles.galleryBtn} onPress={onPickGallery} activeOpacity={0.8}>
                        <View style={styles.galleryBtnInner}>
                            <Ionicons name="images" size={28} color={colors.primary} />
                        </View>
                        <Text style={styles.galleryBtnLabel} allowFontScaling={false}>Gallery</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Image count info */}
                {images.length > 0 && (
                    <View style={styles.countRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#30D158" />
                        <Text style={styles.countText} allowFontScaling={false}>
                            {images.length} photo{images.length > 1 ? 's' : ''} captured
                        </Text>
                    </View>
                )}

                {/* Thumbnail strip */}
                {images.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.thumbStrip}
                    >
                        {images.map((uri, i) => (
                            <View key={`thumb-${i}`} style={styles.thumbWrap}>
                                <Image source={{ uri }} style={styles.thumbImg} />
                                <TouchableOpacity
                                    style={styles.thumbRemove}
                                    onPress={() => onRemoveImage(i)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="close-circle" size={22} color="#FF453A" />
                                </TouchableOpacity>
                                <View style={styles.thumbBadge}>
                                    <Text style={styles.thumbBadgeText} allowFontScaling={false}>{i + 1}</Text>
                                </View>
                            </View>
                        ))}

                        {/* Add more button */}
                        <TouchableOpacity style={styles.thumbAdd} onPress={onTakePhoto} activeOpacity={0.7}>
                            <Ionicons name="add" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </ScrollView>
                )}

                {/* Confirm & Next button */}
                <Animated.View style={[styles.confirmWrap, { opacity: confirmOp, transform: [{ scale: confirmScale }] }]}>
                    <TouchableOpacity
                        style={[styles.confirmBtn, images.length === 0 && styles.confirmBtnDisabled]}
                        onPress={onConfirm}
                        disabled={images.length === 0}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.confirmText} allowFontScaling={false}>
                            Confirm & Analyze
                        </Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </TouchableOpacity>
                </Animated.View>

                {/* Bottom hint */}
                <View style={styles.hintWrap}>
                    <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.hintText} allowFontScaling={false}>
                        Each photo will be analyzed by AI for issue detection
                    </Text>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 50,
    },
    container: {
        flex: 1,
        backgroundColor: 'rgba(10,10,18,0.98)',
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    aiLabel: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: 'rgba(0,122,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(0,122,255,0.2)',
        marginBottom: 16,
    },
    aiLabelText: {
        fontFamily: fonts.bold,
        fontSize: 12,
        color: colors.primary,
    },
    title: {
        fontFamily: fonts.bold,
        fontSize: 26,
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: fonts.regular,
        fontSize: 14,
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'center',
        lineHeight: 20,
    },
    btnRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 24,
        marginBottom: 30,
    },
    captureBtn: {
        alignItems: 'center',
    },
    captureBtnGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primary,
        top: -10,
    },
    captureBtnInner: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: 'rgba(0,122,255,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,122,255,0.08)',
    },
    captureBtnRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 16 },
            android: { elevation: 8 },
        }),
    },
    captureBtnLabel: {
        fontFamily: fonts.semibold,
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 10,
    },
    galleryBtn: {
        alignItems: 'center',
    },
    galleryBtnInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,122,255,0.08)',
        borderWidth: 2,
        borderColor: 'rgba(0,122,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryBtnLabel: {
        fontFamily: fonts.medium,
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 8,
    },
    countRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    countText: {
        fontFamily: fonts.medium,
        fontSize: 13,
        color: '#30D158',
    },
    thumbStrip: {
        paddingHorizontal: 4,
        gap: 10,
        marginBottom: 24,
    },
    thumbWrap: {
        width: 80,
        height: 80,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
    },
    thumbImg: {
        width: '100%',
        height: '100%',
    },
    thumbRemove: {
        position: 'absolute',
        top: 3,
        right: 3,
    },
    thumbBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbBadgeText: {
        fontFamily: fonts.bold,
        fontSize: 10,
        color: '#FFF',
    },
    thumbAdd: {
        width: 80,
        height: 80,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(0,122,255,0.25)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,122,255,0.04)',
    },
    confirmWrap: {
        width: '100%',
        paddingHorizontal: 16,
    },
    confirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: colors.primary,
        ...Platform.select({
            ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16 },
            android: { elevation: 8 },
        }),
    },
    confirmBtnDisabled: {
        backgroundColor: 'rgba(0,122,255,0.2)',
    },
    confirmText: {
        fontFamily: fonts.bold,
        fontSize: 16,
        color: '#FFF',
    },
    hintWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 16,
    },
    hintText: {
        fontFamily: fonts.regular,
        fontSize: 11,
        color: 'rgba(255,255,255,0.3)',
    },
});
