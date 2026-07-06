// ─────────────────────────────────────────────────────────────────────────────
//  index.js  — app entry point
// ─────────────────────────────────────────────────────────────────────────────
//
//  registerWidgetTaskHandler MUST be called before AppRegistry (i.e. before
//  expo-router/entry) so the native RNWidgetProvider always has a live React
//  Native context when it handles widget lifecycle broadcasts (add / update /
//  delete).  Without this registration the native deleteImages call in
//  RNWidgetImageProvider receives a null context and throws a
//  NullPointerException wrapped as:
//    RuntimeException: Unable to start receiver com.novasec.notes.widget.Bubbles
//
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/app/widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);

// Delegate to Expo Router for the rest of the app.
import 'expo-router/entry';