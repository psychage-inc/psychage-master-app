// FindCareScreen — faithful port of the FindCare.tsx prototype, wired to REAL
// shared-Supabase data and the app's stores. Visual fidelity to the mock was the
// explicit goal, so this screen intentionally uses the prototype's warm palette +
// serif headers rather than the token classes — it will NOT pass mobile-design-audit
// (accepted trade-off). Behavior is real:
//   • results          → useProviderSearch (search_providers_v3 cascade)
//   • provider types   → useProviderTypes (real provider_types lookup)
//   • profile details  → getProviderById
//   • result count     → real total_count (count-up animation, reduce-motion safe)
//   • save / compare   → bookmarks (auth-gated; anon tap → sign-up)
//   • "Use my location"→ real expo-location (one-shot, never persisted)
//   • home location    → remembered across launches (useDirectoryLocation)
//   • per-state / city / type counts → real facet RPCs (directory_facets), grouped
//     on the SAME columns search_providers_v3 filters on, so a count never disagrees
//     with the list selecting it produces (honest coverage; zero-yield disabled).
// Dropped from the mock because the data does NOT back it: gender (no such column).

import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ArrowUpDown, BadgeCheck, Bookmark, BookOpen, Building2, Check, ChevronDown, ChevronLeft,
  ChevronRight, FileText, Hash, Info, LifeBuoy, MapPin, MessageSquare, Phone, Plus, Search,
  Stethoscope, Trash2, Users, X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Modal, Pressable, ScrollView, TextInput, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition, SlideInDown, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderAvatar } from '@/components/HeaderAvatar';
import { Mascot } from '@/components/home/Mascot';
import { PsychageLogo } from '@/components/PsychageLogo';
import { Text } from '@/components/ui/Text';
import { MASCOT_CONTEXTUAL } from '@/features/mascot/mascot.surfaces';
import { useMyProviders } from '@/lib/use-my-providers';
import type { SavedProviderInput } from '@/lib/persistence/my-providers';
import { dial } from '@/features/crisis/dialer';
import { useHaptics } from '@/lib/haptic-context';
import { useDirectoryLocation } from '@/lib/use-directory-location';
import { recordRecentlyViewed } from '@/lib/persistence/recently-viewed';
import { colors } from '@/lib/colors';

import { telUrl } from '@/features/directory/contact';
import { useCityCounts, useProviderSearch, useProviderTypes, useStateCounts, useTypeCounts } from '@/features/directory/hooks';
import { requestAndGetCoords } from '@/features/directory/location';
import { cleanDisplayName } from '@/features/directory/mapping';
import { getProviderById } from '@/features/directory/queries';
import { ABBR, STATES } from '@/features/directory/states';
import { getTrustBadge } from '@/features/directory/trust';
import type { ProviderCardData, ProviderSearchParams, ProviderType, ProviderWithDetails } from '@/features/directory/types';

// Clay-initial avatar palette — providers are NEVER shown by photo (NPPES has none);
// a deterministic initial circle from this fixed set is the avatar everywhere.
const AVA = ['#7E9C8E', '#B98A6A', '#8A86B0', '#A6707A', '#6F94A8', '#9B9460'];
const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVA[h % AVA.length];
};
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const TYPE_ICON: Record<string, typeof Users> = {
  psychiatrist: Stethoscope,
  'psychiatric-nurse-practitioner': Stethoscope,
  'psychiatric-mental-health-nurse-practitioner': Stethoscope,
  psychologist: BookOpen,
  counselor: MessageSquare,
  therapist: MessageSquare,
  'counselor-therapist': MessageSquare,
  'clinical-social-worker': Users,
  'social-worker': Users,
  'marriage-family-therapist': Users,
};
const iconForType = (slug: string) => TYPE_ICON[slug] ?? Users;

// Resolve a reverse-geocoded region (full name "California" OR 2-letter "CA") to the
// canonical state name the directory filters on. Providers carry no coordinates, so
// "Use my location" searches by STATE — this maps the device region onto one.
function resolveStateName(region: string | null): string | null {
  if (!region) return null;
  const direct = STATES.find((s) => s.toLowerCase() === region.trim().toLowerCase());
  if (direct) return direct;
  const up = region.trim().toUpperCase();
  if (up.length === 2) return STATES.find((s) => ABBR[s] === up) ?? null;
  return null;
}

function formatVerified(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/* ----------------------------- motion helpers ----------------------------- */
function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setR(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setR);
    return () => {
      alive = false;
      (sub as { remove?: () => void })?.remove?.();
    };
  }, []);
  return r;
}
function useCountUp(target: number, reduce: boolean) {
  const [v, setV] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const from = ref.current;
    const to = target;
    if (reduce || from === to) {
      ref.current = to;
      setV(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / 450);
      const e = 1 - (1 - p) ** 3;
      setV(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, reduce]);
  return v;
}
function Tap({ onPress, children, className, style, accessibilityLabel, accessibilityRole, activeScale = 0.96 }: { onPress?: () => void; children: React.ReactNode; className?: string; style?: ViewStyle; accessibilityLabel?: string; accessibilityRole?: any; activeScale?: number }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const cfg = { damping: 20, stiffness: 400, mass: 0.6 };
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole ?? 'button'} onPress={onPress} onPressIn={() => { s.value = withSpring(activeScale, cfg); }} onPressOut={() => { s.value = withSpring(1, cfg); }} style={style}>
      <Animated.View className={className} style={a}>{children}</Animated.View>
    </Pressable>
  );
}
function Skeleton() {
  const o = useSharedValue(0.4);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={a} className="flex-row gap-3 bg-surface dark:bg-surface-dark border border-border/50 dark:border-border-dark/50 rounded-[20px] mb-4 p-[15px] shadow-sm dark:shadow-none">
      <View className="w-[46px] h-[46px] rounded-full bg-border/50 dark:bg-border-dark/50" />
      <View className="flex-1 gap-2.5 py-0.5">
        <View className="h-4 w-2/3 rounded-[4px] bg-border/50 dark:bg-border-dark/50" />
        <View className="h-3.5 w-1/2 rounded-[4px] bg-border/50 dark:bg-border-dark/50" />
        <View className="flex-row gap-2 mt-1">
          <View className="h-5 w-16 rounded-full bg-border/50 dark:bg-border-dark/50" />
          <View className="h-5 w-20 rounded-full bg-border/50 dark:bg-border-dark/50" />
        </View>
      </View>
    </Animated.View>
  );
}

