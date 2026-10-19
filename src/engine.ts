import { GameState, GameLine, PointModifier } from './types';
import { saveStateToLocal } from './storage';

export class FogEngine {
  private state: GameState;
  private bundle: any = null;
  private onStateChange: (state: GameState) => void;
  private onLog: (text: string, isChoice?: boolean) => void;

  constructor(
    initialState: GameState,
    onStateChange: (state: GameState) => void,
    onLog: (text: string, isChoice?: boolean) => void
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

  public getAvailableQuests(): Array<{ id: string; name: string; desc: string; cards: string[] }> {
    const story = this.getCurrentStoryObj();
    if (!story || !story.quests) return [];

    const list: Array<any> = [];
    for (const [qId, qData] of Object.entries(story.quests as Record<string, any>)) {
      const nameKey = qData.name_text;
      const descKey = qData.desc_text;
      const name = this.bundle?.common_texts?.[nameKey]?.text || story.texts?.ru?.[nameKey]?.text || `Квест ${qId}`;
      const desc = this.bundle?.common_texts?.[descKey]?.text || story.texts?.ru?.[descKey]?.text || '';
      const cards: string[] = [];
      if (qData.cards) {
        for (const c of Object.values(qData.cards as Record<string, any>)) {
          cards.push(c.path);
        }
      }
      list.push({ id: qId, name, desc, cards });
    }
    return list;
  }

  public selectQuest(questId: string): void {
    this.state.currentQuestId = questId;
    this.state.currentLineId = 'Line_0';
    this.processLine('Line_0');
  }

  public step(): void {
    const line = this.getCurrentLine();
    if (!line) return;

    for (const comp of Object.values(line.components)) {
      if (comp.type === 'line_next' && comp.line) {
        this.goToLine(comp.line);
        return;
      }
      if (comp.type === 'line_to_quests') {
        this.finishCurrentQuest();
        return;
      }
    }
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

    // Apply Background
    for (const comp of Object.values(line.components) as any[]) {
      if (comp.type === 'line_background' && comp.background !== undefined) {
        const bgList = quest.graph?.backgrounds || quest.backgrounds;
        const bgEntry = bgList?.[comp.background];
        if (bgEntry?.path) {
          this.state.currentBackground = bgEntry.path;
        }
      }
      if (comp.type === 'line_points' && comp.modifiers) {
        this.applyPointModifiers(Object.values(comp.modifiers));
      }
    }

    // Apply Text
    for (const comp of Object.values(line.components) as any[]) {
      if (comp.type === 'line_text' && comp.text) {
        // Look up text in quest.texts.ru or common_texts
        const questTexts = quest.texts;
        const rawText = questTexts?.[comp.text]?.text || this.bundle?.common_texts?.[comp.text]?.text;
        if (rawText) {
          this.log(rawText);
        }
      }
    }

    this.save();
  }

  private applyPointModifiers(mods: PointModifier[]): void {
    for (const mod of mods) {
      const current = this.state.points[mod.name] || 0;
      switch (mod.operator) {
        case 0: // Set
          this.state.points[mod.name] = mod.value;
          break;
        case 1: // Add
          this.state.points[mod.name] = current + mod.value;
          break;
        case 2: // Sub
          this.state.points[mod.name] = current - mod.value;
          break;
        default:
          break;
      }
    }
  }

  public finishCurrentQuest(): void {
    if (this.state.currentQuestId && !this.state.completedQuests.includes(this.state.currentQuestId)) {
      this.state.completedQuests.push(this.state.currentQuestId);
    }

    const story = this.getCurrentStoryObj();
    const allStoryQuests = Object.keys(story?.quests || {});
    const isStoryDone = allStoryQuests.every((q) => this.state.completedQuests.includes(q));

    if (isStoryDone) {
      const epData = this.bundle.episodes?.[this.state.currentEpisode];
      const storyKeys = Object.keys(epData?.stories || {});
      const currentStoryIndex = storyKeys.indexOf(this.state.currentStory);

      if (currentStoryIndex !== -1 && currentStoryIndex < storyKeys.length - 1) {
        // Next story in current episode
        this.state.currentStory = storyKeys[currentStoryIndex + 1];
        this.state.currentQuestId = null;
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
          this.state.currentQuestId = null;
          this.state.isEpisodeFinished = true;
        } else {
          this.state.gameFinished = true;
        }
      }
    } else {
      this.state.currentQuestId = null;
    }

    this.save();
  }

  private log(text: string, isChoice = false): void {
    this.state.history.push({ text, isChoice });
    this.onLog(text, isChoice);
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
