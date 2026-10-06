import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@sba/shared';

export const IS_PUBLIC = 'sba:public';
export const ROLES = 'sba:roles';
export const ALLOW_WITHOUT_MFA = 'sba:allow-without-mfa';

/** No session required (public intake, sign-in, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Caller must hold at least one of these roles (re-read from the DB per request). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Reachable by staff who have not completed MFA yet (enrolment, me, logout). */
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA, true);
