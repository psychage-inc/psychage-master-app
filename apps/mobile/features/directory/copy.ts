// CT4 FIXTURE — Provider Directory copy (S26 list + S27 detail). NOT final copy.
// Framing is strictly INFORMATIONAL / non-clinical: no "we recommend", no "verified
// by Psychage", no booking language the web doesn't carry. Clinically reviewed
// before ship (root CLAUDE.md §7).
const FIXTURE = 'FIXTURE — not final copy' as const;

export const DIRECTORY_COPY = {
  _fixture: 'CT4' as const,
  _marker: FIXTURE,

  // List (S26)
  title: 'Provider directory',
  searchPlaceholder: 'Search by name, specialty, or place',
  searchAccessibilityLabel: 'Search the provider directory',
  filtersButton: 'Filters',
  emptyPrompt: 'Search or add a filter to browse the directory.',
  recentlyViewed: 'Recently viewed',
  scopeAllStates: 'All states',
  editScope: 'Change location',

  // Sort (order, not a ranking of quality). Maps to search_providers_v3 sort_by.
  sortButton: 'Sort',
  sortTitle: 'Sort',
  sortNote: 'Sorting changes order only. It is not a ranking of quality.',
  sortRelevance: 'Relevance',
  sortName: 'Name (A–Z)',

  // Thin-coverage banner (real total). CT-pending.
  coverageNote: (place: string, n: number) => `Limited coverage in ${place} (${n}).`,
  coverageAction: 'Browse all states',

  // Specialty quick-suggestions under the search box.
  searchSpecialtyHint: (label: string) => `Search ${label}`,

  // Compare (saved providers, side by side). Up to 3. CT-pending.
  compareTitle: 'Compare',
  compareCta: (n: number) => `Compare ${n} saved`,
  compareEmptyTitle: 'Nothing to compare yet',
  compareEmptyBody: 'Save two or three providers to compare them side by side.',
  compareRemove: 'Remove',
  compareCap: 'Comparing your 3 most recently saved.',
  fieldType: 'Type',
  fieldLocation: 'Location',
  fieldModality: 'Modality',
  fieldVerified: 'NPI listing',
  none: '—',
  noResults: 'No providers match these filters.',
  emptyTitle: 'No providers match',
  emptyClearSearch: 'Clear search',
  emptyWiden: 'Browse all states',
  droppedState: 'No match in that state — showing the city instead.',
  resultCount: (n: number) => `${n.toLocaleString()} ${n === 1 ? 'provider' : 'providers'}`,
  loadingMore: 'Loading more…',
  disclaimer: 'A listing is information, not a recommendation. Psychage does not vet or endorse providers.',

  // Badges (mirror the provider's own registry/claim state — NEVER a Psychage
  // endorsement or vetting; P33). "Verified" was removed because it read as Psychage
  // vouching for the provider; the data is simply sourced from the public NPI registry.
  badgeVerified: 'NPI registry',
  badgeClaimed: 'Claimed',
  badgeUnclaimed: 'Listed',
  telehealth: 'Telehealth',
  inPerson: 'In person',
  acceptingPatients: 'Accepting new patients',

  // Provenance / credentials (detail). Informational — provider's own registry
  // data, not a Psychage endorsement. CT-pending.
  credentialsTitle: 'Credentials & registry listing',
  npiLabel: 'NPI',
  licenseLabel: 'License',
  npiSource: 'Listed from the NPI registry',
  lastConfirmed: (when: string) => `Last confirmed ${when}`,

  // Detail (S27)
  about: 'About',
  specialties: 'Specialties',
  languages: 'Languages',
  insurance: 'Insurance',
  locations: 'Location',
  contact: 'Contact',
  call: 'Call',
  website: 'Website',
  directions: 'Directions',
  email: 'Email',
  booking: 'Booking page',
  // Action that opens the share-with-a-provider flow. Worded to say plainly what it
  // does (the old "Use in my therapist record" read as "am I the therapist / did I
  // sign up?"). Final copy is Dr. Dobson-reviewed.
  useAsTherapist: 'Share my check-ins with this provider',
  shareClarifier:
    'Puts together a summary of your recent check-ins that you can share with them. Psychage never contacts them for you.',
  notFoundTitle: 'Provider unavailable',
  notFoundBody: 'This listing could not be loaded. It may have been removed.',
} as const;
