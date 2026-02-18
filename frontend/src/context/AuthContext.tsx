import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, userAPI } from '../services/api';
import logger from '../utils/logger';

interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
    points: number;
    reportsCount: number;
    reportsResolved: number;
    impactScore: number;
    region: string;
    badges: string[];
    token: string;
    username?: string;
    city?: string;
    ward?: string;
    interests?: string[];
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    needsLocationSetup: boolean;
    needsProfileSetup: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    completeLocationSetup: () => void;
    completeProfileSetup: (data: { username: string; city: string; ward: string; interests: string[] }) => Promise<void>;
    completeOnboarding: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsLocationSetup, setNeedsLocationSetup] = useState(false);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        logger.info('Auth', 'Loading persisted user from AsyncStorage...');
        try {
            const stored = await AsyncStorage.getItem('user');
            if (stored) {
                const parsed = JSON.parse(stored);
                setUser(parsed);
                logger.success('Auth', `Restored session for: ${parsed.email} (role: ${parsed.role})`);
            } else {
                logger.info('Auth', 'No persisted session found — showing Onboarding/Login');
            }
        } catch (e) {
            logger.error('Auth', 'Failed to load user from storage', e);
        }
        setLoading(false);
    };

    const login = async (email: string, password: string) => {
        logger.action('Auth', `Login attempt for: ${email}`);
        try {
            const { data } = await authAPI.login(email, password);
            await AsyncStorage.setItem('token', data.token);
            await AsyncStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            logger.success('Auth', `Login successful: ${data.name} (${data.role}), points: ${data.points}`);

            const locationDone = await AsyncStorage.getItem('locationSetupDone');
            if (!locationDone) {
                logger.info('Auth', 'Location setup not done — showing LocationSetupScreen');
                setNeedsLocationSetup(true);
            } else {
                const profileDone = await AsyncStorage.getItem('profileSetupDone');
                if (!profileDone) {
                    logger.info('Auth', 'Profile setup not done — showing ProfileSetupScreen');
                    setNeedsProfileSetup(true);
                }
            }
            return { success: true };
        } catch (e: any) {
            const msg = e.response?.data?.message || 'Login failed. Check your connection.';
            logger.error('Auth', `Login failed for ${email}: ${msg}`);
            return { success: false, error: msg };
        }
    };

    const register = async (name: string, email: string, password: string) => {
        logger.action('Auth', `Register attempt: name="${name}", email="${email}"`);
        try {
            const { data } = await authAPI.register(name, email, password);
            await AsyncStorage.setItem('token', data.token);
            await AsyncStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            setNeedsLocationSetup(true);
            logger.success('Auth', `Registration successful: ${data.name} (id: ${data._id})`);
            return { success: true };
        } catch (e: any) {
            const msg = e.response?.data?.message || 'Registration failed.';
            logger.error('Auth', `Registration failed for ${email}: ${msg}`);
            return { success: false, error: msg };
        }
    };

    const logout = async () => {
        logger.action('Auth', `Logout: ${user?.email}`);
        await AsyncStorage.multiRemove(['token', 'user', 'locationSetupDone', 'profileSetupDone', 'onboardingDone']);
        setUser(null);
        setNeedsLocationSetup(false);
        setNeedsProfileSetup(false);
        logger.success('Auth', 'Logged out, session cleared');
    };

    const completeLocationSetup = async () => {
        logger.success('Auth', 'Location setup completed');
        await AsyncStorage.setItem('locationSetupDone', 'true');
        setNeedsLocationSetup(false);
        // After location, show profile setup
        const profileDone = await AsyncStorage.getItem('profileSetupDone');
        if (!profileDone) {
            setNeedsProfileSetup(true);
        }
    };

    const completeProfileSetup = async (data: { username: string; city: string; ward: string; interests: string[] }) => {
        logger.success('Auth', `Profile setup completed: @${data.username}, ${data.city}, ${data.ward}`);
        await AsyncStorage.setItem('profileSetupDone', 'true');
        const updatedUser = { ...user, ...data, region: data.ward } as User;
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setNeedsProfileSetup(false);
    };

    const completeOnboarding = async () => {
        logger.success('Auth', 'Onboarding completed — navigating to Login');
        await AsyncStorage.setItem('onboardingDone', 'true');
    };

    const refreshProfile = async () => {
        logger.info('Auth', 'Refreshing user profile from server...');
        try {
            const { data } = await userAPI.getProfile();
            const updated = { ...user, ...data } as User;
            setUser(updated);
            await AsyncStorage.setItem('user', JSON.stringify(updated));
            logger.success('Auth', `Profile refreshed: points=${data.points}, reports=${data.reportsCount}`);
        } catch (e) {
            logger.error('Auth', 'Failed to refresh profile', e);
        }
    };

    return (
        <AuthContext.Provider value={{
            user, loading, needsLocationSetup, needsProfileSetup,
            login, register, logout, completeLocationSetup, completeProfileSetup, completeOnboarding, refreshProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
