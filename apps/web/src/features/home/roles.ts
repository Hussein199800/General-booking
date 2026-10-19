import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  Crown,
  Eye,
  Landmark,
  Scale,
  Settings2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export const ROLE_CATEGORIES = [
  'PUBLIC',
  'LAWYERS',
  'SECRETARIAT',
  'LEADERSHIP',
  'UNITS',
  'OVERSIGHT',
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export const ROLE_KEYS = [
  'VISITOR',
  'LAWYER',
  'SECRETARIAT_OFFICER',
  'SECRETARIAT_HEAD',
  'GRAND_SYNDIC',
  'COUNCIL_MEMBER',
  'BRANCH_OFFICER',
  'COMMITTEE_MEMBER',
  'AUDITOR',
  'SYSTEM_ADMIN',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleEntry {
  readonly key: RoleKey;
  readonly category: RoleCategory;
  readonly icon: LucideIcon;
  /** Served by the API only; there is no screen for it yet. */
  readonly apiOnly?: boolean;
}

/**
 * The roles as the system implements them (API guards in apps/api). The texts
 * describe what the portal lets each role do — not the Bar's legal procedures.
 */
export const ROLES: readonly RoleEntry[] = [
  { key: 'VISITOR', category: 'PUBLIC', icon: UsersRound },
  { key: 'LAWYER', category: 'LAWYERS', icon: UserRound },
  { key: 'SECRETARIAT_OFFICER', category: 'SECRETARIAT', icon: ClipboardCheck },
  { key: 'SECRETARIAT_HEAD', category: 'SECRETARIAT', icon: Landmark },
  { key: 'GRAND_SYNDIC', category: 'LEADERSHIP', icon: Crown },
  { key: 'COUNCIL_MEMBER', category: 'LEADERSHIP', icon: CalendarClock },
  { key: 'BRANCH_OFFICER', category: 'UNITS', icon: Building2 },
  { key: 'COMMITTEE_MEMBER', category: 'UNITS', icon: Scale },
  { key: 'AUDITOR', category: 'OVERSIGHT', icon: Eye, apiOnly: true },
  { key: 'SYSTEM_ADMIN', category: 'OVERSIGHT', icon: Settings2, apiOnly: true },
];
