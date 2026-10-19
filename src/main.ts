import "./style.css";
import { loadStateFromLocal, exportSaveJSON, importSaveJSON } from './storage';
import { FogEngine } from './engine';
import { sounds } from './sound';

const bgElement = document.getElementById('game-bg') as HTMLDivElement;
const logContainer = document.getElementById('log-container') as HTMLDivElement;
const controlsContainer = document.getElementById('controls-container') as HTMLDivElement;
const epBtn = document.getElementById('ep-btn') as HTMLButtonElement;
const soundToggle = document.getElementById('sound-toggle') as HTMLButtonElement;
const menuToggle = document.getElementById('menu-toggle') as HTMLButtonElement;
const invToggle = document.getElementById('inv-toggle') as HTMLButtonElement;
const modalMenu = document.getElementById('modal-menu') as HTMLDivElement;
const modalInventory = document.getElementById('modal-inventory') as HTMLDivElement;
const modalEpisodes = document.getElementById('modal-episodes') as HTMLDivElement;
const closeMenu = document.getElementById('close-menu') as HTMLButtonElement;
const closeInventory = document.getElementById('close-inventory') as HTMLButtonElement;
const closeEpisodes = document.getElementById('close-episodes') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

const pointsRedVal = document.getElementById('points-red-val') as HTMLSpanElement;
const pointsBlueVal = document.getElementById('points-blue-val') as HTMLSpanElement;
const inventoryList = document.getElementById('inventory-list') as HTMLDivElement;
const episodesList = document.getElementById('episodes-list') as HTMLDivElement;

let engine: FogEngine;

function updateBackground(bgPath: string) {
  if (!bgPath) return;
  const normalized = bgPath.toLowerCase().replace(/^backgrounds\//i, '');
  bgElement.style.backgroundImage = `url(./assets/backgrounds/${normalized}.webp)`;
}

function updatePointsUI() {
  const state = engine.getState();
  const red = state.points?.value_0 || 0;
  const blue = state.points?.value_1 || 0;
  pointsRedVal.textContent = red.toString();
  pointsBlueVal.textContent = blue.toString();
}

function appendLogMessage(text: string, isChoice = false, pointChange?: { red?: number; blue?: number }) {
  const container = document.createElement('div');
  container.className = isChoice ? 'story-choice-echo animate-fade-in' : 'story-line animate-fade-in';
  container.innerHTML = text.replace(/\n/g, '<br/>');

  if (pointChange) {
    if (pointChange.red && pointChange.red !== 0) {
      const b = document.createElement('span');
      b.className = 'point-badge-change red';
      b.textContent = `${pointChange.red > 0 ? '+' : ''}${pointChange.red} Сила`;
      container.appendChild(document.createElement('br'));
      container.appendChild(b);
    }
    if (pointChange.blue && pointChange.blue !== 0) {
      const b = document.createElement('span');
      b.className = 'point-badge-change blue';
      b.textContent = `${pointChange.blue > 0 ? '+' : ''}${pointChange.blue} Рассудок`;
      container.appendChild(document.createElement('br'));
      container.appendChild(b);
    }
  }

  logContainer.appendChild(container);

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });
}

