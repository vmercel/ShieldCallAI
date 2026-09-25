const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Suppress Metro sub-package version mismatch warnings that arise when a
// transitive dependency (e.g. react-native-iap or another native module)
// pulls in a slightly different metro-* sub-package than the one Expo
// already installed. This only suppresses the check; it does not change
// any bundling behaviour.
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
};

module.exports = config;
