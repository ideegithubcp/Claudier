import { state } from './state.js';

export const CC_CATS = [
  'Dining', 'Grocery', 'Gas', 'Travel', 'Streaming', 'Utilities',
  'Wireless', 'Shopping', 'Drugstore', 'Entertainment', 'Rent',
  'Catch-all', 'Balance Transfer', 'Other',
];

export function applyOverrides(c) {
  const ov = state.cardOverrides[c.id];
  if (!ov) return c;
  return {
    ...c,
    af: ov.af !== undefined ? ov.af : c.af,
    tip: ov.tip || c.tip,
    cats: ov.cats?.length ? ov.cats : c.cats,
    earn: ov.earn || c.earn,
    _hasOverride: true,
  };
}

export function allWalletCards() {
  const catalog = state.CARD_CATALOG.filter(c => state.myCardIds.includes(c.id)).map(applyOverrides);
  return [...catalog, ...state.customCards];
}
