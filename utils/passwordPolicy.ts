/**
 * Mirrors src/utils/passwordPolicy.js on the backend so the user gets immediate
 * feedback. The SERVER is authoritative — a pass here is not permission.
 */
export const MIN_PASSWORD_LENGTH = 12;

const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '123456789012',
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword123',
  'qwerty', 'qwerty123', 'qwertyuiop', 'azerty', 'abc123', 'iloveyou',
  'admin', 'admin123', 'administrator', 'root', 'letmein', 'welcome',
  'welcome123', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'baseball', 'superman', 'trustno1', 'master', 'shadow', 'michael',
  'changeme', 'changeit', 'secret', 'default', 'test1234', 'temp1234',
  'parking', 'parking123', 'pbms', 'pbms1234', 'vietnam', 'vietnam123',
  'khongbiet', 'matkhau', 'matkhau123',
]);

const isRepeatedCharacter = (value: string) => /^(.)\1+$/.test(value);

const isSequentialRun = (value: string) => {
  if (value.length < 4) return false;
  const step = value.charCodeAt(1) - value.charCodeAt(0);
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < value.length; i += 1) {
    if (value.charCodeAt(i) - value.charCodeAt(i - 1) !== step) return false;
  }
  return true;
};

const stripDecoration = (value: string) => value.replace(/[^a-z]+$/, '').replace(/^[^a-z]+/, '');

/** Returns a human-readable reason, or null when the password is acceptable. */
export function findPasswordWeakness(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized) || COMMON_PASSWORDS.has(stripDecoration(normalized))) {
    return 'This password is too common. Please choose a less predictable one.';
  }
  if (isRepeatedCharacter(normalized)) {
    return 'Password cannot be a single repeated character.';
  }
  if (isSequentialRun(normalized)) {
    return 'Password cannot be a sequential run of characters.';
  }
  return null;
}
