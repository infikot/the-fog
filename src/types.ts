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
  items?: Record<string, ChoiceItem>;
  modifiers?: Record<string, PointModifier>;
  conditions?: Record<string, any>;
  cards?: Record<string, { path: string }>;
}

export interface GameLine {
  type: string;
  line_type: string;
  components: Record<string, LineComponent>;
}

export interface QuestNode {
  lines: Record<string, GameLine>;
  texts?: {
    ru?: {
      path: string;
    };
  };
  backgrounds?: Record<string, { path: string }>;
}

export interface QuestInfo {
  id: string;
  path: string;
  name: string;
  desc: string;
  cards: string[];
}

export interface StoryInfo {
  id: string;
  nextStory?: string;
  quests: QuestInfo[];
}

export interface EpisodeInfo {
  id: string;
  title: string;
  stories: string[];
  lastStory: string;
  nextEpisode?: string | null;
}

export interface GameState {
  currentEpisode: string;
  currentStory: string;
  currentQuestId: string | null;
  currentLineId: string;
  completedQuests: string[];
  completedEpisodes: string[];
  inventory: Record<string, number>;
  points: Record<string, number>;
  history: Array<{
    text: string;
    isChoice?: boolean;
    speaker?: string;
  }>;
  currentBackground: string;
  isEpisodeFinished?: boolean;
  gameFinished?: boolean;
}
