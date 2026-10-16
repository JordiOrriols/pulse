export const RETRO_TEMPLATES = [
  "well_improve",
  "start_stop_continue",
  "mad_sad_glad",
  "open",
] as const;
export type RetroTemplate = (typeof RETRO_TEMPLATES)[number];

/** Board columns of each template, in display order; their labels live in the locales. */
export const TEMPLATE_COLUMNS: Record<RetroTemplate, readonly string[]> = {
  well_improve: ["went_well", "to_improve", "ideas"],
  start_stop_continue: ["start", "stop", "continue"],
  mad_sad_glad: ["mad", "sad", "glad"],
  open: ["topics"],
};

export const RETRO_STAGES = [
  "prepare",
  "collect",
  "group",
  "vote",
  "discuss",
  "actions",
  "closed",
] as const;
export type RetroStage = (typeof RETRO_STAGES)[number];

export const DECISIONS = ["action", "monitor", "accept"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DEFAULT_VOTES = 3;
export const MAX_VOTES = 10;

export interface Retro {
  id: string;
  title: string;
  heldOn: string;
  period: string | null;
  goal: string | null;
  template: RetroTemplate;
  anonymous: boolean;
  votesPerPerson: number;
  stage: RetroStage;
  createdAt: string;
  closedAt: string | null;
}

export interface RetroTopic {
  id: string;
  column: string;
  title: string;
  description: string | null;
  groupId: string | null;
  createdAt: string;
  mine: boolean;
  /** Only set when the retrospective is not anonymous. */
  author: string | null;
}

export interface Discussion {
  summary: string | null;
  impact: string | null;
  rootCauses: string | null;
  context: string | null;
  decision: Decision | null;
}

export interface RetroGroup extends Discussion {
  id: string;
  title: string | null;
  createdAt: string;
  /** Hidden until voting closes. */
  votes: number | null;
  myVotes: number;
}

export interface RetroBoard {
  canFacilitate: boolean;
  topics: RetroTopic[];
  /** Topics written by others while they are still hidden during collection. */
  hiddenTopics: number;
  groups: RetroGroup[];
  voters: number;
}

export interface RankedGroup {
  group: RetroGroup;
  topics: RetroTopic[];
}

export function stageIndex(stage: RetroStage): number {
  return RETRO_STAGES.indexOf(stage);
}

export function nextStage(stage: RetroStage): RetroStage | null {
  return RETRO_STAGES[stageIndex(stage) + 1] ?? null;
}

export function previousStage(stage: RetroStage): RetroStage | null {
  return stageIndex(stage) > 0 ? RETRO_STAGES[stageIndex(stage) - 1]! : null;
}

export function topicsOf(board: RetroBoard, groupId: string): RetroTopic[] {
  return board.topics.filter((topic) => topic.groupId === groupId);
}

export function looseTopics(board: RetroBoard): RetroTopic[] {
  return board.topics.filter((topic) => topic.groupId === null);
}

export function votesLeft(board: RetroBoard, votesPerPerson: number): number {
  return votesPerPerson - board.groups.reduce((sum, group) => sum + group.myVotes, 0);
}

/** The title to show for a group: its own, or the title of its only topic. */
export function groupLabel(group: RetroGroup, topics: RetroTopic[]): string | null {
  return group.title ?? (topics.length === 1 ? topics[0]!.title : null);
}

/** Groups by votes, then by how many topics they hold, then oldest first. */
export function rankGroups(board: RetroBoard): RankedGroup[] {
  return board.groups
    .map((group) => ({ group, topics: topicsOf(board, group.id) }))
    .toSorted(
      (a, b) =>
        (b.group.votes ?? 0) - (a.group.votes ?? 0) ||
        b.topics.length - a.topics.length ||
        a.group.createdAt.localeCompare(b.group.createdAt) ||
        a.group.id.localeCompare(b.group.id)
    );
}

export function hasDiscussion(group: Discussion): boolean {
  return !!(group.summary || group.impact || group.rootCauses || group.context || group.decision);
}

export interface RetroSummary {
  topics: number;
  voters: number;
  /** The groups that received votes, best first, at most three. */
  top: RankedGroup[];
  /** Every group with discussion notes or a decision, in ranking order. */
  discussed: RankedGroup[];
}

export function summarizeRetro(board: RetroBoard): RetroSummary {
  const ranked = rankGroups(board);
  return {
    topics: board.topics.length,
    voters: board.voters,
    top: ranked.filter((item) => (item.group.votes ?? 0) > 0).slice(0, 3),
    discussed: ranked.filter((item) => hasDiscussion(item.group)),
  };
}
