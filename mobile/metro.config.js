const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// The app imports the website's plain TypeScript (src/features, src/lib, src/db/paging.ts).
// Watch the repo root so those files resolve. Hierarchical lookup stays on: turning it off
// hides packages that Expo keeps beside itself.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Those files import each other with a .ts suffix, which Node's test runner needs. Metro resolves
// extensionless names, so the suffix is taken off before the default resolver runs.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = (moduleName.startsWith('.') || moduleName.startsWith('/')) && /\.tsx?$/.test(moduleName)
    ? moduleName.replace(/\.tsx?$/, '')
    : moduleName;
  return context.resolveRequest({ ...context, resolveRequest: undefined }, name, platform);
};

module.exports = config;
