# Deck plain JS migration plan

## Goal
Rebuild the legacy deck application as a CSP-safe plain JavaScript app without losing gameplay functionality.

## Keep and reuse
- `views/deck/js/database_*.js`
- `views/deck/js/abilities.js`
- `views/deck/js/modifiers.js`
- `views/deck/js/gear.js`
- `views/deck/js/enhancements.js`
- `views/deck/js/battlegoals.js`
- image/data assets under `views/deck/data`

## Replace
- Runtime Vue template in `views/deck/index.ejs`
- Inline styles and handlers
- Runtime Vue compiler dependency

## App architecture
- `public/deck-app/app.js` boot file
- `public/deck-app/state.js` single source of truth
- `public/deck-app/store.js` cookie/import/export helpers
- `public/deck-app/render.js` DOM rendering helpers
- `public/deck-app/events.js` delegated event handlers
- `public/deck-app/sections/*.js` section renderers for play, abilities, modifiers, gear, enhancement

## Migration phases
1. Boot shell and shared state
2. Load databases and options
3. Port play/home screen
4. Port abilities and class selection
5. Port modifiers and gear
6. Port enhancements and battle goals
7. Port modals/import/export
8. Remove legacy Vue deck page

## Compatibility requirements
- Keep cookie data format whenever possible
- Keep imported/exported JSON format
- Keep class, gear, modifier, and ability data files untouched
- Keep drag/drop interactions using Sortable where needed
