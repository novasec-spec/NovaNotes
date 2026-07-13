// plugins/withQuickCaptureTile.js
//
// Expo config plugin for a Quick Settings tile that captures a note
// headlessly (no app UI). Registered in app.config.js under `plugins`.
//
// What this does on every `expo prebuild`:
//  1. Adds the QuickCaptureTileService + QuickCaptureTaskService <service>
//     entries to AndroidManifest.xml.
//  2. Copies the Kotlin source templates into
//     android/app/src/main/java/<your/package>/quicktile/, substituting
//     your actual package name in.
//  3. Drops in a vector drawable icon for the tile if you don't already
//     have one at res/drawable/ic_quick_note.xml.
//  4. Registers QuickCapturePackage in MainApplication.kt so the
//     QuickCaptureModule native module is available to RN.
//
// This is idempotent — safe to run prebuild repeatedly.
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TILE_SERVICE = '.quicktile.QuickCaptureTileService';
const TASK_SERVICE = '.quicktile.QuickCaptureTaskService';

function addServices(androidManifest) {
  const app = androidManifest.manifest.application[0];
  app.service = app.service || [];

  if (!app.service.some((s) => s.$['android:name'] === TILE_SERVICE)) {
    app.service.push({
      $: {
        'android:name': TILE_SERVICE,
        'android:label': 'Quick Note',
        'android:icon': '@drawable/ic_quick_note',
        'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
        'android:exported': 'true',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }] },
      ],
    });
  }

  if (!app.service.some((s) => s.$['android:name'] === TASK_SERVICE)) {
    app.service.push({
      $: {
        'android:name': TASK_SERVICE,
        'android:exported': 'false',
        'android:foregroundServiceType': 'dataSync',
      },
    });
  }

  return androidManifest;
}

function withQuickCaptureManifest(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = addServices(config.modResults);
    return config;
  });
}

function withQuickCaptureNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pkg = config.android?.package;
      if (!pkg) {
        throw new Error(
          '[withQuickCaptureTile] android.package must be set in app.config before this plugin runs.'
        );
      }
      const pkgPath = pkg.replace(/\./g, '/');
      const srcDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        pkgPath,
        'quicktile'
      );
      fs.mkdirSync(srcDir, { recursive: true });

      const templateDir = path.join(__dirname, 'nativeSrc');
      for (const file of fs.readdirSync(templateDir)) {
        if (file === 'ic_quick_note.xml') continue;
        const contents = fs.readFileSync(path.join(templateDir, file), 'utf8').replace(/__PACKAGE__/g, pkg);
        fs.writeFileSync(path.join(srcDir, file), contents);
      }

      const drawableDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      const iconDest = path.join(drawableDir, 'ic_quick_note.xml');
      if (!fs.existsSync(iconDest)) {
        fs.copyFileSync(path.join(templateDir, 'ic_quick_note.xml'), iconDest);
      }

      return config;
    },
  ]);
}

function withQuickCapturePackageRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pkg = config.android?.package;
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        pkg.replace(/\./g, '/'),
        'MainApplication.kt'
      );

      if (!fs.existsSync(mainAppPath)) {
        console.warn(
          '[withQuickCaptureTile] MainApplication.kt not found at the expected path — ' +
            'register QuickCapturePackage() manually in getPackages(). See README.'
        );
        return config;
      }

      let contents = fs.readFileSync(mainAppPath, 'utf8');

      if (contents.includes('QuickCapturePackage()')) {
        return config; // already registered, nothing to do
      }

      const addLine = `packages.add(${pkg}.quicktile.QuickCapturePackage())`;

      // Shape 1: block body with a local `packages` variable already
      // declared — either `val packages = PackageList(this).packages` or
      // the `.toMutableList()` variant. Insert the add() call right after
      // the declaration.
      const blockBodyRegex = /(val packages\s*=\s*PackageList\(this\)\.packages(?:\.toMutableList\(\))?)/;

      // Shape 2: expression body with no local variable at all — this is
      // the current Expo default template:
      //   override fun getPackages(): List<ReactPackage> = PackageList(this).packages
      // Needs to be rewritten into a block body to insert anything.
      const exprBodyRegex =
        /override fun getPackages\(\):\s*(?:Mutable)?List<ReactPackage>\s*=\s*PackageList\(this\)\.packages\s*\n?/;

      if (blockBodyRegex.test(contents)) {
        contents = contents.replace(blockBodyRegex, (match) => `${match}\n            ${addLine}`);
        fs.writeFileSync(mainAppPath, contents);
      } else if (exprBodyRegex.test(contents)) {
        const replacement =
          'override fun getPackages(): List<ReactPackage> {\n' +
          '            val packages = PackageList(this).packages.toMutableList()\n' +
          `            ${addLine}\n` +
          '            return packages\n' +
          '        }\n';
        contents = contents.replace(exprBodyRegex, replacement);
        fs.writeFileSync(mainAppPath, contents);
      } else {
        console.warn(
          '[withQuickCaptureTile] MainApplication.kt didn\'t match either expected template ' +
            '(expression-body or block-body getPackages()) — register QuickCapturePackage() ' +
            'manually. See README.'
        );
      }

      return config;
    },
  ]);
}

module.exports = function withQuickCaptureTile(config) {
  config = withQuickCaptureManifest(config);
  config = withQuickCaptureNativeFiles(config);
  config = withQuickCapturePackageRegistration(config);
  return config;
};
