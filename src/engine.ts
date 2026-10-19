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
    if (this.state.currentQuestId === undefined) {
      this.state.currentQuestId = '0';
    }
    if (!this.state.currentLineId) {
      this.state.currentLineId = 'Line_0';
    }
    if (!this.state.points) {
      this.state.points = { value_0: 0, value_1: 0, first: 0, second: 0 };
    }
    if (!this.state.inventory) {
      this.state.inventory = {};
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

  private getCurrentStoryObj(): any {
    if (!this.bundle) return null;
    return this.bundle.episodes?.[this.state.currentEpisode]?.stories?.[this.state.currentStory] || null;
  }

  public getCurrentQuestObj(): any {
    const story = this.getCurrentStoryObj();
    if (!story || !this.state.currentQuestId) return null;
    return story.quests?.[this.state.currentQuestId] || null;
  }

  public getCurrentLine(): GameLine | null {
    const quest = this.getCurrentQuestObj();
    if (!quest) return null;
    const lines = quest.graph?.lines || quest.lines;
    if (!lines) return null;
    return lines[this.state.currentLineId] || null;
  }

  public getAvailableQuests(): Array<{ id: string; name: string; desc: string; cards: string[]; isDone: boolean }> {
    const story = this.getCurrentStoryObj();
    if (!story || !story.quests) return [];

    const list: Array<any> = [];
    for (const [qId, qData] of Object.entries(story.quests as Record<string, any>)) {
      const nameKey = qData.name_text;
      const descKey = qData.desc_text;
      const name = this.bundle?.common_texts?.[nameKey]?.text || story.texts?.ru?.[nameKey]?.text || qData.texts?.[nameKey]?.text || `Квест ${qId}`;
      const desc = this.bundle?.common_texts?.[descKey]?.text || story.texts?.ru?.[descKey]?.text || qData.texts?.[descKey]?.text || '';
      const cards: string[] = [];
      if (qData.cards) {
        for (const c of Object.values(qData.cards as Record<string, any>)) {
          cards.push(c.path);
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
    this.processLine('Line_0');
  }

  public advanceToNextStory(): void {
    const epData = this.bundle.episodes?.[this.state.currentEpisode];
    const storyKeys = Object.keys(epData?.stories || {});
    const currentStoryIndex = storyKeys.indexOf(this.state.currentStory);

    if (currentStoryIndex !== -1 && currentStoryIndex < storyKeys.length - 1) {
      const nextStory = storyKeys[currentStoryIndex + 1];
      this.state.currentStory = nextStory;
      const storyObj = epData.stories[nextStory];
      const questKeys = Object.keys(storyObj?.quests || {});
      this.state.currentQuestId = questKeys.length > 0 ? questKeys[0] : null;
      this.state.currentLineId = 'Line_0';
      if (this.state.currentQuestId) {
        this.processLine('Line_0');
      }
    } else {
      // Episode completed
      if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
        this.state.completedEpisodes.push(this.state.currentEpisode);
      }
      const epKeys = Object.keys(this.bundle.episodes || {});
      const epIndex = epKeys.indexOf(this.state.currentEpisode);
      if (epIndex !== -1 && epIndex < epKeys.length - 1) {
        this.state.currentEpisode = epKeys[epIndex + 1];
        this.state.currentStory = '0';
        const epDataNext = this.bundle.episodes?.[this.state.currentEpisode];
        const nextQuests = Object.keys(epDataNext?.stories?.['0']?.quests || {});
        this.state.currentQuestId = nextQuests.length > 0 ? nextQuests[0] : null;
        this.state.currentLineId = 'Line_0';
        if (this.state.currentQuestId) {
          this.processLine('Line_0');
        }
      } else {
        this.state.gameFinished = true;
      }
    }
    this.save();
  }

  public step(): void {
    const line = this.getCurrentLine();
    if (!line) return;

    for (const comp of Object.values(line.components)) {
      if (comp.type === 'line_next' && comp.line) {
        this.goToLine(comp.line);
        return;
      }
      if (comp.type === 'line_next_points') {
        const nextTarget = this.evaluateNextPoints(comp);
        if (nextTarget) {
          this.goToLine(nextTarget);
          return;
        }
      }
      if (comp.type === 'line_next_item') {
        const nextTarget = this.evaluateNextItem(comp);
        if (nextTarget) {
          this.goToLine(nextTarget);
          return;
        }
      }
      if (comp.type === 'line_to_quests') {
        this.finishCurrentQuest();
        return;
      }
    }
  }

  private evaluateNextPoints(comp: any): string | null {
    if (comp.comparers) {
      const comparers = Object.values(comp.comparers) as any[];
      for (const c of comparers) {
        const pointKey = c.name === 'second' || c.name === 'value_1' ? 'value_1' : 'value_0';
        const currentVal = this.state.points[pointKey] || 0;
        const targetVal = c.value ?? 0;
        const comparer = c.comparer ?? 0;

        let matches = false;
        switch (comparer) {
          case 0: matches = currentVal === targetVal; break;
          case 1: matches = currentVal !== targetVal; break;
          case 2: matches = currentVal < targetVal; break;
          case 3: matches = currentVal <= targetVal; break;
          case 4: matches = currentVal >= targetVal; break;
          case 5: matches = currentVal > targetVal; break;
          default: matches = currentVal >= targetVal; break;
        }

        if (matches && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }

  private evaluateNextItem(comp: any): string | null {
    if (comp.comparers) {
      const comparers = Object.values(comp.comparers) as any[];
      for (const c of comparers) {
        if (c.item && (this.state.inventory[c.item] || 0) > 0 && c.line) {
          return c.line;
        }
      }
    }
    return comp.line || null;
  }

  public choose(choiceLine: string, choiceText: string): void {
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
          const pointChange = (redChange !== 0 || blueChange !== 0) ? { red: redChange, blue: blueChange } : undefined;
          this.log(rawText, false, pointChange);
        }
      }
    }

    this.save();
  }

  private applyPointModifiers(mods: PointModifier[]): { red: number; blue: number } {
    let redDiff = 0;
    let blueDiff = 0;

    for (const mod of mods) {
      const isBlue = mod.name === 'second' || mod.name === 'value_1';
      const key = isBlue ? 'value_1' : 'value_0';
      const current = this.state.points[key] || 0;
      let next = current;

      switch (mod.operator) {
        case 0: // Set
          next = mod.value;
          break;
        case 1: // Add
          next = current + mod.value;
          break;
        case 2: // Sub
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

  public finishCurrentQuest(): void {
    const questKey = `${this.state.currentEpisode}_${this.state.currentStory}_${this.state.currentQuestId}`;
    if (!this.state.completedQuests.includes(questKey)) {
      this.state.completedQuests.push(questKey);
    }
    if (this.state.currentQuestId && !this.state.completedQuests.includes(this.state.currentQuestId)) {
      this.state.completedQuests.push(this.state.currentQuestId);
    }

    const story = this.getCurrentStoryObj();
    const allStoryQuests = Object.keys(story?.quests || {});
    const isStoryDone = allStoryQuests.every((q) => {
      const fullK = `${this.state.currentEpisode}_${this.state.currentStory}_${q}`;
      return this.state.completedQuests.includes(fullK) || this.state.completedQuests.includes(q);
    });

    if (isStoryDone) {
      // Auto-unlock or set next story ready
      const epData = this.bundle.episodes?.[this.state.currentEpisode];
      const storyKeys = Object.keys(epData?.stories || {});
      const currentStoryIndex = storyKeys.indexOf(this.state.currentStory);

      if (currentStoryIndex !== -1 && currentStoryIndex < storyKeys.length - 1) {
        this.state.currentStory = storyKeys[currentStoryIndex + 1];
        const nextQuests = Object.keys(epData.stories[this.state.currentStory]?.quests || {});
        this.state.currentQuestId = nextQuests.length > 0 ? nextQuests[0] : null;
        this.state.currentLineId = 'Line_0';
        if (this.state.currentQuestId) {
          this.processLine('Line_0');
        }
      } else {
        // Episode finished!
        if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
          this.state.completedEpisodes.push(this.state.currentEpisode);
        }
        const epKeys = Object.keys(this.bundle.episodes || {});
        const epIndex = epKeys.indexOf(this.state.currentEpisode);
        if (epIndex !== -1 && epIndex < epKeys.length - 1) {
          this.state.currentEpisode = epKeys[epIndex + 1];
          this.state.currentStory = '0';
          const epNextQuests = Object.keys(this.bundle.episodes[this.state.currentEpisode]?.stories?.['0']?.quests || {});
          this.state.currentQuestId = epNextQuests.length > 0 ? epNextQuests[0] : null;
          this.state.currentLineId = 'Line_0';
          if (this.state.currentQuestId) {
            this.processLine('Line_0');
          }
        } else {
          this.state.gameFinished = true;
        }
      }
    } else {
      this.state.currentQuestId = null;
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
    localStorage.clear();
    location.reload();
  }
}
