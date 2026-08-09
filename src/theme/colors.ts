/**
 * FCS Pulse dark theme tokens.
 * Navy + gold identity — prefer these over hardcoded hex in UI code.
 *
 * Hierarchy (lightest → deepest for chrome):
 *   surfaceElevated > surface > background > header/tabBar
 */
export const colors = {
  /** Page canvas — lighter navy/slate (Candidate B) */
  background: '#243B56',
  /** Cards / list rows — clearly lighter than the page */
  surface: '#314F6E',
  /** Sheets, raised chips, pressed states */
  surfaceElevated: '#3C5F84',
  /** Deep FCS navy for headers and tab bar */
  header: '#0D1830',
  /** Brand gold — selected, actionable, accent */
  primary: '#D4AF37',
  /** Softer gold for tracks / soft fills */
  primaryMuted: '#C09A2E',
  /** Dark navy text/icons on gold fills */
  onPrimary: '#0D1830',
  accent: '#2E7D32',
  /** Primary copy */
  text: '#F7F9FC',
  /** Supporting copy — light silver, comfortably readable */
  textSecondary: '#C5CEDA',
  /** Disabled / truly low-priority only */
  textMuted: '#7D8796',
  /** Visible blue-gray edges between layers */
  border: '#4A6A8C',
  tabBar: '#0D1830',
  tabBarBorder: '#1A2A42',
  /** Inactive tabs — clearly inactive, not disabled */
  tabIconDefault: '#9AABBF',
  tabIconSelected: '#D4AF37',
  error: '#F04444',
  success: '#22C55E',
} as const;

export type Colors = typeof colors;
