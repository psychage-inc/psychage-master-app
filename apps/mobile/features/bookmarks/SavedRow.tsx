/**
 * S-3 saved-list row (T-006). Resolves the saved resource by id (refetch — no
 * denormalized snapshot), routes to its detail surface on tap, and exposes a
 * trailing unsave. Unresolvable resource → "No longer available" + Remove (EC-4),
 * never a crash.
 */

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bookmark, FileText, MapPin, Wrench } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { getProviderById } from '@/features/directory/queries';
import { getArticleBySlug } from '@/lib/articles';
import { useThemeColors } from '@/lib/use-theme-colors';
import { trackSavedItemOpened } from './analytics';
import { BOOKMARKS_COPY } from './copy';
import { useToggleBookmark } from './hooks';
import type { Bookmark as BookmarkItem, ResourceType } from './types';

/** Tool resource_id = Expo route slug (no tools DB table — _review.md / tasks Open #1). */
const TOOL_NAMES: Record<string, string> = {
  clarity: 'Clarity Score',
  sleep: 'Sleep Architect',
  'mood-journal': 'Moments',
  mindmate: 'MindMate',
  'relationship-health': 'Relationship Health Check',
};

// Legacy tool slugs whose /tools/<slug> route no longer exists (Mood Journal was
// folded into Moments, PR #173) — a stored bookmark must not route to +not-found.
const TOOL_ROUTE_OVERRIDES: Record<string, string> = {
  'mood-journal': '/',
};

const TYPE_LABEL: Record<ResourceType, string> = {
  article: 'Article',
  video: 'Video',
  provider: 'Provider',
  tool: 'Tool',
};

function routeFor(b: BookmarkItem): string {
  switch (b.resource_type) {
    case 'article':
      return `/article/${b.resource_id}`;
    case 'provider':
      return `/find/provider/${b.resource_id}`;
    case 'tool':
      return TOOL_ROUTE_OVERRIDES[b.resource_id] ?? `/tools/${b.resource_id}`;
    default:
      return '/';
  }
}

function iconFor(type: ResourceType) {
  if (type === 'article' || type === 'video') return FileText;
  if (type === 'provider') return MapPin;
  return Wrench;
}

function useResolvedTitle(b: BookmarkItem) {
  return useQuery({
    queryKey: ['bookmarks', 'resolve', b.resource_type, b.resource_id],
    queryFn: async (): Promise<string | null> => {
      if (b.resource_type === 'tool') return TOOL_NAMES[b.resource_id] ?? null;
      if (b.resource_type === 'article') return (await getArticleBySlug(b.resource_id))?.title ?? null;
      if (b.resource_type === 'provider') return (await getProviderById(b.resource_id))?.display_name ?? null;
      return null;
    },
    staleTime: 5 * 60_000,
  });
}

export function SavedRow({ item }: { item: BookmarkItem }) {
  const tc = useThemeColors();
  const toggle = useToggleBookmark();
  const { data: title, isLoading } = useResolvedTitle(item);
  const unavailable = !isLoading && (title === null || title === undefined);
  const Icon = iconFor(item.resource_type);

  const open = () => {
    if (unavailable) return;
    trackSavedItemOpened();
    router.push(routeFor(item));
  };
  const remove = () =>
    toggle.mutate({ ref: { resource_type: item.resource_type, resource_id: item.resource_id }, wasSaved: true });

  const display = isLoading ? '…' : (title ?? BOOKMARKS_COPY.row.unavailable);

  return (
    <Pressable
      testID={`saved-row-${item.id}`}
      onPress={open}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={`${display}, ${TYPE_LABEL[item.resource_type]}. Saved.`}
      className="min-h-[64px] flex-row items-center gap-4 px-2 py-3 active:bg-surface-active dark:active:bg-surface-active-dark border-b border-border-hairline last:border-b-0"
    >
      <Icon size={20} color={tc.inkSecondary} strokeWidth={1.75} />
      <View className="flex-1">
        <Text variant="bodyLarge" numberOfLines={1} className="text-text-primary dark:text-text-primary-dark">
          {display}
        </Text>
        <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
          {unavailable ? BOOKMARKS_COPY.row.unavailable : TYPE_LABEL[item.resource_type]}
        </Text>
      </View>
      <Pressable
        onPress={remove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={BOOKMARKS_COPY.row.remove}
        className="h-11 w-11 items-center justify-center"
      >
        <Bookmark size={20} color={tc.primary} fill={tc.primary} strokeWidth={1.75} />
      </Pressable>
    </Pressable>
  );
}
