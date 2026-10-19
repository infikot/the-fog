import { GameState, GameLine, PointModifier } from './types';
import { saveStateToLocal } from './storage';

export class FogEngine {
  private state: GameState;
  private currentQuestData: any = null;
  private currentStoryData: any = null;
  private episodesMeta: any = null;
  private commonRu: any = null;
  private itemsCatalog: any = null;
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
    const metaRes = await fetch('./episodes_meta.json');
    this.episodesMeta = await metaRes.json();

    const commonRes = await fetch('./common_ru.json');
    this.commonRu = await commonRes.json();

    const itemsRes = await fetch('./items.json');
    this.itemsCatalog = await itemsRes.json();

    await this.loadStory(this.state.currentEpisode, this.state.currentStory);

    if (this.state.currentQuestId) {
      await this.loadQuest(this.state.currentEpisode, this.state.currentStory, this.state.currentQuestId);
    }
  }

  public getState(): GameState {
    return this.state;
  }

  public getCommonRu(): any {
    return this.commonRu;
  }

  public getItemsCatalog(): any {
    return this.itemsCatalog;
  }

  public async loadStory(episodeId: string, storyId: string): Promise<void> {
    const url = `./episodes/${episodeId}/story_${storyId}.json`;
    const res = await fetch(url);
    this.currentStoryData = await res.json();
    this.state.currentEpisode = episodeId;
    this.state.currentStory = storyId;
  }

  public async loadQuest(episodeId: string, storyId: string, questId: string): Promise<void> {
    const questMeta = this.currentStoryData?.quests?.[questId];
    if (!questMeta) {
      console.error(`Quest ${questId} not found in story ${storyId}`);
      return;
    }

    const questPath = questMeta.path?.path; // e.g. "Episodes/nazareth/story_0/vstuplenie_nazareth"
    const relPath = questPath.replace(/^Episodes\//i, '');
    const res = await fetch(`./episodes/${relPath}.json`);
    this.currentQuestData = await res.json();

    this.state.currentQuestId = questId;
    if (!this.state.currentLineId) {
      this.state.currentLineId = 'Line_0';
    }
    this.save();
  }

  public getCurrentLine(): GameLine | null {
    if (!this.currentQuestData || !this.currentQuestData.lines) return null;
    return this.currentQuestData.lines[this.state.currentLineId] || null;
  }

  public getCurrentQuestMeta(): any {
    return this.currentStoryData?.quests?.[this.state.currentQuestId || '0'] || null;
  }

  public getAvailableQuests(): Array<{ id: string; name: string; desc: string; cards: string[] }> {
    if (!this.currentStoryData || !this.currentStoryData.quests) return [];
    const list: Array<any> = [];
    for (const [qId, qData] of Object.entries(this.currentStoryData.quests as Record<string, any>)) {
      const nameKey = qData.name_text;
      const descKey = qData.desc_text;
      const name = this.currentStoryData.texts?.ru?.[nameKey]?.text || `Квест ${qId}`;
      const desc = this.currentStoryData.texts?.ru?.[descKey]?.text || '';
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

  public async selectQuest(questId: string): Promise<void> {
    this.state.currentQuestId = questId;
    this.state.currentLineId = 'Line_0';
    await this.loadQuest(this.state.currentEpisode, this.state.currentStory, questId);
    this.processLine(this.state.currentLineId);
  }

  public step(): void {
    const line = this.getCurrentLine();
    if (!line) return;

    // Find next line or action
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

  private processLine(lineId: string): void {
    const line = this.currentQuestData?.lines?.[lineId];
    if (!line) return;

    // Background
    for (const comp of Object.values(line.components) as any[]) {
      if (comp.type === 'line_background' && comp.background !== undefined) {
        const bgEntry = this.currentQuestData.backgrounds?.[comp.background];
        if (bgEntry?.path) {
          this.state.currentBackground = bgEntry.path;
        }
      }
      if (comp.type === 'line_points' && comp.modifiers) {
        this.applyPointModifiers(Object.values(comp.modifiers));
      }
    }

    // Text
    for (const comp of Object.values(line.components) as any[]) {
      if (comp.type === 'line_text' && comp.text) {
        const rawText = this.currentQuestData.texts?.ru?.[comp.text]?.text;
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
    if (!this.state.completedQuests.includes(this.state.currentQuestId || '')) {
      if (this.state.currentQuestId) {
        this.state.completedQuests.push(this.state.currentQuestId);
      }
    }

    // Check all quests in story completed
    const allStoryQuests = Object.keys(this.currentStoryData?.quests || {});
    const isStoryDone = allStoryQuests.every((q) => this.state.completedQuests.includes(q));

    if (isStoryDone) {
      const currentEp = this.episodesMeta[this.state.currentEpisode];
      if (this.state.currentStory === currentEp.lastStory) {
        // Episode finished!
        if (!this.state.completedEpisodes.includes(this.state.currentEpisode)) {
          this.state.completedEpisodes.push(this.state.currentEpisode);
        }
        if (currentEp.nextEpisode) {
          this.state.currentEpisode = currentEp.nextEpisode;
          this.state.currentStory = '0';
          this.state.currentQuestId = null;
          this.state.isEpisodeFinished = true;
          this.loadStory(this.state.currentEpisode, this.state.currentStory);
        } else {
          this.state.gameFinished = true;
        }
      } else {
        // Next story in episode
        const nextStory = this.currentStoryData.next_story || String(Number(this.state.currentStory) + 1);
        this.state.currentStory = nextStory;
        this.state.currentQuestId = null;
        this.loadStory(this.state.currentEpisode, nextStory);
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
