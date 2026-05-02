export const state = {
  view: 'build',

  selectedClass: null,

  cardsInHand: [],
  cardsDiscarded: [],
  cardsDestroyed: [],
  cardsOnBoard: [],

  enhancements: {},
  selectedCards: [],
  turn: 1,
  initiative: null,
  turnPhase: 'select', // select | order | resolve
  orderedCards: [],
  selectedLevel: 1
};
