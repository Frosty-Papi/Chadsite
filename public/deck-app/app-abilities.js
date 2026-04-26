import { state } from './state.js';

function initState(){
  state.abilitiesChosen=[];
  state.cardsInHand=[];
  state.cardsDiscarded=[];
  state.cardsDestroyed=[];
  state.cardsOnBoard=[];
  state.twoAbilitiesSelected=[];
  state.turn=1;
  state.enhancementSelections={};
}

function loadData(){
  state.abilities = window.abilities || [];
}

function render(){
  const app=document.getElementById('app');
  app.innerHTML=`
    <div class='deck-app'>
      <div class='panel'>
        <h2>Ability Cards</h2>
        <div id='abilities'></div>
      </div>
      <div class='panel'>
        <h2>Hand</h2>
        <div id='hand'></div>
      </div>
      <div class='panel'>
        <h2>Enhancements</h2>
        <div id='enhancements'></div>
      </div>
    </div>
  `;

  renderAbilities();
  renderHand();
  renderEnhancements();
}

function renderAbilities(){
  const el=document.getElementById('abilities');
  el.innerHTML='';
  state.abilities.forEach(cat=>{
    (cat.cards||[]).forEach(card=>{
      const div=document.createElement('div');
      div.textContent=card.name;
      div.onclick=()=>addCard(card);
      el.appendChild(div);
    });
  });
}

function renderHand(){
  const el=document.getElementById('hand');
  el.innerHTML='';
  state.cardsInHand.forEach(card=>{
    const div=document.createElement('div');
    div.textContent=card.name;
    el.appendChild(div);
  });
}

function renderEnhancements(){
  const el=document.getElementById('enhancements');
  el.innerHTML='';
  state.cardsInHand.forEach(card=>{
    const div=document.createElement('div');
    div.innerHTML=`${card.name} <button>Edit</button>`;
    div.querySelector('button').onclick=()=>editEnhancement(card);
    el.appendChild(div);
  });
}

function addCard(card){
  if(!state.cardsInHand.includes(card)){
    state.cardsInHand.push(card);
    render();
  }
}

function editEnhancement(card){
  const val=prompt('Edit enhancement (top text):',card.top||'');
  if(val!==null){
    card.top=val;
    render();
  }
}

function init(){
  initState();
  loadData();
  render();
}

init();
