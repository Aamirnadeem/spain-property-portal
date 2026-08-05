import { describe, expect, it } from 'vitest';
import { logger } from './index';

describe('logger', () => {
  it('exposes structured methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
