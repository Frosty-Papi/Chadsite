const root = document.getElementById('play-setup-root');
const builder = document.getElementById('layout-builder');
const grid = 5;

function getCSRFToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

function snap(v) {
  return Math.round(v / grid) * grid;
}

function parseJsonAttribute(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

const bootstrap = {
  gameId: root?.dataset.gameId || "",
  defaultLayout: parseJsonAttribute(root?.dataset.defaultLayout, { gridSize: 5, widgets: [] }),
  playerBounds: {
    min: Number(root?.dataset.playerMin || 1),
    max: Number(root?.dataset.playerMax || 4)
  }
};

let widgets = Array.isArray(bootstrap.defaultLayout?.widgets)
  ? [...bootstrap.defaultLayout.widgets]
  : [];

function render() {
  if (!builder) return;
  builder.innerHTML = '';
  widgets.forEach(w => {
    const el = document.createElement('div');
    el.className = 'widget';
    el.style.left = `${w.x || 0}px`;
    el.style.top = `${w.y || 0}px`;
    el.style.width = `${w.width || w.w || 100}px`;
    el.style.height = `${w.height || w.h || 50}px`;
    el.textContent = w.type || 'widget';
    el.draggable = true;
    el.ondragend = (ev) => {
      w.x = snap(ev.offsetX);
      w.y = snap(ev.offsetY);
      render();
    };
    builder.appendChild(el);
  });
}

document.querySelectorAll('.widget-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.widgetType;
    const w = { id: Date.now(), type, x: 0, y: 0, width: 100, height: 50 };
    widgets.push(w);
    render();
  });
});

render();

document.getElementById('save-config-btn')?.addEventListener('click', async () => {
  const body = {
    gameId: bootstrap.gameId,
    name: document.getElementById('config-name')?.value || 'My Layout',
    description: document.getElementById('config-description')?.value || '',
    layoutJson: JSON.stringify({ gridSize: 5, widgets }),
    isPublic: !!document.getElementById('config-public')?.checked,
    makeDefault: !!document.getElementById('config-default')?.checked
  };

  const response = await fetch('/api/play/configurations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': getCSRFToken(),
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(data.error || 'Failed to save configuration');
    return;
  }

  alert('Saved');
});

document.getElementById('play-setup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  const body = {
    gameId: form.gameId.value,
    configurationId: document.querySelector('input[name="configurationId"]:checked')?.value,
    title: form.title.value,
    visibility: form.visibility.value,
    maxPlayers: form.maxPlayers.value
  };

  const res = await fetch('/api/play/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': getCSRFToken(),
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Failed to start session');
    return;
  }

  if (data.redirectUrl) location.href = data.redirectUrl;
});
