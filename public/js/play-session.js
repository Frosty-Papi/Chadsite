const board=document.getElementById('session-board');
let state=window.PLAY_SESSION_BOOTSTRAP.state||{};

function getCSRFToken(){return document.querySelector('meta[name="csrf-token"]')?.content||"";}

function render(){
  board.innerHTML='';
  (state.widgets||[]).forEach(w=>{
    const el=document.createElement('div');
    el.className='widget';
    el.style.left=w.x+'px';
    el.style.top=w.y+'px';
    el.style.width=w.width+'px';
    el.style.height=w.height+'px';
    el.textContent=w.type;
    board.appendChild(el);
  });
}

async function sync(){
  await fetch(`/api/play/sessions/${window.PLAY_SESSION_BOOTSTRAP.sessionId}/state`,{
    method:'POST',headers:{'Content-Type':'application/json','CSRF-Token':getCSRFToken()},
    body:JSON.stringify({state})
  });
}

render();

document.getElementById('terminate-btn')?.addEventListener('click',async ()=>{
  await fetch(`/api/play/sessions/${window.PLAY_SESSION_BOOTSTRAP.sessionId}/terminate`,{
    method:'POST',headers:{'Content-Type':'application/json','CSRF-Token':getCSRFToken()},
    body:JSON.stringify({outcome:'completed'})
  });
  location.href='/play';
});