/* ----------------------------- shared chrome ----------------------------- */
// Module scope (not the render body): a component type re-created during render gets
// a fresh identity every render, remounting its subtree on every keystroke. Theme
// values are derived inside each component (same pattern as ProfileStep / Row).
const Header = ({ back, title, hideMine, onOpenSaved }: { back?: () => void; title?: string; hideMine?: boolean; onOpenSaved?: () => void }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const ink = isDark ? colors.text.primary.dark : colors.text.primary.light;
  const teal = isDark ? colors.teal[400] : colors.teal[600];
  const red = isDark ? colors.crisis.dark : colors.crisis.light;
  const my = useMyProviders();
  return (
    <Animated.View layout={LinearTransition} className="flex-row items-center justify-between px-6 pt-3 pb-4">
      {back ? (
        <Tap activeScale={0.85} onPress={back}><View className="p-2.5 -ml-2.5 bg-surface-active/50 dark:bg-surface-active-dark/50 rounded-full"><ChevronLeft size={24} color={ink} /></View></Tap>
      ) : (
        <PsychageLogo className="font-display text-2xl text-text-primary dark:text-text-primary-dark" />
      )}
      {title ? <Text className="font-sans-bold text-[17px] text-text-primary dark:text-text-primary-dark">{title}</Text> : null}
      <View className="flex-row items-center gap-3">
        {hideMine || !onOpenSaved ? null : (
          <Tap activeScale={0.9} accessibilityLabel="My providers" onPress={onOpenSaved}>
            <View className="p-1.5"><Bookmark size={20} color={my.items.length ? teal : ink} fill={my.items.length ? teal : 'transparent'} /></View>
          </Tap>
        )}
        <Tap activeScale={0.9} accessibilityLabel="Help now" onPress={() => router.push('/crisis')}>
          <View className="flex-row items-center gap-1.5 bg-error/10 dark:bg-error-dark/20 border border-error/30 dark:border-error-dark/40 rounded-full px-4 py-1.5 shadow-sm dark:shadow-none">
            <LifeBuoy size={16} color={red} /><Text className="font-sans-bold text-[14px] text-error dark:text-error-dark">Help</Text>
          </View>
        </Tap>
        <HeaderAvatar />
      </View>
    </Animated.View>
  );
};
const Chip = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const { colorScheme } = useColorScheme();
  const soft = colorScheme === 'dark' ? colors.text.secondary.dark : colors.text.secondary.light;
  return (
    <Tap onPress={onPress} activeScale={0.95}>
      <View className="flex-row items-center gap-1.5 bg-surface dark:bg-surface-dark border border-border/60 dark:border-border-dark/60 rounded-full px-3.5 py-2 shadow-sm dark:shadow-none">
        <Text className="font-sans-medium text-[14px] text-text-primary dark:text-text-primary-dark">{label}</Text><ChevronDown size={14} color={soft} />
      </View>
    </Tap>
  );
};
const Primary = ({ label, onPress, disabled, color, icon }: { label: string; onPress?: () => void; disabled?: boolean; color?: string; icon?: React.ReactNode }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bg = color ?? (isDark ? colors.teal[400] : colors.teal[600]);
  return (
    <Tap onPress={disabled ? undefined : onPress} activeScale={0.96}>
      <View style={{ backgroundColor: bg, opacity: disabled ? 0.45 : 1, shadowColor: bg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.3, shadowRadius: 8, elevation: isDark ? 0 : 4 }} className="rounded-[16px] py-4 flex-row items-center justify-center gap-2">
        {icon}<Text className="font-sans-bold text-white text-[17px]">{label}</Text>
      </View>
    </Tap>
  );
};

type Step = 'location' | 'manual' | 'city' | 'type' | 'outside' | 'results' | 'profile' | 'compare' | 'saved';

