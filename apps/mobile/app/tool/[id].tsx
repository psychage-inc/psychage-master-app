import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { ToolScreen } from '@/components/ui/ToolScreen';
import { goBackOr } from '@/lib/nav';
import { type ToolId, TOOLS, toolUsageStore } from '@/lib/tool-usage-store';

// Legacy `/tool/[id]` deep-link shim. The placeholder screen it used to render is
// retired (PR-008): every ToolId now redirects to its real native flow (TOOLS[*].route,
// aligned with features/compass/routes.ts). Kept as a route so old links keep working.
// Unknown ids get a small not-found surface whose Back is cold-start-safe (goBackOr).
export default function ToolRedirectRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = id ? TOOLS[id as ToolId] : undefined;

  // Arriving here counts as opening the tool (feeds the dormant-tool nudge),
  // exactly like the home bento's open(). Effect, not render-time — the redirect
  // component can mount more than once.
  useEffect(() => {
    if (tool) toolUsageStore.recordUse(tool.id);
  }, [tool]);

  if (tool) {
    return <Redirect href={tool.route as never} />;
  }

  return (
    <ToolScreen scroll="none" onBack={() => goBackOr('/compass')}>
      <View className="flex-1 items-center justify-center gap-6 p-6">
        <Text variant="h1">Tool Not Found</Text>
        <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
          This link doesn’t match a tool in this version of the app. You can find every tool on the
          Compass tab.
        </Text>
      </View>
    </ToolScreen>
  );
}
