import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { getSupabaseAuthClient } from '@/lib/supabase/client';

import { createMindMateConsentApi, type MindMateConsentApi, mindMateAppVersion } from './consent-api';

// The real consent API: the session-bearing auth client + the native app version.
// getSupabaseAuthClient() throws when the Supabase env is missing, and
// mindMateAppVersion() throws when the native version is unavailable — both fail fast.
export function getMindMateConsentApi(): MindMateConsentApi {
  return createMindMateConsentApi(getSupabaseAuthClient(), () =>
    mindMateAppVersion(Platform.OS, Application.nativeApplicationVersion),
  );
}
