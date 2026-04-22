export const state = {
  menu: 'home',
  turn: 1,
  level: 1,
  dark: true,
  abilities: [],
  modifiers: [],
  gear: [],
  abilitiesChosen: [],
  modifiersChosen: [],
  gearChosen: [],
};

export function setState(updates) {
  Object.assign(state, updates);
}
