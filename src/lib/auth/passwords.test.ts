import { describe, expect, it } from 'vitest';
import { assertPasswordStrength, hashPassword, verifyPassword, WeakPasswordError } from './passwords';

describe('password hashing', () => {
  it('accepts a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('Correct horse battery', hash)).toBe(false);
  });

  it('salts each hash independently', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
  });

  it('rejects a short password', async () => {
    expect(() => assertPasswordStrength('short')).toThrow(WeakPasswordError);
    await expect(hashPassword('short')).rejects.toThrow(WeakPasswordError);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', 'bcrypt$1$2$3$4$5')).toBe(false);
  });

  it('normalises unicode so an equivalent password still verifies', async () => {
    const hash = await hashPassword('ünicode-password');
    expect(await verifyPassword('ünicode-password', hash)).toBe(true);
  });
});
