// ─── Design tokens matching Image 2 style ───────────────────────
export const Colors = {
  // Backgrounds
  bg: '#f8fafc',        // slate-50 (clean light background)
  card: '#ffffff',      // pure white cards
  cardAlt: '#f1f5f9',   // slate-100 (light gray for alternate background/borders)
  input: '#f1f5f9',     // slate-100 (light input background matching image 2)
  border: '#e2e8f0',     // slate-200 (light border)
  borderAlt: '#cbd5e1',  // slate-300

  // Brand / Primary (Cyan / Sky-blue matching Image 2)
  primary: '#0ea5e9',   // sky-500 (premium cyan-blue)
  primaryGlow: 'rgba(14,165,233,0.15)',
  amber: '#d97706',     // amber-600 for contrast in light theme

  // Text
  text: '#0f172a',       // slate-900 (dark charcoal text)
  textMuted: '#475569',  // slate-600
  textDim: '#64748b',    // slate-500

  // Status (emerald green, rose red, amber yellow with light theme variables)
  success: '#059669',    // emerald-600
  successBg: 'rgba(5,150,105,0.08)',
  successBorder: 'rgba(5,150,105,0.2)',

  error: '#e11d48',      // rose-600
  errorBg: 'rgba(225,29,72,0.08)',
  errorBorder: 'rgba(225,29,72,0.2)',

  warning: '#d97706',    // amber-600
  warningBg: 'rgba(217,119,6,0.08)',
  warningBorder: 'rgba(217,119,6,0.2)',

  // Accent
  blue: '#2563eb',       // blue-600
  blueBg: 'rgba(37,99,237,0.08)',
  purple: '#7c3aed',     // purple-600
  purpleBg: 'rgba(124,58,237,0.08)',
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};
