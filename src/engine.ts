import { GameState, GameLine, PointModifier } from './types';
import { saveStateToLocal } from './storage';

export class FogEngine {
  private state: GameState;
  private bundle: any = null;
  private onStateChange: (state: GameState) => void;
  private onLog: (text: string, isChoice?: boolean, pointChange?: { red?: number; blue?: number }) => void;

  constructor(
    initialState: GameState,
    onStateChange: (state: GameState) => void,
    onLog: (text: string, isChoice?: boolean, pointChange?: { red?: number; blue?: number }) => void
  ) {
    this.state = { ...initialState };
    this.onStateChange = onStateChange;
    this.onLog = onLog;
  }

  public async init(): Promise<void> {
    const res = await fetch('./game_bundle.json');
    this.bundle = await res.json();

    if (!this.state.currentEpisode) {
      this.state.currentEpisode = this.bundle.first_episode || 'nazareth';
    }
    if (!this.state.currentStory) {
      this.state.currentStory = '0';
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

  public getState(): GameState {
    return this.state;
  }

  public getCommonRu(): any {
    return this.bundle?.common_texts || {};
  }

  public getItemsCatalog(): any {
    return this.bundle?.items || {};
  }

  public getEpisodesCatalog(): any {
    return this.bundle?.episodes || {};
  }

  public startNewGame(): void {
    this.state.hasStartedSession = true;
    this.state.currentEpisode = this.bundle.first_episode || 'nazareth';
    this.state.currentStory = '0';
    this.state.currentQuestId = '0';
    this.state.currentLineId = 'Line_0';
    this.state.completedQuests = [];
    this.state.completedEpisodes = [];
    this.state.inventory = {};
    this.state.points = { value_0: 0, value_1: 0, first: 0, second: 0, good: 0, bad: 0 };
    this.state.visitedLines = {};
    this.state.choiceHistory = [];
    this.state.history = [];
    this.state.currentBackground = 'Backgrounds/1';
    this.state.currentScreen = 'quest';
    this.processLine('Line_0');
    this.save();
  }

  public continueGame(): void {
    if (!this.state.hasStartedSession) {
      this.startNewGame();
      return;
    }
    // Strictly continue where left off
    if (!this.state.currentQuestId) {
      // Find current active quest in the story
      const story = this.getCurrentStoryObj();
      const firstQ = Object.keys(story?.quests || {})[0] || '0';
      this.selectQuest(firstQ);
      return;
    }
    this.state.currentScreen = 'quest';
    this.save();
  }

  public returnToMenu(): void {
    this.state.currentScreen = 'menu';
    this.save();
  }

  public getCurrentEpisodeObj(): any {
    return this.bundle?.episodes?.[this.state.currentEpisode];
  }

  public getCurrentStoryObj(): any {
    const ep = this.getCurrentEpisodeObj();
    return ep?.stories?.[this.state.currentStory];
  }

  public getCurrentQuestObj(): any {
    const story = this.getCurrentStoryObj();
    if (!story || !this.state.currentQuestId) return null;
    return story.quests?.[this.state.currentQuestId];
  }

  public getCurrentLineObj(): GameLine | null {
    const quest = this.getCurrentQuestObj();
    if (!quest) return null;
    const lines = quest.graph?.lines || quest.lines;
    return lines?.[this.state.currentLineId] || null;
  }

  public getAvailableQuests(): Array<{ id: string; name: string; desc: string; cards: string[]; isDone: boolean }> {
    const story = this.getCurrentStoryObj();
    if (!story || !story.quests) return [];

    const list: Array<any> = [];
    for (const [qId, qData] of Object.entries(story.quests as Record<string, any>)) {
      const nameKey = qData.name_text;
      const descKey = qData.desc_text;
      const name = story.texts?.[nameKey]?.text || story.texts?.ru?.[nameKey]?.text || this.bundle?.common_texts?.[nameKey]?.text || qData.texts?.[nameKey]?.text || `Квест ${qId}`;
      const desc = story.texts?.[descKey]?.text || story.texts?.ru?.[descKey]?.text || this.bundle?.common_texts?.[descKey]?.text || qData.texts?.[descKey]?.text || '';
      const cards: string[] = [];
      if (Array.isArray(qData.cards)) {
        for (const c of qData.cards) {
          if (typeof c === 'string') cards.push(c);
          else if (c && c.path) cards.push(c.path);
        }
      } else if (qData.cards) {
        for (const c of Object.values(qData.cards as Record<string, any>)) {
          if (typeof c === 'string') cards.push(c);
          else if (c && c.path) cards.push(c.path);
        }
      }
      const questKey = `${this.state.currentEpisode}_${this.state.currentStory}_${qId}`;
      const isDone = this.state.completedQuests.includes(questKey) || this.state.completedQuests.includes(qId);
      list.push({ id: qId, name, desc, cards, isDone });
    }
    return list;
  }

  public selectQuest(questId: string): void {
    this.state.currentQuestId = questId;
    this.state.currentLineId = 'Line_0';
    this.state.currentScreen = 'quest';
    this.state.history = []; // Clear chat on new quest start
    this.processLine('Line_0');
  }

  public advanceToNextStory(): void {
    const epData = this.bundle.episodes?.[this.state.currentEpisode];
    const storyKeys = Object.keys(epData?.stories || {});
    const currentStoryIndex = storyKeys.indexOf(this.state.currentStory);

    if (currentStoryIndex !== -1 && currentStoryIndex < storyKeys.length - 1) {
      const nextStory = storyKeys[currentStoryIndex + 1];
      this.state.currentStory = nextStory;
      const nextStoryObj = epData.stories[nextStory];
      const firstQ = Object.keys(nextStoryObj?.quests || {})[0] || '0';
      this.selectQuest(firstQ);
    } else {
      // Episode completed -> check next episode
      if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
        this.state.completedEpisodes.push(this.state.currentEpisode);
      }
      const allEpisodes = Object.keys(this.bundle.episodes || {});
      const currentEpIndex = allEpisodes.indexOf(this.state.currentEpisode);
      if (currentEpIndex !== -1 && currentEpIndex < allEpisodes.length - 1) {
        const nextEp = allEpisodes[currentEpIndex + 1];
        this.state.currentEpisode = nextEp;
        this.state.currentStory = '0';
        const nextEpObj = this.bundle.episodes[nextEp];
        const nextStoryObj = nextEpObj?.stories?.['0'];
        const firstQ = Object.keys(nextStoryObj?.quests || {})[0] || '0';
        this.selectQuest(firstQ);
      } else {
        alert('Поздравляем! Вы прошли все доступные эпизоды игры «Туман»!');
        this.returnToMenu();
      }
    }
    this.save();
  }

  public getChoiceText(textKey: string): string {
    const quest = this.getCurrentQuestObj();
    const texts = quest?.texts || {};
    return texts[textKey]?.text || this.bundle?.common_texts?.[textKey]?.text || '';
  }

  public step(): void {
    const currentLine = this.getCurrentLineObj();
    if (!currentLine) return;

    const comps = Object.values(currentLine.components);

    // 1. Line to quests (End of quest)
    if (comps.some((c) => c.type === 'line_to_quests')) {
      this.finishCurrentQuest();
      return;
    }

    // 2. Conditional Branching by points (line_next_points)
    const nextPointsComp = comps.find((c) => c.type === 'line_next_points');
    if (nextPointsComp) {
      const targetLine = this.evalPointsBranch(nextPointsComp);
      if (targetLine) {
        this.goToLine(targetLine);
        return;
      }
    }

    // 3. Conditional Branching by items (line_next_item)
    const nextItemComp = comps.find((c) => c.type === 'line_next_item');
    if (nextItemComp) {
      const targetLine = this.evalItemBranch(nextItemComp);
      if (targetLine) {
        this.goToLine(targetLine);
        return;
      }
    }

    // 4. Default next transition (line_next)
    const nextComp = comps.find((c) => c.type === 'line_next' && c.line);
    if (nextComp && nextComp.line) {
      this.goToLine(nextComp.line);
      return;
    }

    // If no direct transitions found, end quest
    this.finishCurrentQuest();
  }

  private evalPointsBranch(comp: any): string | null {
    if (comp.comparers) {
      for (const c of Object.values(comp.comparers) as any[]) {
        const pName = c.name;
        // Map points to both raw name and normalized slot
        const isBlue = pName === 'second' || pName === 'value_1' || pName === 'good';
        const normKey = isBlue ? 'value_1' : 'value_0';
        const val = this.state.points[pName] ?? this.state.points[normKey] ?? 0;
        const target = c.value || 0;
        let pass = false;

        switch (c.comparer) {
          case 0: pass = val === target; break; // Equal
          case 1: pass = val !== target; break; // NotEqual
          case 2: pass = val < target; break;   // Less
          case 3: pass = val <= target; break;  // LessEqual
          case 4: pass = val > target; break;   // Greater
          case 5: pass = val >= target; break;  // GreaterEqual
          default: pass = val >= target; break;
        }

        if (pass && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }

  private evalItemBranch(comp: any): string | null {
    if (comp.comparers) {
      for (const c of Object.values(comp.comparers) as any[]) {
        const item = c.item;
        const hasItem = (this.state.inventory[item] || 0) > 0;
        if (hasItem && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }

  public choose(choiceLine: string, choiceText: string): void {
    this.state.choiceHistory.push({
      episode: this.state.currentEpisode,
      story: this.state.currentStory,
      questId: this.state.currentQuestId || '0',
      fromLineId: this.state.currentLineId,
      choiceLineId: choiceLine,
      choiceText,
      timestamp: Date.now(),
    });

    this.log(choiceText, true);
    this.goToLine(choiceLine);
  }

  private goToLine(lineId: string): void {
    this.state.currentLineId = lineId;
    this.processLine(lineId);
  }

  public processLine(lineId: string): void {
    const quest = this.getCurrentQuestObj();
    if (!quest) return;
    const lines = quest.graph?.lines || quest.lines;
    const line = lines?.[lineId];
    if (!line) return;

    const fullLineKey = `${this.state.currentEpisode}_${this.state.currentStory}_${this.state.currentQuestId}_${lineId}`;
    this.state.visitedLines[fullLineKey] = true;

    let redChange = 0;
    let blueChange = 0;

    // Apply Components
    for (const comp of Object.values(line.components) as any[]) {
      if (comp.type === 'line_background' && comp.background !== undefined) {
        const bgList = quest.graph?.backgrounds || quest.backgrounds;
        const bgEntry = bgList?.[comp.background];
        if (bgEntry?.path) {
          this.state.currentBackground = bgEntry.path;
        }
      }
      if (comp.type === 'line_points' && comp.modifiers) {
        const diff = this.applyPointModifiers(Object.values(comp.modifiers));
        redChange += diff.red;
        blueChange += diff.blue;
      }
      if (comp.type === 'line_inventory_add' && comp.item) {
        this.state.inventory[comp.item] = (this.state.inventory[comp.item] || 0) + 1;
      }
      if (comp.type === 'line_inventory_remove' && comp.item) {
        if (this.state.inventory[comp.item]) {
          this.state.inventory[comp.item] = Math.max(0, this.state.inventory[comp.item] - 1);
        }
      }
    }

    // Apply Text
    for (const comp of Object.values(line.components) as any[]) {
      if (comp.type === 'line_text' && comp.text) {
        const questTexts = quest.texts;
        const rawText = questTexts?.[comp.text]?.text || this.bundle?.common_texts?.[comp.text]?.text;
        if (rawText) {
          const cleanText = rawText.replace(/<\/?(?:i|b|color[^>]*|size[^>]*)>/gi, '').trim();
          const pointChange = (redChange !== 0 || blueChange !== 0) ? { red: redChange, blue: blueChange } : undefined;
          this.log(cleanText, false, pointChange);
        }
      }
    }

    this.save();
  }

  private applyPointModifiers(mods: PointModifier[]): { red: number; blue: number } {
    let redDiff = 0;
    let blueDiff = 0;

    for (const mod of mods) {
      const isBlue = mod.name === 'second' || mod.name === 'value_1' || mod.name === 'good';
      const key = isBlue ? 'value_1' : 'value_0';
      const current = this.state.points[key] || 0;
      let next = current;

      switch (mod.operator) {
        case 0: next = mod.value; break; // Set
        case 1: next = current + mod.value; break; // Add
        case 2: next = current - mod.value; break; // Sub
        default: next = current + mod.value; break;
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

  public finishCurrentQuest(): void {
    const questKey = `${this.state.currentEpisode}_${this.state.currentStory}_${this.state.currentQuestId}`;
    if (!this.state.completedQuests.includes(questKey)) {
      this.state.completedQuests.push(questKey);
    }
    if (this.state.currentQuestId && !this.state.completedQuests.includes(this.state.currentQuestId)) {
      this.state.completedQuests.push(this.state.currentQuestId);
    }

    const story = this.getCurrentStoryObj();
    const storyQuests = Object.keys(story?.quests || {});
    const currentQIndex = storyQuests.indexOf(this.state.currentQuestId || '0');

    // If there is another quest in the same story, automatically go to it!
    if (currentQIndex !== -1 && currentQIndex < storyQuests.length - 1) {
      const nextQId = storyQuests[currentQIndex + 1];
      this.selectQuest(nextQId);
    } else {
      // Story finished! Advance directly to next story
      this.advanceToNextStory();
    }

    this.save();
  }

  private log(text: string, isChoice = false, pointChange?: { red?: number; blue?: number }): void {
    this.state.history.push({ text, isChoice, pointChange });
    this.onLog(text, isChoice, pointChange);
  }

  private save(): void {
    saveStateToLocal(this.state);
    this.onStateChange(this.state);
  }

  public restartGame(): void {
    this.startNewGame();
    location.reload();
  }
}
