export const state = {
  selectedExpansion: null,
  selectedClass: null,
  selectedLevel: 1,
  builds: [],
  activeBuild: null,
  lastPlayed: null,

  view: null, // 'build' or 'play'

  // deck building
  builtHand: [],
  handSize: 10,

  // gameplay zones
  cardsInHand: [],
  cardsDiscarded: [],
  cardsLost: [],
  cardsActive: []

};
