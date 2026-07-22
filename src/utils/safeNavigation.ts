import { useRouter } from 'expo-router';

export const VALID_ROUTES = {
  CHAT: '/(tabs)/chat',
  CHAT_LIST: '/(tabs)/chat/chatlist',
  CHAT_ROOM: '/(tabs)/chat/chatroom',
  INCOMING_CALL: '/IncomingCallScreen',
  AUDIO_CALL: '/AudioCallScreen',
  VIDEO_CALL: '/VideoCallScreen',
  AUTH: '/(tabs)/chat/auth',
  HOME: '/(tabs)/index',
  NOTES: '/(tabs)/notes',
} as const;

interface NavigationParams {
  route: string;
  params?: Record<string, any>;
}

export const useSafeNavigation = () => {
  const router = useRouter();

  const navigate = (route: string, params?: Record<string, any>) => {
    // Validate route exists
    const isValidRoute = Object.values(VALID_ROUTES).includes(route as any);
    
    if (!isValidRoute) {
      console.warn(
        `[SafeNavigation] Invalid route attempted: "${route}". Falling back to HOME.`,
        'Valid routes:', Object.values(VALID_ROUTES)
      );
      router.replace(VALID_ROUTES.HOME);
      return;
    }

    try {
      if (params) {
        router.push({ pathname: route, params });
      } else {
        router.push(route);
      }
    } catch (error) {
      console.error(`[SafeNavigation] Navigation failed for route "${route}":`, error);
      router.replace(VALID_ROUTES.HOME);
    }
  };

  const replace = (route: string, params?: Record<string, any>) => {
    const isValidRoute = Object.values(VALID_ROUTES).includes(route as any);
    
    if (!isValidRoute) {
      console.warn(`[SafeNavigation] Invalid route replace attempted: "${route}".`);
      return;
    }

    try {
      if (params) {
        router.replace({ pathname: route, params });
      } else {
        router.replace(route);
      }
    } catch (error) {
      console.error(`[SafeNavigation] Replace failed for route "${route}":`, error);
    }
  };

  return { navigate, replace };
};
