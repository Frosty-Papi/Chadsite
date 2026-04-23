export const state = {
  menu: 'home',
  dark: true,
  modal: null,

  expansion: 'vanilla',
  availableExpansions: ['vanilla', 'frosthaven', 'jotl', 'crimsonscales', 'trailofashes'],

  hasEnabledCardExchange: false,
  hasEnabledModifierDisplay: false,
  hasEnabledCurses: true,
  hasEnabledSaveGameplayData: true,

  abilities: [],
  abilityCategory: null,

  modifiers: [],
  modifiersBase: [],
  modifiersSpecial: [],

  allGear: [],
  battleGoals: [],
  classIcons: {},

  classNames: {},
  modifierCategory: null,

  perks: [],
  perkDefinitions: [],

  enhancementCatalog: [],
  enhancementSelections: {},
  enhancementEditingCard: null,

  level: 1,
  className: null,
  abilitiesChosen: [],

  turn: 1,
  cardsInHand: [],
  cardsDiscarded: [],
  cardsDestroyed: [],
  cardsOnBoard: [],
  twoAbilitiesSelected: [],
  isRestDisabled: true,

  pendingShortRestLoss: null,
  longRestSelection: null,

  boardCardMeta: {},

  modifiersChosen: [],
  modifiersDrawPile: [],
  modifiersDiscardPile: [],
  lastDrawnModifier: null,
  blessings: 0,
  curses: 0,

  gearChosen: [],
  gearCategoryIndex: null,

  battleGoalsDrawn: [],
  battleGoalPicked: [],
  goalCounter: 0,

  acceptedCard: null,
  cardExchangePool: [],

  specialClassMode: null,
  specialClassValue: 0,
};

export function setState(updates) {
  Object.assign(state, updates);
}
