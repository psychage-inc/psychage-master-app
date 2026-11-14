import { fireEvent, screen } from '@testing-library/react-native';

import { SortSheet } from '@/features/directory/SortSheet';

import { renderWithProviders } from './_helpers';

describe('SortSheet', () => {
  it('offers relevance and name only — never a distance sort', () => {
    renderWithProviders(<SortSheet visible value="relevance" onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('sort-relevance')).toBeTruthy();
    expect(screen.getByTestId('sort-name')).toBeTruthy();
    expect(screen.queryByTestId('sort-distance')).toBeNull();
    expect(screen.queryByText('Nearest')).toBeNull();
  });

  it('reports the chosen option', () => {
    const onSelect = jest.fn();
    renderWithProviders(<SortSheet visible value="relevance" onSelect={onSelect} onClose={() => {}} />);
    fireEvent.press(screen.getByTestId('sort-name'));
    expect(onSelect).toHaveBeenCalledWith('name');
  });
});
