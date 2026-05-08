import { state } from './state.js';

// Disable sitewide toasts on deck-modern
window.toast = {
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {}
};

window.alert = (msg) => {
  console.warn("Alert suppressed:", msg);
};

// ===== LOAD DATA =====
const rawCards = window.characterAbilityCards || [];

const rawMats = window.characterMats || [];

const handsizeMap = {};

rawMats.forEach(mat => {
  if (!mat.classId || !mat.handsize) return;

  handsizeMap[mat.classId] = mat.handsize;
});

function getCSRF() {
  return document.querySelector('meta[name="csrf-token"]')?.content;
}

let saveTimeout = null;

function queueSave() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    persistState();
  }, 400); // 400ms debounce
}

function getActivePreset(build) {
  return build.presets?.[build.activePreset || 0];
}

function renderTabs(container) {
  const tabs = document.createElement('div');
  tabs.className = 'tabs';

  tabs.innerHTML = `
  <button id="tabSelect">Change Class</button>
  <button id="tabBuild">Modify/Switch Deck</button>
  `;

  container.appendChild(tabs);

  const activeMap = {
    select: 'tabSelect',
    build: 'tabBuild'
  };

  const activeId = activeMap[state.view];

  if (activeId) {
    document.getElementById(activeId)?.classList.add('active');
  }

  document.getElementById('tabSelect').onclick = () => {
    state.view = 'select';
    render();
  };

  document.getElementById('tabBuild').onclick = () => {
    state.view = 'build';
    render();
  };
}

function getLevelUpChoices(build, cls) {
  const nextLevel = (build.level || 1) + 1;

  return cls.cards.filter(card => {

    // Already owned
    if (build.supply.includes(card.image)) {
      return false;
    }

    const level =
    normalizeLevel(
      card.top?.level ||
      card.bottom?.level
    );

    // Next level cards
    if (level === nextLevel) {
      return true;
    }

    // Lower-level skipped cards
    if (
      typeof level === 'number' &&
      level < nextLevel
    ) {
      return true;
    }

    return false;
  });
}

function renderLevelUpModal(build, cls) {

  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';

  overlay.innerHTML = `
  <div class="levelup-modal">
  <h2>
  Choose a Level-Up Card
  </h2>

  <div class="levelup-row"></div>
  </div>
  `;

  const row =
  overlay.querySelector('.levelup-row');

  sortCards([...state.levelUpChoices])
  .forEach(card => {

    const wrapper =
    document.createElement('div');

    wrapper.className = 'overlap-card';

    const img =
    document.createElement('img');

    img.src =
    `/deck-assets/images/${card.image}`;

    img.className =
    'ability-card overlap-card-img';

    wrapper.appendChild(img);

    wrapper.onclick = () => {

      build.supply.push(card.image);

      build.levelHistory.push({
        level: (build.level || 1) + 1,
                              card: card.image
      });

      build.level =
      (build.level || 1) + 1;

      persistState();

      overlay.remove();

      render();
    };

    row.appendChild(wrapper);
  });

  document.body.appendChild(overlay);
}

// ===== MERGE TOP/BOTTOM INTO SINGLE CARD =====
function buildCardMap(cards) {
  const map = {};

  cards.forEach(card => {
    if (!card.image) return;

    if (!map[card.image]) {
      map[card.image] = {
        image: card.image,
        top: null,
        bottom: null,
        name: card.name.replace(/-(top|bottom)$/, '')
      };
    }

    if (card.xws?.endsWith('-top')) {
      map[card.image].top = card;
    } else if (card.xws?.endsWith('-bottom')) {
      map[card.image].bottom = card;
    }
  });

  return Object.values(map);
}

const mergedCards = buildCardMap(rawCards);

function normalizeLevel(level) {
  if (level === 'X' || level === 'x') return 'X';
  return Number(level);
}

function getSortWeight(level) {
  if (level === 1) return 1;
  if (level === 'X') return 1.5;
  return level;
}

