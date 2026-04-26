import { state } from './state.js';

const ENHANCEMENTS = [
  { id: 'attack', label: '+1 Attack', cost: 75 },
  { id: 'move', label: '+1 Move', cost: 50 },
  { id: 'range', label: '+1 Range', cost: 30 },
  { id: 'heal', label: '+1 Heal', cost: 50 },
  { id: 'target', label: '+1 Target', cost: 75 }
];

function ensureEnh(card){
  if(!state.enhancements) state.enhancements={};
  if(!state.enhancements[card.name]) state.enhancements[card.name]={top:[],bottom:[]};
  return state.enhancements[card.name];
}

function addEnh(card,side,type){
  const def=ENHANCEMENTS.find(e=>e.id===type);
  if(!def)return;
  ensureEnh(card)[side].push({label:def.label,cost:def.cost});
  render();
}

function remEnh(card,side,i){
  ensureEnh(card)[side].splice(i,1);
  render();
}

function getCard(name){
  return state.cardsInHand.find(c=>c.name===name)||
         state.cardsDiscarded.find(c=>c.name===name)||
         state.cardsOnBoard.find(c=>c.name===name)||
         state.cardsDestroyed.find(c=>c.name===name);
}

function renderCard(card,zone){
  const enh=state.enhancements?.[card.name]||{top:[],bottom:[]};

  const el=document.createElement('div');
  el.className='card';

  el.innerHTML=`
    <div class="card-inner">
      <img src="${card.image?'/deck-assets/data/'+card.image:''}" />
      <div class="card-overlay">
        <div class="card-title">${card.name}</div>

        <div class="enh">
          <div>
            <b>Top</b>
            ${enh.top.map((e,i)=>`<span class="chip">${e.label}<button data-rem="${card.name}|top|${i}">×</button></span>`).join('')}
            <select data-add="${card.name}|top"><option value="">+</option>${ENHANCEMENTS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('')}</select>
          </div>

          <div>
            <b>Bottom</b>
            ${enh.bottom.map((e,i)=>`<span class="chip">${e.label}<button data-rem="${card.name}|bottom|${i}">×</button></span>`).join('')}
            <select data-add="${card.name}|bottom"><option value="">+</option>${ENHANCEMENTS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('')}</select>
          </div>
        </div>

        <div class="actions">
          ${zone==='hand'?'<button data-act="discard">Discard</button><button data-act="lose">Lose</button>':''}
          ${zone==='discard'?'<button data-act="recover">Recover</button>':''}
          ${zone==='active'?'<button data-act="discard">End</button>':''}
        </div>
      </div>
    </div>
  `;

  return el;
}

function renderZone(title,cards,zone){
  const sec=document.createElement('div');
  sec.className='zone';

  const h=document.createElement('h2');
  h.textContent=`${title} (${cards.length})`;

  const grid=document.createElement('div');
  grid.className='grid';

  cards.forEach(c=>grid.appendChild(renderCard(c,zone)));

  sec.appendChild(h);
  sec.appendChild(grid);
  return sec;
}

function render(){
  const app=document.getElementById('app');
  app.innerHTML='';

  app.appendChild(renderZone('Hand',state.cardsInHand,'hand'));
  app.appendChild(renderZone('Active',state.cardsOnBoard,'active'));
  app.appendChild(renderZone('Discard',state.cardsDiscarded,'discard'));
  app.appendChild(renderZone('Lost',state.cardsDestroyed,'lost'));
}

// delegation
document.addEventListener('change',e=>{
  if(e.target.matches('[data-add]')){
    const [n,s]=e.target.dataset.add.split('|');
    const c=getCard(n);
    if(!c||!e.target.value)return;
    addEnh(c,s,e.target.value);
    e.target.value='';
  }
});

document.addEventListener('click',e=>{
  if(e.target.matches('[data-rem]')){
    const [n,s,i]=e.target.dataset.rem.split('|');
    const c=getCard(n);
    if(!c)return;
    remEnh(c,s,Number(i));
  }
});

render();
