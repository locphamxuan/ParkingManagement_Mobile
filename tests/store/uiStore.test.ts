import { useUIStore } from '@/store/uiStore';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({ isTabBarHidden: false });
  });

  it('mặc định tab bar hiển thị', () => {
    expect(useUIStore.getState().isTabBarHidden).toBe(false);
  });

  it('setTabBarHidden(true) ẩn tab bar', () => {
    useUIStore.getState().setTabBarHidden(true);
    expect(useUIStore.getState().isTabBarHidden).toBe(true);
  });

  it('bật/tắt lại được', () => {
    useUIStore.getState().setTabBarHidden(true);
    useUIStore.getState().setTabBarHidden(false);
    expect(useUIStore.getState().isTabBarHidden).toBe(false);
  });
});
