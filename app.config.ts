import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'FCSFootball',
  slug: 'FCSFootball',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fcsfootball',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0F1419',
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      LSApplicationQueriesSchemes: ['sportscenter', 'espnapp'],
    },
  },
  android: {
    package: 'com.chillslc.fcsfootball',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0F1419',
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
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#C9A227',
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
