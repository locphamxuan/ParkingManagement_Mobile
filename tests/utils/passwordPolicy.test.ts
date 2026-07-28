import { findPasswordWeakness, MIN_PASSWORD_LENGTH } from '@/utils/passwordPolicy';

/** Must stay in lockstep with src/utils/passwordPolicy.js on the backend. */
describe('findPasswordWeakness', () => {
  it('requires at least 12 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(findPasswordWeakness('Abcd3fgh!jk')).toContain('12 characters');
    expect(findPasswordWeakness('Abcd3fgh!jkl')).toBeNull();
  });

  it.each(['123456', 'password', 'Password123', 'admin123', 'matkhau123'])(
    'rejects the common password %s',
    (password) => {
      expect(findPasswordWeakness(password)).toBeTruthy();
    },
  );

  it('rejects repeated and sequential runs', () => {
    expect(findPasswordWeakness('aaaaaaaaaaaa')).toBeTruthy();
    expect(findPasswordWeakness('123456789012')).toBeTruthy();
    expect(findPasswordWeakness('abcdefghijkl')).toBeTruthy();
  });

  it('accepts a reasonable passphrase', () => {
    expect(findPasswordWeakness('correct-horse-battery')).toBeNull();
  });
});
