import { state } from './state.js';

const STORAGE_KEY = 'deck_modern_state_v5';
const AUTOSAVE_MS = 5000;

const CURSE_NAME = 'curse';
const BLESS_NAME = 'bless';
const NULL_NAME = 'am-p-19';
const TWO_X_NAME = 'am-p-20';
const SANCTUARY_NAME_PREFIX = 'cs-am-sa-';

let autosaveTimer = null;

/* -------------------------
 A SSET HELPERS                                    *
 -------------------------- */

function deckAsset(path) {
  return `/deck-assets/${path}`;
}

function deckData(path) {
  return deckAsset(`data/${path}`);
}

function cardImg(card) {
  return deckData(card.image);
}

function escapeHtml(value) {
  return String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* -------------------------
 E XPANSION DATABASE LOADING                       *
 Exact mapping from legacy main.js
 -------------------------- */

function normalizeAvailableExpansions() {
  state.availableExpansions = [
    'vanilla',
    'jotl',
    'frosthaven',
    'crimsonscales',
    'trailofashes',
  ];
  if (!state.expansion || !state.availableExpansions.includes(state.expansion)) {
    state.expansion = 'vanilla';
  }
}

function loadDatabaseVersion(version) {
  state.expansion = version;

  switch (version) {
    case 'vanilla':
      state.classNames = window.classNames || {};
      state.modifiers = window.attack_modifiers_categories || [];
      state.abilities = window.abilities || [];
      state.allGear = window.allItems || [];
      break;

    case 'jotl':
      state.classNames = window.classNames_jotl || {};
      state.modifiers = window.attack_modifiers_categories_jotl || [];
      state.abilities = window.abilities_jotl || [];
      state.allGear = window.allItems_jotl || [];
      break;

    case 'frosthaven':
      state.classNames = window.classNames_frosthaven || {};
      state.modifiers = window.attack_modifiers_categories_frosthaven || [];
      state.abilities = window.abilities_frosthaven || [];
      state.allGear = window.allItems_frosthaven || [];
      break;

    case 'crimsonscales':
      state.classNames = window.classNames_cs || {};
      state.modifiers = window.attack_modifiers_categories_cs || [];
      state.abilities = window.abilities_cs || [];
      state.allGear = deepClone(window.allItems_cs || []);
      // legacy normalizes first gear category names
      if (state.allGear?.[0]?.items) {
        state.allGear[0].items.forEach(g => {
          g.name = g.name.replace(/\d+/g, '');
          g.name = g.name.replace('-', '');
          g.name = g.name.replaceAll('-', ' ');
        });
      }
      break;

    case 'trailofashes':
      state.classNames = window.classNames_toa || {};
      state.modifiers = window.attack_modifiers_categories_toa || [];
      state.abilities = window.abilities_toa || [];
      // legacy code appears to set addGear instead of allGear; modern app fixes that typo intentionally
      state.allGear = window.allItems_toa || [];
      break;

    default:
      state.expansion = 'vanilla';
      state.classNames = window.classNames || {};
      state.modifiers = window.attack_modifiers_categories || [];
      state.abilities = window.abilities || [];
      state.allGear = window.allItems || [];
      break;
  }
}

function loadDatabase() {
  normalizeAvailableExpansions();

  loadDatabaseVersion(state.expansion);

  state.modifiersSpecial = [];
  if (Array.isArray(window.attack_modifiers_special)) {
    state.modifiersSpecial = [...window.attack_modifiers_special];
  }

  if (
    state.expansion === 'crimsonscales' &&
    window.attack_modifiers_special_cs &&
    !state.modifiersSpecial.includes(window.attack_modifiers_special_cs)
  ) {
    state.modifiersSpecial.push(window.attack_modifiers_special_cs);
  }

  state.modifiersBase = Array.isArray(window.attack_modifiers_base)
  ? window.attack_modifiers_base
  : [];

  state.modifiersChosen = [];
  state.modifiersBase.forEach(cat => {
    (cat.cards || []).forEach(modif => {
      state.modifiersChosen.push(modif);
    });
  });
  state.modifiersDrawPile = state.modifiersChosen.slice();
  state.modifiersDiscardPile = [];
  state.lastDrawnModifier = null;

  state.battleGoals = window.battle_goals || [];

  buildEnhancementCatalog();
  buildPerkDefinitions();
}

function loadXEnvelope() {
  if (!state.hasOpenedXEnvelope) {
    if (window.XEnvelopeModifiers) {
      state.modifiers.push(window.XEnvelopeModifiers);
    }
    if (window.XEnvelopeAbilities) {
      state.abilities.push(window.XEnvelopeAbilities);
    }
    state.hasOpenedXEnvelope = true;
  }
}

/* -------------------------
 R EMOTE DATA                                      *
 -------------------------- */

async function loadRemoteData() {
  try {
    const [bgRes, ciRes] = await Promise.all([
      fetch('/api/deck/battle-goals').then(r => r.json()).catch(() => ({ battleGoals: [] })),
                                             fetch('/api/deck/class-icons').then(r => r.json()).catch(() => ({ classIcons: {} })),
    ]);

    if (Array.isArray(bgRes?.battleGoals) && bgRes.battleGoals.length) {
      state.battleGoals = bgRes.battleGoals;
    }
    state.classIcons = ciRes?.classIcons || {};
  } catch (err) {
    console.error(err);
  }
}

/* -------------------------
 L OOKUPS                                          *
 -------------------------- */

function flatGear() {
  return state.allGear.flatMap(c => c.items || []);
}

function allModifierCards() {
  return [
    ...state.modifiersBase.flatMap(c => c.cards || []),
    ...state.modifiersSpecial.flatMap(c => c.cards || []),
    ...state.modifiers.flatMap(c => c.cards || []),
  ];
}

function getClassCode(category) {
  if (!category) return null;
  const sample = category.cards?.[0]?.image || '';
  const match = sample.match(/([a-z]{2})-/i);
  return match ? match[1].toLowerCase() : '';
}

function findAbilityByName(name) {
  for (const cat of state.abilities) {
    const found = (cat.cards || []).find(c => c.name === name);
    if (found) return found;
  }
  return null;
}

function findModifierByName(name) {
  return allModifierCards().find(c => c.name === name) || null;
}

function findGearByName(name) {
  return flatGear().find(i => i.name === name) || null;
}

function findBattleGoalByName(name) {
  return state.battleGoals.find(g => g.name === name) || null;
}

function getBoardMeta(card) {
  if (!state.boardCardMeta[card.name]) {
    state.boardCardMeta[card.name] = {
      duration: card.duration ?? 0,
      numberOfTimesUsed: card.numberOfTimesUsed ?? 0,
    };
  }
  return state.boardCardMeta[card.name];
}

function syncCardFromBoardMeta(card) {
  const meta = getBoardMeta(card);
  card.duration = meta.duration;
  card.numberOfTimesUsed = meta.numberOfTimesUsed;
}

function syncBoardMetaFromCard(card) {
  state.boardCardMeta[card.name] = {
    duration: card.duration ?? 0,
    numberOfTimesUsed: card.numberOfTimesUsed ?? 0,
  };
}

/* -------------------------
 S AVE / LOAD                                      *
 Mirrors legacy split between build data and gameplay data
 -------------------------- */

function buildData() {
  const abilityCategoryName = state.abilityCategory?.name || null;

  return {
    abilityCategoryName,
    abilitiesChosen: state.abilitiesChosen.map(card => ({
      name: card.name,
      top: card.top,
      bottom: card.bottom,
    })),
    modifiersChosen: state.modifiersChosen.map(mod => ({ name: mod.name })),
    gearChosen: state.gearChosen.map(gear => ({ name: gear.name })),
    classDisplayed: state.classDisplayed || [],
    level: state.level,
    options: {
      hasEnabledModifierDisplay: state.hasEnabledModifierDisplay,
      hasEnabledCardExchange: state.hasEnabledCardExchange,
      hasOpenedXEnvelope: !!state.hasOpenedXEnvelope,
      hasEnabledCurses: state.hasEnabledCurses,
      version: state.expansion,
      dark: state.dark,
      hasEnabledSaveGameplayData: state.hasEnabledSaveGameplayData,
    },
  };
}

function buildGameplayData() {
  return {
    turn: state.turn,
    twoAbilitiesSelected: state.twoAbilitiesSelected.map(c => ({ name: c.name })),
    cardsInHand: state.cardsInHand.map(c => ({ name: c.name })),
    cardsDestroyed: state.cardsDestroyed.map(c => ({ name: c.name })),
    cardsDiscarded: state.cardsDiscarded.map(c => ({ name: c.name })),
    cardsOnBoard: state.cardsOnBoard.map(c => ({
      name: c.name,
      numberOfTimesUsed: c.numberOfTimesUsed ?? 0,
    })),
    battleGoalsDrawn: state.battleGoalsDrawn.map(g => ({ name: g.name })),
    battleGoalPicked: state.battleGoalPicked.map(g => ({ name: g.name })),
    goalCounter: state.goalCounter,
    gear: state.gearChosen.map(item => ({
      name: item.name,
      played: !!item.played,
      lost: !!item.lost,
      used: item.used ?? 0,
    })),
    modifiersDrawPile: state.modifiersDrawPile.map(c => ({ name: c.name })),
    modifiersDiscardPile: state.modifiersDiscardPile.map(c => ({ name: c.name })),
    lastDrawnModifier: state.lastDrawnModifier ? { name: state.lastDrawnModifier.name } : null,
    blessingsGameplayData: state.blessings,
    cursesGameplayData: state.curses,
  };
}

function saveAllState() {
  const payload = {
    build: buildData(),
    gameplay: buildGameplayData(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function saveStateMaybe() {
  if (!state.hasEnabledSaveGameplayData) return;
  saveAllState();
}

function exportState() {
  const payload = {
    build: buildData(),
    gameplay: buildGameplayData(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gloomhaven-deck_export.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importStateFile(file) {
  file.text().then(value => {
    try {
      const parsed = JSON.parse(value);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Could not import data file.');
    }
  });
}

function loadBuildData(data) {
  if (!data) return;

  if (data.abilityCategoryName != null) {
    state.abilities.forEach(ability => {
      if (ability.name === data.abilityCategoryName) {
        displayAbilities(ability);
        if (state.abilityCategory) state.abilityCategory.hidden = false;
      }
    });
  }

  if (data.abilitiesChosen != null) {
    state.abilitiesChosen = [];
    data.abilitiesChosen.forEach(ability => {
      state.abilities.forEach(cat => {
        (cat.cards || []).forEach(card => {
          if (card.name === ability.name) {
            if (ability.top != null) card.top = ability.top;
            if (ability.bottom != null) card.bottom = ability.bottom;
            state.abilitiesChosen.push(card);
          }
        });
      });
    });
  }

  if (data.modifiersChosen != null) {
    state.modifiersChosen = [];
    data.modifiersChosen.forEach(modifier => {
      state.modifiersBase.forEach(cat => {
        (cat.cards || []).forEach(card => {
          if (card.name === modifier.name) state.modifiersChosen.push(card);
        });
      });

      state.modifiersSpecial.forEach(cat => {
        (cat.cards || []).forEach(card => {
          if (card.name === modifier.name) state.modifiersChosen.push(card);
        });
      });

      state.modifiers.forEach(cat => {
        (cat.cards || []).forEach(card => {
          if (card.name === modifier.name) state.modifiersChosen.push(card);
        });
      });
    });
    state.modifiersDrawPile = state.modifiersChosen.slice();
  }

  if (data.gearChosen != null) {
    state.gearChosen = [];
    data.gearChosen.forEach(gear => {
      state.allGear.forEach(cat => {
        (cat.items || []).forEach(item => {
          if (gear.name === item.name) state.gearChosen.push(item);
        });
      });
    });
  }

  if (data.classDisplayed != null) {
    state.classDisplayed = data.classDisplayed;
    state.abilities.forEach(ab => {
      if (state.classDisplayed.includes(ab.name)) {
        ab.hidden = false;
      }
    });
  }

  if (data.level != null) {
    state.level = data.level;
  }

  if (data.options) {
    if (data.options.hasEnabledModifierDisplay != null) {
      state.hasEnabledModifierDisplay = data.options.hasEnabledModifierDisplay;
    }
    if (data.options.hasEnabledCardExchange != null) {
      state.hasEnabledCardExchange = data.options.hasEnabledCardExchange;
    }
    if (data.options.hasOpenedXEnvelope) {
      loadXEnvelope();
    }
    if (data.options.hasEnabledCurses != null) {
      state.hasEnabledCurses = data.options.hasEnabledCurses;
    }
    if (data.options.version != null) {
      state.expansion = data.options.version;
    }
    if (data.options.dark != null) {
      state.dark = data.options.dark;
    }
    if (data.options.hasEnabledSaveGameplayData != null) {
      state.hasEnabledSaveGameplayData = data.options.hasEnabledSaveGameplayData;
    }
  }

  // legacy behavior: after loading build data, start a new game
  newGame();
}

function loadGameplayData(data) {
  if (!data) return;

  if (data.turn != null) {
    state.turn = data.turn;
  }

  const abilityLookup = (list) =>
  (list || []).map(entry => findAbilityByName(entry.name)).filter(Boolean);

  state.twoAbilitiesSelected = abilityLookup(data.twoAbilitiesSelected);
  state.cardsInHand = abilityLookup(data.cardsInHand);
  state.cardsDestroyed = abilityLookup(data.cardsDestroyed);
  state.cardsDiscarded = abilityLookup(data.cardsDiscarded);

  state.cardsOnBoard = [];
  (data.cardsOnBoard || []).forEach(entry => {
    const card = findAbilityByName(entry.name);
    if (card) {
      if (entry.numberOfTimesUsed != null) card.numberOfTimesUsed = entry.numberOfTimesUsed;
      card.duration = -1;
      state.cardsOnBoard.push(card);
      syncBoardMetaFromCard(card);
    }
  });

  state.battleGoalsDrawn = (data.battleGoalsDrawn || [])
  .map(entry => findBattleGoalByName(entry.name))
  .filter(Boolean);

  state.battleGoalPicked = (data.battleGoalPicked || [])
  .map(entry => findBattleGoalByName(entry.name))
  .filter(Boolean);

  if (data.goalCounter != null) {
    state.goalCounter = data.goalCounter;
  }

  (data.gear || []).forEach(savedGear => {
    state.gearChosen.forEach(item => {
      if (savedGear.name === item.name) {
        item.played = savedGear.played;
        item.lost = savedGear.lost;
        item.used = savedGear.used;
      }
    });
  });

  if (data.modifiersDrawPile != null) {
    state.modifiersDrawPile = [];
    data.modifiersDrawPile.forEach(modifier => {
      state.modifiersChosen.forEach(card => {
        if (card.name === modifier.name) state.modifiersDrawPile.push(card);
      });
    });
  }

  if (data.modifiersDiscardPile != null) {
    state.modifiersDiscardPile = [];
    data.modifiersDiscardPile.forEach(modifier => {
      state.modifiersChosen.forEach(card => {
        if (card.name === modifier.name) state.modifiersDiscardPile.push(card);
      });
    });
  }

  if (data.lastDrawnModifier != null) {
    state.lastDrawnModifier = null;
    state.modifiersChosen.forEach(card => {
      if (card.name === data.lastDrawnModifier.name) {
        state.lastDrawnModifier = card;
      }
    });
  }

  if (data.blessingsGameplayData != null) state.blessings = data.blessingsGameplayData;
  if (data.cursesGameplayData != null) state.curses = data.cursesGameplayData;

  recomputeRestDisabled();
}

function loadStoredState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);

    // accept legacy single-object shape or split build/gameplay shape
    if (parsed.build || parsed.gameplay) {
      if (parsed.build?.options?.version) {
        state.expansion = parsed.build.options.version;
        loadDatabase();
      }
      loadBuildData(parsed.build);
      if (state.hasEnabledSaveGameplayData && parsed.gameplay) {
        loadGameplayData(parsed.gameplay);
      }
    } else {
      // fallback for older localStorage versions
      if (parsed.expansion) {
        state.expansion = parsed.expansion;
        loadDatabase();
      }
      if (parsed.build || parsed.gameplay) return;
    }
  } catch (err) {
    console.error(err);
  }
}

/* -------------------------
 S TATE UTILS                                      *
 -------------------------- */

function recomputeRestDisabled() {
  state.isRestDisabled = state.cardsDiscarded.length < 2;
}

function moveCard(card, from, to) {
  const i = from.indexOf(card);
  if (i !== -1) from.splice(i, 1);
  if (!to.includes(card)) to.push(card);
}

function removeFromZone(zone, card) {
  const i = zone.indexOf(card);
  if (i !== -1) zone.splice(i, 1);
}

function resetGearItem(item) {
  item.played = false;
  item.lost = false;
  item.used = 0;
}

/* -------------------------
 M ENU / APP OPTIONS                               *
 -------------------------- */

function setMenu(menu) {
  state.menu = menu;
  render();
}

function swapMode() {
  state.dark = !state.dark;
  render();
}

function setExpansion(expansion) {
  state.expansion = expansion;
  loadDatabase();

  state.classChosen = false;
  state.abilityCategory = null;
  state.abilitiesChosen = [];
  state.cardsInHand = [];
  state.cardsOnBoard = [];
  state.cardsDiscarded = [];
  state.cardsDestroyed = [];
  state.twoAbilitiesSelected = [];
  state.boardCardMeta = {};

  state.gearChosen = [];
  state.battleGoalsDrawn = [];
  state.battleGoalPicked = [];
  state.goalCounter = 0;

  state.className = '';
  state.modifierCategory = null;
  state.specialClassMode = '';
  state.specialClassValue = 0;
  state.acceptedCard = null;

  render();
}

/* -------------------------
 C LASS / ABILITIES                                *
 Exact mappings from abilities.js
 -------------------------- */

function displayAbilities(param) {
  const switchingToDifferentClass =
  state.abilityCategory &&
  state.abilityCategory.name !== param.name;

  if (switchingToDifferentClass) {
    const hasExistingDeck =
    state.abilitiesChosen.length > 0 ||
    state.cardsInHand.length > 0 ||
    state.cardsDiscarded.length > 0 ||
    state.cardsDestroyed.length > 0 ||
    state.cardsOnBoard.length > 0;

    if (hasExistingDeck) {
      const confirmed = window.confirm(
        'Switching classes will clear your current deck and related play state. Continue?'
      );

      if (!confirmed) {
        return;
      }
    }

    state.abilitiesChosen = [];
    state.cardsInHand = [];
    state.cardsDiscarded = [];
    state.cardsDestroyed = [];
    state.cardsOnBoard = [];
    state.twoAbilitiesSelected = [];
    state.boardCardMeta = {};
    state.cardToEnhance = null;
    state.enhancementEditingCard = null;
    state.acceptedCard = null;
    state.turn = 1;
  }

  state.classChosen = true;

  if (state.abilityCategory === param) {
    state.abilityCategory = null;
    state.classChosen = false;
  } else {
    displayModifiers(param.name);
    state.abilityCategory = param;
    state.abilityCategory.cards.sort((a, b) => a.level - b.level);
    state.className = getClassCode(param);
    buildPerkDefinitions();
  }

  recomputeRestDisabled();
  render();
}

function displayAbilitiesToExchange(param) {
  if (state.chosenCardExchanger === param) {
    state.chosenCardExchanger = null;
  } else {
    state.chosenCardExchanger = param;
  }
  render();
}

function addAbility(card) {
  card.duration = 0;
  if (!state.abilitiesChosen.includes(card)) {
    if (state.abilitiesChosen.length < (state.abilityCategory?.max || 0)) {
      state.abilitiesChosen.push(card);
      state.cardsInHand.push(card);
    } else {
      alert('You have selected the maximum number of ability cards this class can take into battle.');
    }
  } else {
    removeAbility(card);
  }
  recomputeRestDisabled();
  render();
}

function acceptAbility(card) {
  card.duration = 0;
  if (!state.cardsInHand.includes(card)) {
    state.cardsInHand.push(card);
  }
  recomputeRestDisabled();
  render();
}

function removeAbility(card) {
  removeFromZone(state.abilitiesChosen, card);
  removeAbilityFromBoard(card);
  recomputeRestDisabled();
  render();
}

function removeAbilityFromBoard(card) {
  if (state.cardsInHand.includes(card)) {
    removeFromZone(state.cardsInHand, card);
    if (state.twoAbilitiesSelected.includes(card)) {
      removeFromZone(state.twoAbilitiesSelected, card);
    }
  } else if (state.cardsDestroyed.includes(card)) {
    removeFromZone(state.cardsDestroyed, card);
  } else if (state.cardsDiscarded.includes(card)) {
    removeFromZone(state.cardsDiscarded, card);
  } else if (state.cardsOnBoard.includes(card)) {
    removeFromZone(state.cardsOnBoard, card);
  }
}

function initShortRest() {
  state.rerolling = false;
  let cardIndexToDestroy = getRandomInt(state.cardsDiscarded.length);

  while (
    state.cardToLose != null &&
    cardIndexToDestroy === state.cardsDiscarded.findIndex(element => element === state.cardToLose)
  ) {
    cardIndexToDestroy = getRandomInt(state.cardsDiscarded.length);
  }

  state.cardToLose = state.cardsDiscarded[cardIndexToDestroy];
  initRest();
  openModal('shortRest');
}

function initLongRest() {
  if (state.cardsDiscarded.length < 2) {
    alert('You need at least 2 discarded cards to long rest.');
    return;
  }

  state.cardToLose = null;
  state.longRestSelection = null;

  openModal('longRest');
}

function initRest() {
  state.cardsToRestore = [];
  state.cardsDiscarded.forEach(element => {
    if (element !== state.cardToLose) {
      state.cardsToRestore.push(element);
    }
  });
}

function reroll() {
  initShortRest();
  state.rerolling = true;
}

function rest() {
  removeFromZone(state.cardsDiscarded, state.cardToLose);
  state.cardsDestroyed.push(state.cardToLose);

  state.cardsDiscarded.forEach(card => {
    state.cardsInHand.push(card);
  });

  state.cardsDiscarded = [];
  state.rerolling = false;
  state.cardToLose = null;
  recomputeRestDisabled();
}

function longRest() {
  rest();

  state.turn += 1;
  updateOnBoardCards();

  state.gearChosen.forEach(gear => {
    if (gear.played && !gear.lost) {
      gear.played = false;
    }
  });

  closeModal();

  if (state.cardsInHand.length < 2) {
    alert('You do not have enough cards in your hand to continue.');
  }
  render();
}

function pickCardToLoseLongRest(card) {
  state.cardToLose = card;
  state.longRestSelection = card;
  initRest();
  render();
}

function pickCard(card) {
  if (state.twoAbilitiesSelected.includes(card)) {
    cancelCard(card);
  } else if (state.twoAbilitiesSelected.length < 2) {
    state.twoAbilitiesSelected.push(card);
  }
  render();
}

function cancelCard(card) {
  removeFromZone(state.twoAbilitiesSelected, card);
  render();
}

function fetchCard(card) {
  if (state.cardsDestroyed.includes(card)) {
    removeFromZone(state.cardsDestroyed, card);
  } else if (state.cardsDiscarded.includes(card)) {
    removeFromZone(state.cardsDiscarded, card);
  }
  state.cardsInHand.push(card);
  recomputeRestDisabled();
  render();
}

function destroyCard(card) {
  if (card.canBeExchanged) {
    removeAbility(card);
  } else {
    cancelCard(card);
    state.cardsDestroyed.push(card);

    if (state.cardsInHand.includes(card)) {
      removeFromZone(state.cardsInHand, card);
    } else if (state.cardsDiscarded.includes(card)) {
      removeFromZone(state.cardsDiscarded, card);
    } else if (state.cardsOnBoard.includes(card)) {
      removeFromZone(state.cardsOnBoard, card);
    }
    recomputeRestDisabled();
    render();
  }
}

function playCard(card) {
  state.cardsDiscarded.push(card);
  removeFromZone(state.cardsInHand, card);
}

function discardOnBoardItem(card) {
  removeFromZone(state.cardsOnBoard, card);
  state.cardsDiscarded.push(card);
  card.duration = 0;
  syncBoardMetaFromCard(card);
  recomputeRestDisabled();
  render();
}

function useCard(card) {
  card.numberOfTimesUsed = (card.numberOfTimesUsed || 0) + 1;
  syncBoardMetaFromCard(card);
  render();
}

function keepAbilityOneTurn(card) {
  card.duration = 1;
  syncBoardMetaFromCard(card);
  state.cardsOnBoard.push(card);
  removeFromZone(state.cardsDiscarded, card);
  recomputeRestDisabled();
  render();
}

function keepAbilityManyTurns(card) {
  card.duration = -1;
  card.numberOfTimesUsed = 0;
  syncBoardMetaFromCard(card);
  state.cardsOnBoard.push(card);
  removeFromZone(state.cardsDiscarded, card);
  recomputeRestDisabled();
  render();
}

function updateOnBoardCards() {
  for (let i = state.cardsOnBoard.length - 1; i >= 0; i--) {
    const card = state.cardsOnBoard[i];
    card.duration--;
    syncBoardMetaFromCard(card);
    if (card.duration === 0) {
      state.cardsDiscarded.push(card);
      state.cardsOnBoard.splice(i, 1);
    }
  }
}

function play() {
  if (state.twoAbilitiesSelected.length !== 2) {
    if (state.abilitiesChosen.length === 0) {
      alert('You need to build you deck in the Abilities section.');
    } else {
      alert('You have to select two cards.');
    }
    return;
  }

  state.twoAbilitiesSelected.forEach(card => {
    if (card.canBeExchanged) {
      // legacy used cardsInHand.pop(card), which is a JS bug.
      // This modern port preserves the intended rule: exchanged cards are not discarded.
      removeFromZone(state.cardsInHand, card);
    } else {
      playCard(card);
    }
  });

  state.twoAbilitiesSelected = [];
  updateOnBoardCards();
  state.turn++;
  state.shortRestMode = false;
  roundEndShuffle();
  recomputeRestDisabled();
  render();
}

/* -------------------------
 M ODIFIERS                                        *
 Exact mappings from modifiers.js
 -------------------------- */

function displayModifiers(param) {
  state.className = param;
  if (state.modifierCategory === param) {
    state.modifierCategory = null;
  } else {
    state.modifierCategory = param;
  }
}

function checkIfNull(card) {
  return (card && card.name === NULL_NAME) || false;
}

function checkIfTwoX(card) {
  return (card && card.name === TWO_X_NAME) || false;
}

function checkIfCurse(card) {
  const curseSet = state.modifiersSpecial.find(element => element.name === CURSE_NAME);
  return (curseSet?.cards || []).includes(card) || false;
}

function checkIfSanctuary(card) {
  const sanctuaryCards = state.modifiersSpecial.find(element => element.name.startsWith(SANCTUARY_NAME_PREFIX));
  if (sanctuaryCards != null) {
    return sanctuaryCards.cards.includes(card);
  }
  return false;
}

function checkIfBlessing(card) {
  const blessSet = state.modifiersSpecial.find(element => element.name === BLESS_NAME);
  return ((blessSet?.cards || []).includes(card) || checkIfSanctuary(card)) || false;
}

function checkIfCurseOrBless(card) {
  return checkIfCurse(card) || checkIfBlessing(card);
}

function addModifier(card) {
  if (!state.modifiersChosen.includes(card)) {
    state.modifiersChosen.push(card);
    state.modifiersDrawPile.push(card);

    if (checkIfCurse(card)) state.curses++;
    if (checkIfBlessing(card)) state.blessings++;
  } else {
    removeModifier(card);
  }
  render();
}

function removeModifier(card) {
  state.modifiersChosen = state.modifiersChosen.filter(c => c !== card);
  state.modifiersDrawPile = state.modifiersDrawPile.filter(c => c !== card);

  if (checkIfCurse(card)) state.curses--;
  if (checkIfBlessing(card)) state.blessings--;
  render();
}

function drawModifier() {
  if (!state.modifiersDrawPile.length) return;

  if (state.lastDrawnModifier != null) {
    state.modifiersDiscardPile.unshift(state.lastDrawnModifier);
  }

  state.lastDrawnModifier = state.modifiersDrawPile[0];

  if (checkIfCurseOrBless(state.lastDrawnModifier)) {
    removeModifier(state.lastDrawnModifier);
  } else {
    state.modifiersDrawPile.splice(0, 1);
  }
  render();
}

function roundEndShuffle() {
  const filtered = state.modifiersDiscardPile.filter(card => checkIfNull(card) || checkIfTwoX(card));
  if (checkIfNull(state.lastDrawnModifier) || checkIfTwoX(state.lastDrawnModifier) || filtered.length > 0) {
    shuffleModifiersDeck();
  }
}

function shuffleModifiersDeck() {
  state.modifiersDrawPile = state.modifiersChosen.slice();
  shuffleDeck();
  state.lastDrawnModifier = null;
  state.modifiersDiscardPile = [];
  updateBlessCurseCounts();
  render();
}

function shuffleDeck() {
  for (let i = state.modifiersDrawPile.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.modifiersDrawPile[i], state.modifiersDrawPile[j]] = [state.modifiersDrawPile[j], state.modifiersDrawPile[i]];
  }
}

function switchModifierClass() {
  state.modifierCategory = null;
  state.className = '';
  state.modifiersChosen = state.modifiersBase.flatMap(cat => cat.cards || []).slice();
  state.modifiersDrawPile = state.modifiersChosen.slice();
  state.modifiersDiscardPile = [];
  state.lastDrawnModifier = null;
  updateBlessCurseCounts();
  render();
}

function addBlessing() {
  const blessingSet = state.modifiersSpecial.find(element => element.name === BLESS_NAME);
  const availableBlessings = (blessingSet?.cards || []).filter(element => !state.modifiersDrawPile.includes(element));
  if (availableBlessings.length > 0) addModifier(availableBlessings[0]);
  shuffleDeck();
  render();
}

function addCurse() {
  const curseSet = state.modifiersSpecial.find(element => element.name === CURSE_NAME);
  const availableCurses = (curseSet?.cards || []).filter(element => !state.modifiersDrawPile.includes(element));
  if (availableCurses.length > 0) addModifier(availableCurses[0]);
  shuffleDeck();
  render();
}

function resetModifiers() {
  const hasTempCards = state.modifiersDrawPile.filter(card => checkIfCurseOrBless(card)).length > 0;
  if (hasTempCards) {
    const confirmed = window.confirm('Do you want to remove the blessing and curse cards from your modifiers deck ?');
    if (confirmed) {
      [...state.modifiersDrawPile].forEach(card => {
        if (checkIfCurseOrBless(card)) {
          removeModifier(card);
        }
      });
    }
  }
  shuffleModifiersDeck();
  state.blessings = getBlessings();
  state.curses = getCurses();
  render();
}

function getBlessings() {
  return state.modifiersDrawPile.filter(element => checkIfBlessing(element)).length;
}

function getCurses() {
  return state.modifiersDrawPile.filter(element => checkIfCurse(element)).length;
}

function updateBlessCurseCounts() {
  state.blessings = getBlessings();
  state.curses = getCurses();
}

/* -------------------------
 P ERKS                                            *
 Exact engine hook; class-specific definitions still need legacy source
 -------------------------- */

function buildPerkDefinitions() {
  // Placeholder engine definitions.
  // Replace with exact class-specific mappings from legacy perk source when located.
  state.perkDefinitions = [];
}

function rebuildModifiersFromPerks() {
  state.modifiersChosen = state.modifiersBase.flatMap(cat => cat.cards || []).slice();
  state.modifiersDrawPile = state.modifiersChosen.slice();
  state.modifiersDiscardPile = [];
  state.lastDrawnModifier = null;
  state.perks.forEach(() => {
    // apply class-specific perk mutations here once sourced
  });
  updateBlessCurseCounts();
}

function togglePerk(perkId) {
  const idx = state.perks.indexOf(perkId);
  if (idx === -1) state.perks.push(perkId);
  else state.perks.splice(idx, 1);

  rebuildModifiersFromPerks();
  render();
}

/* -------------------------
 G EAR                                             *
 Exact mappings from gear.js
 -------------------------- */

function displayGearCategory(cat) {
  if (state.gearCategory == null) {
    state.gearCategory = cat;
  } else {
    state.gearCategory = null;
  }
  render();
}

function addGear(item) {
  restoreItem(item);
  if (!state.gearChosen.includes(item)) {
    state.gearChosen.push(item);
  } else {
    removeGear(item);
  }
  render();
}

function removeGear(item) {
  const index = state.gearChosen.indexOf(item);
  if (index >= 0) state.gearChosen.splice(index, 1);
  render();
}

function looseItem(item) {
  item.played = true;
  item.lost = true;
  item.used = 0;
  render();
}

function tapItem(item) {
  item.played = true;
  item.lost = false;
  item.used = 0;
  render();
}

function restoreItem(item) {
  item.played = false;
  item.lost = false;
  item.used = 0;
  render();
}

function useItem(item) {
  if (item.used == null) item.used = 1;
  else item.used += 1;
  render();
}

function addItemById(idRaw) {
  const id = parseInt(idRaw, 10);
  let found = false;
  state.allGear.forEach(cat => {
    (cat.items || []).forEach(item => {
      if ((item.points + 1) === id) {
        addGear(item);
        found = true;
      }
    });
  });
  if (!found) {
    alert('Invalid ID');
  }
}

/* -------------------------
 B ATTLE GOALS                                     *
 Exact mappings from battlegoals.js
 -------------------------- */

function drawBattleGoals() {
  state.battleGoalsDrawn = [];
  state.battleGoalPicked = [];

  let randomint = getRandomInt(state.battleGoals.length);
  let randomint2 = getRandomInt(state.battleGoals.length);
  while (randomint === randomint2) {
    randomint2 = getRandomInt(state.battleGoals.length);
  }
  state.battleGoalsDrawn.push(state.battleGoals[randomint]);
  state.battleGoalsDrawn.push(state.battleGoals[randomint2]);
  render();
}

function pickBattleGoal(battleGoal) {
  state.battleGoalsDrawn = [];
  state.battleGoalPicked = [];
  state.battleGoalPicked.push(battleGoal);
  state.goalCounter = 0;
  render();
}

function incrementGoalCounter() {
  state.goalCounter += 1;
  render();
}

function resetBattlegoals() {
  state.battleGoalsDrawn = [];
  state.battleGoalPicked = [];
  state.goalCounter = 0;
  render();
}

/* -------------------------
 E NHANCEMENTS                                     *
 Exact mappings from enhancements.js
 -------------------------- */

function buildEnhancementCatalog() {
  const categories = window.enhancementsCategories || [];

  state.plus1 = null;
  state.baseEnhancements = [];
  state.elementEnhancements = [];
  state.debuffEnhancements = [];
  state.buffEnhancements = [];
  state.hex = null;
  state.jump = null;

  categories.forEach(cat => {
    if (cat.name === 'plus1') {
      state.plus1 = cat.enhancements[0];
    } else if (cat.name === 'base') {
      state.baseEnhancements = cat.enhancements;
    } else if (cat.name === 'buffs') {
      state.buffEnhancements = cat.enhancements;
    } else if (cat.name === 'debuffs') {
      state.debuffEnhancements = cat.enhancements;
    } else if (cat.name === 'elements') {
      state.elementEnhancements = cat.enhancements;
    } else if (cat.name === 'hex') {
      state.hex = cat.enhancements[0];
    } else if (cat.name === 'jump') {
      state.jump = cat.enhancements[0];
    }
  });
}

function addEnhancement(enhancement) {
  // legacy bug/inconsistency: addEnhancement checks 'top'/'bottom'
  if (state.enhancementMode === 'top') {
    if (state.cardToEnhance.top == null) state.cardToEnhance.top = [];
    state.cardToEnhance.top.push(enhancement);
  }
  if (state.enhancementMode === 'bottom') {
    if (state.cardToEnhance.bottom == null) state.cardToEnhance.bottom = [];
    state.cardToEnhance.bottom.push(enhancement);
  }
  render();
}

function removeEnhancement(enhancements, enhancement) {
  const index = enhancements.indexOf(enhancement);
  if (index >= 0) enhancements.splice(index, 1);
  render();
}

function setTopEnhancement() {
  // legacy toggles 'Top'
  if (state.enhancementMode !== 'Top') {
    state.enhancementMode = 'Top';
  } else {
    state.enhancementMode = '';
  }
  render();
}

function setBottomEnhancement() {
  // legacy toggles 'Bottom'
  if (state.enhancementMode !== 'Bottom') {
    state.enhancementMode = 'Bottom';
  } else {
    state.enhancementMode = '';
  }
  render();
}

/* -------------------------
 C ARD EXCHANGE                                    *
 Only exact visible hooks from abilities.js are implemented here.
 -------------------------- */

function initCardExchange() {
  state.cardExchangePool = state.abilities.filter(cat => !cat.hidden);
  openModal('cardExchange');
}

function acceptCard(card) {
  acceptAbility(card);
  state.acceptedCard = card;
  closeModal();
}

/* -------------------------
 S PECIAL CLASS CONTROLS                           *
 Exact visible state hooks from main.js / index.html
 -------------------------- */

function setSpecialClassMode(mode) {
  state.specialClassMode = mode;
  render();
}

function incrementSpecialValue() {
  state.specialClassValue += 1;
  render();
}

function decrementSpecialValue() {
  if (state.specialClassValue > 0) state.specialClassValue -= 1;
  render();
}

/* -------------------------
 M ODALS                                           *
 -------------------------- */

function openModal(modal) {
  state.modal = modal;
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

/* -------------------------
 R ENDERING                                        *
 -------------------------- */

function renderNavbar() {
  return `
  <nav class="deck-navbar">
  <div class="navbar-brand-wrap">
  <a class="navbar-brand-link" href="/">ChadBroChill</a>
  <span class="navbar-title">Gloomhaven Deckbuilder</span>
  </div>
  <div class="navbar-links">
  <button class="nav-link-btn ${state.menu === 'home' ? 'active' : ''}" data-menu="home">Play</button>
  <button class="nav-link-btn ${state.menu === 'abilities' ? 'active' : ''}" data-menu="abilities">Abilities</button>
  <button class="nav-link-btn ${state.menu === 'enhancement' ? 'active' : ''}" data-menu="enhancement">Enhancement</button>
  <button class="nav-link-btn ${state.menu === 'modifiers' ? 'active' : ''}" data-menu="modifiers">Modifiers</button>
  <button class="nav-link-btn ${state.menu === 'gear' ? 'active' : ''}" data-menu="gear">Gear</button>
  <button class="nav-link-btn ${state.menu === 'options' ? 'active' : ''}" data-menu="options">Options</button>
  <button class="btn small" id="saveDataNav">Save</button>
  </div>
  </nav>
  `;
}

function renderClassButtons() {
  return `
  <div class="class-grid">
  ${state.abilities.map((cat, i) => {
    const sample = cat.cards?.[0]?.image || '';
    const m = sample.match(/([a-z]{2})-/i);
    const code = m ? m[1].toLowerCase() : '';
    const iconPath = state.classIcons?.[code] ? deckData(state.classIcons[code]) : '';
    return `
    <button class="image-card ${state.abilityCategory?.name === cat.name ? 'chosen' : ''}" data-class="${i}">
    ${iconPath ? `<img src="${iconPath}" alt="${escapeHtml(cat.name)}" class="ability-image">` : `<span>${escapeHtml(cat.name)}</span>`}
    </button>
    `;
  }).join('')}
  </div>
  `;
}

function renderAbilityPool() {
  if (!state.abilityCategory) return '<p class="muted">Choose a class to build a deck.</p>';

  return `
  <div class="image-grid ability-grid ability-pool">
  ${(state.abilityCategory.cards || [])
    .filter(card => card.level <= state.level && !/-back\./i.test(card.image))
    .map(card => `
    <button class="image-card ${state.abilitiesChosen.includes(card) ? 'chosen' : ''}" data-add="${escapeHtml(card.name)}">
    <img src="${cardImg(card)}" alt="${escapeHtml(card.name)}" class="ability-image">
    </button>
    `).join('')}
    </div>
    `;
}

function renderSpecialClassControls() {
  if (state.className === 'bb') {
    return `
    <div class="row-actions wrap">
    <button id="bbSlow" class="btn small ${state.specialClassMode === 'slow' ? 'active' : ''}">Slow</button>
    <button class="btn small">${state.specialClassValue}</button>
    <button id="bbFast" class="btn small ${state.specialClassMode === 'fast' ? 'active' : ''}">Fast</button>
    </div>
    `;
  }

  if (state.className === 'ge') {
    return `
    <div class="row-actions wrap">
    <button id="geLeft" class="btn small ${state.specialClassMode === 'left' ? 'active' : ''}">Left</button>
    <button id="geRight" class="btn small ${state.specialClassMode === 'right' ? 'active' : ''}">Right</button>
    </div>
    `;
  }

  return '';
}

function renderPlayZoneCards(title, cards, pickType = '') {
  if (!cards.length) return '<p class="muted">Empty</p>';

  return cards.map(card => {
    const meta = getBoardMeta(card);
    const durationDisplay = title === 'On Board'
    ? `<div class="counter-badge">${meta.duration < 0 ? meta.numberOfTimesUsed : meta.duration}</div>`
    : '';

    return `
    <div class="play-card ${state.twoAbilitiesSelected.includes(card) ? 'selected' : ''}" ${pickType ? `data-${pickType}="${escapeHtml(card.name)}"` : ''}>
    <img src="${cardImg(card)}" alt="${escapeHtml(card.name)}" class="ability-image ${title === 'Discarded' ? 'played' : ''} ${title === 'Lost' ? 'destroyed' : ''}">
    <div class="card-actions">
    ${title === 'Hand' ? `<button class="btn mini" data-hand-destroy="${escapeHtml(card.name)}">Lose</button>` : ''}
    ${title === 'Discarded' ? `
      <button class="btn mini" data-recover="${escapeHtml(card.name)}">Recover</button>
      <button class="btn mini" data-destroy="${escapeHtml(card.name)}">Lose</button>
      <button class="btn mini" data-board="${escapeHtml(card.name)}">Board</button>
      <button class="btn mini" data-round="${escapeHtml(card.name)}">1 Round</button>
      ` : ''}
      ${title === 'Lost' ? `<button class="btn mini" data-recover="${escapeHtml(card.name)}">Recover</button>` : ''}
      ${title === 'On Board' ? `
        ${meta.duration < 0 ? `<button class="btn mini" data-board-use="${escapeHtml(card.name)}">Use</button>` : ''}
        <button class="btn mini" data-board-discard="${escapeHtml(card.name)}">Discard</button>
        ` : ''}
        </div>
        ${durationDisplay}
        </div>
        `;
  }).join('');
}

function renderModifiersPanel() {
  return `
  <section class="panel">
  <h2>Modifiers</h2>
  <div class="row-actions wrap">
  <button id="drawMod" class="btn">Draw</button>
  <button id="shuffleMod" class="btn">Shuffle</button>
  <button id="addBless" class="btn">+ Bless</button>
  <button id="addCurse" class="btn" ${state.hasEnabledCurses ? '' : 'disabled'}>+ Curse</button>
  </div>

  <div class="modifier-row">
  <div class="modifier-stack">
  <img src="${deckData('attack-modifiers/back/top.png')}" class="modifier-image" alt="Modifier deck">
  </div>
  ${state.lastDrawnModifier ? `<div class="modifier-stack"><img src="${cardImg(state.lastDrawnModifier)}" class="modifier-image" alt="${escapeHtml(state.lastDrawnModifier.name)}"></div>` : ''}
  </div>

  <div class="modifier-discard-scroll">
  ${state.modifiersDiscardPile.map(m => `<img src="${cardImg(m)}" class="modifier-thumb" alt="${escapeHtml(m.name)}">`).join('')}
  </div>

  <p class="muted">Blessings: ${state.blessings} | Curses: ${state.curses}</p>
  </section>
  `;
}

function renderBattleGoalsPanel() {
  if (!state.battleGoals.length) return '';

  return `
  <section class="panel">
  <h2>Battle Goals</h2>
  <div class="battle-goal-row">
  <div class="battle-goal-card" id="drawGoals">
  <img src="${deckData('battle-goals/battlegoal-back.png')}" class="battle-goal-image" alt="Battle goals">
  </div>
  ${state.battleGoalsDrawn.map(g => `<div class="battle-goal-card" data-pick-goal="${escapeHtml(g.name)}"><img src="${deckData(g.image)}" class="battle-goal-image" alt="${escapeHtml(g.name)}"></div>`).join('')}
  ${state.battleGoalPicked.map(g => `<div class="battle-goal-card"><img src="${deckData(g.image)}" class="battle-goal-image" alt="${escapeHtml(g.name)}"><div class="counter-badge">${state.goalCounter}</div></div>`).join('')}
  </div>
  <div class="row-actions wrap">
  <button id="incGoal" class="btn">+1</button>
  <button id="resetGoals" class="btn">Reset</button>
  </div>
  </section>
  `;
}

function renderChosenGearPanel() {
  return `
  <section class="panel">
  <h2>Gear</h2>
  <div class="image-grid compact">
  ${state.gearChosen.map(g => `
    <div class="gear-card">
    <img src="${cardImg(g)}" class="gear-image ${g.played ? (g.lost ? 'lost' : 'tapped') : ''}" alt="${escapeHtml(g.name)}">
    <div class="card-actions">
    ${!g.played ? `
      <button class="btn mini" data-gear-tap="${escapeHtml(g.name)}">Tap</button>
      <button class="btn mini" data-gear-lose="${escapeHtml(g.name)}">Lose</button>
      <button class="btn mini" data-gear-use="${escapeHtml(g.name)}">+1</button>
      ` : `<button class="btn mini" data-gear-restore="${escapeHtml(g.name)}">Restore</button>`}
      </div>
      ${g.used > 0 ? `<div class="counter-badge">${g.used}</div>` : ''}
      </div>
      `).join('') || '<p class="muted">No gear selected</p>'}
      </div>
      </section>
      `;
}

function renderHome() {
  return `
  <div class="page-shell">
  <div class="panel split-head">
  <div>
  <h1>Play</h1>
  <p class="muted">Turn: ${state.turn}</p>
  </div>
  <div class="toolbar-actions wrap">
  <button id="newGame" class="btn">New Game</button>
  <button id="exportDeckState" class="btn">Export</button>
  <button id="triggerImportDeckState" class="btn">Import</button>
  <input id="importDeckState" type="file" accept="application/json" hidden>
  </div>
  </div>

  <div class="home-layout">
  <div class="left-column panel">
  <h2>Classes</h2>
  ${renderClassButtons()}

  <div class="play-actions wrap">
  <button id="playTop" class="btn primary">Play Cards</button>
  <button id="shortRestTop" class="btn" ${state.isRestDisabled ? 'disabled' : ''}>Short Rest</button>
  <button id="longRestTop" class="btn" ${state.isRestDisabled ? 'disabled' : ''}>Long Rest</button>
  ${state.hasEnabledCardExchange ? `<button id="openCardExchange" class="btn">Accept Card</button>` : ''}
  ${state.hasEnabledModifierDisplay ? `<button id="openModifierSort" class="btn">Sort Modifiers</button>` : ''}
  </div>

  ${renderSpecialClassControls()}

  ${state.abilitiesChosen.length ? '' : `<p class="muted">Build your deck in the Abilities section first.</p>`}

  <h3>Hand</h3>
  <div class="play-strip">${renderPlayZoneCards('Hand', state.cardsInHand, 'pick')}</div>

  <h3>On Board</h3>
  <div class="play-strip">${renderPlayZoneCards('On Board', state.cardsOnBoard)}</div>

  <h3>Discarded</h3>
  <div class="play-strip">${renderPlayZoneCards('Discarded', state.cardsDiscarded)}</div>

  <h3>Lost</h3>
  <div class="play-strip">${renderPlayZoneCards('Lost', state.cardsDestroyed)}</div>
  </div>

  <div class="right-column">
  ${renderModifiersPanel()}
  ${renderChosenGearPanel()}
  ${renderBattleGoalsPanel()}
  </div>
  </div>
  </div>
  `;
}

function renderAbilities() {
  return `
  <div class="page-shell">
  <section class="panel split-head">
  <div>
  <h1>Abilities</h1>
  <p class="muted">Choose a class, set level, and build your deck.</p>
  </div>
  <div>
  <label>Level
  <input id="levelInput" type="number" min="1" max="9" value="${state.level}">
  </label>
  </div>
  </section>

  <section class="panel">
  <h2>Classes</h2>
  ${renderClassButtons()}
  </section>

  <section class="panel">
  <h2>Available Ability Cards</h2>
  ${renderAbilityPool()}
  </section>

  <section class="panel">
  <h2>Selected Deck</h2>
  <p class="muted">${state.abilityCategory ? escapeHtml(state.abilityCategory.name) : 'No class selected'} | Hand size: ${state.abilityCategory?.max || 0} | Selected: ${state.abilitiesChosen.length}</p>
  <div class="tag-list">
  ${state.abilitiesChosen.map(card => `<span class="tag">${escapeHtml(card.name)}</span>`).join('') || '<span class="muted">No cards selected</span>'}
  </div>
  <div class="row-actions wrap">
  <button id="startNewGameFromAbilities" class="btn primary" ${state.abilitiesChosen.length ? '' : 'disabled'}>Start New Game</button>
  </div>
  </section>
  </div>
  `;
}

function renderEnhancementPage() {
  const card = state.cardToEnhance || state.enhancementEditingCard || null;
  return `
  <div class="page-shell">
  <section class="panel">
  <h1>Enhancement</h1>
  <p class="muted">Enhancement arrays are saved directly onto card top/bottom data, matching legacy export/save behavior.</p>
  </section>

  <section class="panel">
  <h2>Selected Deck</h2>
  <div class="image-grid ability-grid">
  ${state.abilitiesChosen.map(c => `<button class="image-card ${card?.name === c.name ? 'chosen' : ''}" data-edit-enhancement="${escapeHtml(c.name)}"><img src="${cardImg(c)}" class="ability-image" alt="${escapeHtml(c.name)}"></button>`).join('') || '<p class="muted">Build a deck first.</p>'}
  </div>
  </section>

  ${card ? `
    <section class="panel">
    <h2>${escapeHtml(card.name)}</h2>
    <img src="${cardImg(card)}" class="enhancement-preview-card" alt="${escapeHtml(card.name)}">
    <div class="enhancement-grid">
    <div class="panel compact-panel">
    <h3>Top</h3>
    <div class="tag-list">
    ${state.baseEnhancements.map(e => `<button class="btn small" data-add-enhancement="${escapeHtml(e.name || 'enh')}|base">${escapeHtml(e.name || 'Enh')}</button>`).join('')}
    </div>
    </div>
    <div class="panel compact-panel">
    <h3>Bottom</h3>
    <div class="tag-list">
    ${state.baseEnhancements.map(e => `<button class="btn small" data-add-enhancement="${escapeHtml(e.name || 'enh')}|base">${escapeHtml(e.name || 'Enh')}</button>`).join('')}
    </div>
    </div>
    </div>
    </section>
    ` : ''}
    </div>
    `;
}

function renderGearPage() {
  return `
  <div class="page-shell">
  ${renderChosenGearPanel()}
  <section class="panel">
  <h2>Gear Library</h2>
  ${state.allGear.map(cat => `
    <div class="gear-category-block">
    <h3>${escapeHtml(cat.name)}</h3>
    <div class="image-grid compact">
    ${(cat.items || []).map(item => `<button class="image-card ${state.gearChosen.includes(item) ? 'chosen' : ''}" data-gear="${escapeHtml(item.name)}"><img src="${cardImg(item)}" class="gear-image" alt="${escapeHtml(item.name)}"></button>`).join('')}
    </div>
    </div>
    `).join('') || '<p class="muted">No gear loaded.</p>'}
    </section>
    </div>
    `;
}

function renderModifierManagerPage() {
  return `
  <div class="page-shell">
  <section class="panel split-head">
  <div>
  <h1>Modifiers</h1>
  <p class="muted">Class modifiers, special modifiers, and perk engine.</p>
  </div>
  <div class="row-actions wrap">
  <button id="openPerksBtn" class="btn">Show Perks</button>
  <button id="goChooseClassFromModifiers" class="btn">Switch Class</button>
  </div>
  </section>

  <section class="panel">
  <h2>Current Deck</h2>
  <div class="modifier-card-grid">
  ${state.modifiersChosen.map(card => `<img src="${cardImg(card)}" class="modifier-page-card selected-deck-card" alt="${escapeHtml(card.name)}">`).join('') || '<p class="muted">No modifiers selected.</p>'}
  </div>
  </section>

  ${renderModifiersPanel()}
  </div>
  `;
}

function renderOptionsPage() {
  return `
  <div class="page-shell">
  <section class="panel">
  <h1>Options</h1>
  <div class="options-grid">
  <div class="panel compact-panel">
  <h3>Expansion</h3>
  <div class="tag-list">
  ${state.availableExpansions.map(exp => `<button class="btn small ${state.expansion === exp ? 'active' : ''}" data-expansion="${exp}">${exp}</button>`).join('')}
  </div>
  </div>

  <div class="panel compact-panel">
  <h3>Toggles</h3>
  <label class="checkbox-row"><input type="checkbox" id="toggleCardExchange" ${state.hasEnabledCardExchange ? 'checked' : ''}> Accept card</label>
  <label class="checkbox-row"><input type="checkbox" id="toggleModifierDisplay" ${state.hasEnabledModifierDisplay ? 'checked' : ''}> Sort modifiers</label>
  <label class="checkbox-row"><input type="checkbox" id="toggleQuickCurse" ${state.hasEnabledCurses ? 'checked' : ''}> Quick curse</label>
  <label class="checkbox-row"><input type="checkbox" id="toggleGameplaySave" ${state.hasEnabledSaveGameplayData ? 'checked' : ''}> Gameplay data saving</label>
  </div>

  <div class="panel compact-panel">
  <h3>Appearance</h3>
  <button id="swapModeBtn" class="btn">${state.dark ? 'Night Mode On' : 'Night Mode Off'}</button>
  </div>

  <div class="panel compact-panel">
  <h3>Data</h3>
  <div class="row-actions wrap">
  <button id="exportDeckStateOptions" class="btn">Export</button>
  <button id="triggerImportDeckStateOptions" class="btn">Import</button>
  <input id="importDeckStateOptions" type="file" accept="application/json" hidden>
  </div>
  </div>
  </div>
  </section>
  </div>
  `;
}

function renderModalBody() {
  if (state.modal === 'shortRest') {
    return `
    <h2>Short Rest</h2>
    <p class="muted">Random loss selected:</p>
    ${state.cardToLose ? `<img src="${cardImg(state.cardToLose)}" class="modal-card-preview" alt="${escapeHtml(state.cardToLose.name)}">` : ''}
    <div class="row-actions wrap">
    <button id="confirmShortRest" class="btn primary">Confirm</button>
    <button id="redrawShortRest" class="btn">Reroll</button>
    <button id="closeModal" class="btn">Cancel</button>
    </div>
    `;
  }

  if (state.modal === 'longRest') {
    return `
    <h2>Long Rest</h2>
    <p class="muted">Choose one discarded card to lose.</p>
    <div class="image-grid">
    ${state.cardsDiscarded.map(card => `<button class="image-card ${state.cardToLose?.name === card.name ? 'chosen' : ''}" data-long-rest-pick="${escapeHtml(card.name)}"><img src="${cardImg(card)}" class="ability-image" alt="${escapeHtml(card.name)}"></button>`).join('')}
    </div>
    <div class="row-actions wrap">
    <button id="confirmLongRest" class="btn primary">Confirm</button>
    <button id="closeModal" class="btn">Cancel</button>
    </div>
    `;
  }

  if (state.modal === 'perks') {
    return `
    <h2>Perks</h2>
    <p class="muted">No exact perk definitions were visible in the opened legacy files yet.</p>
    <div class="row-actions wrap">
    <button id="closeModal" class="btn">Close</button>
    </div>
    `;
  }

  if (state.modal === 'cardExchange') {
    return `
    <h2>Accept Card</h2>
    <p class="muted">Choose a card to accept into hand.</p>
    <div class="image-grid">
    ${(state.abilityCategory?.cards || []).filter(card => card.canBeExchanged).map(card => `
      <button class="image-card" data-accept-card="${escapeHtml(card.name)}">
      <img src="${cardImg(card)}" class="ability-image" alt="${escapeHtml(card.name)}">
      </button>
      `).join('') || '<p class="muted">No exchange cards available.</p>'}
      </div>
      <div class="row-actions wrap">
      <button id="closeModal" class="btn">Close</button>
      </div>
      `;
  }

  if (state.modal === 'modifierSort') {
    return `
    <h2>Sort Modifiers</h2>
    <p class="muted">Legacy app used drag sorting here.</p>
    <div class="modifier-card-grid">
    ${state.modifiersDrawPile.map(card => `<img src="${cardImg(card)}" class="modifier-page-card" alt="${escapeHtml(card.name)}">`).join('')}
    </div>
    <div class="row-actions wrap">
    <button id="closeModal" class="btn">Close</button>
    </div>
    `;
  }

  return '';
}

function renderModals() {
  if (!state.modal) return '';
  return `
  <div class="modal-backdrop">
  <div class="modal-card">
  ${renderModalBody()}
  </div>
  </div>
  `;
}

function renderCurrentMenu() {
  switch (state.menu) {
    case 'home': return renderHome();
    case 'abilities': return renderAbilities();
    case 'enhancement': return renderEnhancementPage();
    case 'gear': return renderGearPage();
    case 'modifiers': return renderModifierManagerPage();
    case 'options': return renderOptionsPage();
    default: return renderHome();
  }
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
  <div class="deck-app ${state.dark ? 'theme-dark' : 'theme-light'}">
  ${renderNavbar()}
  <main class="app-content">
  ${renderCurrentMenu()}
  </main>
  ${renderModals()}
  </div>
  `;

  bindEvents();
}

/* -------------------------
 E VENTS                                           *
 -------------------------- */

function bindEvents() {
  document.querySelectorAll('[data-menu]').forEach(btn =>
  btn.addEventListener('click', () => setMenu(btn.dataset.menu))
  );

  document.getElementById('saveDataNav')?.addEventListener('click', () => {
    saveAllState();
    alert('Data saved!');
  });

  document.querySelectorAll('[data-class]').forEach(btn =>
  btn.addEventListener('click', () => displayAbilities(state.abilities[Number(btn.dataset.class)]))
  );

  document.querySelectorAll('[data-add]').forEach(btn =>
  btn.addEventListener('click', () => {
    const card = findAbilityByName(btn.dataset.add);
    if (card) addAbility(card);
  })
  );

  document.getElementById('levelInput')?.addEventListener('change', e => {
    state.level = Math.max(1, Math.min(9, Number(e.target.value) || 1));
    render();
  });

  document.getElementById('startNewGameFromAbilities')?.addEventListener('click', () => {
    newGame();
    setMenu('home');
  });

  document.querySelectorAll('[data-pick]').forEach(box =>
  box.addEventListener('click', () => {
    const card = findAbilityByName(box.dataset.pick);
    if (card) pickCard(card);
  })
  );

  document.querySelectorAll('[data-hand-destroy]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.handDestroy);
    if (card) destroyCard(card);
  })
  );

  document.querySelectorAll('[data-recover]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.recover);
    if (card) fetchCard(card);
  })
  );

  document.querySelectorAll('[data-destroy]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.destroy);
    if (card) destroyCard(card);
  })
  );

  document.querySelectorAll('[data-board]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.board);
    if (card) keepAbilityManyTurns(card);
  })
  );

  document.querySelectorAll('[data-round]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.round);
    if (card) keepAbilityOneTurn(card);
  })
  );

  document.querySelectorAll('[data-board-use]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.boardUse);
    if (card) useCard(card);
  })
  );

  document.querySelectorAll('[data-board-discard]').forEach(btn =>
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = findAbilityByName(btn.dataset.boardDiscard);
    if (card) discardOnBoardItem(card);
  })
  );

  document.getElementById('playTop')?.addEventListener('click', play);
  document.getElementById('shortRestTop')?.addEventListener('click', initShortRest);
  document.getElementById('longRestTop')?.addEventListener('click', initLongRest);
  document.getElementById('newGame')?.addEventListener('click', newGame);

  document.getElementById('drawMod')?.addEventListener('click', drawModifier);
  document.getElementById('shuffleMod')?.addEventListener('click', shuffleModifiersDeck);
  document.getElementById('addBless')?.addEventListener('click', addBlessing);
  document.getElementById('addCurse')?.addEventListener('click', addCurse);

  document.getElementById('drawGoals')?.addEventListener('click', drawBattleGoals);
  document.querySelectorAll('[data-pick-goal]').forEach(el =>
  el.addEventListener('click', () => {
    const goal = findBattleGoalByName(el.dataset.pickGoal);
    if (goal) pickBattleGoal(goal);
  })
  );
  document.getElementById('incGoal')?.addEventListener('click', incrementGoalCounter);
  document.getElementById('resetGoals')?.addEventListener('click', resetBattlegoals);

  document.querySelectorAll('[data-gear]').forEach(btn =>
  btn.addEventListener('click', () => {
    const item = findGearByName(btn.dataset.gear);
    if (item) addGear(item);
  })
  );

  document.querySelectorAll('[data-gear-tap]').forEach(btn =>
  btn.addEventListener('click', () => {
    const item = findGearByName(btn.dataset.gearTap);
    if (item) tapItem(item);
  })
  );

  document.querySelectorAll('[data-gear-lose]').forEach(btn =>
  btn.addEventListener('click', () => {
    const item = findGearByName(btn.dataset.gearLose);
    if (item) looseItem(item);
  })
  );

  document.querySelectorAll('[data-gear-use]').forEach(btn =>
  btn.addEventListener('click', () => {
    const item = findGearByName(btn.dataset.gearUse);
    if (item) useItem(item);
  })
  );

  document.querySelectorAll('[data-gear-restore]').forEach(btn =>
  btn.addEventListener('click', () => {
    const item = findGearByName(btn.dataset.gearRestore);
    if (item) restoreItem(item);
  })
  );

  document.querySelectorAll('[data-edit-enhancement]').forEach(btn =>
  btn.addEventListener('click', () => {
    const card = findAbilityByName(btn.dataset.editEnhancement);
    if (card) {
      state.cardToEnhance = card;
      state.enhancementEditingCard = card;
      render();
    }
  })
  );

  document.getElementById('openCardExchange')?.addEventListener('click', initCardExchange);
  document.getElementById('openModifierSort')?.addEventListener('click', () => openModal('modifierSort'));

  document.querySelectorAll('[data-accept-card]').forEach(btn =>
  btn.addEventListener('click', () => {
    const card = findAbilityByName(btn.dataset.acceptCard);
    if (card) acceptCard(card);
  })
  );

  document.getElementById('bbSlow')?.addEventListener('click', () => {
    state.specialClassMode = 'slow';
    incrementSpecialValue();
  });

  document.getElementById('bbFast')?.addEventListener('click', () => {
    if (state.specialClassValue > 0) {
      state.specialClassMode = 'fast';
      decrementSpecialValue();
    }
  });

  document.getElementById('geLeft')?.addEventListener('click', () => setSpecialClassMode('left'));
  document.getElementById('geRight')?.addEventListener('click', () => setSpecialClassMode('right'));

  document.querySelectorAll('[data-expansion]').forEach(btn =>
  btn.addEventListener('click', () => setExpansion(btn.dataset.expansion))
  );

  document.getElementById('toggleCardExchange')?.addEventListener('change', e => {
    state.hasEnabledCardExchange = e.target.checked;
    render();
  });

  document.getElementById('toggleModifierDisplay')?.addEventListener('change', e => {
    state.hasEnabledModifierDisplay = e.target.checked;
    render();
  });

  document.getElementById('toggleQuickCurse')?.addEventListener('change', e => {
    state.hasEnabledCurses = e.target.checked;
    render();
  });

  document.getElementById('toggleGameplaySave')?.addEventListener('change', e => {
    state.hasEnabledSaveGameplayData = e.target.checked;
    render();
  });

  document.getElementById('swapModeBtn')?.addEventListener('click', swapMode);

  document.getElementById('exportDeckState')?.addEventListener('click', exportState);
  document.getElementById('triggerImportDeckState')?.addEventListener('click', () => {
    document.getElementById('importDeckState')?.click();
  });
  document.getElementById('importDeckState')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importStateFile(file);
  });

    document.getElementById('exportDeckStateOptions')?.addEventListener('click', exportState);
    document.getElementById('triggerImportDeckStateOptions')?.addEventListener('click', () => {
      document.getElementById('importDeckStateOptions')?.click();
    });
    document.getElementById('importDeckStateOptions')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) importStateFile(file);
    });

      document.getElementById('confirmShortRest')?.addEventListener('click', () => {
        rest();
        closeModal();
        if (state.cardsInHand.length < 2) {
          alert('You do not have enough cards in your hand to continue.');
        }
        render();
      });

      document.getElementById('redrawShortRest')?.addEventListener('click', reroll);

      document.querySelectorAll('[data-long-rest-pick]').forEach(btn =>
      btn.addEventListener('click', () => {
        const card = findAbilityByName(btn.dataset.longRestPick);
        if (card) pickCardToLoseLongRest(card);
      })
      );

      document.getElementById('confirmLongRest')?.addEventListener('click', () => {
        if (!state.cardToLose) {
          alert('Select a card to lose.');
          return;
        }
        longRest();
      });
      document.getElementById('closeModal')?.addEventListener('click', closeModal);
}

/* -------------------------
 A UTOSAVE / UNLOAD                                *
 -------------------------- */

function startAutosave() {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(() => {
    if (state.hasEnabledSaveGameplayData) {
      saveAllState();
    }
  }, AUTOSAVE_MS);
}

function handleBeforeUnload() {
  if (state.hasEnabledSaveGameplayData) {
    saveAllState();
  }
}

/* -------------------------
 N EW GAME                                         *
 Exact main.js structure
 -------------------------- */

function newGame() {
  state.cardsInHand = [];
  state.abilitiesChosen.forEach(card => {
    card.duration = 0;
    card.numberOfTimesUsed = 0;
    syncBoardMetaFromCard(card);
    state.cardsInHand.push(card);
  });

  state.cardsOnBoard = [];
  state.cardsDiscarded = [];
  state.cardsDestroyed = [];

  state.gearChosen.forEach(item => {
    resetGearItem(item);
  });

  resetBattlegoals();
  resetModifiers();

  state.turn = 1;
  recomputeRestDisabled();
  render();
}

/* -------------------------
 I NIT                                             *
 -------------------------- */

async function init() {
  normalizeAvailableExpansions();
  loadDatabase();
  await loadRemoteData();
  loadStoredState();
  startAutosave();
  window.addEventListener('beforeunload', handleBeforeUnload);
  render();
}

document.addEventListener('DOMContentLoaded', init);
