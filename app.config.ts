import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'FCS Pulse',
  slug: 'FCSFootball',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fcsfootball',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#081B36',
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      LSApplicationQueriesSchemes: ['sportscenter', 'espnapp'],
    },
  },
  android: {
    package: 'com.chillslc.fcsfootball',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#081B36',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-router',
      {
        root: './src/app',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#081B36',
        image: './assets/splash.png',
        resizeMode: 'contain',
        enableFullScreenImage_legacy: true,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#D8B14B',
        defaultChannel: 'game-alerts',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "60588148-d658-4d1b-be7d-f19b7e12279a",
    },
  },
};

export default config;
