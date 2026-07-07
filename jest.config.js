/**
 * Jest cho Expo (jest-expo preset — transform TS/JSX qua babel-preset-expo).
 * Chỉ nhặt file *.test.ts(x); bỏ qua node_modules/.expo/android/ios.
 */
module.exports = {
  preset: 'jest-expo',
  // Test gom trong tests/ (mirror cấu trúc source), không để lẫn cạnh file nguồn.
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/android/', '/ios/', '/dist/'],
  // Alias @/ → gốc project (khớp tsconfig paths) để test import như source.
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  clearMocks: true,
};
