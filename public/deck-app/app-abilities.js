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

// --- PATCH RENDER CARD ---
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

// --- PATCH EVENTS ---
const _oldBind = bindEvents;
bindEvents = function(){
  _oldBind();

  document.querySelectorAll('[data-add]').forEach(el=>{
    el.addEventListener('change',()=>{
      const [name,side]=el.dataset.add.split('|');
      const card = findCard(name);
      addEnhancement(card, side, el.value);
    });
  });

  document.querySelectorAll('[data-rem]').forEach(el=>{
    el.addEventListener('click',()=>{
      const [name,side,i]=el.dataset.rem.split('|');
      const card = findCard(name);
      removeEnhancement(card, side, Number(i));
    });
  });
}
