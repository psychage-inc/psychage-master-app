// Auth feature — logic surface (no className-bearing JSX lives here; presentational
// bodies live under components/auth so Tailwind's content scan covers them).

export { AUTH_COPY } from './copy';
export {
  PASSWORD_MIN_LENGTH,
  passwordStrength,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
  type ConfirmError,
  type EmailError,
  type NameError,
  type PasswordError,
  type PasswordStrength,
  type StrengthLevel,
} from './validate';
export {
  createStubAuthService,
  type AuthErrorCode,
  type AuthResult,
  type AuthService,
  type AuthSession,
  type SignUpResult,
  type SocialProvider,
  type VerificationStatus,
} from './auth-service';
export { AuthProvider, useAuth } from './use-auth';
export { useSocialSignIn } from './use-social-sign-in';
export { mergeMomentRecords, type MergeResult } from './migration/merge';
export {
  lastSevenDayWindow,
  runMigration,
  stubMigrationRemote,
  type MigrationDeps,
  type MigrationOutcome,
  type MigrationRemote,
  type MigrationStatus,
} from './migration/orchestrate';
