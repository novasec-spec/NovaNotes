const path = require('path');
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

const { getDefaultConfig } = require("expo/metro-config");
const resolveFrom = require("resolve-from");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith("event-target-shim") &&
    context.originModulePath.includes("react-native-webrtc")
  ) {
    // The nested event-target-shim@6 exports map has no "./index" subpath —
    // only ".", "./es5", "./umd". Strip it so resolution hits "." instead.
    const normalizedModuleName = moduleName === "event-target-shim/index"
      ? "event-target-shim"
      : moduleName;

    const eventTargetShimPath = resolveFrom(context.originModulePath, normalizedModuleName);
    return { filePath: eventTargetShimPath, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [
  // Block C++/native source trees in react-native (never needed by Metro)
  /node_modules\/react-native\/ReactCommon\/.*/,
  /node_modules\/react-native\/ReactAndroid\/.*/,
  /node_modules\/react-native\/Libraries\/.*\/__tests__\/.*/,

  // Block Firebase's massive dist tree
  /node_modules\/firebase\/.*\/web-extension\/.*/,
  /node_modules\/@firebase\/.*\/dist\/.*/,

  // Block test and doc folders everywhere
  /node_modules\/.*\/__tests__\/.*/,
  /node_modules\/.*\/tests\/.*/,
  /node_modules\/.*\/docs\/.*/,

  // Block protobuf test data (your first error)
  /node_modules\/@protobufjs\/.*/,
];

module.exports = config;
