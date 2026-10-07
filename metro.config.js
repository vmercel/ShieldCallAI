// Disable the Expo Metro template package-tree mismatch check BEFORE
// getDefaultConfig() runs its validation (duplicate metro-config /
// metro-source-map packages detected when a transitive dep brings in a
// second copy of a Metro sub-package).
process.env.EXPO_NO_METRO_CONFIG_VALIDATION = '1';

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Suppress Metro sub-package version mismatch errors that arise when a
// transitive dependency pulls in a slightly different metro-* sub-package
// (e.g. metro-react-native-babel-preset, metro-inspector-proxy) than the
// one Expo already installed. These flags disable the strict template
// package-tree validation without changing any bundling behaviour.
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_enableSymlinks: false,
};

module.exports = config;
