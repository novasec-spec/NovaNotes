import { router } from 'expo-router';

let navigationReady = false;
let pendingRoute: Parameters<typeof router.push>[0] | null = null;

export function markNavigationReady() {
  navigationReady = true;

  if (pendingRoute) {
    router.push(pendingRoute);
    pendingRoute = null;
  }
}

export function safePush(
  route: Parameters<typeof router.push>[0]
) {
  if (!navigationReady) {
    pendingRoute = route;
    return;
  }

  router.push(route);
}
