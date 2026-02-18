import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

import OnboardingScreen from '../screens/Auth/OnboardingScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import LocationSetupScreen from '../screens/Auth/LocationSetupScreen';
import ProfileSetupScreen from '../screens/Auth/ProfileSetupScreen';
import CitizenTabs from './CitizenTabs';
import AdminTabs from './AdminTabs';
import WorkerTabs from './WorkerTabs';
import IssueDetailScreen from '../screens/Main/IssueDetailScreen';
import ReportIssueScreen from '../screens/Main/ReportIssueScreen';
import LeaderboardScreen from '../screens/Main/LeaderboardScreen';
import SettingsScreen from '../screens/Main/SettingsScreen';
import EditProfileScreen from '../screens/Main/EditProfileScreen';

const Stack = createStackNavigator();

export default function RootNavigator() {
    const { user, loading, needsLocationSetup, needsProfileSetup } = useAuth();

    if (loading) return null;

    const getMainScreen = () => {
        if (!user) return null;
        if (user.role === 'admin' || user.role === 'super_admin') return AdminTabs;
        if (user.role === 'field_worker') return WorkerTabs;
        return CitizenTabs;
    };

    return (
        <NavigationContainer>
            <Stack.Navigator id="root" screenOptions={{ headerShown: false, cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS }}>
                {!user ? (
                    <>
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                    </>
                ) : needsLocationSetup ? (
                    <Stack.Screen name="LocationSetup" component={LocationSetupScreen} />
                ) : needsProfileSetup ? (
                    <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                ) : (
                    <>
                        <Stack.Screen name="MainTabs" component={getMainScreen()!} />
                        <Stack.Screen name="IssueDetail" component={IssueDetailScreen}
                            options={{ cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS }} />
                        <Stack.Screen name="ReportIssue" component={ReportIssueScreen}
                            options={{ cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS }} />
                        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
