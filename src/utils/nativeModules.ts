// utils/nativeModules.ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Simple check - if it's not a device or we're in Expo Go, native modules won't work
export const areNativeModulesAvailable = (): boolean => {
  // In Expo Go, native modules aren't available
  if (__DEV__ && !Device.isDevice) {
    return false;
  }
  
  // Check if we're in a production build
  // This works because in Expo Go, these modules won't be linked
  try {
    // Try to require a native module - if it fails, we're in Expo Go
    require('@livekit/react-native-webrtc');
    require('react-native-incall-manager');
    return true;
  } catch {
    return false;
  }
};

// For production builds - always true
export const isProductionBuild = (): boolean => {
  // In production builds, the app is standalone
  return !__DEV__ || Device.isDevice;
};
