import { FogEngine } from './engine';
import { SoundManager } from './sounds';
import { loadStateFromLocal, exportSaveJSON, importSaveJSON } from './storage';
import { GameState } from './types';

// Initialize audio and engine
const sounds = new SoundManager();
const engine = new FogEngine(
  loadStateFromLocal(),
  (state) => renderApp(state),
  (text, isChoice, pointChange) => appendLogMessage(text, isChoice, pointChange)
);

// UI Element References
const screenMenu = document.getElementById('screen-menu')!;
const screenHub = document.getElementById('screen-hub')!;
const screenQuest = document.getElementById('screen-quest')!;
const gameBg = document.getElementById('game-bg')!;

const btnStart = document.getElementById('menu-btn-start')!;
const btnContinue = document.getElementById('menu-btn-continue')!;
const btnSettingsMenu = document.getElementById('menu-btn-settings')!;
const btnSoundMenu = document.getElementById('menu-btn-sound')!;
const menuSoundIcon = document.getElementById('menu-sound-icon')!;

const questBtnMenu = document.getElementById('quest-btn-menu')!;
const questBtnInv = document.getElementById('quest-btn-inv')!;
const questBtnSound = document.getElementById('quest-btn-sound')!;
const questSoundIcon = document.getElementById('quest-sound-icon')!;

const pointsRedVal = document.getElementById('points-red-val')!;
const pointsBlueVal = document.getElementById('points-blue-val')!;
const logContainer = document.getElementById('log-container')!;
const controlsContainer = document.getElementById('controls-container')!;

// Settings Modal & Audio Sliders
const modalSettings = document.getElementById('modal-settings')!;
const closeSettings = document.getElementById('close-settings')!;
const sliderSfx = document.getElementById('slider-sfx') as HTMLInputElement;
const sliderAmbient = document.getElementById('slider-ambient') as HTMLInputElement;
const sfxValText = document.getElementById('val-sfx')!;
const ambientValText = document.getElementById('val-ambient')!;
const btnExport = document.getElementById('btn-export')!;
const btnImport = document.getElementById('btn-import')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const btnRestart = document.getElementById('btn-restart')!;

// Inventory Modal
const modalInventory = document.getElementById('modal-inventory')!;
const closeInventory = document.getElementById('close-inventory')!;
const inventoryList = document.getElementById('inventory-list')!;

// Hub Carousel Elements
const hubEpTitle = document.getElementById('hub-ep-title')!;
const hubStoryTitle = document.getElementById('hub-story-title')!;
const cardContainer = document.getElementById('card-container')!;
const questNameEl = document.getElementById('quest-name')!;
const questDescEl = document.getElementById('quest-desc')!;
const btnPrevQuest = document.getElementById('btn-prev-quest')!;
const btnNextQuest = document.getElementById('btn-next-quest')!;
const hubActionContainer = document.getElementById('hub-action-container')!;

let currentCarouselIndex = 0;
let hubQuestsList: Array<{ id: string; name: string; desc: string; cards: string[]; isDone: boolean }> = [];
let lastBackgroundPath = '';
let peekTimeout: any = null;

// ========================================================
// APP ROUTING & STATE RENDERER
// ========================================================
function renderApp(state: GameState): void {
  updateBackground(state.currentBackground);
  updatePoints(state);
  updateSoundIcons();

  if (state.currentScreen === 'menu') {
    screenMenu.style.display = 'flex';
    screenHub.style.display = 'none';
    screenQuest.style.display = 'none';
    btnContinue.style.display = state.hasStartedSession ? 'flex' : 'none';
  } else if (state.currentScreen === 'story_hub') {
    screenMenu.style.display = 'none';
    screenHub.style.display = 'flex';
    screenQuest.style.display = 'none';
    renderHub(state);
  } else if (state.currentScreen === 'quest') {
    screenMenu.style.display = 'none';
    screenHub.style.display = 'none';
    screenQuest.style.display = 'flex';
    renderQuest(state);
  }
}

