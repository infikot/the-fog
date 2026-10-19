// src/storage.ts
var STORAGE_KEY = "thefog_save_session_v2";
var DB_NAME = "TheFogSessionDB";
var STORE_NAME = "session";
function getDefaultState() {
  return {
    currentScreen: "menu",
    currentEpisode: "nazareth",
    currentStory: "0",
    currentQuestId: null,
    currentLineId: "Line_0",
    completedQuests: [],
    completedEpisodes: [],
    inventory: {},
    points: {
      value_0: 0,
      value_1: 0,
      first: 0,
      second: 0
    },
    visitedLines: {},
    choiceHistory: [],
    history: [],
    currentBackground: "Backgrounds/1",
    hasStartedSession: false,
    gameFinished: false
  };
}
function saveStateToLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStateToIDB(state);
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}
function loadStateFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.points) {
        parsed.points = { value_0: 0, value_1: 0, first: 0, second: 0 };
      }
      if (parsed.points.value_0 === void 0) parsed.points.value_0 = parsed.points.first || 0;
      if (parsed.points.value_1 === void 0) parsed.points.value_1 = parsed.points.second || 0;
      if (!parsed.inventory) parsed.inventory = {};
      if (!parsed.visitedLines) parsed.visitedLines = {};
      if (!parsed.choiceHistory) parsed.choiceHistory = [];
      if (!parsed.currentScreen) {
        parsed.currentScreen = parsed.hasStartedSession ? parsed.currentQuestId ? "quest" : "story_hub" : "menu";
      }
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse state from localStorage:", e);
  }
  return getDefaultState();
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveStateToIDB(state) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: "active_session", data: state, updatedAt: Date.now() });
  } catch (e) {
  }
}
function exportSaveJSON(state) {
  const exportPayload = {
    version: 2,
    exportTimestamp: Date.now(),
    currentScreen: state.currentScreen,
    currentEpisode: state.currentEpisode,
    currentStory: state.currentStory,
    currentQuestId: state.currentQuestId,
    currentLineId: state.currentLineId,
    points: state.points,
    inventory: state.inventory,
    completedQuests: state.completedQuests,
    completedEpisodes: state.completedEpisodes,
    visitedLinesCount: Object.keys(state.visitedLines || {}).length,
    choiceHistory: state.choiceHistory || [],
    visitedLines: state.visitedLines || {},
    hasStartedSession: state.hasStartedSession,
    currentBackground: state.currentBackground
  };
  return JSON.stringify(exportPayload, null, 2);
}
function importSaveJSON(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.currentEpisode || parsed.version)) {
      const state = getDefaultState();
      state.currentScreen = parsed.currentScreen || "story_hub";
      state.currentEpisode = parsed.currentEpisode || "nazareth";
      state.currentStory = parsed.currentStory || "0";
      state.currentQuestId = parsed.currentQuestId ?? null;
      state.currentLineId = parsed.currentLineId || "Line_0";
      state.points = parsed.points || { value_0: 0, value_1: 0, first: 0, second: 0 };
      state.inventory = parsed.inventory || {};
      state.completedQuests = parsed.completedQuests || [];
      state.completedEpisodes = parsed.completedEpisodes || [];
      state.visitedLines = parsed.visitedLines || {};
      state.choiceHistory = parsed.choiceHistory || [];
      state.hasStartedSession = true;
      state.currentBackground = parsed.currentBackground || "Backgrounds/1";
      return state;
    }
  } catch (e) {
    console.error("Invalid save JSON:", e);
  }
  return null;
}

