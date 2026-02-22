/**
 * ErrorBoundary — Catches JavaScript errors and prevents app crashes
 * Shows a friendly error screen instead of crashing
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../../theme/colors';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });
        
        // Log error for debugging
        console.error('🚨 ErrorBoundary caught error:', error);
        console.error('Component stack:', errorInfo.componentStack);
        
        // In production, you'd send this to a crash reporting service
        // e.g., Sentry, Bugsnag, Firebase Crashlytics
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconWrap}>
                            <LinearGradient
                                colors={['#FF003C', '#FF4D6D']}
                                style={styles.iconGradient}
                            >
                                <Ionicons name="warning" size={48} color="#FFF" />
                            </LinearGradient>
                        </View>

                        <Text style={styles.title}>Oops! Something went wrong</Text>
                        <Text style={styles.subtitle}>
                            The app encountered an unexpected error. Don't worry, your data is safe.
                        </Text>

                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={this.handleRetry}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[colors.primary, '#0055CC']}
                                style={styles.retryGradient}
                            >
                                <Ionicons name="refresh" size={20} color="#FFF" />
                                <Text style={styles.retryText}>Try Again</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.debugBox}>
                                <Text style={styles.debugTitle}>Debug Info (Dev Only):</Text>
                                <Text style={styles.debugText}>
                                    {this.state.error.toString()}
                                </Text>
                                {this.state.errorInfo && (
                                    <Text style={styles.debugStack}>
                                        {this.state.errorInfo.componentStack?.slice(0, 500)}
                                    </Text>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    iconWrap: {
        marginBottom: 24,
    },
    iconGradient: {
        width: 96,
        height: 96,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF003C',
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontFamily: fonts.bold,
        fontSize: 22,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontFamily: fonts.regular,
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    retryBtn: {
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    retryGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: radius.lg,
    },
    retryText: {
        fontFamily: fonts.bold,
        color: '#FFF',
        fontSize: 16,
    },
    debugBox: {
        marginTop: 32,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: 16,
        maxHeight: 200,
        width: '100%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    debugTitle: {
        fontFamily: fonts.semibold,
        fontSize: 12,
        color: '#FF6B35',
        marginBottom: 8,
    },
    debugText: {
        fontFamily: fonts.regular,
        fontSize: 11,
        color: '#FF003C',
        marginBottom: 8,
    },
    debugStack: {
        fontFamily: fonts.regular,
        fontSize: 10,
        color: colors.textMuted,
    },
});
