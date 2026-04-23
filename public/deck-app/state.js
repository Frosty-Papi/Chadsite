export const state = {
  menu: 'home',
  turn: 1,
  level: 1,
  dark: true,
  abilities: [],
  modifiers: [],
  gear: [],

  abilityCategory: null,
  abilitiesChosen: [],

  cardsInHand: [],
  cardsDiscarded: [],
  cardsDestroyed: [],
  cardsOnBoard: [],

  twoAbilitiesSelected: [],

  modifiersBase: [],
  modifiersSpecial: [],
  modifiersChosen: [],
  modifiersDrawPile: [],
  modifiersDiscardPile: [],
  lastDrawnModifier: null,
  blessings: 0,
  curses: 0,

  allGear: [],
  gearChosen: [],
  gearCategoryIndex: null,

  battleGoals: [],
  battleGoalsDrawn: [],
  battleGoalPicked: [],
  goalCounter: 0,
};

export function setState(updates) {
  Object.assign(state, updates);
}
