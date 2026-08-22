import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, DeviceEventEmitter, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { colors, fonts, shadows } from '../theme/colors';
import { notificationsAPI } from '../services/api';

import HomeFeed from '../screens/Main/HomeFeed';
import MapScreen from '../screens/Main/MapScreen';
import NotificationsScreen from '../screens/Main/NotificationsScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';

const Tab = createBottomTabNavigator();
const BADGE_POLL_INTERVAL = 60_000;

export default function CitizenTabs() {
    const [unreadCount, setUnreadCount] = useState(0);
    const listenerRef = useRef<any>(null);

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
        } catch {}
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, BADGE_POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

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

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('notif:unreadCount', (count: number) => {
            const next = Math.max(0, Number(count) || 0);
            setUnreadCount(next);
            AsyncStorage.setItem('notif:unreadCount', String(next)).catch(() => {});
        });
        return () => sub.remove();
    }, []);

    return (
        <Tab.Navigator
            id="CitizenTabs"
            screenOptions={{
                headerShown: false,
                lazy: true,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    height: Platform.OS === 'ios' ? 84 : 68,
                    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
                    paddingTop: 8,
                    ...shadows.bar,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontFamily: fonts.semibold,
                    fontSize: 10,
                },
            }}
        >
            <Tab.Screen name="Feed" component={HomeFeed}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tab.Screen name="Map" component={MapScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'map' : 'map-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tab.Screen name="Report" component={View}
                options={{
                    tabBarIcon: () => (
                        <View style={styles.reportBtnOuter}>
                            <View style={styles.reportBtn}>
                                <Ionicons name="add" size={28} color={colors.onPrimary} />
                            </View>
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
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
                    ),
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                    tabBarBadgeStyle: { backgroundColor: colors.error, fontFamily: fonts.bold, fontSize: 10 },
                }}
                listeners={{
                    focus: () => fetchUnreadCount(),
                }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    reportBtnOuter: {
        width: 56, height: 56, borderRadius: 28,
        marginBottom: 18,
        ...shadows.fab,
    },
    reportBtn: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 4, borderColor: colors.surface,
    },
});
