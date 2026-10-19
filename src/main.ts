import "./style.css";
import { loadStateFromLocal, exportSaveJSON, importSaveJSON } from './storage';
import { FogEngine } from './engine';
import { sounds } from './sound';

const bgElement = document.getElementById('game-bg') as HTMLDivElement;
const logContainer = document.getElementById('log-container') as HTMLDivElement;
const controlsContainer = document.getElementById('controls-container') as HTMLDivElement;
const statusIndicator = document.getElementById('status-indicator') as HTMLSpanElement;
const soundToggle = document.getElementById('sound-toggle') as HTMLButtonElement;
const menuToggle = document.getElementById('menu-toggle') as HTMLButtonElement;
const modalMenu = document.getElementById('modal-menu') as HTMLDivElement;
const closeMenu = document.getElementById('close-menu') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

let engine: FogEngine;

function updateBackground(bgPath: string) {
  if (!bgPath) return;
  const normalized = bgPath.toLowerCase().replace(/^backgrounds\//i, '');
  bgElement.style.backgroundImage = `url(./assets/backgrounds/${normalized}.webp)`;
}

function appendLogMessage(text: string, isChoice = false) {
  const p = document.createElement('p');
  p.className = isChoice ? 'story-choice-echo animate-fade-in' : 'story-line animate-fade-in';
  p.innerHTML = text.replace(/\n/g, '<br/>');
  logContainer.appendChild(p);

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });
}

function renderControls() {
  controlsContainer.innerHTML = '';

  const state = engine.getState();
  const currentLine = engine.getCurrentLine();

  // Update Episode status in header
  const epNames: Record<string, string> = {
    nazareth: 'Назарет',
    virsavia: 'Вирсавия',
    gilgal: 'Галгал',
  };
  statusIndicator.textContent = epNames[state.currentEpisode] || state.currentEpisode;

  if (state.gameFinished) {
    controlsContainer.innerHTML = `
      <div style="text-align:center;padding:1.5rem;background:var(--color-fog-surface);border:1px solid var(--color-fog-border);border-radius:8px;">
        <h2 style="font-family:var(--font-serif);color:var(--color-fog-gold);font-size:1.4rem;margin-bottom:0.5rem;">ФИНАЛ</h2>
        <p style="color:var(--color-fog-muted);font-size:0.85rem;margin-bottom:1rem;">Вы прошли сквозь все испытания Тумана.</p>
        <button id="btn-final-restart" class="fog-btn-action">Начать сначала</button>
      </div>
    `;
    document.getElementById('btn-final-restart')?.addEventListener('click', () => {
      engine.restartGame();
    });
    return;
  }

  // Quest hub (if no active quest)
  if (!state.currentQuestId) {
    const quests = engine.getAvailableQuests();
    const title = document.createElement('div');
    title.style.cssText = 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--color-fog-muted);margin-bottom:0.75rem;font-weight:600;';
    title.textContent = 'Доступные пути:';
    controlsContainer.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:0.75rem;';

    for (const q of quests) {
      const isDone = state.completedQuests.includes(q.id);
      const card = document.createElement('button');
      card.style.cssText = `
        padding: 1rem;
        text-align: left;
        border-radius: 6px;
        border: 1px solid ${isDone ? 'rgba(35,42,53,0.4)' : 'var(--color-fog-border)'};
        background: ${isDone ? 'rgba(20,24,31,0.4)' : 'var(--color-fog-surface)'};
        opacity: ${isDone ? '0.5' : '1'};
        cursor: ${isDone ? 'not-allowed' : 'pointer'};
        transition: all 0.2s ease;
      `;
      card.disabled = isDone;

      card.innerHTML = `
        <div style="color:var(--color-fog-gold);font-weight:600;font-size:0.95rem;margin-bottom:0.25rem;">${q.name}</div>
        <div style="color:var(--color-fog-muted);font-size:0.8rem;line-height:1.4;">${q.desc || 'Продолжить исследование...'}</div>
        <div style="font-size:0.65rem;margin-top:0.5rem;text-transform:uppercase;letter-spacing:0.1em;color:${isDone ? 'var(--color-fog-muted)' : 'var(--color-fog-gold)'}">
          ${isDone ? '[Исследовано]' : '[Отправиться]'}
        </div>
      `;

      if (!isDone) {
        card.addEventListener('mouseenter', () => {
          card.style.borderColor = 'var(--color-fog-gold)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.borderColor = 'var(--color-fog-border)';
        });
        card.addEventListener('click', () => {
          sounds.playAmbient();
          engine.selectQuest(q.id);
        });
      }

      grid.appendChild(card);
    }

    controlsContainer.appendChild(grid);
    return;
  }

  if (!currentLine) return;

  // Check choices component
  let choiceComponent: any = null;
  for (const comp of Object.values(currentLine.components)) {
    if (comp.type === 'line_choose' && comp.items) {
      choiceComponent = comp;
      break;
    }
  }

  if (choiceComponent) {
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;width:100%;';

    const items = Object.values(choiceComponent.items) as any[];
    for (const it of items) {
      const currentQuest = (engine as any).getCurrentQuestObj();
      const rawText = currentQuest?.texts?.[it.text]?.text || engine.getCommonRu()?.[it.text]?.text || it.text;

      const btn = document.createElement('button');
      btn.className = 'fog-btn-choice';
      btn.innerHTML = `
        <span>${rawText}</span>
        <span class="choice-arrow">➔</span>
      `;

      btn.addEventListener('click', () => {
        sounds.playAmbient();
        engine.choose(it.line, rawText);
      });

      list.appendChild(btn);
    }

    controlsContainer.appendChild(list);
  } else {
    // Next step button
    const btn = document.createElement('button');
    btn.className = 'fog-btn-action';
    btn.innerHTML = `
      <span>Продолжить</span>
      <span style="font-size:0.8rem;">➔</span>
    `;

    btn.addEventListener('click', () => {
      sounds.playAmbient();
      engine.step();
    });

    controlsContainer.appendChild(btn);
  }
}

