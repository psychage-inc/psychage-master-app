import { screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

// Drive the two server-state hooks directly (the repo + react-query wiring is
// covered elsewhere); assigned per test before render.
let mockGuide: { data: unknown; isLoading: boolean };
let mockArticles: { data: unknown; isLoading: boolean };
jest.mock('@/lib/conditions/hooks', () => ({
  useConditionGuide: () => mockGuide,
  useConditionArticles: () => mockArticles,
}));

import { ConditionArticlesView } from '@/features/conditions/ConditionArticlesView';
import { CONDITIONS_COPY } from '@/features/conditions/copy';

import { renderWithProviders } from './_helpers';

// PR-068 regression: while the guide query resolved, the (disabled) articles query
// reported isLoading=false, flashing "no articles yet" under a blank '' title — and
// a garbage slug showed the same blank empty state forever instead of a not-found.
describe('ConditionArticlesView', () => {
  it('shows the loader (not the empty state) while the guide is still resolving', () => {
    mockGuide = { data: undefined, isLoading: true };
    mockArticles = { data: undefined, isLoading: false };
    renderWithProviders(<ConditionArticlesView slug="anxiety" />);

    expect(screen.getByLabelText('Loading articles')).toBeTruthy();
    expect(screen.queryByText(CONDITIONS_COPY.articlesEmpty)).toBeNull();
    expect(screen.queryByTestId('condition-articles-not-found')).toBeNull();
  });

  it('shows a real not-found state when the guide resolves to nothing (garbage slug)', () => {
    mockGuide = { data: null, isLoading: false };
    mockArticles = { data: undefined, isLoading: false };
    renderWithProviders(<ConditionArticlesView slug="not-a-real-slug" />);

    expect(screen.getByTestId('condition-articles-not-found')).toBeTruthy();
    expect(screen.getByText(CONDITIONS_COPY.notFound)).toBeTruthy();
    expect(screen.queryByText(CONDITIONS_COPY.articlesEmpty)).toBeNull();
    // Crisis stays reachable on the fallback (SR-2).
    expect(screen.getByLabelText('Help now')).toBeTruthy();
  });

  it('keeps the loader while the articles query itself is loading after the guide resolved', () => {
    mockGuide = { data: { id: 'c1', name: 'Test Condition' }, isLoading: false };
    mockArticles = { data: undefined, isLoading: true };
    renderWithProviders(<ConditionArticlesView slug="anxiety" />);

    expect(screen.getByLabelText('Loading articles')).toBeTruthy();
    expect(screen.queryByText(CONDITIONS_COPY.articlesEmpty)).toBeNull();
  });

  it('shows the empty-state copy only once both queries have settled with no articles', () => {
    mockGuide = { data: { id: 'c1', name: 'Test Condition' }, isLoading: false };
    mockArticles = { data: [], isLoading: false };
    renderWithProviders(<ConditionArticlesView slug="anxiety" />);

    expect(screen.getByText(CONDITIONS_COPY.articlesEmpty)).toBeTruthy();
    expect(screen.queryByLabelText('Loading articles')).toBeNull();
    expect(screen.queryByTestId('condition-articles-not-found')).toBeNull();
  });
});
