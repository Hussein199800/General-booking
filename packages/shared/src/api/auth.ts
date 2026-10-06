import { z } from 'zod';

/** Six-digit TOTP code. */
export const otpSchema = z.string().regex(/^\d{6}$/);

export const staffLoginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
  otp: otpSchema.optional(),
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const lawyerLoginSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(32),
  nationalId: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(256),
  otp: otpSchema.optional(),
});
export type LawyerLoginInput = z.infer<typeof lawyerLoginSchema>;

export const mfaConfirmSchema = z.object({ otp: otpSchema });

/** New passwords: length over complexity rules (NIST SP 800-63B). */
export const newPasswordSchema = z.string().min(12).max(256);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: newPasswordSchema,
});

/** Outcome of a sign-in attempt that did not fail outright. */
export type LoginOutcome =
  { status: 'OK' } | { status: 'MFA_REQUIRED' } | { status: 'MFA_ENROLLMENT_REQUIRED' };

export interface MeResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly roles: readonly string[];
  readonly mfaEnabled: boolean;
  readonly mfaVerified: boolean;
}