function sortCards(cards) {
  return cards.sort((a, b) => {
    const levelA = normalizeLevel(a.top?.level || a.bottom?.level);
    const levelB = normalizeLevel(b.top?.level || b.bottom?.level);

    const weightA = getSortWeight(levelA);
    const weightB = getSortWeight(levelB);

    if (weightA !== weightB) return weightA - weightB;

    return a.name.localeCompare(b.name);
  });
}

function filterByLevel(cards, selectedLevel) {
  return cards.filter(card => {
    const level = normalizeLevel(card.top?.level || card.bottom?.level);

    if (level === 'X') return true;
    return level <= selectedLevel;
  });
}

// ===== BUILD STRUCTURE =====
function buildData() {
  const expansions = {};

  mergedCards.forEach(card => {
    if (!card.image) return;

    // example:
    // character-ability-cards/gloomhaven/be/gh-be-01.png
    const parts = card.image.split('/');

    const expansion = parts[1];
    const classId = parts[2];

    if (!expansions[expansion]) expansions[expansion] = {};
    if (!expansions[expansion][classId]) {
      expansions[expansion][classId] = {
        back: null,
        cards: []
      };
    }

    if (card.name.endsWith('-back')) {
      expansions[expansion][classId].back = card;
    } else {
      expansions[expansion][classId].cards.push(card);
    }
  });

  return expansions;
}

const data = buildData();

// ===== STATE =====
state.selectedExpansion = null;
state.selectedClass = null;

// ===== RENDER: EXPANSION =====
function renderExpansion() {
  const app = document.getElementById('app');

  app.innerHTML = `<h1>Select Expansion</h1><div class="exp-grid"></div>`;

  const grid = app.querySelector('.exp-grid');

  Object.keys(data).forEach(exp => {
    const btn = document.createElement('button');
    btn.className = 'exp-btn';
    btn.textContent = exp;

    btn.onclick = () => {
      state.selectedExpansion = exp;
      state.selectedClass = null;
      render();
    };

    grid.appendChild(btn);
  });
}

// ===== RENDER: CLASS =====
function renderClass() {
  const app = document.getElementById('app');
  const classes = data[state.selectedExpansion];

  app.innerHTML = `
  <h1>${state.selectedExpansion}</h1>
  <button id="backExp">← Back</button>
  <div class="class-grid"></div>
  `;

  const grid = app.querySelector('.class-grid');

  Object.entries(classes).forEach(([classId, cls]) => {
    if (!cls.back) return;

    const img = document.createElement('img');
    img.src = `/deck-assets/images/${cls.back.image}`;
    img.className = 'class-card';

    img.onclick = () => {
      state.selectedClass = classId;

      const build = state.builds[state.activeBuild];

      if (
        build &&
        (!build.supply || build.supply.length === 0)
      ) {
        build.level = 1;

        build.supply = cls.cards
        .filter(card => {
          const level =
          normalizeLevel(
            card.top?.level ||
            card.bottom?.level
          );

          return level === 1 || level === 'X';
        })
        .map(card => card.image);
      }

      if (state.activeBuild != null) {
        const build = state.builds[state.activeBuild];

        build.classId = classId;
        build.expansion = state.selectedExpansion;
      }

      // 🔥 Load proper hand size
      state.handSize = handsizeMap[classId] || 10;

      render();
    };

    grid.appendChild(img);
  });

  document.getElementById('backExp').onclick = () => {
    state.selectedExpansion = null;
    render();
  };
}

