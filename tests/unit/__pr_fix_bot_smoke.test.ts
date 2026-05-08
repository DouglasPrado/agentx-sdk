// Deliberately failing test — smoke test for pr-fix.sh bot.
// Bot should detect the failure and fix it (or delete this file).
import { describe, it, expect } from 'vitest';

describe('pr-fix-bot smoke test', () => {
  it('this assertion is wrong on purpose', () => {
    expect(1).toBe(2);
  });
});