function updateBackground(bgPath: string): void {
  if (!bgPath) return;
  const clean = bgPath.replace(/^Backgrounds\//, '').replace(/\.(png|jpg|webp)$/i, '');
  const url = `./assets/backgrounds/${clean}.webp`;

  if (bgPath !== lastBackgroundPath) {
    lastBackgroundPath = bgPath;
    
    // Preload image in memory so it's ready before revealing
    const img = new Image();
    img.src = url;
    img.onload = () => {
      gameBg.style.backgroundImage = `url('${url}')`;
      triggerTemporaryPeek(1200);
    };
    img.onerror = () => {
      gameBg.style.backgroundImage = `url('${url}')`;
    };
  }
}

function triggerTemporaryPeek(durationMs: number = 1200): void {
  document.body.classList.add('peeking');
  if (peekTimeout) clearTimeout(peekTimeout);
  peekTimeout = setTimeout(() => {
    document.body.classList.remove('peeking');
    peekTimeout = null;
  }, durationMs);
}

function updatePoints(state: GameState): void {
  if (pointsRedVal) pointsRedVal.textContent = String(state.points.value_0 || 0);
  if (pointsBlueVal) pointsBlueVal.textContent = String(state.points.value_1 || 0);
}

function updateSoundIcons(): void {
  const isMuted = sounds.getMuted();
  const icon = isMuted ? 'volume_off' : 'volume_up';
  if (menuSoundIcon) menuSoundIcon.textContent = icon;
  if (questSoundIcon) questSoundIcon.textContent = icon;
}

// ========================================================
// 1. HUB RENDERING (Original Carousel of Quests & Cards)
// ========================================================
function renderHub(state: GameState): void {
  const epNames: Record<string, string> = {
    nazareth: 'НАЗАРЕТ',
    virsavia: 'ВИРСАВИЯ',
    gilgal: 'ГАЛГАЛ',
  };
  hubEpTitle.textContent = epNames[state.currentEpisode] || state.currentEpisode.toUpperCase();
  hubStoryTitle.textContent = `Глава ${state.currentStory}`;

  hubQuestsList = engine.getAvailableQuests();
  if (hubQuestsList.length === 0) return;

  if (currentCarouselIndex >= hubQuestsList.length) {
    currentCarouselIndex = 0;
  }

  const q = hubQuestsList[currentCarouselIndex];
  questNameEl.textContent = q.name;
  questDescEl.textContent = q.desc;

  cardContainer.innerHTML = '';
  if (q.cards && q.cards.length > 0) {
    const cardPath = q.cards[0].replace(/^Cards\//, '').replace(/\.(png|jpg|webp)$/i, '');
    const img = document.createElement('img');
    img.src = `./assets/cards/${cardPath}.webp`;
    img.className = 'w-full h-full object-cover rounded-lg shadow-xl';
    img.alt = q.name;
    img.onerror = () => { img.src = './favicon.png'; };
    cardContainer.appendChild(img);
  } else {
    cardContainer.innerHTML = `<div class="flex items-center justify-center h-full text-fog-muted text-sm font-serif">Локация [${q.name}]</div>`;
  }

  hubActionContainer.innerHTML = '';
  const actionBtn = document.createElement('button');
  actionBtn.className = 'fog-btn-action w-full py-3 text-base';
  actionBtn.innerHTML = `<span>Продолжить путешествие</span><span>➔</span>`;
  actionBtn.addEventListener('click', () => {
    sounds.playChoice();
    engine.selectQuest(q.id);
  });
  hubActionContainer.appendChild(actionBtn);
}

// Hub Arrow Buttons
btnPrevQuest.addEventListener('click', () => {
  if (hubQuestsList.length <= 1) return;
  sounds.playCards();
  currentCarouselIndex = (currentCarouselIndex - 1 + hubQuestsList.length) % hubQuestsList.length;
  renderHub(engine.getState());
});

btnNextQuest.addEventListener('click', () => {
  if (hubQuestsList.length <= 1) return;
  sounds.playCards();
  currentCarouselIndex = (currentCarouselIndex + 1) % hubQuestsList.length;
  renderHub(engine.getState());
});

// ========================================================
// 2. QUEST STORY RENDERING (Dialogue & Choices)
// ========================================================
function renderQuest(state: GameState): void {
  // Restore log history if DOM is empty
  if (logContainer.children.length === 0 && state.history) {
    for (const item of state.history) {
      appendLogMessage(item.text, item.isChoice, item.pointChange);
    }
  }

  controlsContainer.innerHTML = '';
  const currentLine = engine.getCurrentLineObj();
  if (!currentLine) {
    const btn = document.createElement('button');
    btn.className = 'fog-btn-action animate-fade-in';
    btn.innerHTML = `<span>Продолжить путь</span><span>➔</span>`;
    btn.addEventListener('click', () => {
      sounds.playButton();
      engine.finishCurrentQuest();
    });
    controlsContainer.appendChild(btn);
    return;
  }

  const comps = Object.values(currentLine.components);

  // A) Choices
  const choiceComp = comps.find((c) => c.type === 'line_choose' && c.items);
  if (choiceComp && choiceComp.items) {
    for (const [key, item] of Object.entries(choiceComp.items)) {
      const choiceBtn = document.createElement('button');
      choiceBtn.className = 'fog-choice-btn animate-fade-in';
      const choiceText = engine.getChoiceText(item.text) || `Вариант ${key}`;
      choiceBtn.textContent = choiceText;

      choiceBtn.addEventListener('click', () => {
        sounds.playChoice();
        engine.choose(item.line, choiceText);
      });
      controlsContainer.appendChild(choiceBtn);
    }
    return;
  }

  // B) Step / Continue Button
  const hasNext = comps.some(
    (c) => c.type === 'line_next' || c.type === 'line_next_points' || c.type === 'line_next_item' || c.type === 'line_to_quests'
  );

  if (hasNext) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'fog-btn-action animate-fade-in';
    nextBtn.innerHTML = `<span>Продолжить</span><span>➔</span>`;
    nextBtn.addEventListener('click', () => {
      sounds.playButton();
      engine.step();
    });
    controlsContainer.appendChild(nextBtn);
  }
}

function appendLogMessage(text: string, isChoice = false, pointChange?: { red?: number; blue?: number }): void {
  const container = document.createElement('div');
  container.className = isChoice ? 'story-choice-echo animate-fade-in' : 'story-line animate-fade-in';
  container.textContent = text;

  if (pointChange && (pointChange.red || pointChange.blue)) {
    const badgesRow = document.createElement('div');
    badgesRow.className = 'point-badges-row';

    if (pointChange.red) {
      const r = document.createElement('span');
      r.className = 'point-badge-change red';
      r.textContent = `${pointChange.red > 0 ? '+' : ''}${pointChange.red}`;
      badgesRow.appendChild(r);
    }
    if (pointChange.blue) {
      const b = document.createElement('span');
      b.className = 'point-badge-change blue';
      b.textContent = `${pointChange.blue > 0 ? '+' : ''}${pointChange.blue}`;
      badgesRow.appendChild(b);
    }
    container.appendChild(badgesRow);
  }

  logContainer.appendChild(container);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

// ========================================================
// 3. EVENT LISTENERS: Menu, Audio, Inventory, Settings
// ========================================================
btnStart.addEventListener('click', () => {
  sounds.playButton();
  sounds.playAmbient(1);
  engine.startNewGame();
});

btnContinue.addEventListener('click', () => {
  sounds.playButton();
  sounds.playAmbient(1);
  engine.continueGame();
});

btnSoundMenu.addEventListener('click', () => {
  sounds.toggle();
  updateSoundIcons();
});

questBtnSound.addEventListener('click', () => {
  sounds.toggle();
  updateSoundIcons();
});

questBtnMenu.addEventListener('click', () => {
  sounds.playButton();
  modalSettings.style.display = 'flex';
});

btnSettingsMenu.addEventListener('click', () => {
  sounds.playButton();
  modalSettings.style.display = 'flex';
});

questBtnInv.addEventListener('click', () => {
  sounds.playInventory();
  renderInventory();
  modalInventory.style.display = 'flex';
});

closeInventory.addEventListener('click', () => {
  sounds.playButton();
  modalInventory.style.display = 'none';
});

function renderInventory(): void {
  inventoryList.innerHTML = '';
  const inv = engine.getState().inventory || {};
  const catalog = engine.getItemsCatalog();
  const commonRu = engine.getCommonRu();

  const entries = Object.entries(inv).filter(([_, count]) => count > 0);
  if (entries.length === 0) {
    inventoryList.innerHTML = `<div class="col-span-full py-8 text-center text-sm text-fog-muted font-serif">Рюкзак пуст. Исследуйте локации, чтобы найти припасы и артефакты.</div>`;
    return;
  }

  for (const [itemId, count] of entries) {
    const meta = catalog[itemId];
    const nameKey = meta?.name_text;
    const itemName = commonRu[nameKey]?.text || itemId;
    const card = document.createElement('div');
    card.className = 'inventory-item-card';
    card.innerHTML = `
      <img src="./assets/items/${itemId}.webp" class="inventory-item-icon" onerror="this.src='./favicon.png';" alt="${itemName}" />
      <div class="inventory-item-name">${itemName}</div>
      <div class="inventory-item-count">× ${count} шт.</div>
    `;
    inventoryList.appendChild(card);
  }
}

// Settings Audio Sliders Sync
function syncAudioSliders(): void {
  const sfxPercent = Math.round(sounds.getSfxVolume() * 100);
  const ambientPercent = Math.round(sounds.getAmbientVolume() * 100);
  sliderSfx.value = String(sfxPercent);
  sliderAmbient.value = String(ambientPercent);
  sfxValText.textContent = `${sfxPercent}%`;
  ambientValText.textContent = `${ambientPercent}%`;
}

sliderSfx.addEventListener('input', (e) => {
  const val = Number((e.target as HTMLInputElement).value);
  sfxValText.textContent = `${val}%`;
  sounds.setSfxVolume(val / 100);
  sounds.playButton();
});

sliderAmbient.addEventListener('input', (e) => {
  const val = Number((e.target as HTMLInputElement).value);
  ambientValText.textContent = `${val}%`;
  sounds.setAmbientVolume(val / 100);
});

closeSettings.addEventListener('click', () => {
  sounds.playButton();
  modalSettings.style.display = 'none';
});

btnExport.addEventListener('click', () => {
  sounds.playButton();
  const jsonStr = exportSaveJSON(engine.getState());
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TheFog_Session_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', () => {
  sounds.playButton();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result as string;
    const imported = importSaveJSON(content);
    if (imported) {
      alert('Сессия и прогресс выборов успешно восстановлены!');
      location.reload();
    } else {
      alert('Ошибка чтения файла сохранения.');
    }
  };
  reader.readAsText(file);
});

btnRestart.addEventListener('click', () => {
  sounds.playButton();
  if (confirm('Начать игру заново? Весь текущий прогресс будет сброшен.')) {
    engine.restartGame();
  }
});

// ========================================================
// 4. LONG PRESS TO PEEK BACKGROUND (Transparent UI)
// ========================================================
let isPressing = false;

const startPeek = () => {
  isPressing = true;
  if (peekTimeout) {
    clearTimeout(peekTimeout);
    peekTimeout = null;
  }
  document.body.classList.add('peeking');
};

const stopPeek = () => {
  if (!isPressing) return;
  isPressing = false;
  document.body.classList.remove('peeking');
};

logContainer.addEventListener('mousedown', startPeek);
logContainer.addEventListener('mouseup', stopPeek);
logContainer.addEventListener('mouseleave', stopPeek);

logContainer.addEventListener('touchstart', (e) => {
  const target = e.target as HTMLElement;
  if (target && target.closest('button, a, input')) return;
  startPeek();
}, { passive: true });

logContainer.addEventListener('touchend', stopPeek);
logContainer.addEventListener('touchcancel', stopPeek);

// Launch engine
engine.init().then(() => {
  syncAudioSliders();
  renderApp(engine.getState());
});
