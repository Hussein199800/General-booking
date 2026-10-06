import { Controller, Get } from '@nestjs/common';
import type { ReferenceOption } from '@sba/shared';

import { Roles } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Lists the forms need; names are institutional data, not UI strings. */
@Controller('reference')
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('GRAND_SYNDIC', 'SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER', 'COUNCIL_MEMBER')
  @Get('rooms')
  async rooms(): Promise<ReferenceOption[]> {
    const rooms = await this.prisma.client.room.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    return rooms.map((room) => ({ id: room.id, code: room.code, name: room.nameAr }));
  }

  @Roles('SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER')
  @Get('routing-targets')
  async routingTargets(): Promise<{ units: ReferenceOption[]; entities: ReferenceOption[] }> {
    const [units, entities] = await Promise.all([
      this.prisma.client.organizationalUnit.findMany({
        where: {
          isActive: true,
          unitType: { in: ['REGIONAL_BRANCH', 'DISCIPLINARY_COMMITTEE', 'COMMITTEE'] },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.client.externalEntity.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      }),
    ]);
    return {
      units: units.map((u) => ({ id: u.id, code: u.code, name: u.nameAr })),
      entities: entities.map((e) => ({ id: e.id, code: e.code, name: e.nameAr })),
    };
  }
}
