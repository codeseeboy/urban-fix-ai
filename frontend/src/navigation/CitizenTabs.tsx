import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

import HomeFeed from '../screens/Main/HomeFeed';
import MapScreen from '../screens/Main/MapScreen';
import NotificationsScreen from '../screens/Main/NotificationsScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function CitizenTabs() {
    return (
        <Tab.Navigator
            id="CitizenTabs"
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
                tabBarLabelStyle: {
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 10,
                },
            }}
        >
            <Tab.Screen name="Feed" component={HomeFeed}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={22} color={color} />,
                }}
            />
            <Tab.Screen name="Map" component={MapScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={22} color={color} />,
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
                    tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={22} color={color} />,
                    tabBarBadge: 3,
                    tabBarBadgeStyle: { backgroundColor: colors.error, fontFamily: 'Inter_700Bold', fontSize: 10 },
                }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={22} color={color} />,
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
