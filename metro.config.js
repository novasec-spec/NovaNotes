const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

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
