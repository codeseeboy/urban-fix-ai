import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import AdminDashboard from '../screens/Admin/AdminDashboard';
import MapScreen from '../screens/Main/MapScreen';
import NotificationsScreen from '../screens/Main/NotificationsScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
    return (
        <Tab.Navigator
            id="AdminTabs"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(10, 10, 15, 0.96)',
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border,
                    height: 62,
                    paddingBottom: 8,
                    paddingTop: 6,
                    elevation: 0,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarShowLabel: true,
                tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
            }}
        >
            <Tab.Screen name="Dashboard" component={AdminDashboard}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} /> }}
            />
            <Tab.Screen name="Map" component={MapScreen}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={22} color={color} /> }}
            />
            <Tab.Screen name="Alerts" component={NotificationsScreen}
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={22} color={color} />,
                    tabBarBadge: 5,
                    tabBarBadgeStyle: { backgroundColor: colors.error, fontFamily: 'Inter_700Bold', fontSize: 10 },
                }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} /> }}
            />
        </Tab.Navigator>
    );
}