export default function FindCareScreen() {
  const reduce = useReduceMotion();
  const dl = useDirectoryLocation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const ink = isDark ? colors.text.primary.dark : colors.text.primary.light;
  const soft = isDark ? colors.text.secondary.dark : colors.text.secondary.light;
  const faint = isDark ? colors.text.tertiary.dark : colors.text.tertiary.light;
  const teal = isDark ? colors.teal[400] : colors.teal[600];
  const tealPress = isDark ? colors.teal[500] : colors.teal[700];
  const red = isDark ? colors.crisis.dark : colors.crisis.light;

  const { fireHaptic } = useHaptics();

  // Returning users with a saved location still pass through the needs-selection
  // step (provider type) rather than being dumped straight onto the list — the
  // location fast-path is preserved (no re-entering state), but "what kind of care"
  // is asked each visit. First-time / unconfigured users start at location.
  const [step, setStep] = useState<Step>(dl.configured && dl.stateName ? 'type' : 'location');
  const [loc, setLoc] = useState<string | null>(dl.stateName);
  const [city, setCity] = useState<string | null>(dl.city);
  const [typeSel, setTypeSel] = useState<{ id: string; label: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stateQ, setStateQ] = useState('');
  const [cityQ, setCityQ] = useState('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<'relevance' | 'name' | 'distance'>('relevance');
  const [sheet, setSheet] = useState<null | 'sort' | 'addProvider'>(null);

  // My providers — local-first (works signed-out), used for save + compare + call list.
  const my = useMyProviders();
  // Compare only fetches real NPI listings by id; manual entries have no directory row.
  const compareIds = useMemo(() => my.items.filter((p) => !p.manual).map((p) => p.id), [my.items]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Android hardware back walks the wizard back one step (mirroring each screen's
  // on-screen back transition) instead of exiting the tab. At the step this visit
  // ENTERED on (and at the absolute root) the system default applies. The
  // subscription is torn down on unmount.
  const entryStep = useRef(step).current;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === entryStep || step === 'location') return false;
      switch (step) {
        case 'manual':
          setStep('location');
          return true;
        case 'city':
        case 'outside':
          setStep('manual');
          return true;
        case 'type':
          setStep(city ? 'city' : 'manual');
          return true;
        case 'results':
          setStep('type');
          return true;
        case 'profile':
        case 'compare':
          setStep('results');
          return true;
        case 'saved':
          setStep(loc ? 'type' : 'location');
          return true;
        default:
          return false;
      }
    });
    return () => sub.remove();
  }, [step, entryStep, city, loc]);

  const stateAbbr = loc ? ABBR[loc] : undefined;
  // No lat/lng/radius: provider_locations carry no coordinates, so a geo-radius search
  // returns nothing. The directory searches by state (resolved from device location
  // for "Use my location"); distance sort is likewise unbacked and not offered.
  const params = useMemo<ProviderSearchParams>(
    () => ({
      query: debounced || undefined,
      state: stateAbbr,
      city: city && city !== 'all' ? city : undefined,
      provider_type_ids: typeSel ? [typeSel.id] : undefined,
      sort_by: sort,
      per_page: 20,
    }),
    [debounced, stateAbbr, city, typeSel, sort],
  );
  const searchEnabled = step === 'results' && !!stateAbbr;
  const search = useProviderSearch(params, searchEnabled);
  const headerCount = search.total;
  const countShown = useCountUp(headerCount, reduce);

  const types = useProviderTypes();

  // Honest coverage facets — counts come straight from the query layer (never
  // hardcoded). Options that would yield zero are disabled in each picker.
  const stateCounts = useStateCounts();
  const cityCounts = useCityCounts(stateAbbr);
  const typeCounts = useTypeCounts(stateAbbr, city ?? undefined);
  const stateTotal = stateAbbr ? stateCounts.data?.[stateAbbr] : undefined;

  const cityLabel = city === 'all' ? `All ${loc}` : city;
  const locLabel = loc ?? 'Near you';

  const enter = (ms = 0) => (reduce ? undefined : FadeIn.duration(280).delay(ms));

  const persist = (stateName: string | null, cityName: string | null) =>
    dl.setLocation({ stateName, stateAbbr: stateName ? (ABBR[stateName] ?? null) : null, city: cityName });

  const startType = (t: { id: string; label: string } | null) => {
    fireHaptic('tab');
    setTypeSel(t);
    if (loc) persist(loc, city);
    setStep('results');
  };

  const onUseLocation = async () => {
    const res = await requestAndGetCoords();
    if (res.status !== 'granted') {
      setStep('manual');
      return;
    }
    // Non-US device → the out-of-US state (the directory is US-only).
    if (res.countryCode && res.countryCode !== 'US') {
      setStep('outside');
      return;
    }
    // US: resolve the region to a state and search by it (no provider coordinates exist
    // for a radius search). Unresolvable region → fall back to manual state selection.
    const stateName = resolveStateName(res.region);
    if (stateName) {
      setLoc(stateName);
      setCity('all');
      persist(stateName, 'all');
      setStep('type');
    } else {
      setStep('manual');
    }
  };

  const isSaved = (id: string) => my.isSaved(id);
  // Save locally (no auth wall). Takes a denormalized snapshot so the My-providers
  // list can render + dial without re-fetching.
  const toggleSave = (input: SavedProviderInput) => {
    fireHaptic(my.isSaved(input.id) ? 'tab' : 'confirm');
    my.toggleSaved(input);
  };
  const cardSnapshot = (p: ProviderCardData): SavedProviderInput => ({
    id: p.id,
    name: cleanDisplayName(p.display_name) || p.display_name,
    credentials: p.credentials_suffix,
    typeLabel: p.provider_type_label,
    phone: p.phone,
    city: p.primary_city,
    state: p.primary_state,
  });

  const openSaved = () => setStep('saved');

  /* ============================ LOCATION ============================ */
  if (step === 'location')
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <Header onOpenSaved={openSaved} />
        <View className="px-5 pt-2">
          <Text className="font-display text-4xl text-text-primary dark:text-text-primary-dark mt-1.5 mb-2.5">Find care</Text>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-base leading-6 mb-2">Browse providers listed in the public NPI registry, licensed in your state. A listing is information, not a recommendation or endorsement by Psychage.</Text>
          <View className="h-[120px] items-center justify-center my-4 bg-surface-accent dark:bg-surface-accent-dark rounded-[18px]"><BadgeCheck size={30} color={teal} /></View>
          <Primary label="Use my location" onPress={onUseLocation} />
          <Tap onPress={() => setStep('manual')}><View className="py-4 items-center"><Text className="font-sans-bold text-base text-primary dark:text-primary-dark">Enter my state instead</Text></View></Tap>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-xs text-center mt-1.5">State sets who can legally see you. Change it anytime.</Text>
        </View>
      </SafeAreaView>
    );

  /* ============================ STATE ============================ */
  if (step === 'manual')
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <Header back={() => setStep('location')} onOpenSaved={openSaved} />
        <View className="px-5 flex-1">
          <Text className="font-display text-3xl text-text-primary dark:text-text-primary-dark mt-1.5 mb-2.5">Which state?</Text>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-base leading-6 mb-3.5">Providers are licensed by state. Coverage varies — some states have far fewer.</Text>
          <View className="flex-row items-center gap-2.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-4 py-4">
            <Search size={18} color={soft} /><TextInput placeholder="Search states" placeholderTextColor={faint} value={stateQ} onChangeText={setStateQ} className="flex-1 font-sans text-base text-text-primary dark:text-text-primary-dark" />
          </View>
          <FlashList
            className="mt-3"
            data={STATES.filter((s) => s.toLowerCase().includes(stateQ.toLowerCase()))}
            keyExtractor={(s) => s}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: s }) => {
              const abbr = ABBR[s];
              const count = stateCounts.data && abbr ? (stateCounts.data[abbr] ?? 0) : undefined;
              const disabled = count === 0;
              const row = (
                <View style={{ opacity: disabled ? 0.4 : 1 }} className="flex-row items-center justify-between py-4 border-b border-border dark:border-border-dark">
                  <Text className="font-sans text-text-primary dark:text-text-primary-dark text-base">{s}</Text>
                  <View className="flex-row items-center gap-2.5">
                    {count !== undefined ? <Text className="font-sans text-sm text-text-tertiary dark:text-text-tertiary-dark">{count > 0 ? count.toLocaleString() : 'None listed'}</Text> : null}
                    {!disabled ? <ChevronRight size={18} color={soft} /> : null}
                  </View>
                </View>
              );
              return disabled ? row : (
                <Tap onPress={() => { setLoc(s); setCity(null); setCityQ(''); setStep('city'); }}>{row}</Tap>
              );
            }}
            ListFooterComponent={
              <Tap onPress={() => setStep('outside')}>
                <View className="flex-row items-center justify-between py-4 mt-1"><Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-base">I'm outside the United States</Text><ChevronRight size={18} color={soft} /></View>
              </Tap>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    );

  /* ============================ CITY ============================ */
  if (step === 'city' && loc) {
    // Real cities for this state (with counts) — never a hardcoded hint list.
    const allCities = cityCounts.data ?? [];
    const cities = allCities.filter((c) => c.city.toLowerCase().includes(cityQ.toLowerCase()));
    const loadingCities = cityCounts.isLoading;
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <Header back={() => setStep('manual')} onOpenSaved={openSaved} />
        <View className="px-5 flex-1">
          <Chip label={loc} onPress={() => setStep('manual')} />
          <Text className="font-display text-3xl text-text-primary dark:text-text-primary-dark mt-3 mb-2.5">Which city?</Text>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-base leading-6 mb-3.5">Filter by practice location, or browse the whole state.</Text>
          <View className="flex-row items-center gap-2.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-4 py-4">
            <Search size={18} color={soft} /><TextInput placeholder={`Search cities in ${loc}`} placeholderTextColor={faint} value={cityQ} onChangeText={setCityQ} className="flex-1 font-sans text-base text-text-primary dark:text-text-primary-dark" />
          </View>
          {/* FlashList (like the state step): a state's city list can run 1000+ rows,
              which an unvirtualized ScrollView map would mount all at once. */}
          <FlashList
            className="mt-3"
            data={loadingCities ? [] : cities}
            keyExtractor={(c) => c.city}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: c }) => (
              <Tap onPress={() => { setCity(c.city); setStep('type'); }}>
                <View className="flex-row items-center justify-between py-4 border-b border-border dark:border-border-dark">
                  <Text className="font-sans text-text-primary dark:text-text-primary-dark text-base">{c.city}</Text>
                  <View className="flex-row items-center gap-2.5">
                    <Text className="font-sans text-sm text-text-tertiary dark:text-text-tertiary-dark">{c.count.toLocaleString()}</Text>
                    <ChevronRight size={18} color={soft} />
                  </View>
                </View>
              </Tap>
            )}
            ListHeaderComponent={
              <View>
                <Tap onPress={() => { setCity('all'); setStep('type'); }}>
                  <View className="flex-row items-center justify-between py-4 border-b border-border dark:border-border-dark">
                    <Text className="font-sans-medium text-text-primary dark:text-text-primary-dark text-base">All cities in {loc}</Text>
                    <View className="flex-row items-center gap-2.5">
                      {stateTotal !== undefined ? <Text className="font-sans text-sm text-text-tertiary dark:text-text-tertiary-dark">{stateTotal.toLocaleString()}</Text> : null}
                      <ChevronRight size={18} color={soft} />
                    </View>
                  </View>
                </Tap>
                {loadingCities ? <View className="pt-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}</View> : null}
              </View>
            }
            ListEmptyComponent={
              !loadingCities && cityQ ? (
                <View className="items-center py-8 px-4">
                  <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-sm text-center">No listed cities in {loc} match “{cityQ}”.</Text>
                  <Tap onPress={() => { setCity('all'); setStep('type'); }}><View className="py-3"><Text className="font-sans-bold text-base text-primary dark:text-primary-dark">Browse all of {loc}</Text></View></Tap>
                </View>
              ) : null
            }
            ListFooterComponent={<View className="h-4" />}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    );
  }

  /* ============================ TYPE ============================ */
  if (step === 'type') {
    const tc = typeCounts.data;
    const allTypesTotal = tc ? Object.values(tc).reduce((a, b) => a + b, 0) : undefined;
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <Header back={() => setStep(city ? 'city' : 'manual')} onOpenSaved={openSaved} />
        <View className="px-5 flex-1">
          <View className="flex-row gap-2">
            {loc ? <Chip label={loc} onPress={() => setStep('manual')} /> : null}
            {cityLabel ? <Chip label={cityLabel} onPress={() => setStep('city')} /> : null}
          </View>
          <Text className="font-display text-3xl text-text-primary dark:text-text-primary-dark mt-3 mb-2.5">What type of provider?</Text>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-base leading-6 mb-3.5">Provider type comes straight from the NPI registry.</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            <Tap onPress={() => startType(null)}>
              <View className="flex-row items-center justify-between border-[1.5px] border-border dark:border-border-dark rounded-2xl p-4 mb-3 bg-surface shadow-sm dark:shadow-none dark:bg-surface-dark">
                <View><Text className="font-sans-bold text-text-primary dark:text-text-primary-dark text-base">All provider types</Text><Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-sm">Browse everyone in {cityLabel ?? loc}{allTypesTotal !== undefined ? ` · ${allTypesTotal.toLocaleString()}` : ''}</Text></View>
                <ChevronRight size={18} color={soft} />
              </View>
            </Tap>
            {(types.data ?? []).map((t: ProviderType) => {
              const Icon = iconForType(t.slug);
              const count = tc ? (tc[t.id] ?? 0) : undefined;
              const disabled = count === 0;
              const inner = (
                <View key={t.id} style={{ opacity: disabled ? 0.4 : 1 }} className="flex-row items-center gap-3 border-[1.5px] border-border dark:border-border-dark rounded-2xl p-4 mb-3 bg-surface shadow-sm dark:shadow-none dark:bg-surface-dark">
                  <View className="w-[38px] h-[38px] rounded-[10px] bg-surface-accent dark:bg-surface-accent-dark items-center justify-center"><Icon size={18} color={teal} /></View>
                  <View className="flex-1"><Text className="font-sans-bold text-text-primary dark:text-text-primary-dark text-base">{t.label}</Text>{t.description ? <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-sm">{t.description}</Text> : null}</View>
                  {count !== undefined ? <Text className="font-sans text-sm text-text-tertiary dark:text-text-tertiary-dark">{count > 0 ? count.toLocaleString() : 'None'}</Text> : null}
                  {!disabled ? <ChevronRight size={18} color={soft} /> : null}
                </View>
              );
              return disabled ? <View key={t.id}>{inner}</View> : (
                <Tap key={t.id} onPress={() => startType({ id: t.id, label: t.label })}>{inner}</Tap>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  /* ============================ OUTSIDE US ============================ */
  // Reached when "Use my location" reverse-geocodes to a non-US country, or via the
  // manual "I'm outside the United States" option. A designed, warm state (mascot is
  // allowed here — this is a directory-coverage surface, not a crisis surface) that
  // still offers the full US directory and keeps crisis help one tap away.
  if (step === 'outside')
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <Header back={() => setStep('manual')} onOpenSaved={openSaved} />
        <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          <View className="items-center pt-3 pb-1"><Mascot state={MASCOT_CONTEXTUAL.findCareCta} size={132} /></View>
          <Text className="font-display text-3xl text-text-primary dark:text-text-primary-dark text-center mb-2.5">You're not in the U.S. right now</Text>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-base leading-6 text-center mb-6">Our provider directory lists NPI-registered providers in the United States only, for now. You can still browse every U.S. provider — and we're working to reach your country soon.</Text>
          <Primary label="Browse U.S. providers" onPress={() => setStep('manual')} />
          <Tap onPress={() => setStep('manual')}><View className="py-3.5 items-center"><Text className="font-sans-bold text-base text-primary dark:text-primary-dark">I'm actually in the U.S.</Text></View></Tap>
          <Tap accessibilityLabel="Help now" onPress={() => router.push('/crisis')}>
            <View className="flex-row items-center justify-center gap-1.5 mt-1 py-2">
              <LifeBuoy size={15} color={red} />
              <Text className="font-sans-medium text-sm text-error dark:text-error-dark">In crisis? See help options</Text>
            </View>
          </Tap>
        </ScrollView>
      </SafeAreaView>
    );

  /* ============================ PROFILE ============================ */
  if (step === 'profile' && activeId)
    return <ProfileStep id={activeId} onBack={() => setStep('results')} fireHaptic={fireHaptic} />;

  /* ============================ COMPARE ============================ */
  if (step === 'compare')
    return <CompareStep ids={compareIds.slice(0, 3)} onBack={() => setStep('results')} onRemove={(id) => my.remove(id)} />;

  /* ============================ MY PROVIDERS ============================ */
  // Saved providers in one place, each callable + markable as contacted (P30/P31/P32).
  if (step === 'saved')
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <Header back={() => setStep(loc ? 'type' : 'location')} title="My providers" hideMine />
        <ScrollView className="px-5 flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          {my.items.length === 0 ? (
            <View className="items-center pt-16 px-4">
              <View className="w-16 h-16 rounded-full bg-surface-active dark:bg-surface-active-dark border border-border/50 dark:border-border-dark/50 items-center justify-center mb-5"><Bookmark size={26} color={soft} /></View>
              <Text className="font-display text-2xl text-text-primary dark:text-text-primary-dark mb-2 text-center">No saved providers yet</Text>
              <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[15px] leading-6 text-center mb-6">Save providers from the directory to keep them here — ready to call in one place. You can also add one by hand.</Text>
            </View>
          ) : (
            <View className="pt-2 gap-3">
              {my.items.map((sp) => {
                const contacted = sp.contactedAt != null;
                const place = [sp.city, sp.state].filter(Boolean).join(', ');
                return (
                  <View key={sp.id} className="bg-surface dark:bg-surface-dark border border-border/40 dark:border-border-dark/30 rounded-[18px] p-4 gap-3">
                    <View className="flex-row items-start gap-3">
                      <View style={{ backgroundColor: colorFor(sp.id) }} className="w-[46px] h-[46px] rounded-full items-center justify-center"><Text className="font-sans-bold text-white">{initials(sp.name)}</Text></View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5 flex-wrap"><Text className="font-display text-lg text-text-primary dark:text-text-primary-dark">{sp.name}</Text>{sp.credentials ? <Text className="font-sans-medium text-text-secondary dark:text-text-secondary-dark text-[13px]">{sp.credentials}</Text> : null}</View>
                        {sp.typeLabel ? <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[13px] mt-0.5">{sp.typeLabel}</Text> : null}
                        {place ? <Text className="font-sans text-text-tertiary dark:text-text-tertiary-dark text-[13px] mt-0.5">{place}</Text> : null}
                      </View>
                      <Tap accessibilityLabel={`Remove ${sp.name}`} onPress={() => my.remove(sp.id)} activeScale={0.8}><View className="p-1.5"><Trash2 size={18} color={faint} /></View></Tap>
                    </View>
                    <View className="flex-row gap-2.5">
                      {sp.phone ? (
                        <Tap activeScale={0.97} onPress={() => { fireHaptic('confirm'); dial(telUrl(sp.phone as string)); }} style={{ flex: 1 }}>
                          <View style={{ backgroundColor: teal }} className="rounded-[13px] py-3 flex-row items-center justify-center gap-2"><Phone size={16} color="#fff" /><Text className="font-sans-bold text-white text-[15px]">Call</Text></View>
                        </Tap>
                      ) : null}
                      <Tap activeScale={0.97} onPress={() => { fireHaptic('tab'); my.setContacted(sp.id, !contacted); }} style={{ flex: 1 }}>
                        <View className={`rounded-[13px] py-3 flex-row items-center justify-center gap-2 border ${contacted ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/50' : 'bg-surface dark:bg-surface-dark border-border dark:border-border-dark'}`}>
                          {contacted ? <Check size={16} color={teal} /> : null}
                          <Text className={`font-sans-bold text-[15px] ${contacted ? 'text-teal-700 dark:text-teal-300' : 'text-text-primary dark:text-text-primary-dark'}`}>{contacted ? 'Contacted' : 'Mark contacted'}</Text>
                        </View>
                      </Tap>
                    </View>
                    {!sp.manual ? (
                      <Tap onPress={() => { setActiveId(sp.id); setStep('profile'); }}><View className="items-center"><Text className="font-sans-medium text-sm text-primary dark:text-primary-dark">View listing</Text></View></Tap>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
          <View className="mt-4"><Primary label="Add a provider manually" icon={<Plus size={18} color="#fff" />} onPress={() => setSheet('addProvider')} /></View>
        </ScrollView>
        <AddProviderSheet visible={sheet === 'addProvider'} onClose={() => setSheet(null)} onAdd={(name, phone) => { my.addManual({ name, phone }); setSheet(null); }} />
      </SafeAreaView>
    );

  /* ============================ RESULTS ============================ */
  const providers = search.providers;
  const loading = search.isLoading;

  const ListHeader = (
    <View className="bg-background dark:bg-background-dark pt-1 pb-2.5 border-b border-border dark:border-border-dark">
      <View className="flex-row gap-2 flex-wrap mb-2.5">
        <Chip label={locLabel} onPress={() => setStep('manual')} />
        {loc ? <Chip label={cityLabel ?? `All ${loc}`} onPress={() => setStep('city')} /> : null}
        <Chip label={typeSel ? typeSel.label : 'All types'} onPress={() => setStep('type')} />
      </View>
      <View className="flex-row items-center gap-2.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-3.5 py-2.5">
        <Search size={17} color={soft} /><TextInput placeholder="Search by name" placeholderTextColor={faint} value={query} onChangeText={setQuery} className="flex-1 font-sans text-base text-text-primary dark:text-text-primary-dark" />
        {query ? <Tap accessibilityLabel="Clear search" onPress={() => setQuery('')} className="p-2 -mr-2"><X size={16} color={soft} /></Tap> : null}
      </View>
      <View className="flex-row items-center justify-between mt-2.5">
        {loading ? (
          <Text className="font-sans-bold text-sm text-text-primary dark:text-text-primary-dark">Searching…</Text>
        ) : (
          <View className="flex-row items-center gap-1.5"><Text className="font-sans-bold text-sm text-text-primary dark:text-text-primary-dark">{countShown.toLocaleString()} listed</Text></View>
        )}
        <Tap onPress={() => setSheet('sort')}><View className="flex-row items-center gap-1.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-full px-3 py-1.5"><ArrowUpDown size={14} color={ink} /><Text className="font-sans-medium text-sm text-text-primary dark:text-text-primary-dark">Sort</Text></View></Tap>
      </View>
      <Text className="font-sans text-text-tertiary dark:text-text-tertiary-dark text-xs leading-4 mt-2.5">NPI-registry listings. Information, not a recommendation. Order is not a ranking of quality.</Text>
      {!loading && headerCount > 0 && headerCount <= 25 ? (
        <View className="flex-row gap-2 items-start bg-surface-active dark:bg-surface-active-dark rounded-xl px-3 py-2.5 mt-3">
          <Info size={15} color="#A9791F" />
          <Text className="font-sans text-sm text-text-primary dark:text-text-primary-dark leading-4 flex-1">Limited coverage in {cityLabel ?? loc} ({headerCount}). {city && city !== 'all' ? <Text onPress={() => setCity('all')} className="font-sans-bold text-warning dark:text-warning-dark underline">Browse all of {loc}</Text> : `That's the full count of NPI listings for ${loc}.`}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderCard = ({ item: p, index }: { item: ProviderCardData; index: number }) => {
    const sv = isSaved(p.id);
    const name = cleanDisplayName(p.display_name) || p.display_name;
    const place = [p.primary_city, p.primary_state].filter(Boolean).join(', ');
    const dist = p.distance_miles != null ? ` · ${p.distance_miles.toFixed(1)} mi` : '';
    return (
      <Animated.View entering={enter(Math.min(index * 40, 400))} layout={LinearTransition.springify().damping(20).stiffness(300)} className="mb-4">
        <Tap activeScale={0.97} onPress={() => { recordRecentlyViewed({ id: p.id, name, photoUrl: null }); setActiveId(p.id); setStep('profile'); }}>
          <View style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 16, elevation: isDark ? 0 : 3 }} className="flex-row bg-surface dark:bg-surface-dark border border-border/40 dark:border-border-dark/30 rounded-[20px] overflow-hidden">
            <View className="flex-1 flex-row gap-3.5 p-4">
              <View style={{ backgroundColor: colorFor(p.id) }} className="w-[52px] h-[52px] rounded-full items-center justify-center border-2 border-surface dark:border-surface-dark"><Text className="font-sans-bold text-white text-lg">{initials(name)}</Text></View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 flex-wrap"><Text className="font-display text-lg text-text-primary dark:text-text-primary-dark">{name}</Text>{p.credentials_suffix ? <Text className="font-sans-medium text-text-secondary dark:text-text-secondary-dark text-[13px]">{p.credentials_suffix}</Text> : null}</View>
                <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[14px] mt-0.5">{p.provider_type_label}</Text>
                <View className="flex-row items-center gap-2.5 mt-2.5 flex-wrap">
                  {place ? <View className="flex-row items-center gap-1.5"><MapPin size={13} color={soft} /><Text className="font-sans text-[13px] text-text-secondary dark:text-text-secondary-dark">{place}{dist}</Text></View> : null}
                  <View className="flex-row items-center gap-1 bg-surface-active dark:bg-surface-active-dark rounded-full px-2 py-0.5 border border-border/60 dark:border-border-dark/60"><Text className="font-sans-medium text-[12px] text-text-secondary dark:text-text-secondary-dark">NPI registry</Text></View>
                </View>
              </View>
            </View>
            <Tap onPress={() => toggleSave(cardSnapshot(p))} activeScale={0.8}><View className="px-4 h-full justify-start pt-4"><Bookmark size={22} color={sv ? teal : faint} fill={sv ? teal : 'transparent'} /></View></Tap>
          </View>
        </Tap>
      </Animated.View>
    );
  };

  const Empty = (
    <Animated.View entering={FadeIn.duration(400)} className="items-center px-6 pt-12">
      <View className="w-16 h-16 rounded-full bg-surface-active dark:bg-surface-active-dark border border-border/50 dark:border-border-dark/50 items-center justify-center mb-5"><Search size={28} color={soft} /></View>
      <Text className="font-display text-2xl text-text-primary dark:text-text-primary-dark mb-2.5 text-center">No providers match</Text>
      <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[15px] leading-6 text-center mb-6">{debounced ? `We couldn't find anyone matching “${debounced}” in ${cityLabel ?? locLabel}.` : `It looks like no providers of this type are listed in ${cityLabel ?? locLabel}.`}</Text>
      <View className="w-full gap-3">
        <Primary label={debounced ? 'Clear search' : 'Show all types'} onPress={() => (debounced ? setQuery('') : startType(null))} />
        {loc ? <Tap onPress={() => setCity('all')}><View className="py-4 items-center"><Text className="font-sans-bold text-base text-primary dark:text-primary-dark">Browse all of {loc}</Text></View></Tap> : null}
      </View>
    </Animated.View>
  );

  // Distinct from Empty: the search couldn't REACH the directory (RPC/connection
  // failure, now surfaced instead of silently showing "0 results"). Offers a retry.
  const ErrorState = (
    <Animated.View entering={FadeIn.duration(400)} className="items-center px-6 pt-12">
      <View className="w-16 h-16 rounded-full bg-surface-active dark:bg-surface-active-dark border border-border/50 dark:border-border-dark/50 items-center justify-center mb-5"><Info size={28} color={soft} /></View>
      <Text className="font-display text-2xl text-text-primary dark:text-text-primary-dark mb-2.5 text-center">Couldn't load providers</Text>
      <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[15px] leading-6 text-center mb-6">The directory didn't respond. This is usually a connection hiccup — please try again.</Text>
      <View className="w-full gap-3">
        <Primary label="Try again" onPress={() => void search.refetch()} />
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <Header back={() => setStep('type')} onOpenSaved={openSaved} />
      {/* Fixed header (chips + search + sort) — kept OUT of the list so the search
          box does not lose focus on every keystroke as the list re-renders. */}
      <View className="px-5">{ListHeader}</View>
      <View className="px-5 flex-1">
        {search.isError ? (
          ErrorState
        ) : loading ? (
          <View className="pt-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}</View>
        ) : (
          <FlashList
            data={providers}
            keyExtractor={(p) => p.id}
            renderItem={renderCard}
            ListEmptyComponent={Empty}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.5}
            onEndReached={() => { if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage(); }}
            ListHeaderComponent={<View className="h-3" />}
            ListFooterComponent={
              providers.length ? (
                <Text className="font-sans text-center py-2 text-text-secondary dark:text-text-secondary-dark text-xs">{search.hasNextPage ? 'Loading more…' : `That's everyone — ${providers.length} loaded.`}</Text>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 80, 28) }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {compareIds.length >= 2 && !loading ? (
        <Animated.View entering={enter()} style={{ bottom: Math.max(24, insets.bottom + 12) }} className="absolute left-[18px] right-[18px]">
          <Tap onPress={() => setStep('compare')}><View className="bg-primary rounded-[13px] py-4 flex-row items-center justify-center gap-1.5"><Text className="font-sans-bold text-white text-base">Compare {Math.min(compareIds.length, 3)} selected</Text><ChevronRight size={18} color="#fff" /></View></Tap>
        </Animated.View>
      ) : null}

      <SortSheet visible={sheet === 'sort'} value={sort} geo={false} onSelect={(v) => { setSort(v); setSheet(null); }} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

/* ----------------------------- profile step ----------------------------- */
const Row = React.memo(function Row({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  const { colorScheme } = useColorScheme();
  const soft = colorScheme === 'dark' ? colors.text.secondary.dark : colors.text.secondary.light;
  return (
    <View className="flex-row items-start gap-3"><View className="mt-1"><Icon size={17} color={soft} /></View><Text className="font-sans text-sm text-text-secondary dark:text-text-secondary-dark w-1/3 min-w-[90px] pr-2">{label}</Text><Text className="font-sans-medium text-sm text-text-primary dark:text-text-primary-dark flex-1 leading-5">{value}</Text></View>
  );
});
const ProfileStep = React.memo(function ProfileStep({ id, onBack, fireHaptic }: { id: string; onBack: () => void; fireHaptic: (e: 'affirm') => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const ink = isDark ? colors.text.primary.dark : colors.text.primary.light;
  const faint = isDark ? colors.text.tertiary.dark : colors.text.tertiary.light;
  const teal = isDark ? colors.teal[400] : colors.teal[600];
  const my = useMyProviders();
  const saved = my.isSaved(id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['providers', 'detail', id],
    queryFn: () => getProviderById(id),
    enabled: !!id,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <Animated.View entering={FadeIn.duration(300)} layout={LinearTransition} className="flex-1 bg-background dark:bg-background-dark pt-14">
      <View className="flex-row items-center px-5 pt-1 pb-2"><Tap activeScale={0.8} onPress={onBack}><View className="p-2 bg-surface-active dark:bg-surface-active-dark rounded-full"><ChevronLeft size={24} color={ink} /></View></Tap></View>
      {children}
    </Animated.View>
  );
  if (isLoading)
    return <Shell><View className="flex-1 items-center justify-center"><Text className="font-sans text-text-secondary dark:text-text-secondary-dark">Loading…</Text></View></Shell>;
  // Load failure (connection/RPC) is recoverable — offer a retry, distinct from a
  // genuine not-found (listing removed) which is not.
  if (isError)
    return (
      <Shell>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-center">This listing didn't load. Check your connection and try again.</Text>
          <Tap activeScale={0.97} onPress={() => void refetch()}>
            <View style={{ backgroundColor: teal }} className="rounded-[16px] px-6 py-3.5"><Text className="font-sans-bold text-white text-base">Try again</Text></View>
          </Tap>
        </View>
      </Shell>
    );
  if (!data)
    return <Shell><View className="flex-1 items-center justify-center px-8"><Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-center">This listing is unavailable. It may have been removed.</Text></View></Shell>;

  const p: ProviderWithDetails = data;
  const name = cleanDisplayName(p.display_name) || p.display_name;
  const locrow = p.locations.find((l) => l.is_primary) ?? p.locations[0] ?? null;
  const verified = formatVerified(p.verified_at);
  const badge = getTrustBadge({ status: p.status, verified_at: p.verified_at });
  const onToggleSave = () => {
    fireHaptic('affirm');
    my.toggleSaved({
      id: p.id,
      name,
      credentials: p.credentials_suffix,
      typeLabel: p.provider_type?.label ?? null,
      phone: p.phone,
      city: locrow?.city ?? null,
      state: locrow?.state_province ?? null,
    });
  };

  return (
    <Shell>
      <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
        <View className="items-center mt-2 mb-6">
          <Animated.View entering={FadeIn.delay(100).springify()} style={{ backgroundColor: colorFor(p.id) }} className="w-[88px] h-[88px] rounded-full items-center justify-center border-[3px] border-surface dark:border-surface-dark shadow-sm">
            <Text className="font-sans-bold text-white text-3xl">{initials(name)}</Text>
          </Animated.View>
          <Text className="font-display text-3xl text-text-primary dark:text-text-primary-dark text-center mt-4">{name}</Text>
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[15px] mt-1 text-center">{[p.provider_type?.label, p.credentials_suffix].filter(Boolean).join(' · ')}</Text>
          <View className="flex-row items-center mt-4">
             <Tap onPress={onToggleSave} activeScale={0.8}>
               <View className="flex-row items-center gap-2 bg-surface dark:bg-surface-dark border border-border/60 dark:border-border-dark/60 rounded-full px-4 py-2 shadow-sm dark:shadow-none">
                 <Bookmark size={18} color={saved ? teal : ink} fill={saved ? teal : 'transparent'} />
                 <Text className="font-sans-medium text-[14px] text-text-primary dark:text-text-primary-dark">{saved ? 'Saved' : 'Save'}</Text>
               </View>
             </Tap>
          </View>
        </View>

        {verified && (badge === 'verified') ? (
          <View className="flex-row items-center gap-2.5 bg-surface-active dark:bg-surface-active-dark border border-border/50 dark:border-border-dark/40 rounded-2xl px-4 py-3 mb-6">
            <FileText size={20} color={faint} />
            <Text className="font-sans text-[14px] text-text-primary dark:text-text-primary-dark flex-1">Listed in the NPI registry <Text className="text-text-secondary dark:text-text-secondary-dark">· data confirmed {verified}</Text></Text>
          </View>
        ) : null}

        <Text className="font-sans-bold text-base text-text-primary dark:text-text-primary-dark mb-3 px-1">Professional Details</Text>
        <View className="bg-surface dark:bg-surface-dark rounded-2xl border border-border/40 dark:border-border-dark/40 overflow-hidden mb-6 shadow-sm dark:shadow-none">
          <View className="px-4 py-1 gap-4 my-3">
            {p.npi_number ? <Row icon={Hash} label="NPI number" value={p.npi_number} /> : null}
            {p.provider_type?.label ? <Row icon={MessageSquare} label="Type" value={p.provider_type.label} /> : null}
            {p.license_number ? <Row icon={FileText} label="License" value={[p.license_number, p.license_state].filter(Boolean).join(' · ')} /> : null}
            {locrow?.city ? <Row icon={Building2} label="Practice city" value={[locrow.city, locrow.state_province].filter(Boolean).join(', ')} /> : null}
            {p.phone ? <Row icon={Phone} label="Phone" value={p.phone} /> : null}
          </View>
        </View>

        <View className="bg-surface-active/50 dark:bg-surface-active-dark/50 rounded-2xl p-4 mb-2">
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-[13px] leading-5">This listing is drawn from the NPI registry. It's information, not a recommendation or endorsement by Psychage. Please confirm license, availability, and fit directly with the provider.</Text>
        </View>
        <View className="h-24" />
      </ScrollView>

      <View style={{ shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: isDark ? 0 : 0.03, shadowRadius: 12, elevation: 10 }} className="px-5 pt-4 pb-6 bg-surface dark:bg-surface-dark border-t border-border/30 dark:border-border-dark/30 gap-3">
        {p.phone ? (
          <Tap activeScale={0.97} onPress={() => { fireHaptic('affirm'); dial(telUrl(p.phone as string)); }}>
            <View style={{ backgroundColor: teal }} className="rounded-[16px] py-4 flex-row items-center justify-center gap-2.5 shadow-sm">
              <Phone size={18} color="#fff" />
              <Text className="font-sans-bold text-white text-[17px]">Call {p.phone}</Text>
            </View>
          </Tap>
        ) : null}
        <Tap activeScale={0.97} onPress={() => router.push({ pathname: '/add-provider', params: { name, ...(p.phone ? { contact: p.phone } : {}) } })}>
          <View className="rounded-[16px] py-4 items-center bg-surface-active dark:bg-surface-active-dark"><Text className="font-sans-bold text-[17px] text-text-primary dark:text-text-primary-dark">Share my check-ins with this provider</Text></View>
        </Tap>
        <Text className="font-sans text-text-tertiary dark:text-text-tertiary-dark text-xs text-center leading-4">Puts together a summary of your recent check-ins to share. Psychage never contacts them for you.</Text>
      </View>
    </Shell>
  );
});

/* ----------------------------- compare step ----------------------------- */
const CompareStep = React.memo(function CompareStep({ ids, onBack, onRemove }: { ids: string[]; onBack: () => void; onRemove: (id: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const ink = isDark ? colors.text.primary.dark : colors.text.primary.light;
  const teal = isDark ? colors.teal[400] : colors.teal[600];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['providers', 'compare', ids],
    queryFn: async () => {
      // Settled per-id: one transient failure must not discard the columns that DID
      // load. Only when nothing loads at all do we throw (→ retryable error state).
      const settled = await Promise.allSettled(ids.map((id) => getProviderById(id)));
      const rows = settled
        .filter((r): r is PromiseFulfilledResult<ProviderWithDetails | null> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((r): r is ProviderWithDetails => r != null);
      if (rows.length === 0 && settled.some((r) => r.status === 'rejected')) {
        throw new Error('Saved providers could not be loaded.');
      }
      return rows;
    },
    enabled: ids.length > 0,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
  const C = ({ l, v }: { l: string; v: string }) => (
    <View className="py-2 border-t border-border dark:border-border-dark"><Text className="font-sans-bold text-[11px] text-text-tertiary dark:text-text-tertiary-dark uppercase tracking-wide">{l}</Text><Text className="font-sans text-sm text-text-primary dark:text-text-primary-dark mt-0.5">{v}</Text></View>
  );
  if (isLoading)
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center justify-between px-5 pt-1 pb-2"><Tap onPress={onBack}><View className="p-2.5"><ChevronLeft size={24} color={ink} /></View></Tap><Text className="font-sans-bold text-base text-text-primary dark:text-text-primary-dark">Compare</Text><View className="w-8" /></View>
        <View className="flex-1 items-center justify-center"><Text className="font-sans text-text-secondary dark:text-text-secondary-dark">Loading…</Text></View>
      </SafeAreaView>
    );
  // Load failure (connection/RPC) is recoverable — offer a retry instead of a
  // permanently blank compare screen (mirrors ProfileStep's error state).
  if (isError)
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center justify-between px-5 pt-1 pb-2"><Tap onPress={onBack}><View className="p-2.5"><ChevronLeft size={24} color={ink} /></View></Tap><Text className="font-sans-bold text-base text-text-primary dark:text-text-primary-dark">Compare</Text><View className="w-8" /></View>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-center">These listings didn't load. Check your connection and try again.</Text>
          <Tap activeScale={0.97} onPress={() => void refetch()}>
            <View style={{ backgroundColor: teal }} className="rounded-[16px] px-6 py-3.5"><Text className="font-sans-bold text-white text-base">Try again</Text></View>
          </Tap>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-5 pt-1 pb-2"><Tap onPress={onBack}><View className="p-2.5"><ChevronLeft size={24} color={ink} /></View></Tap><Text className="font-sans-bold text-base text-text-primary dark:text-text-primary-dark">Compare</Text><View className="w-8" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {(data ?? []).map((p) => {
          const name = cleanDisplayName(p.display_name) || p.display_name;
          const locrow = p.locations.find((l) => l.is_primary) ?? p.locations[0] ?? null;
          return (
            <View key={p.id} className="w-[180px] bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl p-3.5">
              <View style={{ backgroundColor: colorFor(p.id) }} className="w-[46px] h-[46px] rounded-full items-center justify-center self-center mb-2"><Text className="font-sans-bold text-white">{initials(name)}</Text></View>
              <Text className="font-sans-bold text-text-primary dark:text-text-primary-dark text-base text-center">{name}</Text>
              <Text className="font-sans text-text-secondary dark:text-text-secondary-dark text-xs text-center mb-3">{p.credentials_suffix ?? ' '}</Text>
              <C l="Type" v={p.provider_type?.label ?? '—'} />
              <C l="License" v={[p.license_number, p.license_state].filter(Boolean).join(' · ') || '—'} />
              <C l="NPI listing" v={formatVerified(p.verified_at) ? `Confirmed ${formatVerified(p.verified_at)}` : '—'} />
              <Tap onPress={() => onRemove(p.id)}><View className="py-2 mt-1.5 items-center"><Text className="font-sans-bold text-primary dark:text-primary-dark text-sm">Remove</Text></View></Tap>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
});

/* ----------------------------- sheets ----------------------------- */
function SortSheet({ visible, value, geo, onSelect, onClose }: { visible: boolean; value: string; geo: boolean; onSelect: (v: 'relevance' | 'name' | 'distance') => void; onClose: () => void }) {
  const { colorScheme } = useColorScheme();
  const ink = colorScheme === 'dark' ? colors.text.primary.dark : colors.text.primary.light;
  const teal = colorScheme === 'dark' ? colors.teal[400] : colors.teal[600];
  const opts: [string, string][] = [['relevance', 'Relevance'], ...(geo ? ([['distance', 'Nearest']] as [string, string][]) : []), ['name', 'Name A–Z']];
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(300)} className="bg-background dark:bg-background-dark rounded-t-[32px] pt-3 pb-8 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          <View className="w-12 h-1.5 bg-border dark:bg-border-dark rounded-full self-center mb-4" />
          <View className="flex-row items-center justify-between px-6 pb-4 border-b border-border/40 dark:border-border-dark/40">
            <View className="w-10" />
            <Text className="font-display text-xl text-text-primary dark:text-text-primary-dark">Sort Providers</Text>
            <Tap activeScale={0.8} onPress={onClose}><View className="p-2 bg-surface-active dark:bg-surface-active-dark rounded-full"><X size={20} color={ink} /></View></Tap>
          </View>
          <View className="px-6 pt-3 gap-2">
            {opts.map(([v, l]) => (
              <Tap key={v} activeScale={0.96} onPress={() => onSelect(v as any)}>
                <View className={`flex-row items-center justify-between py-4 px-5 rounded-2xl border ${value === v ? 'border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-900/10' : 'border-border/30 dark:border-border-dark/30 bg-surface dark:bg-surface-dark'}`}>
                  <Text className={`font-sans-medium text-[16px] ${value === v ? 'text-teal-700 dark:text-teal-300' : 'text-text-primary dark:text-text-primary-dark'}`}>{l}</Text>
                  {value === v ? <Check size={20} color={teal} /> : null}
                </View>
              </Tap>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Manual provider entry (P30 "enter provider info") — name + optional phone saved to
// the local My-providers list. For a provider not in the NPI directory (e.g. an
// existing therapist) so they're callable alongside the rest.
function AddProviderSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (name: string, phone: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const ink = isDark ? colors.text.primary.dark : colors.text.primary.light;
  const faint = isDark ? colors.text.tertiary.dark : colors.text.tertiary.light;
  const teal = isDark ? colors.teal[400] : colors.teal[600];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => {
    if (!visible) {
      setName('');
      setPhone('');
    }
  }, [visible]);
  const canAdd = name.trim().length > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(300)} className="bg-background dark:bg-background-dark rounded-t-[32px] pt-3 pb-8 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          <View className="w-12 h-1.5 bg-border dark:bg-border-dark rounded-full self-center mb-4" />
          <View className="flex-row items-center justify-between px-6 pb-4 border-b border-border/40 dark:border-border-dark/40">
            <View className="w-10" />
            <Text className="font-display text-xl text-text-primary dark:text-text-primary-dark">Add a provider</Text>
            <Tap activeScale={0.8} onPress={onClose}><View className="p-2 bg-surface-active dark:bg-surface-active-dark rounded-full"><X size={20} color={ink} /></View></Tap>
          </View>
          <View className="px-6 pt-4 gap-3">
            <View className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-4 py-3.5">
              <TextInput placeholder="Name" placeholderTextColor={faint} value={name} onChangeText={setName} className="font-sans text-base text-text-primary dark:text-text-primary-dark" />
            </View>
            <View className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-4 py-3.5">
              <TextInput placeholder="Phone (optional)" placeholderTextColor={faint} value={phone} onChangeText={setPhone} keyboardType="phone-pad" className="font-sans text-base text-text-primary dark:text-text-primary-dark" />
            </View>
            <Tap activeScale={0.96} onPress={canAdd ? () => onAdd(name.trim(), phone.trim()) : undefined}>
              <View style={{ backgroundColor: teal, opacity: canAdd ? 1 : 0.45 }} className="rounded-[16px] py-4 items-center mt-1"><Text className="font-sans-bold text-white text-[17px]">Add to my providers</Text></View>
            </Tap>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
