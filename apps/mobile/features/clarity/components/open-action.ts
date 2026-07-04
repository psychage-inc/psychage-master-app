import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';

// Handler-less device fallback (PR-026). No feature copy module exists for
// clarity yet — CT4-marked here per the per-feature copy convention.
const CLARITY_ACTION_COPY = {
  reachFallback: (target: string) => `You can still reach it at ${target} from another phone or device.`, // CT4
};

// Shared action opener for the results dashboard's protocol/consultation links. tel:/sms:
// and http(s) open via the system (Linking); everything else is an in-app route push.
// Mirrors the web's <a href> vs <Link to> split.
export function openClarityAction(href: string): void {
  if (href.startsWith('tel:') || href.startsWith('sms:') || href.startsWith('http')) {
    Linking.openURL(href).catch(() => {
      // No handler on this device (e.g. a Wi-Fi-only tablet) — these include crisis
      // resources, so never a silent no-op: show the target so the person can still
      // reach it from another phone or device.
      const target = href.replace(/^(tel:|sms:)/, '');
      Alert.alert(
        "Couldn't open this on your device",
        CLARITY_ACTION_COPY.reachFallback(target),
      );
    });
    return;
  }
  // Expo Router's typed-routes signature is stricter than our dynamic string; the
  // targets here are all real app routes (remapped in scoring/data), so this is safe.
  router.push(href as never);
}
