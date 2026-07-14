// plugins/withQuickTile.js
const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

const withQuickTile = (config) => {
  // Add the service to AndroidManifest
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    if (!manifest.application[0].service) {
      manifest.application[0].service = [];
    }
    
    manifest.application[0].service.push({
      $: {
        'android:name': '.QuickNoteTileService',
        'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
        'android:exported': 'true',
        'android:label': 'Take Note',
        'android:icon': '@drawable/ic_note_tile'
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }]
      }],
      'meta-data': [{
        $: {
          'android:name': 'android.service.quicksettings.ACTIVE_TILE',
          'android:value': 'true'
        }
      }]
    });
    
    return config;
  });

  return config;
};

module.exports = withQuickTile;
