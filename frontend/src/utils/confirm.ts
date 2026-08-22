import { Alert, Platform } from 'react-native';

export function confirmAction(
    title: string,
    message: string,
    confirmLabel = 'OK',
): Promise<boolean> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }

    return new Promise((resolve) => {
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
        ]);
    });
}
