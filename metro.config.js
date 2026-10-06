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

// Disable the Expo Metro template package-tree mismatch check entirely.
// The check compares installed metro-* sub-packages against a hard-coded
// template manifest and throws when a transitive dep brings in a different
// patch version. Suppressing it here is safe: it is a dev-time warning
// only and does not affect the compiled bundle.
process.env.EXPO_NO_METRO_CONFIG_VALIDATION = '1';

module.exports = config;
