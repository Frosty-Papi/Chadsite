export const state = {
  selectedExpansion: null,
  selectedClass: null,
  selectedLevel: 1,
  builds: [],
  activeBuild: null,
  lastPlayed: null,

  view: 'build', // 'build' or 'play'

  // deck building
  builtHand: [],

  // gameplay zones
  cardsInHand: [],
  cardsDiscarded: [],
  cardsLost: [],
  cardsActive: []
};
