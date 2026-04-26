import { state } from './state.js';

function stripState(){
 state.modifiers=[];
 state.allGear=[];
 state.battleGoals=[];
 state.perks=[];
}

function stripDOM(){
 document.querySelectorAll('[class*=modifier],[class*=gear],[class*=battle]').forEach(el=>el.remove());
}

new MutationObserver(()=>{stripState();stripDOM();}).observe(document.body,{childList:true,subtree:true});
stripState();
stripDOM();
