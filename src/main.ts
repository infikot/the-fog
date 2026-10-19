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
  bgElement.style.backgroundImage = `url(./backgrounds/${normalized}.webp)`;
}

function appendLogMessage(text: string, isChoice = false) {
  const p = document.createElement('p');
  p.className = isChoice
    ? 'text-fog-gold italic my-3 border-l-2 border-fog-gold/50 pl-3 leading-relaxed text-sm md:text-base'
    : 'text-fog-text/90 my-2 leading-relaxed text-sm md:text-base font-normal tracking-wide animate-fade-in';
  p.innerHTML = text.replace(/\n/g, '<br/>');
  logContainer.appendChild(p);

  // Auto-scroll to bottom smoothly
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });
}

function renderControls() {
  controlsContainer.innerHTML = '';

  const state = engine.getState();
  const currentLine = engine.getCurrentLine();

  if (state.gameFinished) {
    controlsContainer.innerHTML = `
      <div class="text-center p-6 bg-fog-surface/80 rounded-lg border border-fog-accent/30">
        <h2 class="text-2xl font-serif text-fog-gold mb-2">ФИНАЛ</h2>
        <p class="text-fog-text/80 text-sm mb-4">Вы прошли сквозь все испытания Тумана.</p>
        <button id="btn-final-restart" class="px-6 py-2 bg-fog-accent hover:bg-fog-accent/80 text-white rounded text-sm transition">Начать сначала</button>
      </div>
    `;
    document.getElementById('btn-final-restart')?.addEventListener('click', () => {
      engine.restartGame();
    });
    return;
  }

  // If in quest hub (no active quest or between quests)
  if (!state.currentQuestId) {
    const quests = engine.getAvailableQuests();
    const title = document.createElement('h3');
    title.className = 'text-xs uppercase tracking-widest text-fog-muted mb-3 font-semibold';
    title.textContent = 'Доступные пути:';
    controlsContainer.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';

    for (const q of quests) {
      const isDone = state.completedQuests.includes(q.id);
      const card = document.createElement('button');
      card.className = `p-4 text-left rounded border transition flex flex-col justify-between ${
        isDone
          ? 'bg-fog-surface/40 border-fog-border/30 opacity-60 cursor-not-allowed'
          : 'bg-fog-surface/90 hover:bg-fog-surface border-fog-border hover:border-fog-gold/60 shadow-lg'
      }`;
      card.disabled = isDone;

      card.innerHTML = `
        <div>
          <div class="text-fog-gold font-medium text-base mb-1">${q.name}</div>
          <div class="text-fog-muted text-xs line-clamp-2">${q.desc || 'Продолжить исследование...'}</div>
        </div>
        <div class="text-[10px] mt-2 tracking-wider ${isDone ? 'text-fog-muted' : 'text-fog-gold/80'} uppercase">
          ${isDone ? '[Исследовано]' : '[Отправиться]'}
        </div>
      `;

      if (!isDone) {
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
    list.className = 'flex flex-col gap-2.5 w-full';

    const items = Object.values(choiceComponent.items) as any[];
    for (const it of items) {
      const questTexts = (engine as any).currentQuestData?.texts?.ru;
      const rawText = questTexts?.[it.text]?.text || engine.getCommonRu()?.[it.text]?.text || it.text;

      // Extract text from quest ru if exists
      const btn = document.createElement('button');
      btn.className =
        'p-3.5 bg-fog-surface/90 hover:bg-fog-surface hover:border-fog-gold/70 border border-fog-border rounded text-fog-text text-sm md:text-base text-left transition shadow-md flex items-center justify-between group';

      btn.innerHTML = `
        <span class="group-hover:text-fog-gold transition">${rawText}</span>
        <span class="text-fog-muted group-hover:text-fog-gold transition text-xs">➔</span>
      `;

      btn.addEventListener('click', () => {
        sounds.playAmbient();
        engine.choose(it.line, rawText);
      });

      list.appendChild(btn);
    }

    controlsContainer.appendChild(list);
  } else {
    // Single Next Step Button
    const btn = document.createElement('button');
    btn.className =
      'w-full py-3.5 px-6 bg-fog-surface/90 hover:bg-fog-surface border border-fog-border hover:border-fog-gold/60 rounded text-fog-gold text-sm tracking-widest uppercase font-medium transition shadow-md flex items-center justify-center gap-2 group';

    btn.innerHTML = `
      <span>Продолжить</span>
      <span class="group-hover:translate-x-1 transition text-xs">➔</span>
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

  // Render previous history
  const state = engine.getState();
  if (state.history.length > 0) {
    for (const h of state.history) {
      appendLogMessage(h.text, h.isChoice);
    }
  } else {
    // Initial start: process Line_0
    engine.step();
  }

  updateBackground(state.currentBackground);
  renderControls();

  // Setup header events
  soundToggle.addEventListener('click', () => {
    const isMuted = sounds.toggleMute();
    soundToggle.textContent = isMuted ? '🔇' : '🔊';
  });

  menuToggle.addEventListener('click', () => {
    modalMenu.classList.remove('hidden');
    modalMenu.classList.add('flex');
  });

  closeMenu.addEventListener('click', () => {
    modalMenu.classList.add('hidden');
    modalMenu.classList.remove('flex');
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
