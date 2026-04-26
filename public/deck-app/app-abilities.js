// --- ENHANCEMENT SYSTEM ---
const ENHANCEMENTS = [
  { id: 'attack', label: '+1 Attack', cost: 75 },
  { id: 'move', label: '+1 Move', cost: 50 },
  { id: 'range', label: '+1 Range', cost: 30 },
  { id: 'heal', label: '+1 Heal', cost: 50 },
  { id: 'target', label: '+1 Target', cost: 75 },
  { id: 'stun', label: 'Stun', cost: 150 },
  { id: 'poison', label: 'Poison', cost: 75 }
];

function getSlots(){ return 3; }
function calcCost(base, count){ return base + (count*25); }

function ensureEnh(card){
  if(!state.enhancements) state.enhancements = {};
  if(!state.enhancements[card.name]){
    state.enhancements[card.name] = {top:[], bottom:[]};
  }
  return state.enhancements[card.name];
}

function addEnhancement(card, side, type){
  const def = ENHANCEMENTS.find(e=>e.id===type);
  if(!def) return;
  const slot = ensureEnh(card)[side];
  if(slot.length >= getSlots()) return alert('No slots available');
  const cost = calcCost(def.cost, slot.length);
  slot.push({type:def.id,label:def.label,cost});
  saveState(); render();
}

function removeEnhancement(card, side, i){
  ensureEnh(card)[side].splice(i,1);
  saveState(); render();
}

// --- PATCH RENDER CARD (kept) ---
const _oldRenderCard = renderCard;
renderCard = function(card, zone){
  const base = _oldRenderCard(card, zone);
  const enh = state.enhancements?.[card.name] || {top:[],bottom:[]};

  const block = `
    <div class="enh-block">
      <div>Top: ${enh.top.map((e,i)=>`${e.label} (${e.cost}) <button data-rem="${card.name}|top|${i}">x</button>`).join('<br>')}</div>
      <div>Bottom: ${enh.bottom.map((e,i)=>`${e.label} (${e.cost}) <button data-rem="${card.name}|bottom|${i}">x</button>`).join('<br>')}</div>
      <select data-add="${card.name}|top"><option value="">Add Top</option>${ENHANCEMENTS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('')}</select>
      <select data-add="${card.name}|bottom"><option value="">Add Bottom</option>${ENHANCEMENTS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('')}</select>
    </div>
  `;

  return base.replace('</article>', block + '</article>');
}

// --- FIX: event delegation + correct instance resolution ---
function getCardInstance(name){
  return (
    state.cardsInHand.find(c=>c.name===name) ||
    state.cardsDiscarded.find(c=>c.name===name) ||
    state.cardsOnBoard.find(c=>c.name===name) ||
    state.cardsDestroyed.find(c=>c.name===name) ||
    state.abilitiesChosen.find(c=>c.name===name)
  );
}

// remove per-element bindings by overriding bindEvents safely
const _oldBind = bindEvents;
bindEvents = function(){
  _oldBind();

  // no-op: per-element listeners removed; use delegation below
}

// Delegated listeners (work across re-renders)
document.addEventListener('change', (e)=>{
  if(e.target.matches('[data-add]')){
    const [name,side] = e.target.dataset.add.split('|');
    const card = getCardInstance(name);
    if(!card || !e.target.value) return;
    addEnhancement(card, side, e.target.value);
    e.target.value='';
  }
});

document.addEventListener('click', (e)=>{
  if(e.target.matches('[data-rem]')){
    const [name,side,i] = e.target.dataset.rem.split('|');
    const card = getCardInstance(name);
    if(!card) return;
    removeEnhancement(card, side, Number(i));
  }
});