function renderBuild() {
  const app = document.getElementById('app');
  const currentBuild =
  state.activeBuild != null
  ? state.builds[state.activeBuild]
  : null;

  app.innerHTML ='';
  renderTabs(app);

  const cls = data[state.selectedExpansion]?.[state.selectedClass];
  if (!cls) return;

  const content = document.createElement('div');

  let presetHtml = '';

  if (currentBuild) {
    presetHtml = `
    <div class="preset-bar">
    ${currentBuild.presets.map((p, i) => `
      <button
      class="preset-btn ${i === currentBuild.activePreset ? 'active' : ''}"
      data-preset="${i}">
      ${p.name}
      </button>
      `).join('')}

      ${
        currentBuild.presets.length < 3
        ? `<button id="newPreset">+</button>`
        : ''
      }
      </div>
      `;
  }

  content.innerHTML = `
  <div class="topbar">
  <div>
  Level ${currentBuild?.level || 1}
  </div>
  </div>

  <div class="build-controls">
  ${presetHtml}

  <button id="renamePreset">Rename</button>
  <button id="resetPreset">Reset</button>

  ${
    currentBuild && currentBuild.presets.length > 1
    ? `<button id="deletePreset">Delete Preset</button>`
    : ''
  }
  </div>
  <div class="level-controls">
  <button
  id="levelUpBtn"
  ${(currentBuild?.level || 1) >= 9 ? 'disabled' : ''}
  >
  Level Up
  </button>
  <button
  id="undoLevelBtn"
  ${(currentBuild?.level || 1) <= 1 ? 'disabled' : ''}
  >
  Undo Level
  </button>
  </div>
  <button id="startGame"
  ${state.builtHand.length !== state.handSize ? 'disabled' : ''}>
  Save and Start
  </button>

  <div class="deck-builder">

  <div class="deck-section">
  <h2>
  Deck (${state.builtHand.length} / ${state.handSize})
  </h2>

  <div class="deck-row"></div>
  </div>

  <div class="deck-section">
  <h2>Supply</h2>

  <div class="available-row"></div>
  </div>

  </div>
  `;
  app.appendChild(content);

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.preset);

      const build = state.builds[state.activeBuild];

      build.activePreset = idx;

      const preset = build.presets[idx];

      // 🔥 Restore build hand objects
      state.builtHand = preset.cards
      .map(img => mergedCards.find(c => c.image === img))
      .filter(Boolean);

      // 🔥 Sync gameplay state
      state.cardsInHand = [...state.builtHand];
      state.cardsDiscarded = [];
      state.cardsLost = [];
      state.cardsActive = [];

      build.cardsInHand = state.builtHand.map(c => c.image);
      build.cardsDiscarded = [];
      build.cardsLost = [];
      build.cardsActive = [];

      persistState();
      render();
    };
  });

  const newPresetBtn = document.getElementById('newPreset');

  if (newPresetBtn) {
    newPresetBtn.onclick = () => {
      const build = state.builds[state.activeBuild];

      if (build.presets.length >= 3) return;

      const usedNumbers = build.presets
      .map(p => {
        const match = p.name.match(/^Preset (\d+)$/);
        return match ? Number(match[1]) : null;
      })
      .filter(Boolean);

      let nextNumber = 1;

      while (usedNumbers.includes(nextNumber)) {
        nextNumber++;
      }

      const preset = {
        id: crypto.randomUUID(),
        name: `Preset ${nextNumber}`,
        cards: []
      };

      build.presets.push(preset);

      build.activePreset = build.presets.length - 1;

      state.builtHand = [];

      persistState();
      render();
    };
  }

  const renamePresetBtn =
  document.getElementById('renamePreset');

  if (renamePresetBtn) {
    renamePresetBtn.onclick = () => {
      const build = state.builds[state.activeBuild];

      if (!build) return;

      const preset =
      build.presets[build.activePreset || 0];

      if (!preset) return;

      const nextName = prompt(
        'Rename preset:',
        preset.name
      );

      if (nextName == null) return;

      const cleaned = nextName.trim();

      if (!cleaned) {
        alert('Preset name cannot be empty.');
        return;
      }

      // Optional max length
      preset.name = cleaned.slice(0, 32);

      persistState();
      render();
    };
  }

  const resetBtn = document.getElementById('resetPreset');

  if (resetBtn) {
    resetBtn.onclick = () => {
      const confirmed = confirm(
        'Clear all selected cards from this preset?'
      );

      if (!confirmed) return;

      state.builtHand = [];

      if (state.activeBuild != null) {
        const build = state.builds[state.activeBuild];

        const preset =
        build.presets[build.activePreset || 0];

        if (preset) {
          preset.cards = [];
        }

        build.cardsInHand = [];
        build.cardsDiscarded = [];
        build.cardsLost = [];
        build.cardsActive = [];
      }

      persistState();
      render();
    };
  }

  const deletePresetBtn =
  document.getElementById('deletePreset');

  if (deletePresetBtn) {
    deletePresetBtn.onclick = () => {
      const build = state.builds[state.activeBuild];

      // Safety guard
      if (!build || build.presets.length <= 1) {
        return;
      }

      const preset =
      build.presets[build.activePreset || 0];

      const confirmed = confirm(
        `Delete "${preset.name}"?\n\nThis cannot be undone.`
      );

      if (!confirmed) return;

      // Remove preset
      build.presets.splice(build.activePreset, 1);

      // Clamp active preset index
      if (build.activePreset >= build.presets.length) {
        build.activePreset = build.presets.length - 1;
      }

      // Load newly active preset
      const nextPreset =
      build.presets[build.activePreset];

      state.builtHand = nextPreset.cards
      .map(img => mergedCards.find(c => c.image === img))
      .filter(Boolean);

      state.cardsInHand = [...state.builtHand];
      state.cardsDiscarded = [];
      state.cardsLost = [];
      state.cardsActive = [];

      build.cardsInHand =
      state.builtHand.map(c => c.image);

      build.cardsDiscarded = [];
      build.cardsLost = [];
      build.cardsActive = [];

      persistState();
      render();
    };
  }

  document.getElementById('levelUpBtn').onclick = () => {
    const build = state.builds[state.activeBuild];

    if ((build.level || 1) >= 9) {
      alert('Maximum level reached.');
      return;
    }

    const choices =
    getLevelUpChoices(build, cls);

    if (choices.length === 0) {
      alert('No level-up choices available.');
      return;
    }

    state.levelUpChoices = choices;

    renderLevelUpModal(build, cls);
  };

  document.getElementById('undoLevelBtn').onclick = () => {

    const build = state.builds[state.activeBuild];

    if (!build) return;

    // Cannot go below level 1
    if ((build.level || 1) <= 1) {
      alert('Already at level 1.');
      return;
    }

    const confirmed = confirm(
      'Undo last level?\n\n' +
      'This removes ONE unlocked card.'
    );

    if (!confirmed) return;

    // Current highest unlocked level
    const currentLevel = build.level || 1;

    // Find removable cards
    const lastLevel =
    build.levelHistory.pop();

    if (!lastLevel) {
      alert('No level history found.');
      return;
    }

    const removeCardImage =
    lastLevel.card;

    build.supply =
    build.supply.filter(
      img => img !== removeCardImage
    );

    // Remove from equipped deck if present
    state.builtHand =
    state.builtHand.filter(
      c => c.image !== removeCardImage
    );

    // Remove from presets
    build.presets.forEach(preset => {
      preset.cards =
      preset.cards.filter(
        img => img !== removeCardImage
      );
    });

    build.level = currentLevel - 1;

    persistState();
    render();
  };

  const availableRow =
  app.querySelector('.available-row');

  const deckRow =
  app.querySelector('.deck-row');

  const build = state.builds[state.activeBuild];

  const visibleCards = sortCards(
    cls.cards.filter(card =>
    build.supply.includes(card.image)
    )
  );

  visibleCards.forEach(card => {
    const img = document.createElement('img');

    img.src = `/deck-assets/images/${card.image}`;

    img.className = 'ability-card overlap-card-img';

    const wrapper = document.createElement('div');
    wrapper.className = 'overlap-card';

    wrapper.appendChild(img);

    const selected =
    state.builtHand.some(c => c.image === card.image);

    const deckFull =
    state.builtHand.length >= state.handSize;

    if (!selected && deckFull) {
      wrapper.classList.add('deck-full');
    }

    if (selected) {
      img.classList.add('selected');
      deckRow.appendChild(wrapper);
    } else {
      availableRow.appendChild(wrapper);
    }

    wrapper.onclick = () => {

      if (selected) {
        state.builtHand =
        state.builtHand.filter(
          c => c.image !== card.image
        );

      } else {
        if (
          state.builtHand.length >=
          state.handSize
        ) return;

        state.builtHand.push(card);
      }

      if (state.activeBuild != null) {
        const build =
        state.builds[state.activeBuild];

        const preset =
        build.presets[
          build.activePreset || 0
        ];

        if (preset) {
          preset.cards =
          state.builtHand.map(c => c.image);
        }

        persistState();
      }

      render();
    };
  });

  document.getElementById('startGame').onclick = () => {
    if (state.builtHand.length !== state.handSize) {
      alert(
        `You must select exactly ${state.handSize} cards.\n\n` +
        `Currently selected: ${state.builtHand.length}`
      );
      return;
    }

    // 🔥 Convert built hand → full play state
    state.cardsInHand = state.builtHand.map(c => c);

    state.cardsDiscarded = [];
    state.cardsLost = [];
    state.cardsActive = [];

    // 🔥 Save build (IMPORTANT: use images)
    let build;

    if (state.activeBuild != null) {
      build = state.builds[state.activeBuild];
    } else {
      build = {
        id: crypto.randomUUID(),

        classId: state.selectedClass,
        expansion: state.selectedExpansion,

        presets: [{
          id: crypto.randomUUID(),
          name: "Preset 1",
          cards: []
        }],

        activePreset: 0,

        cardsInHand: [],
        cardsDiscarded: [],
        cardsLost: [],
        cardsActive: []
      };

      if (state.builds.length >= 5) {
        alert("Max 5 characters");
        return;
      }

      state.builds.push(build);
      state.activeBuild = state.builds.length - 1;
    }

    // 🔥 Update active preset instead of replacing build
    const preset = build.presets[build.activePreset];

    preset.cards = state.builtHand.map(c => c.image);

    // 🔥 Sync gameplay state
    build.cardsInHand = [...preset.cards];
    build.cardsDiscarded = [];
    build.cardsLost = [];
    build.cardsActive = [];

    build.classId = state.selectedClass;
    build.expansion = state.selectedExpansion;

    persistState();

    // 🔥 NOW switch view
    state.view = 'play';
    render();
  };
}

