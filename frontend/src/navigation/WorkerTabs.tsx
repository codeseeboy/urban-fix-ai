import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import FieldWorkerDashboard from '../screens/Worker/FieldWorkerDashboard';
import MapScreen from '../screens/Main/MapScreen';
import NotificationsScreen from '../screens/Main/NotificationsScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function WorkerTabs() {
    return (
        <Tab.Navigator
            id="WorkerTabs"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(10, 10, 15, 0.96)',
                    borderTopWidth: 0.5, borderTopColor: colors.border,
                    height: 62, paddingBottom: 8, paddingTop: 6, elevation: 0,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
            }}
        >
            <Tab.Screen name="Tasks" component={FieldWorkerDashboard}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="construct-outline" size={22} color={color} /> }}
            />
            <Tab.Screen name="Map" component={MapScreen}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={22} color={color} /> }}
            />
            <Tab.Screen name="Alerts" component={NotificationsScreen}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={22} color={color} /> }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen}
                options={{ tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} /> }}
            />
        </Tab.Navigator>
    );
}
