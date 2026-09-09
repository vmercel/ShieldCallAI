const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-speech-recognition': path.resolve(__dirname, 'node_modules/expo-speech-recognition'),
};

module.exports = config;
