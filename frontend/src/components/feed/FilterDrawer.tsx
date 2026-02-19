/**
 * FilterDrawer — Fluid side drawer for feed filters
 * Slides in from the left with blur overlay, premium animation
 */
import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated,
    Dimensions, TouchableWithoutFeedback, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

interface FilterOption {
    id: string;
    icon: string;
    label: string;
    description?: string;
    color?: string;
}

interface FilterDrawerProps {
    visible: boolean;
    onClose: () => void;
    filters: FilterOption[];
    activeFilter: string;
    onSelectFilter: (id: string) => void;
    sortOptions?: FilterOption[];
    activeSort?: string;
    onSelectSort?: (id: string) => void;
}

export default function FilterDrawer({
    visible, onClose, filters, activeFilter, onSelectFilter,
    sortOptions, activeSort, onSelectSort,
}: FilterDrawerProps) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 65,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Overlay */}
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
            </TouchableWithoutFeedback>

            {/* Drawer */}
            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.drawerHeader}>
                        <View>
                            <Text style={styles.drawerTitle}>Feed Filters</Text>
                            <Text style={styles.drawerSubtitle}>Customize your view</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Category Section */}
                    <Text style={styles.sectionLabel}>CATEGORY</Text>

                    {filters.map((filter) => {
                        const isActive = activeFilter === filter.id;
                        return (
                            <TouchableOpacity
                                key={filter.id}
                                style={[styles.filterItem, isActive && styles.filterItemActive]}
                                onPress={() => {
                                    onSelectFilter(filter.id);
                                    onClose();
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    styles.filterIconWrap,
                                    isActive && { backgroundColor: colors.primary + '20' },
                                ]}>
                                    <Ionicons
                                        name={filter.icon as any}
                                        size={18}
                                        color={isActive ? colors.primary : colors.textSecondary}
                                    />
                                </View>
                                <View style={styles.filterTextWrap}>
                                    <Text style={[
                                        styles.filterLabel,
                                        isActive && styles.filterLabelActive,
                                    ]}>
                                        {filter.label}
                                    </Text>
                                    {filter.description && (
                                        <Text style={styles.filterDesc}>{filter.description}</Text>
                                    )}
                                </View>
                                {isActive && (
                                    <View style={styles.activeDot}>
                                        <LinearGradient
                                            colors={[colors.primary, '#0055CC']}
                                            style={styles.activeDotInner}
                                        />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    {/* Sort Section */}
                    {sortOptions && sortOptions.length > 0 && (
                        <>
                            <View style={styles.divider} />
                            <Text style={styles.sectionLabel}>SORT BY</Text>

                            {sortOptions.map((sort) => {
                                const isActive = activeSort === sort.id;
                                return (
                                    <TouchableOpacity
                                        key={sort.id}
                                        style={[styles.filterItem, isActive && styles.filterItemActive]}
                                        onPress={() => {
                                            onSelectSort?.(sort.id);
                                            onClose();
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[
                                            styles.filterIconWrap,
                                            isActive && { backgroundColor: '#8B5CF620' },
                                        ]}>
                                            <Ionicons
                                                name={sort.icon as any}
                                                size={18}
                                                color={isActive ? '#8B5CF6' : colors.textSecondary}
                                            />
                                        </View>
                                        <Text style={[
                                            styles.filterLabel,
                                            isActive && { color: '#8B5CF6' },
                                        ]}>
                                            {sort.label}
                                        </Text>
                                        {isActive && (
                                            <View style={styles.activeDot}>
                                                <LinearGradient
                                                    colors={['#8B5CF6', '#6D28D9']}
                                                    style={styles.activeDotInner}
                                                />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    )}

                    {/* Reset */}
                    <TouchableOpacity
                        style={styles.resetBtn}
                        onPress={() => {
                            onSelectFilter('all');
                            onSelectSort?.('latest');
                            onClose();
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh" size={16} color={colors.textMuted} />
                        <Text style={styles.resetText}>Reset Filters</Text>
                    </TouchableOpacity>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 40,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 25,
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 28,
    },
    drawerTitle: {
        fontFamily: fonts.black,
        fontSize: 22,
        color: colors.text,
        letterSpacing: -0.5,
    },
    drawerSubtitle: {
        fontFamily: fonts.regular,
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionLabel: {
        fontFamily: fonts.bold,
        fontSize: 10,
        color: colors.textMuted,
        letterSpacing: 1.5,
        marginBottom: 12,
        marginTop: 4,
    },
    filterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: radius.md,
        marginBottom: 4,
        gap: 12,
    },
    filterItemActive: {
        backgroundColor: colors.surfaceLight,
    },
    filterIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterTextWrap: {
        flex: 1,
    },
    filterLabel: {
        fontFamily: fonts.semibold,
        fontSize: 14,
        color: colors.textSecondary,
    },
    filterLabelActive: {
        color: colors.primary,
        fontFamily: fonts.bold,
    },
    filterDesc: {
        fontFamily: fonts.regular,
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 1,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    activeDotInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 16,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 24,
        paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    resetText: {
        fontFamily: fonts.medium,
        fontSize: 13,
        color: colors.textMuted,
    },
});
