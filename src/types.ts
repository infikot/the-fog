export type Operator = 0 | 1 | 2 | 3 | 4 | 5;

export interface PointModifier {
  name: string;
  value: number;
  operator: Operator;
}

export interface ChoiceItem {
  line: string;
  text: string;
}

export interface LineComponent {
  type: string;
  text?: string;
  line?: string;
  background?: string;
  audio?: string;
  delay?: number;
  item?: string;
  items?: Record<string, ChoiceItem>;
  modifiers?: Record<string, PointModifier>;
  comparers?: Record<string, any>;
  conditions?: Record<string, any>;
  cards?: Record<string, { path: string }>;
}

export interface GameLine {
  type: string;
  line_type: string;
  components: Record<string, LineComponent>;
}

export interface ChoiceHistoryEntry {
  episode: string;
  story: string;
  questId: string;
  fromLineId: string;
  choiceLineId: string;
  choiceText: string;
  timestamp: number;
}

export interface GameState {
  currentScreen: 'menu' | 'story_hub' | 'quest';
  currentEpisode: string;
  currentStory: string;
  currentQuestId: string | null;
  currentLineId: string;
  completedQuests: string[];
  completedEpisodes: string[];
  inventory: Record<string, number>;
  points: {
    value_0: number; // Red (Сила / Агрессия / Выживание)
    value_1: number; // Blue (Рассудок / Мораль / Наблюдательность)
    [key: string]: number;
  };
  visitedLines: Record<string, boolean>;
  choiceHistory: ChoiceHistoryEntry[];
  history: Array<{
    text: string;
    isChoice?: boolean;
    pointChange?: { red?: number; blue?: number };
  }>;
  currentBackground: string;
  gameFinished?: boolean;
  hasStartedSession?: boolean;
}
