import { create } from 'zustand';

interface UIState {
  isTabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isTabBarHidden: false,
  setTabBarHidden: (hidden) => set({ isTabBarHidden: hidden }),
}));
