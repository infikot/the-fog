import { FogEngine } from './engine';
import { loadStateFromLocal, exportSaveJSON, importSaveJSON } from './storage';
import { SoundManager } from './sounds';
import { GameState } from './types';
import './style.css';

// DOM Elements
const screenMenu = document.getElementById('screen-menu') as HTMLElement;
const screenHub = document.getElementById('screen-hub') as HTMLElement;
const screenQuest = document.getElementById('screen-quest') as HTMLElement;

// Background
const gameBg = document.getElementById('game-bg') as HTMLElement;

// Menu buttons
const menuBtnStart = document.getElementById('menu-btn-start') as HTMLButtonElement;
const menuBtnContinue = document.getElementById('menu-btn-continue') as HTMLButtonElement;
const menuBtnSettings = document.getElementById('menu-btn-settings') as HTMLButtonElement;

// Hub Elements
const hubEpTitle = document.getElementById('hub-ep-title') as HTMLElement;
const hubStoryTitle = document.getElementById('hub-story-title') as HTMLElement;
const hubCardImg = document.getElementById('hub-card-img') as HTMLImageElement;
const hubCardTitle = document.getElementById('hub-card-title') as HTMLElement;
const hubCardDesc = document.getElementById('hub-card-desc') as HTMLElement;
const hubCardStatus = document.getElementById('hub-card-status') as HTMLElement;
const hubBtnPrev = document.getElementById('hub-btn-prev') as HTMLButtonElement;
const hubBtnNext = document.getElementById('hub-btn-next') as HTMLButtonElement;
const hubBtnStartQuest = document.getElementById('hub-btn-start-quest') as HTMLButtonElement;
const hubAdvanceBox = document.getElementById('hub-advance-box') as HTMLElement;
const hubBtnAdvanceStory = document.getElementById('hub-btn-advance-story') as HTMLButtonElement;
const hubBtnMenu = document.getElementById('hub-btn-menu') as HTMLButtonElement;
const hubBtnInv = document.getElementById('hub-btn-inv') as HTMLButtonElement;
const hubBtnSound = document.getElementById('hub-btn-sound') as HTMLButtonElement;

// Quest Elements
const questBtnBackHub = document.getElementById('quest-btn-back-hub') as HTMLButtonElement;
const questBtnInv = document.getElementById('quest-btn-inv') as HTMLButtonElement;
const questBtnSound = document.getElementById('quest-btn-sound') as HTMLButtonElement;
const logContainer = document.getElementById('log-container') as HTMLElement;
const controlsContainer = document.getElementById('controls-container') as HTMLElement;
const pointsRedVal = document.getElementById('points-red-val') as HTMLElement;
const pointsBlueVal = document.getElementById('points-blue-val') as HTMLElement;

// Modals
const modalInventory = document.getElementById('modal-inventory') as HTMLElement;
const modalSettings = document.getElementById('modal-settings') as HTMLElement;
const closeInventory = document.getElementById('close-inventory') as HTMLButtonElement;
const closeSettings = document.getElementById('close-settings') as HTMLButtonElement;
const inventoryList = document.getElementById('inventory-list') as HTMLElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

// State & Engines
let currentCarouselIndex = 0;
let hubQuestsList: Array<{ id: string; name: string; desc: string; cards: string[]; isDone: boolean }> = [];

const sounds = new SoundManager();
const initialState = loadStateFromLocal();

const engine = new FogEngine(
  initialState,
  (state) => {
    updateView(state);
  },
  (text, isChoice, pointChange) => {
    appendLogMessage(text, isChoice, pointChange);
  }
);

// Init Application
(async () => {
  await engine.init();
  const state = engine.getState();
  updateView(state);
})();

// Global View Switcher
function updateView(state: GameState): void {
  updateBackground(state.currentBackground);
  updatePoints(state);

  // Toggle screens
  screenMenu.style.display = state.currentScreen === 'menu' ? 'flex' : 'none';
  screenHub.style.display = state.currentScreen === 'story_hub' ? 'flex' : 'none';
  screenQuest.style.display = state.currentScreen === 'quest' ? 'flex' : 'none';

  // Menu Continue button visibility
  if (state.hasStartedSession) {
    menuBtnContinue.style.display = 'block';
  } else {
    menuBtnContinue.style.display = 'none';
  }

  if (state.currentScreen === 'story_hub') {
    renderHub(state);
  } else if (state.currentScreen === 'quest') {
    renderQuest(state);
  }
}

let lastBackgroundPath = '';
let peekTimeout: any = null;

