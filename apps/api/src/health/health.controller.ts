import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorators.js';

/**
 * Liveness probe for container orchestration. It reports only that the process
 * is serving requests; readiness checks for Postgres, Redis and MinIO are added
 * alongside those clients in later phases.
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
