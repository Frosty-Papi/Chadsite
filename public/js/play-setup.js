const builder = document.getElementById('layout-builder');
const grid = 5;
let widgets = [];

function snap(v){return Math.round(v/grid)*grid;}

builder?.addEventListener('click', (e)=>{
  if(e.target.classList.contains('widget-btn')){
    const type = e.target.dataset.widgetType;
    const w = {id:Date.now(),type,x:0,y:0,width:100,height:50};
    widgets.push(w);
    render();
  }
});

function render(){
  builder.innerHTML='';
  widgets.forEach(w=>{
    const el=document.createElement('div');
    el.className='widget';
    el.style.left=w.x+'px';
    el.style.top=w.y+'px';
    el.style.width=w.width+'px';
    el.style.height=w.height+'px';
    el.textContent=w.type;
    el.draggable=true;
    el.ondragend=(ev)=>{
      w.x=snap(ev.offsetX);
      w.y=snap(ev.offsetY);
      render();
    };
    builder.appendChild(el);
  });
}

render();

document.getElementById('save-config-btn')?.addEventListener('click', async ()=>{
  const body={
    gameId:window.PLAY_SETUP_BOOTSTRAP.gameId,
    name:document.getElementById('config-name').value,
    description:document.getElementById('config-description').value,
    layoutJson:JSON.stringify({widgets}),
    isPublic:document.getElementById('config-public').checked,
    makeDefault:document.getElementById('config-default').checked
  };

  await fetch('/api/play/configurations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  alert('Saved');
});

document.getElementById('play-setup-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form=e.target;

  const body={
    gameId:form.gameId.value,
    configurationId:document.querySelector('input[name="configurationId"]:checked')?.value,
    title:form.title.value,
    visibility:form.visibility.value,
    maxPlayers:form.maxPlayers.value
  };

  const res=await fetch('/api/play/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json();
  if(data.redirectUrl) location.href=data.redirectUrl;
});
