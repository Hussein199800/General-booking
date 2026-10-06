import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { AppError } from './app-error.js';

/** Validates a body / query against a zod schema. Reports failing field paths, never values. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields = [
        ...new Set(result.error.issues.map((issue) => issue.path.join('.') || '(root)')),
      ];
      throw new AppError('VALIDATION', {}, fields);
    }
    return result.data;
  }
}
