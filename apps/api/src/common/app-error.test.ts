import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError, fromDatabaseError, sqlState } from './app-error.js';
import { ZodPipe } from './zod.pipe.js';

const dbError = (code: string) => ({
  meta: { driverAdapterError: { cause: { originalCode: code } } },
});

describe('database error mapping', () => {
  it.each([
    ['23P01', 'SLOT_CONFLICT'],
    ['23514', 'ILLEGAL_TRANSITION'],
    ['23505', 'CONFLICT'],
    ['23503', 'NOT_FOUND'],
  ])('SQLSTATE %s → %s', (code, expected) => {
    expect(fromDatabaseError(dbError(code))?.code).toBe(expected);
  });

  it('leaves unknown errors to the generic handler', () => {
    expect(fromDatabaseError(new Error('boom'))).toBeUndefined();
    expect(sqlState({})).toBeUndefined();
  });
});

describe('ZodPipe', () => {
  const pipe = new ZodPipe(
    z.object({ name: z.string().min(2), phone: z.string().regex(/^\+\d+$/) }),
  );

  it('passes valid input through', () => {
    expect(pipe.transform({ name: 'ab', phone: '+963' })).toEqual({ name: 'ab', phone: '+963' });
  });

  it('reports failing field paths, never values', () => {
    try {
      pipe.transform({ name: 'x', phone: 'secret-value' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION');
      expect((error as AppError).fields).toEqual(['name', 'phone']);
      expect(JSON.stringify(error)).not.toContain('secret-value');
    }
  });
});
