import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { colors } from '../theme/colors';
import { notificationsAPI } from '../services/api';

import HomeFeed from '../screens/Main/HomeFeed';
import MapScreen from '../screens/Main/MapScreen';
import NotificationsScreen from '../screens/Main/NotificationsScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';
import LeaderboardScreen from '../screens/Main/LeaderboardScreen';

const Tab = createBottomTabNavigator();

const BADGE_POLL_INTERVAL = 60_000; // 60s — lightweight count-only endpoint

export default function CitizenTabs() {
    const [unreadCount, setUnreadCount] = useState(0);
    const listenerRef = useRef<any>(null);

    // Hydrate cached badge count for instant render (no flicker)
    useEffect(() => {
        (async () => {
            try {
                const cached = await AsyncStorage.getItem('notif:unreadCount');
                if (cached) setUnreadCount(parseInt(cached, 10) || 0);
            } catch {}
        })();
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const { data } = await notificationsAPI.getUnreadCount();
            const count = data.unreadCount || 0;
            setUnreadCount(count);
            AsyncStorage.setItem('notif:unreadCount', String(count)).catch(() => {});
        } catch (e) { /* silent */ }
    }, []);

    // Poll every 60s using lightweight count-only endpoint (was 15s w/ full payload)
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, BADGE_POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Instantly bump badge when a push notification arrives (no extra API call)
    useEffect(() => {
        listenerRef.current = Notifications.addNotificationReceivedListener(() => {
            setUnreadCount(prev => {
                const next = prev + 1;
                AsyncStorage.setItem('notif:unreadCount', String(next)).catch(() => {});
                return next;
            });
        });
        return () => { if (listenerRef.current) listenerRef.current.remove(); };
    }, []);

    return (
        <Tab.Navigator
            id="CitizenTabs"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(10, 10, 15, 0.97)',
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border,
                    height: 64,
                    paddingBottom: 8,
                    paddingTop: 6,
                    elevation: 0,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 10,
                },
            }}
        >
            <Tab.Screen name="Feed" component={HomeFeed}
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={22} color={color} />,
                }}
            />
            <Tab.Screen name="Map" component={MapScreen}
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={22} color={color} />,
                }}
            />
            <Tab.Screen name="Report" component={View}
                options={{
                    tabBarIcon: () => (
                        <View style={styles.reportBtnOuter}>
                            <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.reportBtn}>
                                <Ionicons name="add" size={28} color="#FFF" />
                            </LinearGradient>
                        </View>
                    ),
                    tabBarLabel: () => null,
                }}
                listeners={({ navigation }) => ({
                    tabPress: (e: any) => { e.preventDefault(); navigation.navigate('ReportIssue'); },
                })}
            />
            <Tab.Screen name="Alerts" component={NotificationsScreen}
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={22} color={color} />,
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                    tabBarBadgeStyle: { backgroundColor: colors.error, fontFamily: 'Inter_700Bold', fontSize: 10 },
                }}
                listeners={{
                    focus: () => fetchUnreadCount(),
                }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    reportBtnOuter: {
        width: 58, height: 58, borderRadius: 29,
        marginBottom: 18,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5, shadowRadius: 10, elevation: 10,
    },
    reportBtn: {
        width: 58, height: 58, borderRadius: 29,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: colors.background,
    },
});
