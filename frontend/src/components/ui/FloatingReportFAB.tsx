import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';
import { Plus } from 'lucide-react-native';

interface FloatingReportFABProps {
    onPress: () => void;
}

export const FloatingReportFAB = ({ onPress }: FloatingReportFABProps) => {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.gradient}>
                <Plus color="#FFF" size={32} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        shadowColor: colors.primary,
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
        zIndex: 1000,
    },
    gradient: {
        flex: 1,
        backgroundColor: colors.primary, // Gradient placeholder
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    }
});
