import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { authAPI } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { UserLocation, getStoredLocation, saveLocation, clearStoredLocation } from '../services/locationService';
import logger from '../utils/logger';

// Ensure WebBrowser finishes its work
WebBrowser.maybeCompleteAuthSession();

export interface User {
    _id: string;
    id?: string; // Supabase ID might be mapped here
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
    avatar?: string;
    followingCount?: number;
    followersCount?: number;
    levelInfo?: {
        level: number;
        name: string;
        nextLevelXp: number;
        progress: number;
    };
    level: number;
    nextLevelXp: number;
    progress: number;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    needsLocationSetup: boolean;
    needsProfileSetup: boolean;
    userLocation: UserLocation | null;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    updateUserLocation: (location: UserLocation) => Promise<void>;
    completeLocationSetup: (location?: UserLocation) => Promise<void>;
    completeProfileSetup: (data: { username: string; city: string; ward: string; interests: string[] }) => Promise<void>;
    completeOnboarding: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    // Supabase Auth
    loginWithOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
    verifyOTP: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
    loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsLocationSetup, setNeedsLocationSetup] = useState(false);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
    const [userLocation, setUserLocationState] = useState<UserLocation | null>(null);

    // Refs to avoid stale closures in effects
    const userRef = useRef<User | null>(null);
    const logoutRef = useRef<() => Promise<void>>(async () => { });
    const isLoggingOut = useRef(false);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // logoutRef effect moved to bottom to avoid use-before-declaration error


    useEffect(() => {
        loadUser();

        // Listen for Supabase auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // Exchange Supabase token for Backend JWT if not already logged in
                // Using ref checks preventing stale closure issues
                if (!userRef.current) {
                    logger.info('Auth', 'Supabase SIGNED_IN event detected (User not in state)');
                    await handleSupabaseSession(session.access_token);
                }
            } else if (event === 'SIGNED_OUT') {
                logger.info('Auth', 'Supabase SIGNED_OUT event');
                if (userRef.current) { // Only logout if we think we are logged in
                    await logoutRef.current();
                }
            }
        });

        // Handle deep links (for Google OAuth and Magic Link callbacks)
        const handleDeepLink = async (url: string) => {
            logger.info('Auth', `Deep link received: ${url}`);

            try {
                // Check if URL contains auth tokens (magic link or OAuth callback)
                if (url.includes('#access_token=') || url.includes('?access_token=')) {
                    const urlObj = new URL(url);
                    // Tokens can be in hash fragment or query params
                    const hashParams = new URLSearchParams(urlObj.hash.substring(1));
                    const queryParams = new URLSearchParams(urlObj.search);

                    const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        logger.info('Auth', 'Found tokens in deep link, setting session...');
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) {
                            logger.error('Auth', 'Failed to set session from deep link', sessionError);
                        } else if (sessionData.session) {
                            await handleSupabaseSession(sessionData.session.access_token);
                        }
                    }
                } else if (url.includes('supabase') || url.includes('urbanfix://')) {
                    // Fallback: try to get existing session
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        await handleSupabaseSession(session.access_token);
                    }
                }
            } catch (e: any) {
                logger.error('Auth', 'Deep link handling error', e);
            }
        };

        // Handle deep link events when app is already running
        const linkingSubscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));

        // Check for initial URL (app opened via deep link from closed state)
        Linking.getInitialURL().then((url) => {
            if (url) {
                logger.info('Auth', `App opened with initial URL: ${url}`);
                handleDeepLink(url);
            }
        });

        return () => {
            subscription.unsubscribe();
            linkingSubscription.remove();
        };
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
            // Load users location
            const cachedLocation = await getStoredLocation();
            if (cachedLocation) {
                setUserLocationState(cachedLocation);
                logger.info('Auth', `Restored location: ${cachedLocation.address}`);
            }
        } catch (e) {
            logger.error('Auth', 'Failed to load user from storage', e);
        }
        setLoading(false);
    };

    // Helper: Exchange Supabase Token for App JWT
    const handleSupabaseSession = async (accessToken: string) => {
        try {
            logger.action('Auth', 'Exchanging Supabase token for App JWT...');
            const { data } = await authAPI.supabaseLogin(accessToken);

            await AsyncStorage.setItem('token', data.token);
            await AsyncStorage.setItem('user', JSON.stringify(data));
            setUser(data);

            logger.success('Auth', `Supabase Login successful: ${data.name}`);

            // Check setup flow
            // Check setup flow based on user data, not just local storage
            // If user has a username/city/ward, they have completed profile setup
            if (data.username && data.city && data.ward) {
                await AsyncStorage.setItem('profileSetupDone', 'true');
                setNeedsProfileSetup(false);
            } else {
                setNeedsProfileSetup(true);
            }

            // Location setup check
            // If user has 'region' set to something other than 'General', likely they did location too?
            // Or stick to local storage for location as it's device-specific usually?
            // Actually, let's keep location check as is or improve it.
            const locationDone = await AsyncStorage.getItem('locationSetupDone');
            if (!locationDone) setNeedsLocationSetup(true);

            return { success: true };
        } catch (e: any) {
            const msg = e.response?.data?.message || 'Supabase login sync failed.';
            logger.error('Auth', msg);
            // If sync fails, force logout from Supabase too to prevent mismatch
            await supabase.auth.signOut();
            return { success: false, error: msg };
        }
    };

    const login = async (email: string, password: string) => {
        logger.action('Auth', `Login attempt for: ${email}`);
        try {
            const { data } = await authAPI.login(email, password);
            await AsyncStorage.setItem('token', data.token);
            await AsyncStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            logger.success('Auth', `Login successful: ${data.name}`);

            // Check setup flow based on user data
            if (data.username && data.city && data.ward) {
                await AsyncStorage.setItem('profileSetupDone', 'true');
                setNeedsProfileSetup(false);
            } else {
                setNeedsProfileSetup(true);
            }

            const locationDone = await AsyncStorage.getItem('locationSetupDone');
            if (!locationDone) setNeedsLocationSetup(true);
            return { success: true };
        } catch (e: any) {
            const msg = e.response?.data?.message || 'Login failed.';
            logger.error('Auth', msg);
            return { success: false, error: msg };
        }
    };

    const register = async (name: string, email: string, password: string) => {
        logger.action('Auth', `Register attempt: ${email}`);
        try {
            const { data } = await authAPI.register(name, email, password);
            await AsyncStorage.setItem('token', data.token);
            await AsyncStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            setNeedsLocationSetup(true);
            logger.success('Auth', `Registration successful: ${data.name}`);
            return { success: true };
        } catch (e: any) {
            const msg = e.response?.data?.message || 'Registration failed.';
            logger.error('Auth', msg);
            return { success: false, error: msg };
        }
    };

    const loginWithOTP = async (email: string) => {
        logger.action('Auth', `OTP Request: ${email}`);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true, // Allow new user signup via OTP
                }
            });
            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            logger.error('Auth', 'OTP Request failed', e);
            return { success: false, error: e.message };
        }
    };

    const verifyOTP = async (email: string, token: string) => {
        logger.action('Auth', `Verifying OTP for: ${email}`);
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
            if (error) throw error;
            if (data.session) {
                return await handleSupabaseSession(data.session.access_token);
            }
            return { success: false, error: 'No session returned' };
        } catch (e: any) {
            logger.error('Auth', 'OTP Verification failed', e);
            return { success: false, error: e.message };
        }
    };

    const loginWithGoogle = async () => {
        logger.action('Auth', 'Initiating Google OAuth...');
        try {
            // For Expo Go development, don't specify scheme - it will use exp:// automatically
            // For production builds, it will use the app's scheme (urbanfix://)
            const redirectUrl = makeRedirectUri({
                // In Expo Go: generates exp://192.168.x.x:8081/--/auth/callback
                // In standalone: generates urbanfix://auth/callback
                path: 'auth/callback',
            });
            logger.info('Auth', `OAuth redirect URL: ${redirectUrl}`);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // We handle browser manually
                },
            });
            if (error) throw error;

            if (data.url) {
                // Open auth session and wait for redirect
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUrl
                );

                logger.info('Auth', `WebBrowser result type: ${result.type}`);

                if (result.type === 'success' && result.url) {
                    logger.info('Auth', `OAuth callback received: ${result.url}`);

                    // Extract tokens from the URL fragment
                    const url = new URL(result.url);
                    const params = new URLSearchParams(url.hash.substring(1)); // Remove '#' from hash
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        // Set session manually
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) throw sessionError;

                        if (sessionData.session) {
                            return await handleSupabaseSession(sessionData.session.access_token);
                        }
                    } else {
                        // Try getting session from Supabase (might have been set via deep link)
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                            return await handleSupabaseSession(session.access_token);
                        }
                    }
                    return { success: false, error: 'Failed to extract session from OAuth callback' };
                } else if (result.type === 'cancel') {
                    return { success: false, error: 'Google login was cancelled' };
                } else if (result.type === 'dismiss') {
                    return { success: false, error: 'Google login was dismissed' };
                }
            }
            return { success: false, error: 'No OAuth URL returned' };
        } catch (e: any) {
            logger.error('Auth', 'Google Login failed', e);
            return { success: false, error: e.message };
        }
    };

    const logout = async () => {
        if (isLoggingOut.current) return;
        isLoggingOut.current = true;

        logger.action('Auth', `Logout: ${user?.email}`);

        try {
            await supabase.auth.signOut(); // Clear Supabase session
            await AsyncStorage.multiRemove(['token', 'user', 'locationSetupDone', 'profileSetupDone', 'onboardingDone']);
            await clearStoredLocation();
            setUser(null);
            setNeedsLocationSetup(false);
            setNeedsProfileSetup(false);
            setUserLocationState(null);
        } catch (error: any) {
            logger.error('Auth', 'Logout failed', error);
            // Force local clear anyway
            setUser(null);
        } finally {
            isLoggingOut.current = false;
        }
    };

    const updateUserLocation = async (location: UserLocation) => {
        setUserLocationState(location);
        await saveLocation(location);
    };

    const completeLocationSetup = async (location?: UserLocation) => {
        if (location) await updateUserLocation(location);
        await AsyncStorage.setItem('locationSetupDone', 'true');
        setNeedsLocationSetup(false);
        // Check profile next
        const profileDone = await AsyncStorage.getItem('profileSetupDone');
        if (!profileDone) setNeedsProfileSetup(true);
    };

    const completeProfileSetup = async (data: any) => {
        if (user) {
            const updated = { ...user, ...data };
            setUser(updated);
            await AsyncStorage.setItem('user', JSON.stringify(updated));
        }
        await AsyncStorage.setItem('profileSetupDone', 'true');
        setNeedsProfileSetup(false);
    };

    const completeOnboarding = async () => {
        await AsyncStorage.setItem('onboardingDone', 'true');
    };

    const refreshProfile = async () => {
        // Implement profile refresh logic here
    };

    // Keep logoutRef updated (defined here to be after logout declaration)
    useEffect(() => {
        logoutRef.current = logout;
    }, [logout]);

    return (
        <AuthContext.Provider value={{
            user, loading, needsLocationSetup, needsProfileSetup, userLocation,
            login, register, logout,
            updateUserLocation, completeLocationSetup, completeProfileSetup, completeOnboarding, refreshProfile,
            loginWithOTP, verifyOTP, loginWithGoogle
        }}>
            {children}
        </AuthContext.Provider>
    );
}
