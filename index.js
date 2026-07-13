// Location: project root.
//
// Custom entry point instead of the default "expo-router/entry", because
// two things need to run at the true JS entry point that expo-router's
// default entry doesn't set up for us:
//   1. registerWidgetTaskHandler (react-native-android-widget)
//   2. AppRegistry.registerHeadlessTask (Quick Settings tile capture)
//
// Required package.json change:
//   "main": "index.js"

// @expo/metro-runtime MUST be the first import — it enables Fast Refresh.
import '@expo/metro-runtime';

import './polyfills/event';

import { AppRegistry } from 'react-native';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';
import quickCaptureTask from './src/tasks/quickCaptureTask';

// This file should only import and register roots/handlers — no other
// components or exports belong here.
renderRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
AppRegistry.registerHeadlessTask('QuickCaptureTask', () => quickCaptureTask);
