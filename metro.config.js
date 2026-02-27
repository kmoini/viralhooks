const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Block ONLY the project's own server/ directory from Metro.
// It contains Node.js code (Express, multer, crypto) that can't run in React Native.
// We use the full absolute path so node_modules/*/server/ dirs are NOT blocked.
const serverDir = path.resolve(__dirname, 'server');
const pattern = serverDir
  .replace(/\\/g, '[\\\\/]')   // match both \ and / path separators
  .replace(/\./g, '\\.');      // escape dots in path (e.g. "ali.m")

config.resolver.blockList = [new RegExp(pattern)];

module.exports = config;
