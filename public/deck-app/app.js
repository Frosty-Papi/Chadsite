// --- Added asset helpers ---
function deckAsset(path){return `/deck-assets/${path}`}
function deckData(path){return deckAsset(`data/${path}`)}
function cardImg(c){return deckData(c.image)}
function iconImg(n){return deckData(`icons/${n}`)}

// (keeping rest of file same above...)

// --- Replace renderAbilityPool ---
function renderAbilityPool(){
 if(!state.abilityCategory)return '<p class="muted">Choose a class.</p>';
 return `<div class="image-grid">${state.abilityCategory.cards.filter(c=>c.level<=state.level).map(c=>`
   <button class="image-card ${state.abilitiesChosen.includes(c)?'chosen':''}" data-add="${c.name}">
     <img src="${cardImg(c)}" class="ability-image">
   </button>`).join('')}</div>`
}

// --- Replace renderZone ---
function renderZone(title,cards){
 return `<section class="panel zone-panel"><h2>${title}</h2><div class="image-grid">${cards.length?cards.map(c=>`
   <div class="play-card ${state.twoAbilitiesSelected.includes(c)?'selected':''}" data-pick="${c.name}">
     <img src="${cardImg(c)}" class="ability-image">
     <div class="card-actions">
       ${title==='Hand'?`<img src="${iconImg('lost.png')}" class="small-icon" data-destroy="${c.name}">`:''}
       ${title==='Discard'?`
         <img src="${iconImg('recover.png')}" class="small-icon" data-recover="${c.name}">
         <img src="${iconImg('keep-on-board.png')}" class="small-icon" data-board="${c.name}">
         <img src="${iconImg('keep-on-board-one-turn.png')}" class="small-icon" data-round="${c.name}">
       `:''}
     </div>
   </div>`).join(''):'<p class="muted">Empty</p>'}</div></section>`
}

// --- Replace renderModifiers ---
function renderModifiers(){
 return `<section class="panel"><h2>Modifiers</h2>
 <div class="modifier-row">
   <img src="${deckData('attack-modifiers/back/top.png')}" class="modifier-image">
   ${state.lastDrawnModifier?`<img src="${cardImg(state.lastDrawnModifier)}" class="modifier-image">`:''}
 </div>
 <div class="modifier-discard-scroll">
   ${state.modifiersDiscardPile.map(m=>`<img src="${cardImg(m)}" class="modifier-thumb">`).join('')}
 </div>
 <button id="drawMod" class="btn">Draw</button>
 <button id="shuffleMod" class="btn">Shuffle</button>
 </section>`
}

// --- Replace renderGear ---
function renderGear(){
 return `<section class="panel"><h2>Gear</h2><div class="image-grid">
 ${state.gearChosen.map(g=>`
   <div class="gear-card">
     <img src="${cardImg(g)}" class="gear-image">
     <div class="gear-actions">
       <img src="${iconImg('tap.png')}" class="small-icon" data-gear-tap="${g.name}">
       <img src="${iconImg('lost.png')}" class="small-icon" data-gear-lose="${g.name}">
       <img src="${iconImg('recover.png')}" class="small-icon" data-gear-restore="${g.name}">
     </div>
   </div>`).join('')}
 </div></section>`
}
