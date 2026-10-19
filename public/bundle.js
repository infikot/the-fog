var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
  constructor(initialState, onStateChange, onLog) {
    __publicField(this, "state");
    __publicField(this, "bundle", null);
    __publicField(this, "onStateChange");
    __publicField(this, "onLog");
    this.state = { ...initialState };
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
      this.state.points = { value_0: 0, value_1: 0, first: 0, second: 0, good: 0, bad: 0 };
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
    this.state.currentQuestId = "0";
    this.state.currentLineId = "Line_0";
    this.state.completedQuests = [];
    this.state.completedEpisodes = [];
    this.state.inventory = {};
    this.state.points = { value_0: 0, value_1: 0, first: 0, second: 0, good: 0, bad: 0 };
    this.state.visitedLines = {};
    this.state.choiceHistory = [];
    this.state.history = [];
    this.state.currentBackground = "Backgrounds/1";
    this.state.currentScreen = "quest";
    this.processLine("Line_0");
    this.save();
  }
  continueGame() {
    if (!this.state.hasStartedSession) {
      this.startNewGame();
      return;
    }
    if (!this.state.currentQuestId) {
      const story = this.getCurrentStoryObj();
      const firstQ = Object.keys(story?.quests || {})[0] || "0";
      this.selectQuest(firstQ);
      return;
    }
    this.state.currentScreen = "quest";
    this.save();
  }
  returnToMenu() {
    this.state.currentScreen = "menu";
    this.save();
  }
  getCurrentEpisodeObj() {
    return this.bundle?.episodes?.[this.state.currentEpisode];
  }
  getCurrentStoryObj() {
    const ep = this.getCurrentEpisodeObj();
    return ep?.stories?.[this.state.currentStory];
  }
  getCurrentQuestObj() {
    const story = this.getCurrentStoryObj();
    if (!story || !this.state.currentQuestId) return null;
    return story.quests?.[this.state.currentQuestId];
  }
  getCurrentLineObj() {
    const quest = this.getCurrentQuestObj();
    if (!quest) return null;
    const lines = quest.graph?.lines || quest.lines;
    return lines?.[this.state.currentLineId] || null;
  }
  getAvailableQuests() {
    const story = this.getCurrentStoryObj();
    if (!story || !story.quests) return [];
    const list = [];
    for (const [qId, qData] of Object.entries(story.quests)) {
      const nameKey = qData.name_text;
      const descKey = qData.desc_text;
      const name = story.texts?.[nameKey]?.text || story.texts?.ru?.[nameKey]?.text || this.bundle?.common_texts?.[nameKey]?.text || qData.texts?.[nameKey]?.text || `\u041A\u0432\u0435\u0441\u0442 ${qId}`;
      const desc = story.texts?.[descKey]?.text || story.texts?.ru?.[descKey]?.text || this.bundle?.common_texts?.[descKey]?.text || qData.texts?.[descKey]?.text || "";
      const cards = [];
      if (Array.isArray(qData.cards)) {
        for (const c of qData.cards) {
          if (typeof c === "string") cards.push(c);
          else if (c && c.path) cards.push(c.path);
        }
      } else if (qData.cards) {
        for (const c of Object.values(qData.cards)) {
          if (typeof c === "string") cards.push(c);
          else if (c && c.path) cards.push(c.path);
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
      const nextStoryObj = epData.stories[nextStory];
      const firstQ = Object.keys(nextStoryObj?.quests || {})[0] || "0";
      this.selectQuest(firstQ);
    } else {
      if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
        this.state.completedEpisodes.push(this.state.currentEpisode);
      }
      const allEpisodes = Object.keys(this.bundle.episodes || {});
      const currentEpIndex = allEpisodes.indexOf(this.state.currentEpisode);
      if (currentEpIndex !== -1 && currentEpIndex < allEpisodes.length - 1) {
        const nextEp = allEpisodes[currentEpIndex + 1];
        this.state.currentEpisode = nextEp;
        this.state.currentStory = "0";
        const nextEpObj = this.bundle.episodes[nextEp];
        const nextStoryObj = nextEpObj?.stories?.["0"];
        const firstQ = Object.keys(nextStoryObj?.quests || {})[0] || "0";
        this.selectQuest(firstQ);
      } else {
        alert("\u041F\u043E\u0437\u0434\u0440\u0430\u0432\u043B\u044F\u0435\u043C! \u0412\u044B \u043F\u0440\u043E\u0448\u043B\u0438 \u0432\u0441\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u044D\u043F\u0438\u0437\u043E\u0434\u044B \u0438\u0433\u0440\u044B \xAB\u0422\u0443\u043C\u0430\u043D\xBB!");
        this.returnToMenu();
      }
    }
    this.save();
  }
  getChoiceText(textKey) {
    const quest = this.getCurrentQuestObj();
    const texts = quest?.texts || {};
    return texts[textKey]?.text || this.bundle?.common_texts?.[textKey]?.text || "";
  }
  step() {
    const currentLine = this.getCurrentLineObj();
    if (!currentLine) return;
    const comps = Object.values(currentLine.components);
    if (comps.some((c) => c.type === "line_to_quests")) {
      this.finishCurrentQuest();
      return;
    }
    const nextPointsComp = comps.find((c) => c.type === "line_next_points");
    if (nextPointsComp) {
      const targetLine = this.evalPointsBranch(nextPointsComp);
      if (targetLine) {
        this.goToLine(targetLine);
        return;
      }
    }
    const nextItemComp = comps.find((c) => c.type === "line_next_item");
    if (nextItemComp) {
      const targetLine = this.evalItemBranch(nextItemComp);
      if (targetLine) {
        this.goToLine(targetLine);
        return;
      }
    }
    const nextComp = comps.find((c) => c.type === "line_next" && c.line);
    if (nextComp && nextComp.line) {
      this.goToLine(nextComp.line);
      return;
    }
    this.finishCurrentQuest();
  }
  evalPointsBranch(comp) {
    if (comp.comparers) {
      for (const c of Object.values(comp.comparers)) {
        const pName = c.name;
        const isBlue = pName === "second" || pName === "value_1" || pName === "good";
        const normKey = isBlue ? "value_1" : "value_0";
        const val = this.state.points[pName] ?? this.state.points[normKey] ?? 0;
        const target = c.value || 0;
        let pass = false;
        switch (c.comparer) {
          case 0:
            pass = val === target;
            break;
          // Equal
          case 1:
            pass = val !== target;
            break;
          // NotEqual
          case 2:
            pass = val < target;
            break;
          // Less
          case 3:
            pass = val <= target;
            break;
          // LessEqual
          case 4:
            pass = val > target;
            break;
          // Greater
          case 5:
            pass = val >= target;
            break;
          // GreaterEqual
          default:
            pass = val >= target;
            break;
        }
        if (pass && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }
  evalItemBranch(comp) {
    if (comp.comparers) {
      for (const c of Object.values(comp.comparers)) {
        const item = c.item;
        const hasItem = (this.state.inventory[item] || 0) > 0;
        if (hasItem && c.line) {
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
          const cleanText = rawText.replace(/<\/?(?:i|b|color[^>]*|size[^>]*)>/gi, "").trim();
          const pointChange = redChange !== 0 || blueChange !== 0 ? { red: redChange, blue: blueChange } : void 0;
          this.log(cleanText, false, pointChange);
        }
      }
    }
    this.save();
  }
  applyPointModifiers(mods) {
    let redDiff = 0;
    let blueDiff = 0;
    for (const mod of mods) {
      const isBlue = mod.name === "second" || mod.name === "value_1" || mod.name === "good";
      const key = isBlue ? "value_1" : "value_0";
      const current = this.state.points[key] || 0;
      let next = current;
      switch (mod.operator) {
        case 0:
          next = mod.value;
          break;
        // Set
        case 1:
          next = current + mod.value;
          break;
        // Add
        case 2:
          next = current - mod.value;
          break;
        // Sub
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
    const story = this.getCurrentStoryObj();
    const storyQuests = Object.keys(story?.quests || {});
    const currentQIndex = storyQuests.indexOf(this.state.currentQuestId || "0");
    if (currentQIndex !== -1 && currentQIndex < storyQuests.length - 1) {
      const nextQId = storyQuests[currentQIndex + 1];
      this.selectQuest(nextQId);
    } else {
      this.advanceToNextStory();
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
  constructor() {
    __publicField(this, "ambientAudio", null);
    __publicField(this, "isMuted", false);
    __publicField(this, "sfxVolume", 0.8);
    __publicField(this, "ambientVolume", 0.35);
    __publicField(this, "sfxPool", {});
    this.loadSettings();
    this.preloadSfx();
    this.initAmbient(1);
  }
  loadSettings() {
    try {
      const saved = localStorage.getItem("thefog_sound_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.sfxVolume === "number") this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.ambientVolume === "number") this.ambientVolume = parsed.ambientVolume;
        if (typeof parsed.isMuted === "boolean") this.isMuted = parsed.isMuted;
      }
    } catch (e) {
    }
  }
  saveSettings() {
    try {
      localStorage.setItem("thefog_sound_config", JSON.stringify({
        sfxVolume: this.sfxVolume,
        ambientVolume: this.ambientVolume,
        isMuted: this.isMuted
      }));
    } catch (e) {
    }
  }
  preloadSfx() {
    const sfxList = ["button", "choice", "inventory", "cards"];
    for (const name of sfxList) {
      const a = new Audio(`./assets/audio/so_${name}_1.mp3`);
      a.preload = "auto";
      this.sfxPool[name] = a;
    }
  }
  initAmbient(trackNum) {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }
    this.ambientAudio = new Audio(`./assets/audio/mu_ambient_${trackNum}.mp3`);
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = this.isMuted ? 0 : this.ambientVolume;
  }
  playAmbient(trackNum = 1) {
    if (this.isMuted || this.ambientVolume <= 0) return;
    if (!this.ambientAudio) {
      this.initAmbient(trackNum);
    }
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.ambientVolume;
      this.ambientAudio.play().catch(() => {
      });
    }
  }
  pauseAmbient() {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }
  playSfx(name) {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      const original = this.sfxPool[name];
      if (original) {
        const audio = original.cloneNode();
        audio.volume = this.sfxVolume;
        audio.play().catch(() => {
        });
      } else {
        const audio = new Audio(`./assets/audio/so_${name}_1.mp3`);
        audio.volume = this.sfxVolume;
        audio.play().catch(() => {
        });
      }
    } catch (e) {
    }
  }
  playButton() {
    this.playSfx("button");
  }
  playChoice() {
    this.playSfx("choice");
  }
  playInventory() {
    this.playSfx("inventory");
  }
  playCards() {
    this.playSfx("cards");
  }
  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }
  getSfxVolume() {
    return this.sfxVolume;
  }
  setAmbientVolume(vol) {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.isMuted ? 0 : this.ambientVolume;
      if (this.ambientVolume > 0 && this.ambientAudio.paused && !this.isMuted) {
        this.ambientAudio.play().catch(() => {
        });
      } else if (this.ambientVolume === 0) {
        this.ambientAudio.pause();
      }
    }
    this.saveSettings();
  }
  getAmbientVolume() {
    return this.ambientVolume;
  }
  toggle() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseAmbient();
    } else {
      this.playAmbient();
    }
    this.saveSettings();
    return !this.isMuted;
  }
  getMuted() {
    return this.isMuted;
  }
};