async function start() {
  const savedState = loadStateFromLocal();

  engine = new FogEngine(
    savedState,
    (state) => {
      updateBackground(state.currentBackground);
      renderControls();
    },
    (text, isChoice) => {
      appendLogMessage(text, isChoice);
    }
  );

  await engine.init();

  const state = engine.getState();
  if (state.history.length > 0) {
    for (const h of state.history) {
      appendLogMessage(h.text, h.isChoice);
    }
  } else {
    // Process initial Line_0
    engine.processLine('Line_0');
  }

  updateBackground(state.currentBackground);
  renderControls();

  // Setup header events
  soundToggle.addEventListener('click', () => {
    const isMuted = sounds.toggleMute();
    soundToggle.textContent = isMuted ? '🔇' : '🔊';
  });

  menuToggle.addEventListener('click', () => {
    modalMenu.style.display = 'flex';
  });

  closeMenu.addEventListener('click', () => {
    modalMenu.style.display = 'none';
  });

  btnRestart.addEventListener('click', () => {
    if (confirm('Начать игру заново? Весь текущий прогресс будет сброшен.')) {
      engine.restartGame();
    }
  });

  btnExport.addEventListener('click', () => {
    const jsonStr = exportSaveJSON(engine.getState());
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the_fog_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnImport.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = importSaveJSON(text);
    if (imported) {
      localStorage.setItem('thefog_save_state_v1', JSON.stringify(imported));
      alert('Сохранение успешно импортировано!');
      location.reload();
    } else {
      alert('Ошибка при чтении файла сохранения!');
    }
  });

  // Global click gesture for sound
  window.addEventListener(
    'click',
    () => {
      sounds.playAmbient();
    },
    { once: true }
  );
}

start();
