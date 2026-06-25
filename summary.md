# ParkingManagement Mobile Project Summary

## High-Level Project Overview
ParkingManagement Mobile is a mobile application built using **React Native**, **Expo (version 54)**, and **TypeScript**. It serves as the client-facing application for customers to manage their parking balances, view parking reservation options, check their active parking sessions, view notifications, top up their wallets, subscribe to parking packages (weekly, monthly, etc.), and scan in/out of parking structures using a QR code.

---

## Folder Structure and Responsibilities
The project is structured under the standard Expo Router layout:

*   **`app/`**: File-system-based router.
    *   **`(auth)/`**: Login, registration, password recovery pages.
    *   **`(tabs)/`**: Tabbed screens (Home, Reserve, History, Wallet, Packages, Profile).
    *   **`buildings.tsx`**: View/search structures.
*   **`components/`**: Reusable React Native components.
    *   **`shared/`**: Global shared UI blocks like notification bells, modals.
    *   **`ui/`**: Base UI elements such as `Button`, `Input`, `Card`, `Badge`, and complex modals (e.g. `BookingDateModal`).
*   **`constants/`**: Design tokens, styles, and configurations.
    *   **`theme.ts`**: Unified color scheme, spacing, font sizes, and borders.
    *   **`config.ts`**: API URLs and environment settings.
*   **`services/`**: API fetching logic communicating with the backend.
*   **`store/`**: Zustand stores for state management (`authStore`, `uiStore`).
*   **`styles/`**: Externalized stylesheet designs corresponding to individual screens and components.
*   **`types/`**: TypeScript interfaces defining common entity models.
*   **`utils/`**: Helper files (e.g. date formatters, validators).

---

## Important Files and Their Purposes
*   **`package.json`**: Package dependencies (Expo, Lucide-react-native, React Native Reanimated, Zustand, etc.).
*   **`app/_layout.tsx`**: Root application wrapper handling auth guards and configuration.
*   **`app/(tabs)/_layout.tsx`**: Bottom navigation tab bar component.
*   **`constants/theme.ts`**: The design system's source of truth (colors, typography, radii, spacing).
*   **`store/authStore.ts`**: Tracks user tokens, profiles, and active session logins.

---

## State Management Approach
Uses **Zustand** for lightweight and reactive global state:
*   **`authStore.ts`**: Manages login/logout flow, user token, and basic profile info stored persistently.
*   **`uiStore.ts`**: Controls visual layouts, including hiding the tab bar in fullscreen views (e.g., QR scanners, overlays).

---

## Routing and Navigation
*   **Expo Router**: File-system navigation with standard tab routing.
*   **Tab Navigation**: Integrates Home (`index`), Reservations (`reservations`), History (`history`), Wallet (`wallet`), Packages (`packages`), and Profile (`profile`).

---

## Key Dependencies
*   `expo` / `react-native`: Main app environment.
*   `expo-router`: App routing engine.
*   `react-native-reanimated`: Micro-animations.
*   `zustand`: State control.
*   `lucide-react-native` / `@expo/vector-icons`: Visual design icons.

---

## Coding Conventions
*   TypeScript for type safety.
*   Styles separate from layout code (in the `styles/` directory) to keep markup files readable.
*   Reusable UI components mapped to design tokens in `constants/theme.ts`.