// src/main.ts
var sounds = new SoundManager();
var engine = new FogEngine(
  loadStateFromLocal(),
  (state) => renderApp(state),
  (text, isChoice, pointChange) => appendLogMessage(text, isChoice, pointChange)
);
var screenMenu = document.getElementById("screen-menu");
var screenHub = document.getElementById("screen-hub");
var screenQuest = document.getElementById("screen-quest");
var gameBg = document.getElementById("game-bg");
var btnStart = document.getElementById("menu-btn-start");
var btnContinue = document.getElementById("menu-btn-continue");
var btnSettingsMenu = document.getElementById("menu-btn-settings");
var btnSoundMenu = document.getElementById("menu-btn-sound");
var menuSoundIcon = document.getElementById("menu-sound-icon");
var questBtnMenu = document.getElementById("quest-btn-menu");
var questBtnInv = document.getElementById("quest-btn-inv");
var questBtnSound = document.getElementById("quest-btn-sound");
var questSoundIcon = document.getElementById("quest-sound-icon");
var pointsRedVal = document.getElementById("points-red-val");
var pointsBlueVal = document.getElementById("points-blue-val");
var logContainer = document.getElementById("log-container");
var controlsContainer = document.getElementById("controls-container");
var modalSettings = document.getElementById("modal-settings");
var closeSettings = document.getElementById("close-settings");
var sliderSfx = document.getElementById("slider-sfx");
var sliderAmbient = document.getElementById("slider-ambient");
var sfxValText = document.getElementById("val-sfx");
var ambientValText = document.getElementById("val-ambient");
var btnExport = document.getElementById("btn-export");
var btnImport = document.getElementById("btn-import");
var fileInput = document.getElementById("file-input");
var btnRestart = document.getElementById("btn-restart");
var modalInventory = document.getElementById("modal-inventory");
var closeInventory = document.getElementById("close-inventory");
var inventoryList = document.getElementById("inventory-list");
var hubEpTitle = document.getElementById("hub-ep-title");
var hubStoryTitle = document.getElementById("hub-story-title");
var cardContainer = document.getElementById("card-container");
var questNameEl = document.getElementById("quest-name");
var questDescEl = document.getElementById("quest-desc");
var btnPrevQuest = document.getElementById("btn-prev-quest");
var btnNextQuest = document.getElementById("btn-next-quest");
var hubActionContainer = document.getElementById("hub-action-container");
var currentCarouselIndex = 0;
var hubQuestsList = [];
var lastBackgroundPath = "";
var peekTimeout = null;
function renderApp(state) {
  updateBackground(state.currentBackground);
  updatePoints(state);
  updateSoundIcons();
  if (state.currentScreen === "menu") {
    screenMenu.style.display = "flex";
    screenHub.style.display = "none";
    screenQuest.style.display = "none";
    btnContinue.style.display = state.hasStartedSession ? "flex" : "none";
  } else if (state.currentScreen === "story_hub") {
    screenMenu.style.display = "none";
    screenHub.style.display = "flex";
    screenQuest.style.display = "none";
    renderHub(state);
  } else if (state.currentScreen === "quest") {
    screenMenu.style.display = "none";
    screenHub.style.display = "none";
    screenQuest.style.display = "flex";
    renderQuest(state);
  }
}
function updateBackground(bgPath) {
  if (!bgPath) return;
  const clean = bgPath.replace(/^Backgrounds\//, "").replace(/\.(png|jpg|webp)$/i, "");
  const url = `./assets/backgrounds/${clean}.webp`;
  if (bgPath !== lastBackgroundPath) {
    lastBackgroundPath = bgPath;
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
function triggerTemporaryPeek(durationMs = 1200) {
  document.body.classList.add("peeking");
  if (peekTimeout) clearTimeout(peekTimeout);
  peekTimeout = setTimeout(() => {
    document.body.classList.remove("peeking");
    peekTimeout = null;
  }, durationMs);
}
function updatePoints(state) {
  if (pointsRedVal) pointsRedVal.textContent = String(state.points.value_0 || 0);
  if (pointsBlueVal) pointsBlueVal.textContent = String(state.points.value_1 || 0);
}
function updateSoundIcons() {
  const isMuted = sounds.getMuted();
  const icon = isMuted ? "volume_off" : "volume_up";
  if (menuSoundIcon) menuSoundIcon.textContent = icon;
  if (questSoundIcon) questSoundIcon.textContent = icon;
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
  const q = hubQuestsList[currentCarouselIndex];
  questNameEl.textContent = q.name;
  questDescEl.textContent = q.desc;
  cardContainer.innerHTML = "";
  if (q.cards && q.cards.length > 0) {
    const cardPath = q.cards[0].replace(/^Cards\//, "").replace(/\.(png|jpg|webp)$/i, "");
    const img = document.createElement("img");
    img.src = `./assets/cards/${cardPath}.webp`;
    img.className = "w-full h-full object-cover rounded-lg shadow-xl";
    img.alt = q.name;
    img.onerror = () => {
      img.src = "./favicon.png";
    };
    cardContainer.appendChild(img);
  } else {
    cardContainer.innerHTML = `<div class="flex items-center justify-center h-full text-fog-muted text-sm font-serif">\u041B\u043E\u043A\u0430\u0446\u0438\u044F [${q.name}]</div>`;
  }
  hubActionContainer.innerHTML = "";
  const actionBtn = document.createElement("button");
  actionBtn.className = "fog-btn-action w-full py-3 text-base";
  actionBtn.innerHTML = `<span>\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0443\u0442\u0435\u0448\u0435\u0441\u0442\u0432\u0438\u0435</span><span>\u2794</span>`;
  actionBtn.addEventListener("click", () => {
    sounds.playChoice();
    engine.selectQuest(q.id);
  });
  hubActionContainer.appendChild(actionBtn);
}
btnPrevQuest.addEventListener("click", () => {
  if (hubQuestsList.length <= 1) return;
  sounds.playCards();
  currentCarouselIndex = (currentCarouselIndex - 1 + hubQuestsList.length) % hubQuestsList.length;
  renderHub(engine.getState());
});
btnNextQuest.addEventListener("click", () => {
  if (hubQuestsList.length <= 1) return;
  sounds.playCards();
  currentCarouselIndex = (currentCarouselIndex + 1) % hubQuestsList.length;
  renderHub(engine.getState());
});
function renderQuest(state) {
  if (logContainer.children.length === 0 && state.history) {
    for (const item of state.history) {
      appendLogMessage(item.text, item.isChoice, item.pointChange);
    }
  }
  controlsContainer.innerHTML = "";
  const currentLine = engine.getCurrentLineObj();
  if (!currentLine) {
    const btn = document.createElement("button");
    btn.className = "fog-btn-action animate-fade-in";
    btn.innerHTML = `<span>\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0443\u0442\u044C</span><span>\u2794</span>`;
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
      const choiceText = engine.getChoiceText(item.text) || `\u0412\u0430\u0440\u0438\u0430\u043D\u0442 ${key}`;
      choiceBtn.textContent = choiceText;
      choiceBtn.addEventListener("click", () => {
        sounds.playChoice();
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
  if (pointChange && (pointChange.red || pointChange.blue)) {
    const badgesRow = document.createElement("div");
    badgesRow.className = "point-badges-row";
    if (pointChange.red) {
      const r = document.createElement("span");
      r.className = "point-badge-change red";
      r.textContent = `${pointChange.red > 0 ? "+" : ""}${pointChange.red}`;
      badgesRow.appendChild(r);
    }
    if (pointChange.blue) {
      const b = document.createElement("span");
      b.className = "point-badge-change blue";
      b.textContent = `${pointChange.blue > 0 ? "+" : ""}${pointChange.blue}`;
      badgesRow.appendChild(b);
    }
    container.appendChild(badgesRow);
  }
  logContainer.appendChild(container);
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}
btnStart.addEventListener("click", () => {
  sounds.playButton();
  sounds.playAmbient(1);
  engine.startNewGame();
});
btnContinue.addEventListener("click", () => {
  sounds.playButton();
  sounds.playAmbient(1);
  engine.continueGame();
});
btnSoundMenu.addEventListener("click", () => {
  sounds.toggle();
  updateSoundIcons();
});
questBtnSound.addEventListener("click", () => {
  sounds.toggle();
  updateSoundIcons();
});
questBtnMenu.addEventListener("click", () => {
  sounds.playButton();
  modalSettings.style.display = "flex";
});
btnSettingsMenu.addEventListener("click", () => {
  sounds.playButton();
  modalSettings.style.display = "flex";
});
questBtnInv.addEventListener("click", () => {
  sounds.playInventory();
  renderInventory();
  modalInventory.style.display = "flex";
});
closeInventory.addEventListener("click", () => {
  sounds.playButton();
  modalInventory.style.display = "none";
});
function renderInventory() {
  inventoryList.innerHTML = "";
  const inv = engine.getState().inventory || {};
  const catalog = engine.getItemsCatalog();
  const commonRu = engine.getCommonRu();
  const entries = Object.entries(inv).filter(([_, count]) => count > 0);
  if (entries.length === 0) {
    inventoryList.innerHTML = `<div class="col-span-full py-8 text-center text-sm text-fog-muted font-serif">\u0420\u044E\u043A\u0437\u0430\u043A \u043F\u0443\u0441\u0442. \u0418\u0441\u0441\u043B\u0435\u0434\u0443\u0439\u0442\u0435 \u043B\u043E\u043A\u0430\u0446\u0438\u0438, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0439\u0442\u0438 \u043F\u0440\u0438\u043F\u0430\u0441\u044B \u0438 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u044B.</div>`;
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
function syncAudioSliders() {
  const sfxPercent = Math.round(sounds.getSfxVolume() * 100);
  const ambientPercent = Math.round(sounds.getAmbientVolume() * 100);
  sliderSfx.value = String(sfxPercent);
  sliderAmbient.value = String(ambientPercent);
  sfxValText.textContent = `${sfxPercent}%`;
  ambientValText.textContent = `${ambientPercent}%`;
}
sliderSfx.addEventListener("input", (e) => {
  const val = Number(e.target.value);
  sfxValText.textContent = `${val}%`;
  sounds.setSfxVolume(val / 100);
  sounds.playButton();
});
sliderAmbient.addEventListener("input", (e) => {
  const val = Number(e.target.value);
  ambientValText.textContent = `${val}%`;
  sounds.setAmbientVolume(val / 100);
});
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
var isPressing = false;
var startPeek = () => {
  isPressing = true;
  if (peekTimeout) {
    clearTimeout(peekTimeout);
    peekTimeout = null;
  }
  document.body.classList.add("peeking");
};
var stopPeek = () => {
  if (!isPressing) return;
  isPressing = false;
  document.body.classList.remove("peeking");
};
logContainer.addEventListener("mousedown", startPeek);
logContainer.addEventListener("mouseup", stopPeek);
logContainer.addEventListener("mouseleave", stopPeek);
logContainer.addEventListener("touchstart", (e) => {
  const target = e.target;
  if (target && target.closest("button, a, input")) return;
  startPeek();
}, { passive: true });
logContainer.addEventListener("touchend", stopPeek);
logContainer.addEventListener("touchcancel", stopPeek);
engine.init().then(() => {
  syncAudioSliders();
  renderApp(engine.getState());
});
