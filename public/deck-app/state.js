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
};

export function setState(updates) {
  Object.assign(state, updates);
}
