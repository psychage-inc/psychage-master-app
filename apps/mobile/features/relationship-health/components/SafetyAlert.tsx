import { ExternalLink, MessageCircle, Phone } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Linking, Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors } from '@/lib/colors';

import { CT4_RELATIONSHIP } from '../copy';

// Safety surface for the DV / isolation alerts. Ported from the web SafetyAlert:
// a full-screen modal with confidential resources, plus a persistent banner shown
// on the results screen after dismissal. Crisis support is also always one tap
// away via the chrome's Help-now pill (SR-2); this is the assessment-specific
// surfacing layered on top, never a gate that hides the results.

export interface SafetyAlertProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly onCrisis: () => void;
  /**
   * Which alert fired (PR-029). 'dv' keeps the DV hotline resources; 'isolation'
   * (only the social-isolation trigger, no DV) swaps in general support copy +
   * the 988 lifeline — the DV hotline is the wrong first resource for a lonely,
   * no-partner user. When both fire, DV takes precedence.
   */
  readonly variant?: 'dv' | 'isolation';
}

// A device without a tel:/sms: handler (e.g. a Wi-Fi-only tablet) REJECTS openURL —
// a crisis resource must never silently no-op. Fall back to showing the resource and
// its number/text target in an alert, so the person can still reach it from a phone.
function openResourceOrShow(url: string, title: string, fallbackBody: string): void {
  Linking.openURL(url).catch(() => Alert.alert(title, fallbackBody));
}

function ResourceRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface-hover p-3 dark:border-border-dark dark:bg-surface-hover-dark"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">{icon}</View>
      <View className="flex-1">
        <Text variant="bodyLarge" className="text-[14px]">
          {title}
        </Text>
        <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

export function SafetyAlert({ visible, onDismiss, onCrisis, variant = 'dv' }: SafetyAlertProps) {
  const t = CT4_RELATIONSHIP.safety;
  const isolation = variant === 'isolation';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {/* @design-purpose: modal backdrop scrim to focus the safety dialog — solid dim, no blur/glassmorphism */}
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <Text variant="h2" className="mb-2" accessibilityRole="header">
            {isolation ? t.isolationTitle : t.title}
          </Text>
          <Text variant="caption" className="mb-4 text-text-secondary dark:text-text-secondary-dark leading-5">
            {isolation ? t.isolationBody : t.body}
          </Text>

          <View className="gap-2">
            {isolation ? (
              <ResourceRow
                icon={<Phone size={16} color={colors.primary.default.light} strokeWidth={1.75} />}
                title={t.lifelineTitle}
                sub={t.lifelineSub}
                onPress={() =>
                  openResourceOrShow(
                    t.lifelineTel,
                    t.lifelineTitle,
                    `Calling isn't available on this device. From any phone: ${t.lifelineSub}`,
                  )
                }
              />
            ) : (
              <>
                <ResourceRow
                  icon={<Phone size={16} color={colors.primary.default.light} strokeWidth={1.75} />}
                  title={t.dvTitle}
                  sub={t.dvSub}
                  onPress={() =>
                    openResourceOrShow(
                      t.dvTel,
                      t.dvTitle,
                      `Calling isn't available on this device. From any phone: ${t.dvSub}`,
                    )
                  }
                />
                <ResourceRow
                  icon={<MessageCircle size={16} color={colors.primary.default.light} strokeWidth={1.75} />}
                  title={t.textTitle}
                  sub={t.textSub}
                  onPress={() =>
                    openResourceOrShow(
                      t.textSms,
                      t.textTitle,
                      `Texting isn't available on this device. From any phone: ${t.textSub}`,
                    )
                  }
                />
              </>
            )}
            <ResourceRow
              icon={<ExternalLink size={16} color={colors.text.secondary.light} strokeWidth={1.75} />}
              title={t.moreTitle}
              sub={t.moreSub}
              onPress={onCrisis}
            />
          </View>

          <Button variant="ghost" size="sm" onPress={onDismiss} className="mt-4 w-full">
            {t.dismiss}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

/** Persistent banner shown on the results screen after the alert is dismissed. */
export function SafetyBanner({ onCrisis }: { onCrisis: () => void }) {
  const t = CT4_RELATIONSHIP.safety;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.bannerLead} ${t.bannerBody}`}
      onPress={onCrisis}
      className="rounded-xl border border-crisis/40 bg-surface p-4 dark:bg-surface-dark"
    >
      <Text variant="caption" className="leading-5">
        <Text variant="bodyLarge" className="text-[14px]">
          {t.bannerLead}{' '}
        </Text>
        <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
          {t.bannerBody}
        </Text>
      </Text>
    </Pressable>
  );
}