function renderControls() {
  controlsContainer.innerHTML = '';
  updatePointsUI();

  const state = engine.getState();
  const currentLine = engine.getCurrentLine();

  const epNames: Record<string, string> = {
    nazareth: 'Назарет',
    virsavia: 'Вирсавия',
    gilgal: 'Галгал',
  };
  epBtn.textContent = epNames[state.currentEpisode] || state.currentEpisode;

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

  // If no active quest: Show quest hub + Next Story Button!
  if (!state.currentQuestId) {
    const quests = engine.getAvailableQuests();
    const allDone = quests.length > 0 && quests.every((q) => q.isDone);

    const title = document.createElement('div');
    title.style.cssText = 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--color-fog-muted);margin-bottom:0.75rem;font-weight:600;display:flex;justify-content:space-between;align-items:center;';
    title.innerHTML = `
      <span>Локации: Глава ${state.currentStory}</span>
      <span style="color:var(--color-fog-gold);">${allDone ? 'Ветка пройдена' : ''}</span>
    `;
    controlsContainer.appendChild(title);

    // If all quests in this story are completed: Show prominent "Продолжить путь" button!
    if (allDone) {
      const nextStoryBtn = document.createElement('button');
      nextStoryBtn.className = 'fog-btn-action';
      nextStoryBtn.style.marginBottom = '0.75rem';
      nextStoryBtn.innerHTML = `
        <span>Продолжить путь (Следующая глава)</span>
        <span style="font-size:1rem;">➔</span>
      `;
      nextStoryBtn.addEventListener('click', () => {
        sounds.playAmbient();
        engine.advanceToNextStory();
      });
      controlsContainer.appendChild(nextStoryBtn);
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:0.75rem;';

    for (const q of quests) {
      const card = document.createElement('button');
      card.style.cssText = `
        padding: 1rem;
        text-align: left;
        border-radius: 6px;
        border: 1px solid ${q.isDone ? 'rgba(35,42,53,0.4)' : 'var(--color-fog-border)'};
        background: ${q.isDone ? 'rgba(20,24,31,0.4)' : 'var(--color-fog-surface)'};
        opacity: ${q.isDone ? '0.6' : '1'};
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      card.innerHTML = `
        <div style="color:var(--color-fog-gold);font-weight:600;font-size:0.95rem;margin-bottom:0.25rem;">${q.name}</div>
        <div style="color:var(--color-fog-muted);font-size:0.8rem;line-height:1.4;">${q.desc || 'Продолжить исследование...'}</div>
        <div style="font-size:0.65rem;margin-top:0.5rem;text-transform:uppercase;letter-spacing:0.1em;color:${q.isDone ? 'var(--color-fog-muted)' : 'var(--color-fog-gold)'}">
          ${q.isDone ? '[Переиграть заново]' : '[Отправиться]'}
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'var(--color-fog-gold)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = q.isDone ? 'rgba(35,42,53,0.4)' : 'var(--color-fog-border)';
      });
      card.addEventListener('click', () => {
        sounds.playAmbient();
        engine.selectQuest(q.id);
      });

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

function renderInventoryModal() {
  inventoryList.innerHTML = '';
  const state = engine.getState();
  const catalog = engine.getItemsCatalog();
  const items = Object.entries(state.inventory || {}).filter(([_, count]) => count > 0);

  if (items.length === 0) {
    inventoryList.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 1.5rem; color:var(--color-fog-muted); font-size:0.85rem;">
        Инвентарь пуст. Исследуйте локации, чтобы находить предметы.
      </div>
    `;
    return;
  }

  for (const [itemId, count] of items) {
    const card = document.createElement('div');
    card.className = 'inventory-item-card';

    const itemData = catalog[itemId];
    const imgPath = itemData?.image?.path || itemId;
    const cleanImg = imgPath.toLowerCase().replace(/^items\//i, '');

    card.innerHTML = `
      <img src="./assets/items/${cleanImg}.webp" class="inventory-item-img" onerror="this.style.display='none'" />
      <span class="inventory-item-name">${itemId}</span>
      <span class="inventory-item-count">x${count}</span>
    `;
    inventoryList.appendChild(card);
  }
}

function renderEpisodesModal() {
  episodesList.innerHTML = '';
  const state = engine.getState();
  const episodes = engine.getEpisodesCatalog();

  const epNames: Record<string, string> = {
    nazareth: 'Назарет (Эпизод 1)',
    virsavia: 'Вирсавия (Эпизод 2)',
    gilgal: 'Галгал (Эпизод 3)',
  };

  for (const [epId, _] of Object.entries(episodes)) {
    const btn = document.createElement('button');
    btn.className = 'fog-modal-btn';
    const isActive = state.currentEpisode === epId;
    btn.style.borderColor = isActive ? 'var(--color-fog-gold)' : 'var(--color-fog-border)';
    btn.innerHTML = `
      <span style="color:${isActive ? 'var(--color-fog-gold)' : 'var(--color-fog-text)'}">${epNames[epId] || epId}</span>
      <span style="font-size:0.7rem;color:var(--color-fog-muted);">${isActive ? '[Текущий]' : ''}</span>
    `;

    btn.addEventListener('click', () => {
      if (state.currentEpisode !== epId) {
        state.currentEpisode = epId;
        state.currentStory = '0';
        state.currentQuestId = '0';
        state.currentLineId = 'Line_0';
        modalEpisodes.style.display = 'none';
        engine.selectQuest('0');
      }
    });

    episodesList.appendChild(btn);
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
    (text, isChoice, pointChange) => {
      appendLogMessage(text, isChoice, pointChange);
    }
  );

  await engine.init();

  const state = engine.getState();
  if (state.history.length > 0) {
    for (const h of state.history) {
      appendLogMessage(h.text, h.isChoice, (h as any).pointChange);
    }
  } else {
    engine.processLine('Line_0');
  }

  updateBackground(state.currentBackground);
  renderControls();

  // Header and modal events
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

  invToggle.addEventListener('click', () => {
    renderInventoryModal();
    modalInventory.style.display = 'flex';
  });
  closeInventory.addEventListener('click', () => {
    modalInventory.style.display = 'none';
  });

  epBtn.addEventListener('click', () => {
    renderEpisodesModal();
    modalEpisodes.style.display = 'flex';
  });
  closeEpisodes.addEventListener('click', () => {
    modalEpisodes.style.display = 'none';
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

  window.addEventListener(
    'click',
    () => {
      sounds.playAmbient();
    },
    { once: true }
  );
}

start();