// src/engine.ts
var FogEngine = class {
  state;
  bundle = null;
  onStateChange;
  onLog;
  constructor(initialState2, onStateChange, onLog) {
    this.state = { ...initialState2 };
    this.onStateChange = onStateChange;
    this.onLog = onLog;
  }
  async init() {
    const res = await fetch("./game_bundle.json");
    this.bundle = await res.json();
    if (!this.state.currentEpisode) {
      this.state.currentEpisode = this.bundle.first_episode || "nazareth";
    }
    if (!this.state.currentStory) {
      this.state.currentStory = "0";
    }
    if (!this.state.points) {
      this.state.points = { value_0: 0, value_1: 0, first: 0, second: 0 };
    }
    if (!this.state.inventory) {
      this.state.inventory = {};
    }
    if (!this.state.visitedLines) {
      this.state.visitedLines = {};
    }
    if (!this.state.choiceHistory) {
      this.state.choiceHistory = [];
    }
  }
  getState() {
    return this.state;
  }
  getCommonRu() {
    return this.bundle?.common_texts || {};
  }
  getItemsCatalog() {
    return this.bundle?.items || {};
  }
  getEpisodesCatalog() {
    return this.bundle?.episodes || {};
  }
  startNewGame() {
    this.state.hasStartedSession = true;
    this.state.currentEpisode = this.bundle.first_episode || "nazareth";
    this.state.currentStory = "0";
    this.state.currentQuestId = null;
    this.state.currentLineId = "Line_0";
    this.state.completedQuests = [];
    this.state.completedEpisodes = [];
    this.state.inventory = {};
    this.state.points = { value_0: 0, value_1: 0, first: 0, second: 0 };
    this.state.visitedLines = {};
    this.state.choiceHistory = [];
    this.state.history = [];
    this.state.currentBackground = "Backgrounds/1";
    this.state.currentScreen = "story_hub";
    this.save();
  }
  continueGame() {
    if (!this.state.hasStartedSession) {
      this.startNewGame();
      return;
    }
    this.state.currentScreen = this.state.currentQuestId ? "quest" : "story_hub";
    this.save();
  }
  returnToMenu() {
    this.state.currentScreen = "menu";
    this.save();
  }
  returnToHub() {
    this.state.currentScreen = "story_hub";
    this.state.currentQuestId = null;
    this.save();
  }
  getCurrentStoryObj() {
    if (!this.bundle) return null;
    return this.bundle.episodes?.[this.state.currentEpisode]?.stories?.[this.state.currentStory] || null;
  }
  getCurrentQuestObj() {
    const story = this.getCurrentStoryObj();
    if (!story || !this.state.currentQuestId) return null;
    return story.quests?.[this.state.currentQuestId] || null;
  }
  getCurrentLine() {
    const quest = this.getCurrentQuestObj();
    if (!quest) return null;
    const lines = quest.graph?.lines || quest.lines;
    if (!lines) return null;
    return lines[this.state.currentLineId] || null;
  }
  getAvailableQuests() {
    const story = this.getCurrentStoryObj();
    if (!story || !story.quests) return [];
    const list = [];
    for (const [qId, qData] of Object.entries(story.quests)) {
      const nameKey = qData.name_text;
      const descKey = qData.desc_text;
      const name = this.bundle?.common_texts?.[nameKey]?.text || story.texts?.ru?.[nameKey]?.text || qData.texts?.[nameKey]?.text || `\u041A\u0432\u0435\u0441\u0442 ${qId}`;
      const desc = this.bundle?.common_texts?.[descKey]?.text || story.texts?.ru?.[descKey]?.text || qData.texts?.[descKey]?.text || "";
      const cards = [];
      if (qData.cards) {
        for (const c of Object.values(qData.cards)) {
          cards.push(c.path);
        }
      }
      const questKey = `${this.state.currentEpisode}_${this.state.currentStory}_${qId}`;
      const isDone = this.state.completedQuests.includes(questKey) || this.state.completedQuests.includes(qId);
      list.push({ id: qId, name, desc, cards, isDone });
    }
    return list;
  }
  selectQuest(questId) {
    this.state.currentQuestId = questId;
    this.state.currentLineId = "Line_0";
    this.state.currentScreen = "quest";
    this.state.history = [];
    this.processLine("Line_0");
  }
  advanceToNextStory() {
    const epData = this.bundle.episodes?.[this.state.currentEpisode];
    const storyKeys = Object.keys(epData?.stories || {});
    const currentStoryIndex = storyKeys.indexOf(this.state.currentStory);
    if (currentStoryIndex !== -1 && currentStoryIndex < storyKeys.length - 1) {
      const nextStory = storyKeys[currentStoryIndex + 1];
      this.state.currentStory = nextStory;
      this.state.currentQuestId = null;
      this.state.currentScreen = "story_hub";
    } else {
      if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
        this.state.completedEpisodes.push(this.state.currentEpisode);
      }
      const epKeys = Object.keys(this.bundle.episodes || {});
      const epIndex = epKeys.indexOf(this.state.currentEpisode);
      if (epIndex !== -1 && epIndex < epKeys.length - 1) {
        this.state.currentEpisode = epKeys[epIndex + 1];
        this.state.currentStory = "0";
        this.state.currentQuestId = null;
        this.state.currentScreen = "story_hub";
      } else {
        this.state.gameFinished = true;
      }
    }
    this.save();
  }
  step() {
    const line = this.getCurrentLine();
    if (!line) return;
    for (const comp of Object.values(line.components)) {
      if (comp.type === "line_next" && comp.line) {
        this.goToLine(comp.line);
        return;
      }
      if (comp.type === "line_next_points") {
        const nextTarget = this.evaluateNextPoints(comp);
        if (nextTarget) {
          this.goToLine(nextTarget);
          return;
        }
      }
      if (comp.type === "line_next_item") {
        const nextTarget = this.evaluateNextItem(comp);
        if (nextTarget) {
          this.goToLine(nextTarget);
          return;
        }
      }
      if (comp.type === "line_to_quests") {
        this.finishCurrentQuest();
        return;
      }
    }
  }
  evaluateNextPoints(comp) {
    if (comp.comparers) {
      const comparers = Object.values(comp.comparers);
      for (const c of comparers) {
        const pointKey = c.name === "second" || c.name === "value_1" ? "value_1" : "value_0";
        const currentVal = this.state.points[pointKey] || 0;
        const targetVal = c.value ?? 0;
        const comparer = c.comparer ?? 0;
        let matches = false;
        switch (comparer) {
          case 0:
            matches = currentVal === targetVal;
            break;
          case 1:
            matches = currentVal !== targetVal;
            break;
          case 2:
            matches = currentVal < targetVal;
            break;
          case 3:
            matches = currentVal <= targetVal;
            break;
          case 4:
            matches = currentVal >= targetVal;
            break;
          case 5:
            matches = currentVal > targetVal;
            break;
          default:
            matches = currentVal >= targetVal;
            break;
        }
        if (matches && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }
  evaluateNextItem(comp) {
    if (comp.comparers) {
      const comparers = Object.values(comp.comparers);
      for (const c of comparers) {
        if (c.item && (this.state.inventory[c.item] || 0) > 0 && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }
  choose(choiceLine, choiceText) {
    this.state.choiceHistory.push({
      episode: this.state.currentEpisode,
      story: this.state.currentStory,
      questId: this.state.currentQuestId || "0",
      fromLineId: this.state.currentLineId,
      choiceLineId: choiceLine,
      choiceText,
      timestamp: Date.now()
    });
    this.log(choiceText, true);
    this.goToLine(choiceLine);
  }
  goToLine(lineId) {
    this.state.currentLineId = lineId;
    this.processLine(lineId);
  }
  processLine(lineId) {
    const quest = this.getCurrentQuestObj();
    if (!quest) return;
    const lines = quest.graph?.lines || quest.lines;
    const line = lines?.[lineId];
    if (!line) return;
    const fullLineKey = `${this.state.currentEpisode}_${this.state.currentStory}_${this.state.currentQuestId}_${lineId}`;
    this.state.visitedLines[fullLineKey] = true;
    let redChange = 0;
    let blueChange = 0;
    for (const comp of Object.values(line.components)) {
      if (comp.type === "line_background" && comp.background !== void 0) {
        const bgList = quest.graph?.backgrounds || quest.backgrounds;
        const bgEntry = bgList?.[comp.background];
        if (bgEntry?.path) {
          this.state.currentBackground = bgEntry.path;
        }
      }
      if (comp.type === "line_points" && comp.modifiers) {
        const diff = this.applyPointModifiers(Object.values(comp.modifiers));
        redChange += diff.red;
        blueChange += diff.blue;
      }
      if (comp.type === "line_inventory_add" && comp.item) {
        this.state.inventory[comp.item] = (this.state.inventory[comp.item] || 0) + 1;
      }
      if (comp.type === "line_inventory_remove" && comp.item) {
        if (this.state.inventory[comp.item]) {
          this.state.inventory[comp.item] = Math.max(0, this.state.inventory[comp.item] - 1);
        }
      }
    }
    for (const comp of Object.values(line.components)) {
      if (comp.type === "line_text" && comp.text) {
        const questTexts = quest.texts;
        const rawText = questTexts?.[comp.text]?.text || this.bundle?.common_texts?.[comp.text]?.text;
        if (rawText) {
          const pointChange = redChange !== 0 || blueChange !== 0 ? { red: redChange, blue: blueChange } : void 0;
          this.log(rawText, false, pointChange);
        }
      }
    }
    this.save();
  }
  applyPointModifiers(mods) {
    let redDiff = 0;
    let blueDiff = 0;
    for (const mod of mods) {
      const isBlue = mod.name === "second" || mod.name === "value_1";
      const key = isBlue ? "value_1" : "value_0";
      const current = this.state.points[key] || 0;
      let next = current;
      switch (mod.operator) {
        case 0:
          next = mod.value;
          break;
        case 1:
          next = current + mod.value;
          break;
        case 2:
          next = current - mod.value;
          break;
        default:
          next = current + mod.value;
          break;
      }
      const diff = next - current;
      this.state.points[key] = next;
      this.state.points[mod.name] = next;
      if (isBlue) {
        blueDiff += diff;
      } else {
        redDiff += diff;
      }
    }
    return { red: redDiff, blue: blueDiff };
  }
  finishCurrentQuest() {
    const questKey = `${this.state.currentEpisode}_${this.state.currentStory}_${this.state.currentQuestId}`;
    if (!this.state.completedQuests.includes(questKey)) {
      this.state.completedQuests.push(questKey);
    }
    if (this.state.currentQuestId && !this.state.completedQuests.includes(this.state.currentQuestId)) {
      this.state.completedQuests.push(this.state.currentQuestId);
    }
    this.state.currentScreen = "story_hub";
    this.state.currentQuestId = null;
    const story = this.getCurrentStoryObj();
    const allStoryQuests = Object.keys(story?.quests || {});
    const isStoryDone = allStoryQuests.length > 0 && allStoryQuests.every((q) => {
      const fullK = `${this.state.currentEpisode}_${this.state.currentStory}_${q}`;
      return this.state.completedQuests.includes(fullK) || this.state.completedQuests.includes(q);
    });
    if (isStoryDone) {
      const epData = this.bundle.episodes?.[this.state.currentEpisode];
      const storyKeys = Object.keys(epData?.stories || {});
      const currentStoryIndex = storyKeys.indexOf(this.state.currentStory);
      if (currentStoryIndex !== -1 && currentStoryIndex < storyKeys.length - 1) {
      } else {
        if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
          this.state.completedEpisodes.push(this.state.currentEpisode);
        }
      }
    }
    this.save();
  }
  log(text, isChoice = false, pointChange) {
    this.state.history.push({ text, isChoice, pointChange });
    this.onLog(text, isChoice, pointChange);
  }
  save() {
    saveStateToLocal(this.state);
    this.onStateChange(this.state);
  }
  restartGame() {
    this.startNewGame();
    location.reload();
  }
};

// src/sounds.ts
var SoundManager = class {
  ambientAudio = null;
  isMuted = false;
  constructor() {
    this.ambientAudio = new Audio("./ambient.mp3");
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = 0.35;
  }
  playAmbient() {
    if (this.isMuted || !this.ambientAudio) return;
    this.ambientAudio.play().catch(() => {
    });
  }
  pauseAmbient() {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }
  playButton() {
    if (this.isMuted) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
    }
  }
  toggle() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseAmbient();
    } else {
      this.playAmbient();
    }
    return !this.isMuted;
  }
};

// src/main.ts
var screenMenu = document.getElementById("screen-menu");
var screenHub = document.getElementById("screen-hub");
var screenQuest = document.getElementById("screen-quest");
var gameBg = document.getElementById("game-bg");
var menuBtnStart = document.getElementById("menu-btn-start");
var menuBtnContinue = document.getElementById("menu-btn-continue");
var menuBtnSettings = document.getElementById("menu-btn-settings");
var hubEpTitle = document.getElementById("hub-ep-title");
var hubStoryTitle = document.getElementById("hub-story-title");
var hubCardImg = document.getElementById("hub-card-img");
var hubCardTitle = document.getElementById("hub-card-title");
var hubCardDesc = document.getElementById("hub-card-desc");
var hubCardStatus = document.getElementById("hub-card-status");
var hubBtnPrev = document.getElementById("hub-btn-prev");
var hubBtnNext = document.getElementById("hub-btn-next");
var hubBtnStartQuest = document.getElementById("hub-btn-start-quest");
var hubAdvanceBox = document.getElementById("hub-advance-box");
var hubBtnAdvanceStory = document.getElementById("hub-btn-advance-story");
var hubBtnMenu = document.getElementById("hub-btn-menu");
var hubBtnInv = document.getElementById("hub-btn-inv");
var hubBtnSound = document.getElementById("hub-btn-sound");
var questBtnBackHub = document.getElementById("quest-btn-back-hub");
var questBtnInv = document.getElementById("quest-btn-inv");
var questBtnSound = document.getElementById("quest-btn-sound");
var logContainer = document.getElementById("log-container");
var controlsContainer = document.getElementById("controls-container");
var pointsRedVal = document.getElementById("points-red-val");
var pointsBlueVal = document.getElementById("points-blue-val");
var modalInventory = document.getElementById("modal-inventory");
var modalSettings = document.getElementById("modal-settings");
var closeInventory = document.getElementById("close-inventory");
var closeSettings = document.getElementById("close-settings");
var inventoryList = document.getElementById("inventory-list");
var btnExport = document.getElementById("btn-export");
var btnImport = document.getElementById("btn-import");
var btnRestart = document.getElementById("btn-restart");
var fileInput = document.getElementById("file-input");
var currentCarouselIndex = 0;
var hubQuestsList = [];
var sounds = new SoundManager();
var initialState = loadStateFromLocal();
var engine = new FogEngine(
  initialState,
  (state) => {
    updateView(state);
  },
  (text, isChoice, pointChange) => {
    appendLogMessage(text, isChoice, pointChange);
  }
);
(async () => {
  await engine.init();
  const state = engine.getState();
  updateView(state);
})();
function updateView(state) {
  updateBackground(state.currentBackground);
  updatePoints(state);
  screenMenu.style.display = state.currentScreen === "menu" ? "flex" : "none";
  screenHub.style.display = state.currentScreen === "story_hub" ? "flex" : "none";
  screenQuest.style.display = state.currentScreen === "quest" ? "flex" : "none";
  if (state.hasStartedSession) {
    menuBtnContinue.style.display = "block";
  } else {
    menuBtnContinue.style.display = "none";
  }
  if (state.currentScreen === "story_hub") {
    renderHub(state);
  } else if (state.currentScreen === "quest") {
    renderQuest(state);
  }
}
function updateBackground(bgPath) {
  if (!bgPath) return;
  const clean = bgPath.replace(/^Backgrounds\//, "").replace(/\.(png|jpg|webp)$/i, "");
  const url = `./assets/backgrounds/${clean}.webp`;
  gameBg.style.backgroundImage = `url('${url}')`;
}
function updatePoints(state) {
  if (pointsRedVal) pointsRedVal.textContent = String(state.points.value_0 || 0);
  if (pointsBlueVal) pointsBlueVal.textContent = String(state.points.value_1 || 0);
}
function renderHub(state) {
  const epNames = {
    nazareth: "\u041D\u0410\u0417\u0410\u0420\u0415\u0422",
    virsavia: "\u0412\u0418\u0420\u0421\u0410\u0412\u0418\u042F",
    gilgal: "\u0413\u0410\u041B\u0413\u0410\u041B"
  };
  hubEpTitle.textContent = epNames[state.currentEpisode] || state.currentEpisode.toUpperCase();
  hubStoryTitle.textContent = `\u0413\u043B\u0430\u0432\u0430 ${state.currentStory}`;
  hubQuestsList = engine.getAvailableQuests();
  if (hubQuestsList.length === 0) return;
  if (currentCarouselIndex >= hubQuestsList.length) {
    currentCarouselIndex = 0;
  }
  const currentQ = hubQuestsList[currentCarouselIndex];
  hubCardTitle.textContent = currentQ.name;
  hubCardDesc.textContent = currentQ.desc || "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043B\u043E\u043A\u0430\u0446\u0438\u0438...";
  hubCardStatus.textContent = currentQ.isDone ? "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u043E" : "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E";
  hubCardStatus.style.color = currentQ.isDone ? "var(--color-fog-muted)" : "var(--color-fog-gold)";
  let cardImgPath = "./assets/backgrounds/1.webp";
  if (currentQ.cards && currentQ.cards.length > 0) {
    const rawCard = currentQ.cards[0].replace(/^Cards\//, "").replace(/\.(png|jpg|webp)$/i, "");
    cardImgPath = `./assets/cards/${rawCard}.webp`;
  }
  hubCardImg.src = cardImgPath;
  hubBtnPrev.disabled = currentCarouselIndex === 0;
  hubBtnNext.disabled = currentCarouselIndex >= hubQuestsList.length - 1;
  const allStoryDone = hubQuestsList.every((q) => q.isDone);
  if (allStoryDone) {
    hubAdvanceBox.style.display = "block";
  } else {
    hubAdvanceBox.style.display = "none";
  }
}
function renderQuest(state) {
  controlsContainer.innerHTML = "";
  const currentLine = engine.getCurrentLine();
  if (!currentLine) {
    const btn = document.createElement("button");
    btn.className = "fog-btn-action";
    btn.innerHTML = `<span>\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435</span><span>\u2794</span>`;
    btn.addEventListener("click", () => {
      sounds.playButton();
      engine.finishCurrentQuest();
    });
    controlsContainer.appendChild(btn);
    return;
  }
  const comps = Object.values(currentLine.components);
  const choiceComp = comps.find((c) => c.type === "line_choose" && c.items);
  if (choiceComp && choiceComp.items) {
    for (const [key, item] of Object.entries(choiceComp.items)) {
      const choiceBtn = document.createElement("button");
      choiceBtn.className = "fog-choice-btn animate-fade-in";
      const commonRu = engine.getCommonRu();
      const choiceText = commonRu[item.text]?.text || item.text || `\u0412\u0430\u0440\u0438\u0430\u043D\u0442 ${key}`;
      choiceBtn.textContent = choiceText;
      choiceBtn.addEventListener("click", () => {
        sounds.playButton();
        engine.choose(item.line, choiceText);
      });
      controlsContainer.appendChild(choiceBtn);
    }
    return;
  }
  const hasNext = comps.some(
    (c) => c.type === "line_next" || c.type === "line_next_points" || c.type === "line_next_item" || c.type === "line_to_quests"
  );
  if (hasNext) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "fog-btn-action animate-fade-in";
    nextBtn.innerHTML = `<span>\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C</span><span>\u2794</span>`;
    nextBtn.addEventListener("click", () => {
      sounds.playButton();
      engine.step();
    });
    controlsContainer.appendChild(nextBtn);
  }
}
function appendLogMessage(text, isChoice = false, pointChange) {
  const container = document.createElement("div");
  container.className = isChoice ? "story-choice-echo animate-fade-in" : "story-line animate-fade-in";
  container.textContent = text;
  if (pointChange) {
    if (pointChange.red) {
      const r = document.createElement("span");
      r.className = "point-badge-change red";
      r.textContent = `${pointChange.red > 0 ? "+" : ""}${pointChange.red} \u0421\u0438\u043B\u0430`;
      container.appendChild(document.createElement("br"));
      container.appendChild(r);
    }
    if (pointChange.blue) {
      const b = document.createElement("span");
      b.className = "point-badge-change blue";
      b.textContent = `${pointChange.blue > 0 ? "+" : ""}${pointChange.blue} \u0420\u0430\u0441\u0441\u0443\u0434\u043E\u043A`;
      container.appendChild(document.createElement("br"));
      container.appendChild(b);
    }
  }
  logContainer.appendChild(container);
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}
menuBtnStart.addEventListener("click", () => {
  sounds.playButton();
  sounds.playAmbient();
  engine.startNewGame();
});
menuBtnContinue.addEventListener("click", () => {
  sounds.playButton();
  sounds.playAmbient();
  engine.continueGame();
});
menuBtnSettings.addEventListener("click", () => {
  sounds.playButton();
  modalSettings.style.display = "flex";
});
hubBtnPrev.addEventListener("click", () => {
  sounds.playButton();
  if (currentCarouselIndex > 0) {
    currentCarouselIndex--;
    renderHub(engine.getState());
  }
});
hubBtnNext.addEventListener("click", () => {
  sounds.playButton();
  if (currentCarouselIndex < hubQuestsList.length - 1) {
    currentCarouselIndex++;
    renderHub(engine.getState());
  }
});
hubBtnStartQuest.addEventListener("click", () => {
  sounds.playButton();
  if (hubQuestsList[currentCarouselIndex]) {
    engine.selectQuest(hubQuestsList[currentCarouselIndex].id);
  }
});
hubBtnAdvanceStory.addEventListener("click", () => {
  sounds.playButton();
  engine.advanceToNextStory();
});
hubBtnMenu.addEventListener("click", () => {
  sounds.playButton();
  engine.returnToMenu();
});
questBtnBackHub.addEventListener("click", () => {
  sounds.playButton();
  engine.returnToHub();
});
var hubSoundIcon = document.getElementById("hub-sound-icon");
var questSoundIcon = document.getElementById("quest-sound-icon");
var toggleSound = () => {
  const active = sounds.toggle();
  const iconName = active ? "volume_up" : "volume_off";
  if (hubSoundIcon) hubSoundIcon.textContent = iconName;
  if (questSoundIcon) questSoundIcon.textContent = iconName;
};
hubBtnSound.addEventListener("click", toggleSound);
questBtnSound.addEventListener("click", toggleSound);
var openInventory = () => {
  sounds.playButton();
  renderInventory();
  modalInventory.style.display = "flex";
};
hubBtnInv.addEventListener("click", openInventory);
questBtnInv.addEventListener("click", openInventory);
closeInventory.addEventListener("click", () => {
  sounds.playButton();
  modalInventory.style.display = "none";
});
function renderInventory() {
  inventoryList.innerHTML = "";
  const inv = engine.getState().inventory;
  const catalog = engine.getItemsCatalog();
  const commonRu = engine.getCommonRu();
  const entries = Object.entries(inv).filter(([_, count]) => count > 0);
  if (entries.length === 0) {
    inventoryList.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-fog-muted);font-size:0.85rem;">
        \u0420\u044E\u043A\u0437\u0430\u043A \u043F\u0443\u0441\u0442. \u0418\u0441\u0441\u043B\u0435\u0434\u0443\u0439\u0442\u0435 \u043C\u0438\u0440 \u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B.
      </div>
    `;
    return;
  }
  for (const [itemId, count] of entries) {
    const meta = catalog[itemId];
    const nameKey = meta?.name_text;
    const itemName = commonRu[nameKey]?.text || itemId;
    const card = document.createElement("div");
    card.className = "inventory-item-card";
    card.innerHTML = `
      <img src="./assets/items/${itemId}.webp" class="inventory-item-icon" onerror="this.src='./favicon.png';" alt="${itemName}" />
      <div class="inventory-item-name">${itemName}</div>
      <div class="inventory-item-count">\xD7 ${count} \u0448\u0442.</div>
    `;
    inventoryList.appendChild(card);
  }
}
closeSettings.addEventListener("click", () => {
  sounds.playButton();
  modalSettings.style.display = "none";
});
btnExport.addEventListener("click", () => {
  sounds.playButton();
  const jsonStr = exportSaveJSON(engine.getState());
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TheFog_Session_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
btnImport.addEventListener("click", () => {
  sounds.playButton();
  fileInput.click();
});
fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result;
    const imported = importSaveJSON(content);
    if (imported) {
      alert("\u0421\u0435\u0441\u0441\u0438\u044F \u0438 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0432\u044B\u0431\u043E\u0440\u043E\u0432 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B!");
      location.reload();
    } else {
      alert("\u041E\u0448\u0438\u0431\u043A\u0430 \u0447\u0442\u0435\u043D\u0438\u044F \u0444\u0430\u0439\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.");
    }
  };
  reader.readAsText(file);
});
btnRestart.addEventListener("click", () => {
  sounds.playButton();
  if (confirm("\u041D\u0430\u0447\u0430\u0442\u044C \u0438\u0433\u0440\u0443 \u0437\u0430\u043D\u043E\u0432\u043E? \u0412\u0435\u0441\u044C \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0431\u0443\u0434\u0435\u0442 \u0441\u0431\u0440\u043E\u0448\u0435\u043D.")) {
    engine.restartGame();
  }
});
//# sourceMappingURL=bundle.js.map
