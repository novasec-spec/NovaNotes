// index.js                                                                             // Location: project root.
//
// You're using expo-router (I can tell from CallScreen.tsx using
// `useLocalSearchParams`/`router.push`), which normally boots via the
// `expo-router/entry` package with no index.js of your own. But
// registerWidgetTaskHandler has to run at the true JS entry point, so we
// take over entry duty here using expo-router's own internal entry pieces
// (this is the pattern expo-router itself recommends for this exact case).
//
// Required package.json change:
//   "main": "index.js"
import './polyfills/event';
// (instead of the default "expo-router/entry" — see README-WIDGET.md)

// @expo/metro-runtime MUST be the first import — it enables Fast Refresh.
import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';
// This file should only import and register the root — no other
// components or exports belong here
  renderRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);



// Register the track player service (Android)

// Register headless tasks
