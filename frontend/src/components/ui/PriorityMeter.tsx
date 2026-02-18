import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';

interface PriorityMeterProps {
    score: number; // 0-10
}

export const PriorityMeter = ({ score }: PriorityMeterProps) => {
    const animatedWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedWidth, {
            toValue: score * 10, // Convert to percentage
            duration: 1000,
            useNativeDriver: false,
        }).start();
    }, [score]);

    let meterColor = colors.success;
    if (score > 4) meterColor = colors.accent;
    if (score > 7) meterColor = colors.error;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Priority Score: {score}/10</Text>
            <View style={styles.track}>
                <Animated.View
                    style={[
                        styles.fill,
                        {
                            width: animatedWidth.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%']
                            }),
                            backgroundColor: meterColor,
                            shadowColor: meterColor,
                        }
                    ]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
        width: '100%',
    },
    label: {
        color: colors.textSecondary,
        fontSize: 12,
        marginBottom: 4,
    },
    track: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 3,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
    },
});