function updateBackground(bgPath: string): void {
  if (!bgPath) return;
  const clean = bgPath.replace(/^Backgrounds\//, '').replace(/\.(png|jpg|webp)$/i, '');
  const url = `./assets/backgrounds/${clean}.webp`;
  
  if (bgPath !== lastBackgroundPath) {
    lastBackgroundPath = bgPath;
    gameBg.style.backgroundImage = `url('${url}')`;

    // Trigger brief 2-second peek on background change so user can see new artwork
    triggerTemporaryPeek(2000);
  }
}

function triggerTemporaryPeek(durationMs: number = 2000): void {
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

  const currentQ = hubQuestsList[currentCarouselIndex];
  hubCardTitle.textContent = currentQ.name;
  hubCardDesc.textContent = currentQ.desc || 'Продолжить исследование локации...';
  hubCardStatus.textContent = currentQ.isDone ? 'Исследовано' : 'Доступно';
  hubCardStatus.style.color = currentQ.isDone ? 'var(--color-fog-muted)' : 'var(--color-fog-gold)';

  // First card image or fallback
  let cardImgPath = './assets/backgrounds/1.webp';
  if (currentQ.cards && currentQ.cards.length > 0) {
    const rawCard = String(currentQ.cards[0]).replace(/\\/g, '/').split('/').pop()?.replace(/\.(png|jpg|webp)$/i, '') || '';
    if (rawCard) {
      cardImgPath = `./assets/cards/${rawCard}.webp`;
    }
  } else if (state.currentBackground) {
    const cleanBg = String(state.currentBackground).replace(/\\/g, '/').split('/').pop()?.replace(/\.(png|jpg|webp)$/i, '') || '1';
    cardImgPath = `./assets/backgrounds/${cleanBg}.webp`;
  }
  hubCardImg.onerror = () => {
    hubCardImg.src = './assets/backgrounds/1.webp';
  };
  hubCardImg.src = cardImgPath;

  // Nav buttons
  hubBtnPrev.disabled = currentCarouselIndex === 0;
  hubBtnNext.disabled = currentCarouselIndex >= hubQuestsList.length - 1;

  // Check if all quests in this story are completed
  const allStoryDone = hubQuestsList.every((q) => q.isDone);
  if (allStoryDone) {
    hubAdvanceBox.style.display = 'block';
  } else {
    hubAdvanceBox.style.display = 'none';
  }
}

// ========================================================
// 2. QUEST RENDERING (Story Log & Decisions)
// ========================================================
function renderQuest(state: GameState): void {
  controlsContainer.innerHTML = '';
  const currentLine = engine.getCurrentLine();

  if (!currentLine) {
    // End of quest: Return button
    const btn = document.createElement('button');
    btn.className = 'fog-btn-action';
    btn.innerHTML = `<span>Завершить исследование</span><span>➔</span>`;
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

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });
}

// ========================================================
// 3. LISTENERS & CONTROLS
// ========================================================

// Main Menu
menuBtnStart.addEventListener('click', () => {
  sounds.playButton();
  sounds.playAmbient();
  engine.startNewGame();
});

menuBtnContinue.addEventListener('click', () => {
  sounds.playButton();
  sounds.playAmbient();
  engine.continueGame();
});

menuBtnSettings.addEventListener('click', () => {
  sounds.playButton();
  modalSettings.style.display = 'flex';
});

// Hub Controls
hubBtnPrev.addEventListener('click', () => {
  sounds.playCards();
  if (currentCarouselIndex > 0) {
    currentCarouselIndex--;
    renderHub(engine.getState());
  }
});

hubBtnNext.addEventListener('click', () => {
  sounds.playCards();
  if (currentCarouselIndex < hubQuestsList.length - 1) {
    currentCarouselIndex++;
    renderHub(engine.getState());
  }
});

hubBtnStartQuest.addEventListener('click', () => {
  sounds.playButton();
  if (hubQuestsList[currentCarouselIndex]) {
    engine.selectQuest(hubQuestsList[currentCarouselIndex].id);
  }
});

hubBtnAdvanceStory.addEventListener('click', () => {
  sounds.playButton();
  engine.advanceToNextStory();
});

hubBtnMenu.addEventListener('click', () => {
  sounds.playButton();
  engine.returnToMenu();
});

// Quest Top Bar
questBtnBackHub.addEventListener('click', () => {
  sounds.playButton();
  engine.returnToHub();
});

// Sound toggles
const hubSoundIcon = document.getElementById('hub-sound-icon') as HTMLElement;
const questSoundIcon = document.getElementById('quest-sound-icon') as HTMLElement;

const toggleSound = () => {
  const active = sounds.toggle();
  const iconName = active ? 'volume_up' : 'volume_off';
  if (hubSoundIcon) hubSoundIcon.textContent = iconName;
  if (questSoundIcon) questSoundIcon.textContent = iconName;
};
hubBtnSound.addEventListener('click', toggleSound);
questBtnSound.addEventListener('click', toggleSound);

// Inventory Modals
const openInventory = () => {
  sounds.playInventory();
  renderInventory();
  modalInventory.style.display = 'flex';
};
hubBtnInv.addEventListener('click', openInventory);
questBtnInv.addEventListener('click', openInventory);
closeInventory.addEventListener('click', () => {
  sounds.playButton();
  modalInventory.style.display = 'none';
});

function renderInventory(): void {
  inventoryList.innerHTML = '';
  const inv = engine.getState().inventory;
  const catalog = engine.getItemsCatalog();
  const commonRu = engine.getCommonRu();

  const entries = Object.entries(inv).filter(([_, count]) => count > 0);

  if (entries.length === 0) {
    inventoryList.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-fog-muted);font-size:0.85rem;">
        Рюкзак пуст. Исследуйте мир и собирайте полезные предметы.
      </div>
    `;
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

// Settings Modal
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
  // Check if click was on interactive button/link
  const target = e.target as HTMLElement;
  if (target && target.closest('button, a, input')) return;
  startPeek();
}, { passive: true });

logContainer.addEventListener('touchend', stopPeek);
logContainer.addEventListener('touchcancel', stopPeek);
