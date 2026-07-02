export const colors = {
  background: '#0F1419',
  surface: '#1A2230',
  surfaceElevated: '#232D3F',
  primary: '#C9A227',
  primaryMuted: '#A8861F',
  accent: '#2E7D32',
  text: '#F0F2F5',
  textSecondary: '#9BA3AF',
  textMuted: '#6B7280',
  border: '#2A3344',
  tabBar: '#121820',
  tabBarBorder: '#1E2736',
  tabIconDefault: '#6B7280',
  tabIconSelected: '#C9A227',
  error: '#EF4444',
  success: '#22C55E',
} as const;

export type Colors = typeof colors;
