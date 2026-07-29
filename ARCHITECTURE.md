# PBMS Mobile — Architecture

Mobile app for the **user** role (customers who park and buy long-term packages —
there is no short-term reservation/pre-booking product) of PBMS (Parking Building
Management System). Talks to `../ParkingManagement_BE`; the web counterpart for staff/
manager/admin is `../ParkingManagement_FE_WDP301`.

## Tech stack

- **Expo Router** (`~6.0`) — file-based routing under `app/`, typed routes enabled
  (`experiments.typedRoutes` in `app.json`).
- **React Native** (`0.81`) + **React** (`19.1`).
- **TypeScript** (`~5.9`), strict-ish app code (no `any` in new code; `npx tsc --noEmit`
  must stay at 0 errors).
- **Zustand** (`^5.0`) for global state (`store/`).
- **react-native-reanimated** (`~4.1`) + `react-native-worklets` for the pressable/card
  animations in `components/ui/AnimatedCard.tsx`.
- **expo-secure-store** for the auth token on native; falls back to `localStorage` on
  web (see `services/api.ts`).
- **jest** + **jest-expo** preset for tests.
- No global CSS/UI kit beyond the project's own `constants/theme.ts` token set and
  `styles/screens/*` — no NativeBase/Paper/Tamagui etc.

## Folder structure

```
app/                     Expo Router screens (file-based routing)
  (auth)/                 Login, register, forgot/reset password — unauthenticated stack
  (tabs)/                 Authenticated tab bar: index (Home), packages, wallet,
                           history, profile
  buildings.tsx            Building/floor/slot lookup + long-term package entry point
  incidents.tsx             Report incident + "My Tickets"
  _layout.tsx / index.tsx   Root layout & entry redirect

components/
  ui/            Design-system-ish primitives: Button, Input, Badge, Dropdown,
                 AnimatedCard (AnimatedPressable + AnimatedCard), EmptyState,
                 SuccessBanner, ErrorBanner, DateRangePicker
  shared/        SheetModal (bottom-sheet scaffold), FeedbackModal, NotificationBellStream,
                 CustomDialog (in-app alert/confirm dialog replacing native Alert.alert —
                 used by packages.tsx, buildings.tsx and FeedbackModal)
  packages/      Sub-components of the Packages screen (see below), incl. SlotMapModal
                 (2D/3D parking map picker for a package's fixed slot)
  buildings/, home/, profile/, wallet/   Screen-specific modals/sub-components

services/        One file per BE resource, thin fetch wrappers around apiRequest()
                 (api, auth, buildingLookup, floors, longTerm, wallet, history,
                 notifications, plates, incidents, feedback, profile)
hooks/           Screen view-models: state + data loading + handlers, so screen
                 components stay JSX-only (usePackages, usePackageSubscription,
                 usePackageCancellation, usePackageRenewal, useHomeScreen,
                 useNotificationStream)
store/           Zustand stores: authStore (session/token), uiStore (tab bar visibility)
styles/
  screens/*      One stylesheet per screen (StyleSheet.create), imported as `styles`
  components/*   Stylesheets for a few components that got split out of their .tsx
  common.ts      Shared tokens/reused style fragments (e.g. bottom-sheet scaffold)
constants/       theme.ts (Colors/Spacing/Radius/FontSize — sky-blue light theme),
                 vehiclePresets.ts, config.ts (dev URLs)
types/           Shared TS interfaces (LongTermPackage/Subscription,
                 LicensePlate, Notification, WalletTransaction, ...)
utils/           Pure helper functions (packageHelpers, slotLayout, vehicle,
                 walletHelpers) — the ones with real logic have unit tests under tests/
tests/           Jest specs, mirrors source structure, imports via the `@/` alias
openspec/        OpenSpec workflow artifacts (proposed/applied/archived changes) —
                 see `openspec/config.yaml` for project context
```

### Established conventions (see this file's own CLAUDE.md for the up-to-date list)

- Screen components (`app/**`) should stay JSX-only: state/data-loading/handlers go in
  a `hooks/use<Screen>.ts` hook, `StyleSheet.create(...)` goes in `styles/screens/<screen>.ts`.
  Files over ~600 lines get split into sub-components (see `components/packages/*` for
  the reference split of a 1000+ line screen).
- No native `Alert.alert` — use `CustomDialog`/`useCustomDialog` (in-app dialog) or the
  banner components (`SuccessBanner`/`ErrorBanner`).
- All user-facing UI text (labels, buttons, placeholders, toasts, error messages) must
  be English. Code comments may stay Vietnamese.
- Behavior/UX changes go through OpenSpec (`openspec/`); pure refactors/splits/style
  moves do not need a change proposal.

## Backend connection

No `.env` file / env var is used for the API base URL. `services/api.ts::getApiBase()`
derives it at runtime:

- **Web**: `http://<window.location.hostname>:5000/api`.
- **Native** (Android/iOS emulator or device via Expo Go/dev client): starts from a
  platform default (`10.0.2.2` for Android emulator, `127.0.0.1` for iOS simulator),
  then overrides the host with the IP Expo's dev server reports itself running on
  (`Constants.expoConfig?.hostUri`) — so a physical device on the same Wi-Fi as the
  dev machine resolves the right LAN IP automatically.
- Port `5000` and the `/api` prefix are hardcoded; the BE (`ParkingManagement_BE`) must
  be running locally on port 5000 for any of this to work.
- Auth token: stored via `expo-secure-store` on native, `localStorage` on web
  (`services/api.ts::getToken/setToken`), sent as `Authorization: Bearer <token>`.
- Password-reset deep link base is similarly auto-detected in `constants/config.ts::getMobileFrontendUrl()`
  (points at the FE web dev server on port 5173 in dev, a custom `parkingmobile://` scheme in prod).

## Running locally

```bash
npm install
npx expo start          # same as `npm start` — opens the Expo dev server / QR code
npm run android          # expo start --android
npm run ios              # expo start --ios
npm run web               # expo start --web
```

Make sure `ParkingManagement_BE` is running on `localhost:5000` first (see that repo's
own docs) — the app does not work against a mock/offline backend.

### Tests

```bash
npm test          # jest (jest-expo preset)
npm run test:watch
```

- Config: `jest.config.js` — `roots: ['tests']`, `moduleNameMapper` maps the `@/` alias.
- Tests live under `tests/`, mirroring the source tree, and import source via `@/...`
  — never colocate test files next to source files.
- Coverage is intentionally narrow: pure-logic modules only (`utils/vehicle`,
  `utils/packageHelpers`, `utils/slotLayout`, `store/uiStore` — see the repo's
  CLAUDE.md for the current file/test count and any known-red tests), not native
  component rendering, to keep the suite fast and stable across RN/Expo upgrades.

## Build / EAS

No `eas.json` or EAS configuration exists in this repo at the time of writing — builds
are local/dev-only via the Expo CLI commands above. `app.json` holds the Expo app
config (name `PBMS`, slug `ParkingManagement_Mobile`, scheme `pbms`, dark
`userInterfaceStyle` at the OS-chrome level — the in-app UI itself uses the sky-blue
**light** theme from `constants/theme.ts`, these are independent settings).