function renderZone(title, cards, zone) {
  const section = document.createElement('div');
  section.className = 'zone';

  section.innerHTML = `<h2>${title} (${cards.length})</h2>`;

  const grid = document.createElement('div');
  grid.className = 'card-grid';

  cards.forEach(card => {
    const img = document.createElement('img');
    img.src = `/deck-assets/images/${card.image}`;
    img.className = 'ability-card';

    img.onclick = () => handleCardAction(card, zone);

    grid.appendChild(img);
  });

  section.appendChild(grid);
  return section;
}

async function renderPlay() {
  const app = document.getElementById('app');

  app.innerHTML ='';
  renderTabs(app);

  const content = document.createElement('div');

  content.appendChild(renderZone('Hand', state.cardsInHand, 'hand'));
  content.appendChild(renderZone('Active', state.cardsActive, 'active'));
  content.appendChild(renderZone('Discard', state.cardsDiscarded, 'discard'));
  content.appendChild(renderZone('Lost', state.cardsLost, 'lost'));

  app.appendChild(content);
}

function renderSelectClass() {
  const app = document.getElementById('app');
  app.innerHTML ='';
  renderTabs(app);

  const content = document.createElement('div');
  content.innerHTML = `
  <div class="header">
  <h1>Select Class</h1>
  </div>

  <div class="build-grid"></div>
  `;
  app.appendChild(content);

  const grid = app.querySelector('.build-grid');

  const allCards = mergedCards;

  function restore(list) {
    if (!Array.isArray(list)) return [];
    return list
    .map(img => allCards.find(c => c.image === img))
    .filter(Boolean);
  }

  // ===== EXISTING BUILDS =====
  state.builds.forEach((build, i) => {
    const cls = data[build.expansion]?.[build.classId];
    if (!cls) return;

    const div = document.createElement('div');
    div.className = 'build-card';

    const imgSrc = cls.back
    ? `/deck-assets/images/${cls.back.image}`
    : '';

    div.innerHTML = `
    <img src="${imgSrc}" class="class-img"/>
    <div class="build-info">
    <div class="expansion">${build.expansion}</div>
    </div>

    <div class="actions">
    <button class="load">Play</button>
    <button class="del">Delete</button>
    </div>
    `;

    // LOAD
    div.querySelector('.load').onclick = () => {

      state.activeBuild = i;
      state.lastPlayed = i;

      const b = state.builds[i];

      state.selectedClass = b.classId;
      state.selectedExpansion = b.expansion;

      state.handSize =
      handsizeMap[b.classId] || 10;

      // 🔥 Restore active preset into build editor
      if (
        b.presets &&
        b.presets.length > 0
      ) {
        const preset =
        b.presets[b.activePreset || 0];

        state.builtHand = restore(preset.cards);

      } else {
        state.builtHand =
        restore(b.cardsInHand);
      }

      // 🔥 Restore gameplay zones too
      state.cardsInHand =
      restore(b.cardsInHand);

      state.cardsDiscarded =
      restore(b.cardsDiscarded);

      state.cardsLost =
      restore(b.cardsLost);

      state.cardsActive =
      restore(b.cardsActive);

      // 🔥 Open in BUILD view
      state.view = 'build';

      render();
    };

    // DELETE
    div.querySelector('.del').onclick = async () => {
      const confirmed = confirm(
        `Delete ${build.classId.toUpperCase()}?\n\nThis cannot be undone.`
      );

      if (!confirmed) return;

      // Remove build
      state.builds.splice(i, 1);

      if (state.builds.length === 0) {
        state.activeBuild = null;
        state.lastPlayed = 0;
        state.view = 'select';
      } else {
        if (state.activeBuild === i) {
          state.activeBuild = null;
        } else if (state.activeBuild > i) {
          state.activeBuild--;
        }

        if (state.lastPlayed >= state.builds.length) {
          state.lastPlayed = state.builds.length - 1;
        }
      }

      await persistState();
      render();
    };

    grid.appendChild(div);
  });

  // ===== EMPTY SLOTS =====
  const remaining = 5 - state.builds.length;

  for (let i = 0; i < remaining; i++) {
    const div = document.createElement('div');
    div.className = 'build-card empty';

    div.innerHTML = `
    <div class="empty-slot">+ New Char</div>
    `;

    div.onclick = () => {
      // 🔥 FULL RESET
      const build = {
        id: crypto.randomUUID(),

        classId: null,
        expansion: null,
        level: 1,
        levelHistory: [],

        supply: [],

        presets: [{
          id: crypto.randomUUID(),
          name: "Preset 1",
          cards: []
        }],

        activePreset: 0,

        cardsInHand: [],
        cardsDiscarded: [],
        cardsLost: [],
        cardsActive: []
      };

      state.builds.push(build);
      state.activeBuild = state.builds.length - 1;

      state.selectedExpansion = null;
      state.selectedClass = null;

      state.builtHand = [];
      state.cardsInHand = [];
      state.cardsDiscarded = [];
      state.cardsLost = [];
      state.cardsActive = [];

      state.view = 'build';
      render();
    };

    grid.appendChild(div);
  }
}


