import { describe, it, expect } from 'vitest';
import { cmpVersions } from '../src/update-check.js';

describe('cmpVersions', () => {
  it('orders versions numerically, not lexically (0.2.9 < 0.2.10)', () => {
    expect(cmpVersions('0.2.9', '0.2.10')).toBe(-1);
    expect(cmpVersions('0.2.10', '0.2.9')).toBe(1);
    expect(cmpVersions('0.2.10', '0.2.10')).toBe(0);
    expect(cmpVersions('0.3.0', '0.2.99')).toBe(1);
    expect(cmpVersions('1.0.0', '0.9.9')).toBe(1);
  });

  it('ignores pre-release suffixes', () => {
    expect(cmpVersions('0.2.10-beta.1', '0.2.10')).toBe(0);
    expect(cmpVersions('0.2.9-rc.1', '0.2.10')).toBe(-1);
  });
});
