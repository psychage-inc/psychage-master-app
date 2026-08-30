// Manual jest mock for @shopify/flash-list (activated via jest.mock in
// jest.setup.js). The real FlashList's ViewHolder layout pass throws under
// react-test-renderer, leaving no queryable children. This renders a plain View
// that maps data → renderItem, or renders the empty-state component when there is
// no data, so list content (including empty-state intros) is assertable in tests.
const React = require('react');
const { View } = require('react-native');

// Each item is wrapped in a View carrying `flashlist-item-type:<type>` so tests can
// assert the recycle-pool type a list assigns per row (getItemType) — a real FlashList
// recycles cells across rows of the same type, so a list of mixed rows must key them.
function FlashList({ data, renderItem, ListEmptyComponent, keyExtractor, getItemType, testID }) {
  const items = data ?? [];
  let body;
  if (items.length === 0) {
    if (React.isValidElement(ListEmptyComponent)) {
      body = ListEmptyComponent;
    } else if (ListEmptyComponent) {
      body = React.createElement(ListEmptyComponent);
    } else {
      body = null;
    }
  } else {
    body = items.map((item, index) =>
      React.createElement(
        View,
        {
          key: keyExtractor ? keyExtractor(item, index) : index,
          testID: `flashlist-item-type:${getItemType ? String(getItemType(item, index)) : 'default'}`,
        },
        renderItem({ item, index }),
      ),
    );
  }
  return React.createElement(View, { testID }, body);
}

module.exports = { FlashList };
