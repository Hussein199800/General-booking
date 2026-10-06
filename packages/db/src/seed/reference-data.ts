import { GOVERNORATES, t, type Governorate } from '@sba/shared';

import type { ExternalEntityType, OrgUnitType } from '../generated/prisma/enums.js';

export interface OrgUnitSeed {
  readonly code: string;
  readonly unitType: OrgUnitType;
  readonly nameAr: string;
  readonly governorate: Governorate | null;
}

export interface ExternalEntitySeed {
  readonly code: string;
  readonly entityType: ExternalEntityType;
  readonly nameAr: string;
}

export function branchCode(governorate: Governorate): string {
  return `BRANCH_${governorate}`;
}

/**
 * Central bodies, the central Disciplinary Committee (decision Q10: no other
 * committees are seeded) and one branch council per governorate.
 */
export function organizationalUnits(): OrgUnitSeed[] {
  return [
    {
      code: 'GRAND_SYNDIC_OFFICE',
      unitType: 'GRAND_SYNDIC_OFFICE',
      nameAr: t('orgUnits.GRAND_SYNDIC_OFFICE'),
      governorate: null,
    },
    {
      code: 'CENTRAL_SECRETARIAT',
      unitType: 'CENTRAL_SECRETARIAT',
      nameAr: t('orgUnits.CENTRAL_SECRETARIAT'),
      governorate: null,
    },
    {
      code: 'CENTRAL_DISCIPLINARY_COMMITTEE',
      unitType: 'DISCIPLINARY_COMMITTEE',
      nameAr: t('orgUnits.CENTRAL_DISCIPLINARY_COMMITTEE'),
      governorate: null,
    },
    ...GOVERNORATES.map((governorate) => ({
      code: branchCode(governorate),
      unitType: 'REGIONAL_BRANCH' as const,
      nameAr: t('branch.councilName', { governorate: t(`governorates.${governorate}`) }),
      governorate,
    })),
  ];
}

export function externalEntities(): ExternalEntitySeed[] {
  return [
    {
      code: 'MINISTRY_OF_JUSTICE',
      entityType: 'MINISTRY_OF_JUSTICE',
      nameAr: t('entities.MINISTRY_OF_JUSTICE'),
    },
    {
      code: 'SUPREME_JUDICIAL_COUNCIL',
      entityType: 'SUPREME_JUDICIAL_COUNCIL',
      nameAr: t('entities.SUPREME_JUDICIAL_COUNCIL'),
    },
  ];
}
