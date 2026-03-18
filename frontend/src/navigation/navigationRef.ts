import { createNavigationContainerRef } from '@react-navigation/native';

// Used for navigating from outside React components (e.g., push notification taps).
export const navigationRef = createNavigationContainerRef<any>();