function handleCardAction(card, zone) {
  const remove = arr => arr.filter(c => c.image !== card.image);

  if (zone === 'hand') {
    state.cardsInHand = remove(state.cardsInHand);
    state.cardsDiscarded.push(card);
  } else if (zone === 'discard') {
    state.cardsDiscarded = remove(state.cardsDiscarded);
    state.cardsInHand.push(card);
  } else if (zone === 'hand') {
    state.cardsLost.push(card);
  }

  queueSave();
  render();
}

// ===== ROUTER =====
async function render() {
  // 🔥 ALWAYS show Select Class first unless actively building/playing
  if (!state.view) {
    return renderSelectClass();
  }

  if (state.view === 'select') {
    return renderSelectClass();
  }

  if (!state.selectedExpansion) return renderExpansion();
  if (!state.selectedClass) return renderClass();

  if (state.view === 'build') return renderBuild();
  return renderPlay();
}

async function persistState() {
  // 🔥 Always update lastPlayed safely
  if (state.activeBuild != null) {
    state.lastPlayed = state.activeBuild;
  }

  // 🔥 Only sync build IF one is active
  if (state.activeBuild != null) {
    const build = state.builds[state.activeBuild];

    if (build) {
      if (state.view === 'play') {
        build.cardsInHand = state.cardsInHand.map(c => c.image);
        build.cardsDiscarded = state.cardsDiscarded.map(c => c.image);
        build.cardsLost = state.cardsLost.map(c => c.image);
        build.cardsActive = state.cardsActive.map(c => c.image);
      }

      build.classId = state.selectedClass;
      build.expansion = state.selectedExpansion;
    }
  }

  // 🔥 ALWAYS save — even if builds = []
  try {
    const res = await fetch('/api/deck/save', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': getCSRF()
      },
      body: JSON.stringify({
        builds: state.builds,        // can be []
        lastPlayed: state.lastPlayed ?? 0
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SAVE FAILED:", res.status, text);
    }

  } catch (err) {
    console.error("Auto-save crashed:", err);
  }
}

async function loadGame() {
  const res = await fetch('/api/deck/load', {
    credentials: 'include'
  });

  if (!res.ok) return;

  const data = await res.json();

  if (!data) return;

  if (Array.isArray(data)) {
    // fallback (shouldn’t happen anymore, but safe)
    state.builds = data;
    state.lastPlayed = 0;
  } else {
    state.builds = data.builds || [];
    state.lastPlayed = data.lastPlayed || 0;
  }

  if (state.builds.length === 0) {
    state.activeBuild = null;
    state.view = 'select';
    return;
  }

  // 🔥 Load last played
  state.activeBuild = Math.min(state.lastPlayed, state.builds.length - 1);

  const b = state.builds[state.activeBuild];

  // 🔥 Migration: initialize supply
  if (!b.supply) {

    const cls =
    data[b.expansion]?.[b.classId];

    b.level = b.level || 1;

    b.supply = cls.cards
    .filter(card => {

      const level =
      normalizeLevel(
        card.top?.level ||
        card.bottom?.level
      );

      return level === 1 || level === 'X';
    })
    .map(card => card.image);
  }

  // 🔥 Migration: initialize level history
  if (!b.levelHistory) {
    b.levelHistory = [];
  }

  const allCards = mergedCards;

  function restore(list) {
    if (!Array.isArray(list)) return [];

    const allCards = mergedCards || [];

    return list
    .map(img => allCards.find(c => c.image === img))
    .filter(Boolean);
  }

  state.cardsInHand = restore(b.cardsInHand);
  state.cardsDiscarded = restore(b.cardsDiscarded);
  state.cardsLost = restore(b.cardsLost);
  state.cardsActive = restore(b.cardsActive);

  // Restore active preset into build view
  if (
    b.presets &&
    b.presets.length > 0
  ) {
    const preset =
    b.presets[b.activePreset || 0];

    state.builtHand = restore(preset.cards);
  } else {
    state.builtHand = restore(b.cardsInHand);
  }

  state.selectedClass = b.classId;
  state.handSize = handsizeMap[b.classId] || 10;
  state.selectedExpansion = b.expansion;
}

async function waitForCards() {
  while (!mergedCards || mergedCards.length === 0) {
    await new Promise(r => setTimeout(r, 50));
  }
}
// ===== INIT =====
init();

async function init() {
  await waitForCards();   // 🔥 ADD THIS

  await loadGame();

  if (state.builds.length > 0) {
    const build = state.builds[state.activeBuild];

    state.selectedExpansion = build.expansion;
    state.selectedClass = build.classId;

    state.handSize = handsizeMap[build.classId] || 10;

    // Restore active preset into build editor
    if (
      build.presets &&
      build.presets.length > 0
    ) {
      const preset =
      build.presets[build.activePreset || 0];

      state.builtHand = preset.cards
      .map(img =>
      mergedCards.find(c => c.image === img)
      )
      .filter(Boolean);
    }

    // 🔥 Default to deck-building view
    state.view = 'build';

  } else {
    state.view = 'select';
  }



  render();
}
