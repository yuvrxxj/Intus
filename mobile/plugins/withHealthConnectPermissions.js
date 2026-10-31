// Adds the Health Connect read permissions Intus asks for to the Android manifest during `expo prebuild`.
// The react-native-health-connect plugin already adds the privacy-policy entry points (the rationale intent filter and
// the activity alias) and its own manifest brings the <queries> entry for Health Connect; neither adds permissions.
// Read only: there is no write permission here, and there must not be.
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  // Without this Health Connect hands an app only the last 30 days. The first sync reads 90.
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
];

const withHealthConnectPermissions = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const existing = manifest['uses-permission'] ?? [];
    const have = new Set(existing.map((p) => p.$['android:name']));
    for (const name of PERMISSIONS) {
      if (!have.has(name)) existing.push({ $: { 'android:name': name } });
    }
    manifest['uses-permission'] = existing;
    return config;
  });

module.exports = withHealthConnectPermissions;
module.exports.PERMISSIONS = PERMISSIONS;
