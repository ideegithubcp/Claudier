# SwipeRight — Card Optimizer

## What this project is
A PWA credit card optimizer. User enters a vendor name (or uses GPS nearby)
and gets ranked card recommendations from their personal wallet.

## File structure
- index.html       — HTML shell only (no inline CSS or JS)
- app.css          — all styles
- js/app.js        — entry point, window.* bindings, init (ES module)
- js/config.js     — GOOGLE_PLACES_API_KEY, constants
- js/storage.js    — loadS / saveS (localStorage helpers)
- js/state.js      — shared mutable state object
- js/data.js       — loadData, refreshData, setDataStatus, checkAutoRefresh
- js/search.js     — fuzzy search, renderResults, buildQuick, quickPick
- js/places.js     — GPS, Google Maps JS API, fetchNearbyPlaces
- js/wallet.js     — wallet render, add/remove/export/import, modals
- js/overrides.js  — catalog card override modal
- js/ui.js         — toast, switchTab, clock, PWA install, helpers
- cards.json       — card catalog (94 cards, current as of June 2026)
- vendors.json     — vendor DB with fuzzy search support
- sw.js            — service worker (cache v8, network-first for HTML+JSON)
- manifest.json    — PWA manifest

## Key architecture decisions
- No build step, no npm — native ES modules (type="module"), deploys to Netlify via GitHub Actions
- localStorage for wallet (sr_wallet, sr_custom, sr_card_overrides)
- Fuzzy search: trigram similarity + Levenshtein distance (norm() function)
- Card overrides: user edits stored in sr_card_overrides, survive data refresh
- Google Places API key set in GOOGLE_PLACES_API_KEY constant in index.html
- Service worker cache name: swiperight-v8

## Data model
- CARD_CATALOG: loaded from cards.json at runtime
- myCardIds: array of card IDs the user owns (from catalog)
- customCards: user-added cards not in catalog (stored as objects)
- cardOverrides: {cardId: {af, earn, tip, cats}} — user corrections to catalog cards
- VENDOR_DB: loaded from vendors.json, each entry has names[], cat, icon, recs[]

## Current version: v4
Annual fees are current as of June 2026:
- Amex Gold: $325 (raised from $250 in Oct 2024)
- Amex Platinum: $895 (raised from $695 in Jan 2026)
- Chase Sapphire Reserve: $795 (raised from $550 in June 2025)
- Capital One Venture X: $395

## GitHub repo
https://github.com/ideegithubcp/Claudier
Branch: feature/version3
Deployed on Netlify