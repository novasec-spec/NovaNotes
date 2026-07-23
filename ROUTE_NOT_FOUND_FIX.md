# Route Not Found Crash Fix - Implementation Guide

## Problem Summary

Your NovaNotes app experiences crashes on user devices when:
31. Users create accounts and login
2. Notifications/calls are received (chat, calling system, notification system)
3. Routes triggered by these events don't exist or are invalid
4. The "route not found" screen appears and persists even after navigation attempts
5. Clicking "go back" loops back to the error screen

**Root Causes:**
- Invalid/undefined routes being passed to the router from notification handlers
- No validation of routes before navigation
- Missing error boundaries to catch navigation failures
- Inconsistent route definitions across the app
- Deep link handlers not validating URLs before navigation

---

## Solution Architecture

### 1. **Safe Navigation Utility** (`src/utils/safeNavigation.ts`)
- Centralized route validation
- Prevents invalid routes from reaching the router
- Fallback to HOME screen on errors
- Logging for debugging

**Usage:**
```typescript
import { useSafeNavigation } from '../utils/safeNavigation';

export const MyComponent = () => {
  const { navigate, replace } = useSafeNavigation();
  
  // These are validated before navigation
  navigate('/(tabs)/chat', { chatId: '123' });
  replace('/(tabs)/index');
};
```

### 2. **Enhanced Notification Handler** (`src/hooks/useEnhancedNotificationHandler.ts`)
- Validates notification payloads before navigation
- Handles foreground and background notifications
- Typed payload structure
- Error recovery mechanisms

**Usage:**
```typescript
import { useEnhancedNotificationHandler } from '../hooks/useEnhancedNotificationHandler';

export const MyScreen = () => {
  const { setupNotificationListeners, handleNotificationNavigation } = 
    useEnhancedNotificationHandler();
  
  useEffect(() => {
    const unsubscribe = setupNotificationListeners();
    return unsubscribe;
  }, []);
};
```

### 3. **App State & Deep Link Handler** (`src/hooks/useAppStateHandler.ts`)
- Manages app lifecycle state changes
- Handles deep link validation
- Recovers notification listeners on app resume

### 4. **Error Boundary** (`src/components/ErrorBoundary.tsx`)
- Catches navigation errors before they crash the app
- Provides user-friendly error UI
- Allows retry and home navigation
- Prevents infinite error loops

**Usage:**
```typescript
import { ErrorBoundary } from '../components/ErrorBoundary';

export const RootLayout = () => {
  return (
    <ErrorBoundary>
      <YourAppContent />
    </ErrorBoundary>
  );
};
```

### 5. **App Safety Wrapper** (`src/components/AppSafetyWrapper.tsx`)
- Initializes all safety mechanisms
- Sets up global error handlers
- Coordinates all components

---

## Implementation Steps

### Step 1: Wrap Your Root Layout

Find your root layout file (typically `src/app/_layout.tsx`) and wrap it:

```typescript
import { ErrorBoundary } from '../components/ErrorBoundary';
import AppSafetyWrapper from '../components/AppSafetyWrapper';

export default function RootLayout() {
  return (
    <AppSafetyWrapper>
      <ErrorBoundary>
        <YourExistingRootContent />
      </ErrorBoundary>
    </AppSafetyWrapper>
  );
}
```

### Step 2: Update Notification Handlers

In your existing notification handler files, replace direct router usage:

**Before:**
```typescript
router.push({
  pathname: data.route,
  params: data.params
});
```

**After:**
```typescript
import { useSafeNavigation } from '../utils/safeNavigation';

const { navigate } = useSafeNavigation();
navigate(data.route, data.params);
```

### Step 3: Update Call System

Replace call screen navigation with safe navigation:

```typescript
// In your call screen components
import { useSafeNavigation } from '../utils/safeNavigation';

export const IncomingCallHandler = () => {
  const { navigate } = useSafeNavigation();
  
  const handleIncomingCall = (callerId: string) => {
    navigate('/IncomingCallScreen', { callerId });
  };
  
  // ... rest of component
};
```

### Step 4: Add Valid Routes Configuration

Update `src/utils/safeNavigation.ts` with ALL your app routes:

```typescript
export const VALID_ROUTES = {
  // Tab routes
  CHAT: '/(tabs)/chat',
  CHAT_LIST: '/(tabs)/chat/chatlist',
  CHAT_ROOM: '/(tabs)/chat/chatroom',
  NOTES: '/(tabs)/notes',
  FAITH: '/(tabs)/faith',
  INDEX: '/(tabs)/index',
  
  // Call routes
  INCOMING_CALL: '/IncomingCallScreen',
  AUDIO_CALL: '/AudioCallScreen',
  VIDEO_CALL: '/VideoCallScreen',
  CALL_HISTORY: '/CallHistoryScreen',
  
  // Auth routes
  AUTH: '/(tabs)/chat/auth',
  
  // Other routes
  PREMIUM: '/premium',
  MOOD_CHECKIN: '/mood-checkin',
} as const;
```

### Step 5: Validate Notification Payloads

When sending notifications, ensure payload structure:

```typescript
const payload = {
  route: '/(tabs)/chat/chatroom', // Must match VALID_ROUTES
  chatId: 'valid-chat-id',
  userId: 'valid-user-id',
};

// Send notification...
```

---

## Testing Checklist

- [ ] App doesn't crash when receiving chat notifications
- [ ] App doesn't crash when receiving call notifications
- [ ] "Route not found" screen never appears
- [ ] Navigation works properly after login
- [ ] Going back from screens works correctly
- [ ] App resumes properly from background
- [ ] Multiple rapid notifications don't cause crashes
- [ ] Invalid routes fallback to home gracefully

---

## Debugging Tips

### Enable Debug Logging

All components use console logs with prefixes:
- `[SafeNavigation]` - Route validation
- `[Notification]` - Notification handling
- `[DeepLink]` - Deep link processing
- `[AppState]` - App state changes
- `[ErrorBoundary]` - Error catching
- `[ErrorUtils]` - Global error handling

### View Logs in Development

```bash
# Android
adb logcat | grep "\[SafeNavigation\]\|\[Notification\]\|\[ErrorBoundary\]"

# iOS
xcrun simctl spawn booted log stream --predicate 'eventMessage contains "[SafeNavigation]"'
```

### Common Issues & Solutions

**Issue: "Route not found" screen still appears**
- Check that all routes in notifications match `VALID_ROUTES`
- Verify payload structure matches `NotificationPayload` interface
- Check console logs for specific route names

**Issue: App crashes on specific notification**
- Check notification payload in your backend
- Verify the route exists in your routing configuration
- Use `validateNotificationPayload()` to test payload

**Issue: Navigation loops or gets stuck**
- Error boundary will catch and provide recovery UI
- Check for circular route dependencies
- Verify safe navigation is being used consistently

---

## Production Checklist

- [ ] All notification payloads validated before sending
- [ ] Error boundary wrapped around root layout
- [ ] Safe navigation used in all navigation calls
- [ ] Valid routes list is complete and accurate
- [ ] Sentry/error tracking integrated (optional)
- [ ] Test on multiple Android devices before deployment
- [ ] Monitor Sentry/logs for first week after deploy

---

## Additional Resources

- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Notifications Best Practices](https://docs.expo.dev/guides/using-notifications/)

---

## Need Help?

If crashes persist:
1. Check console logs with prefixes above
2. Verify all routes in `VALID_ROUTES` exist in your file structure
3. Test notification payloads match `NotificationPayload` interface
4. Create a GitHub issue with:
   - Console log output
   - Notification payload structure
   - Steps to reproduce
