import { router } from 'expo-router';
import { User, Palette, Bell, Shield, Bookmark, LifeBuoy } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { BentoCard } from '@/components/settings/bento/BentoCard';
import { BentoGrid } from '@/components/settings/bento/BentoGrid';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth';
import { BOOKMARKS_COPY } from '@/features/bookmarks/copy';
import { CT4_SETTINGS } from '@/features/settings/copy';
import { THERAPIST_COPY } from '@/features/therapist/copy';
import { storage } from '@/lib/adapters/storage';
import { loadPersonalization } from '@/lib/persistence/personalization';
import { useThemeColors } from '@/lib/use-theme-colors';

// S42 Settings hub. A calm bento grid. The native stack header owns the top inset, so
// the shell only guards the bottom.
export default function SettingsHubScreen() {
  const { name } = loadPersonalization(storage);
  const { session } = useAuth();
  const t = CT4_SETTINGS;
  const tc = useThemeColors();

  return (
    <ScreenShell edges={['bottom']}>
      <ScrollView contentContainerClassName="gap-4 py-4 px-4" showsVerticalScrollIndicator={false}>
        <BentoGrid>
          <BentoCard
            title={t.hub.accountLabel}
            icon={<User size={20} color={tc.inkSecondary} />}
            description="Manage your profile and session"
          >
            <SettingsRow
              label={name ?? t.makeItYours.namePlaceholder}
              value={name ? undefined : t.makeItYours.save}
              onPress={() => router.push('/settings/make-it-yours')}
              testID="settings-row-profile"
            />
            <SettingsRow
              label={t.hub.rows.account}
              value={session ? session.email : t.hub.notSignedIn}
              chevron={false}
              testID="settings-row-account-status"
            />
            {session ? (
              <SettingsRow
                label={t.hub.rows.signOut}
                onPress={() => router.push('/sign-out')}
                testID="settings-row-sign-out"
              />
            ) : (
              <SettingsRow
                label={t.hub.rows.signIn}
                onPress={() => router.push('/sign-in')}
                testID="settings-row-sign-in"
              />
            )}
            <SettingsRow
              label={t.hub.rows.deleteAccount}
              destructive
              onPress={() => router.push('/settings/delete')}
              testID="settings-row-delete-account"
            />
          </BentoCard>

          <BentoCard
            title="Appearance"
            icon={<Palette size={20} color={tc.inkSecondary} />}
            description="Theme and visual settings"
          >
            <SettingsRow
              label={t.hub.rows.appearance}
              onPress={() => router.push('/settings/appearance')}
              testID="settings-row-appearance"
            />
            <SettingsRow
              label={t.hub.rows.makeItYours}
              onPress={() => router.push('/settings/make-it-yours')}
              testID="settings-row-make-it-yours"
            />
          </BentoCard>

          <BentoCard
            title="Notifications"
            icon={<Bell size={20} color={tc.inkSecondary} />}
            description="Alerts and reminders"
          >
            <SettingsRow
              label={t.hub.rows.reminders}
              onPress={() => router.push('/settings/reminders')}
              testID="settings-row-reminders"
            />
          </BentoCard>

          <BentoCard
            title="Privacy"
            icon={<Shield size={20} color={tc.inkSecondary} />}
            description="Permissions and security"
          >
            <SettingsRow
              label={t.hub.rows.privacy}
              onPress={() => router.push('/settings/privacy')}
              testID="settings-row-privacy"
            />
          </BentoCard>

          <BentoCard
            title="Data"
            icon={<Bookmark size={20} color={tc.inkSecondary} />}
            description="Storage and history"
          >
            <SettingsRow
              label={BOOKMARKS_COPY.list.title}
              onPress={() => router.push('/saved')}
              testID="settings-row-saved"
            />
            <SettingsRow
              // The person's own session-prep summary — generated on demand and shared by
              // them (system share sheet; Psychage never transmits — SR-4).
              label={THERAPIST_COPY.sessionPrep.navLabel}
              onPress={() => router.push('/settings/session-prep')}
              testID="settings-row-session-prep"
            />
            <SettingsRow
              // Share-to-provider flow (S38–S41). Second entry point — Find Care's provider
              // card is the other. Routes to /add-provider (the live, unambiguous flow start);
              // NOT '/why', which collides with the auth S33 screen (see use-account-prompt).
              // Nothing transmits until the person taps the OS share sheet at preview (SR-4).
              label={THERAPIST_COPY.consentTitle}
              onPress={() => router.push('/add-provider')}
              testID="settings-row-therapist-share"
            />
          </BentoCard>

          <BentoCard
            title={t.hub.crisisLabel}
            icon={<LifeBuoy size={20} color={tc.inkSecondary} />}
            description="Help and feedback"
          >
            <SettingsRow
              label={t.hub.rows.about}
              onPress={() => router.push('/settings/about')}
              testID="settings-row-about"
            />
            <SettingsRow
              label={t.hub.rows.supporter}
              onPress={() => router.push('/settings/supporter')}
              testID="settings-row-supporter"
            />
            <SettingsRow
              // SR-2: crisis access is always reachable. One more entry point to the
              // always-on /crisis surface (also on the GlobalHeader Help-now pill).
              label={t.hub.rows.crisis}
              onPress={() => router.push('/crisis')}
              testID="settings-row-crisis"
            />
          </BentoCard>
        </BentoGrid>

        {/* Internal fixture marker — dev builds only, never shown to users. */}
        {__DEV__ ? (
          <View className="px-1 pt-6 pb-2">
            <Text
              variant="caption"
              className="text-text-tertiary dark:text-text-tertiary-dark text-center"
            >
              {t._marker}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
