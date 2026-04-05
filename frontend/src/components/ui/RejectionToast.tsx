import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Animated, TouchableOpacity,
    Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface RejectionToastProps {
    visible: boolean;
    title?: string;
    reason?: string;
    onDismiss: () => void;
    autoDismissMs?: number;
}

export default function RejectionToast({
    visible,
    title = 'Photo Rejected by AI',
    reason = 'The uploaded image does not appear to show a valid civic issue.',
    onDismiss,
    autoDismissMs = 5500,
}: RejectionToastProps) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-200)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.85)).current;
    const shimmer = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            // Reset progress
            progressAnim.setValue(1);

            // Slide in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    stiffness: 180,
                    damping: 18,
                    mass: 0.8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    stiffness: 200,
                    damping: 14,
                    useNativeDriver: true,
                }),
            ]).start();

            // Shimmer loop
            Animated.loop(
                Animated.timing(shimmer, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                })
            ).start();

            // Progress bar shrink (can't use native driver for width, use scaleX)
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: autoDismissMs,
                useNativeDriver: true,
            }).start();

            // Auto-dismiss
            timerRef.current = setTimeout(() => {
                dismissToast();
            }, autoDismissMs);
        } else {
            translateY.setValue(-200);
            opacity.setValue(0);
            scale.setValue(0.85);
            progressAnim.setValue(1);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible]);

    const dismissToast = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -200,
                duration: 350,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.85,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    if (!visible) return null;

    const shimmerTranslate = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: insets.top + 10,
                    transform: [{ translateY }, { scale }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={dismissToast}
                style={styles.touchable}
            >
                {/* Shimmer effect */}
                <Animated.View
                    style={[
                        styles.shimmer,
                        { transform: [{ translateX: shimmerTranslate }] },
                    ]}
                />

                {/* Left icon */}
                <View style={styles.iconWrap}>
                    <View style={styles.iconPulse} />
                    <Ionicons name="warning" size={24} color="#FF453A" />
                </View>

                {/* Text content */}
                <View style={styles.textWrap}>
                    <Text style={styles.title} allowFontScaling={false} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={styles.reason} allowFontScaling={false} numberOfLines={2}>
                        {reason}
                    </Text>
                </View>

                {/* Dismiss icon */}
                <View style={styles.dismissWrap}>
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </View>

                {/* Progress bar (auto-dismiss indicator) */}
                <View style={styles.progressTrack}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            {
                                transform: [{ scaleX: progressAnim }],
                            },
                        ]}
                    />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 9999,
    },
    touchable: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(40, 12, 12, 0.95)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.35)',
        paddingHorizontal: 14,
        paddingVertical: 14,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#FF453A',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 80,
        backgroundColor: 'rgba(255, 69, 58, 0.06)',
        transform: [{ skewX: '-15deg' }],
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 69, 58, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconPulse: {
        position: 'absolute',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255, 69, 58, 0.06)',
    },
    textWrap: {
        flex: 1,
    },
    title: {
        fontFamily: fonts.bold,
        fontSize: 14,
        color: '#FF6B61',
        includeFontPadding: false,
        marginBottom: 3,
    },
    reason: {
        fontFamily: fonts.regular,
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
        lineHeight: 16,
        includeFontPadding: false,
    },
    dismissWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    progressTrack: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
    },
    progressBar: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 69, 58, 0.5)',
        borderRadius: 3,
    },
});
