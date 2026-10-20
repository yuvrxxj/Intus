// The app imports the web's plain TypeScript rules from ../src, so Metro has to watch the repo root as well as mobile/.
// Packages the shared files need are still resolved from mobile/node_modules, because CI installs only there.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const repoRoot = path.resolve(__dirname, '..');

config.watchFolders = [...(config.watchFolders ?? []), repoRoot];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
