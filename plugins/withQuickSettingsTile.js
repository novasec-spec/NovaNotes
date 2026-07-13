// plugins/withQuickSettingsTile.js
//
// Wraps react-native-android-quick-settings-tiles, which has NO Expo config
// plugin of its own — its README requires hand-editing MainActivity,
// AndroidManifest.xml, and native resource files, all of which
// `expo prebuild` would silently wipe on the next run. This plugin
// automates those exact edits so they survive every prebuild.
//
// Register in app.json:
//   "plugins": [ ..., "./plugins/withQuickSettingsTile" ]

const { withAndroidManifest, withStringsXml, withMainActivity, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'com.reactnativeandroidquicksettingstiles.QSIntentService';
const TILE_LABEL = 'Quick Note'; // must match the `quickLabel` passed to RNQuickSettings.request() in JS

const QUICK_NOTE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF">
  <path android:fillColor="#FF000000"
      android:pathData="M3,17.25V21h3.75L17.81,9.94l-3.75,-3.75L3,17.25zM20.71,7.04c0.39,-0.39 0.39,-1.02 0,-1.41l-2.34,-2.34c-0.39,-0.39 -1.02,-0.39 -1.41,0l-1.83,1.83 3.75,3.75 1.83,-1.83z"/>
</vector>
`;

function withQuickSettingsTileManifest(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application.service = application.service || [];

    const alreadyAdded = application.service.some((s) => s.$['android:name'] === SERVICE_NAME);
    if (!alreadyAdded) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:icon': '@drawable/ic_quick_note',
          'android:label': '@string/qs_intent_tile_label',
          'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }],
          },
        ],
      });
    }

    return config;
  });
}

function withQuickSettingsTileStrings(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string ?? [];
    const hasLabel = strings.some((s) => s.$.name === 'qs_intent_tile_label');
    if (!hasLabel) {
      strings.push({ $: { name: 'qs_intent_tile_label' }, _: TILE_LABEL });
    }
    config.modResults.resources.string = strings;
    return config;
  });
}

function withQuickSettingsTileIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const drawableDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, 'ic_quick_note.xml'), QUICK_NOTE_ICON_XML);
      return config;
    },
  ]);
}

function withQuickSettingsTileMainActivity(config) {
  return withMainActivity(config, (config) => {
    const isKotlin = config.modResults.language === 'kt';
    const marker = '// quick-settings-tile-hooks';

    if (config.modResults.contents.includes(marker)) {
      return config; // already inserted — idempotent across repeated prebuilds
    }

    const insertion = isKotlin
      ? `
  ${marker}
  override fun onStart() {
    super.onStart()
    try {
      com.reactnativeandroidquicksettingstiles.AndroidQuickSettingsTilesModule.startSession(intent)
    } catch (e: Exception) {}
  }

  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    try {
      com.reactnativeandroidquicksettingstiles.AndroidQuickSettingsTilesModule.onNewIntent(intent)
    } catch (e: Exception) {}
  }
`
      : `
  ${marker}
  @Override
  protected void onStart() {
    super.onStart();
    try {
      com.reactnativeandroidquicksettingstiles.AndroidQuickSettingsTilesModule.startSession(getIntent());
    } catch (Exception e) {}
  }

  @Override
  public void onNewIntent(android.content.Intent intent) {
    super.onNewIntent(intent);
    try {
      com.reactnativeandroidquicksettingstiles.AndroidQuickSettingsTilesModule.onNewIntent(intent);
    } catch (Exception e) {}
  }
`;

    // Insert right after the class declaration's opening brace.
    const classRegex = /class MainActivity[^{]*\{|public class MainActivity[^{]*\{/;
    const match = config.modResults.contents.match(classRegex);
    if (!match) {
      console.warn('⚠️ withQuickSettingsTile: could not find MainActivity class declaration to patch — add the onStart/onNewIntent hooks manually (see README-QUICK-TILE.md).');
      return config;
    }

    const insertAt = match.index + match[0].length;
    config.modResults.contents =
      config.modResults.contents.slice(0, insertAt) + insertion + config.modResults.contents.slice(insertAt);

    return config;
  });
}

module.exports = function withQuickSettingsTile(config) {
  config = withQuickSettingsTileManifest(config);
  config = withQuickSettingsTileStrings(config);
  config = withQuickSettingsTileIcon(config);
  config = withQuickSettingsTileMainActivity(config);
  return config;
};
