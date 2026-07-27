// ─── Daylight design tokens (white / vivid blue / deep navy) ────────────────
// Source of truth: docs/ui-demo/mobile-fe-daylight-upgrade-concept-v3.png and
// docs/ui-demo/mobile-auth-daylight-concept-v1.png.
export const Colors = {
  // Backgrounds
  bg: '#f8fafc',        // slate-50 — default page background
  bgWhite: '#ffffff',   // pure white — auth pages
  card: '#ffffff',      // white cards
  cardAlt: '#f1f5f9',   // slate-100 — inset rows / disabled surfaces
  input: '#ffffff',     // inputs sit on white with a cool-gray border
  border: '#e2e8f0',     // slate-200
  borderAlt: '#cbd5e1',  // slate-300

  // Brand / Primary
  // #0b6fe6 rather than the concept's #0B7CF4: it reads the same on screen but
  // clears WCAG AA (4.74:1) both as text on white and as a fill behind white text.
  primary: '#0b6fe6',    // vivid blue
  primaryDark: '#0b5fd0', // pressed / deeper header blue
  primaryTint: '#eff6ff', // blue-50 — tinted surfaces
  primaryGlow: 'rgba(11,111,230,0.15)',
  indigo: '#4a36f2',     // gradient end
  cyan: '#22c1f0',       // ambient highlight (use sparingly)
  amber: '#d97706',     // amber-600, kept for existing call sites

  // Deep navy — wallet payment card
  navy: '#12315c',
  navyDeep: '#0b1e3d',

  // Text
  text: '#0f172a',       // slate-900
  textMuted: '#475569',  // slate-600
  textDim: '#64748b',    // slate-500
  onPrimary: '#ffffff',

  // Status
  success: '#16a34a',    // green-600
  successBg: 'rgba(22,163,74,0.08)',
  successBorder: 'rgba(22,163,74,0.22)',

  error: '#dc2626',      // red-600
  errorBg: 'rgba(220,38,38,0.07)',
  errorBorder: 'rgba(220,38,38,0.22)',

  warning: '#ea580c',    // orange-600
  warningBg: 'rgba(234,88,12,0.08)',
  warningBorder: 'rgba(234,88,12,0.22)',

  // Accent
  blue: '#2563eb',       // blue-600
  blueBg: 'rgba(37,99,237,0.08)',
  purple: '#7c3aed',     // violet-600
  purpleBg: 'rgba(124,58,237,0.08)',
  orange: '#f59e0b',     // amber-500 — wallet "Top Up" action
  orangeDark: '#ea580c',
};

/** Linear-gradient stop pairs consumed by `components/ui/GradientView`. */
export const Gradients = {
  /** Primary action / hero surfaces: blue → indigo. */
  primary: ['#0b6fe6', '#4a36f2'] as const,
  /** Header band: blue sweeping cyan-ward, matching the concept art. */
  header: ['#0b6fe6', '#1595ea'] as const,
  /** Wallet payment card: deep navy. */
  navy: ['#12315c', '#0b1e3d'] as const,
  /** Warm top-up action. */
  orange: ['#f59e0b', '#ea580c'] as const,
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

/** Soft, cool-toned elevation. Keep shadows subtle — the palette is bright. */
export const Shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  brand: {
    shadowColor: '#0b6fe6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
};

/** Minimum comfortable tap target (iOS HIG / Material). */
export const HIT_TARGET = 44;
