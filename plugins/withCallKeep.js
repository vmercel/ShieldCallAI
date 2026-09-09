/**
 * Compiles react-native-callkeep into the native binary.
 * Expo Go has no RNCallKeep module. A dev client / prebuild does.
 */
const {
  withInfoPlist,
  withEntitlementsPlist,
  withAndroidManifest,
} = require('@expo/config-plugins');

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function withCallKeepIos(config) {
  config = withInfoPlist(config, cfg => {
    const modes = ensureArray(cfg.modResults.UIBackgroundModes);
    for (const mode of ['voip', 'audio', 'fetch', 'remote-notification']) {
      if (!modes.includes(mode)) modes.push(mode);
    }
    cfg.modResults.UIBackgroundModes = modes;
    return cfg;
  });

  config = withEntitlementsPlist(config, cfg => {
    cfg.modResults['com.apple.developer.pushkit.voice-over-ip'] = true;
    return cfg;
  });

  return config;
}

function withCallKeepAndroid(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return cfg;

    app.service = app.service || [];
    const serviceName = 'io.wazo.callkeep.RNCallKeepBackgroundMessagingService';
    const hasService = app.service.some(
      s => s.$?.['android:name'] === serviceName,
    );
    if (!hasService) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
        },
      });
    }

    const connName = 'io.wazo.callkeep.VoiceConnectionService';
    const hasConn = app.service.some(
      s => s.$?.['android:name'] === connName,
    );
    if (!hasConn) {
      app.service.push({
        $: {
          'android:name': connName,
          'android:label': 'ShieldCall',
          'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.telecom.ConnectionService' } }],
          },
        ],
      });
    }

    return cfg;
  });
}

function withCallKeep(config) {
  config = withCallKeepIos(config);
  config = withCallKeepAndroid(config);
  return config;
}

module.exports = withCallKeep;
