import type { CardCount, MasteryLevel, PlayResult } from '../domain/types';
import { isCardCount } from '../domain/deck';
import { calculateAccuracy, masteryFor } from '../domain/scoring';
import { isValidAvatarId } from '../data/avatars';
import { RECENT_WINDOW } from '../domain/npcCasting';
import type { KeyValueStore } from './safeStorage';

/**
 * 保存キーは v1 のまま据え置き、レコード内の version で世代を管理する。
 * キーを変えると既存プレイヤーの学習記録が読めなくなるため。
 */
export const STORAGE_KEY = 'kotoba-journey/learning-record/v1';
export const RECORD_VERSION = 2;
const HISTORY_LIMIT = 10;
/** 出会ったキャラクターの保存上限。localStorage が際限なく増えないようにする。 */
export const MET_AVATAR_LIMIT = 80;

export interface PlayHistoryEntry {
  date: string;
  courseId: string;
  courseLabel: string;
  cardCount: CardCount;
  accuracy: number;
  elapsedMs: number;
}

/**
 * 端末に保存する学習記録。
 * 個人名・年齢・学校名・メールアドレスなど、子どもの個人情報は一切含めない。
 */
export interface LearningRecord {
  version: number;
  totalPlays: number;
  /** 学習した日付(YYYY-MM-DD)の一覧。重複なし・昇順。 */
  playedDates: string[];
  totalCorrect: number;
  totalIncorrect: number;
  masteredPairIds: number[];
  reviewPairIds: number[];
  /** 枚数ごとのベストタイム(ms)。 */
  bestTimeMs: Partial<Record<CardCount, number>>;
  selectedCourseId: string | null;
  visitedCountryIds: string[];
  history: PlayHistoryEntry[];
  audioEnabled: boolean;

  // ---- v2（Phase 1-C1）で追加 ----
  /**
   * 自分が選んだキャラクターのID。未選択なら null。
   * 保存の主キーは名前ではなく不変のID。
   */
  selectedAvatarId: string | null;
  /** これまでに会話したことのあるキャラクターのID。 */
  metAvatarIds: string[];
  /** 直近で登場した NPC のID（新しい順）。連続登場を抑えるために使う。 */
  recentNpcAvatarIds: string[];
}

export function createEmptyRecord(): LearningRecord {
  return {
    version: RECORD_VERSION,
    totalPlays: 0,
    playedDates: [],
    totalCorrect: 0,
    totalIncorrect: 0,
    masteredPairIds: [],
    reviewPairIds: [],
    bestTimeMs: {},
    selectedCourseId: null,
    visitedCountryIds: [],
    history: [],
    audioEnabled: true,
    selectedAvatarId: null,
    metAvatarIds: [],
    recentNpcAvatarIds: [],
  };
}

// ---- 安全なパース ---------------------------------------------------------

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string')));
}

function asPairIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0);
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

function asBestTimes(value: unknown): Partial<Record<CardCount, number>> {
  const result: Partial<Record<CardCount, number>> = {};
  if (!value || typeof value !== 'object') return result;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const count = Number(key);
    if (isCardCount(count) && typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      result[count] = raw;
    }
  }
  return result;
}

/** 名簿に存在する有効なIDだけを残す。重複も取り除く。 */
function asAvatarIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (!isValidAvatarId(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function asHistory(value: unknown): PlayHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: PlayHistoryEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.date !== 'string') continue;
    if (!isCardCount(item.cardCount)) continue;
    entries.push({
      date: item.date,
      courseId: typeof item.courseId === 'string' ? item.courseId : '',
      courseLabel: typeof item.courseLabel === 'string' ? item.courseLabel : '',
      cardCount: item.cardCount,
      accuracy: asNumber(item.accuracy, 0),
      elapsedMs: asNumber(item.elapsedMs, 0),
    });
  }
  return entries.slice(0, HISTORY_LIMIT);
}

/**
 * 保存データを検証しながら読み込む。
 * JSON が壊れていても、型が想定外でも、例外を投げずに初期値へ復旧する。
 */
export function parseRecord(raw: string | null): LearningRecord {
  const empty = createEmptyRecord();
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;

  const data = parsed as Record<string, unknown>;
  const dates = asStringArray(data.playedDates)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  return {
    version: RECORD_VERSION,
    totalPlays: asNumber(data.totalPlays, 0),
    playedDates: dates,
    totalCorrect: asNumber(data.totalCorrect, 0),
    totalIncorrect: asNumber(data.totalIncorrect, 0),
    masteredPairIds: asPairIdArray(data.masteredPairIds),
    reviewPairIds: asPairIdArray(data.reviewPairIds),
    bestTimeMs: asBestTimes(data.bestTimeMs),
    selectedCourseId: typeof data.selectedCourseId === 'string' ? data.selectedCourseId : null,
    visitedCountryIds: asStringArray(data.visitedCountryIds),
    history: asHistory(data.history),
    audioEnabled: asBoolean(data.audioEnabled, empty.audioEnabled),

    // v1 の保存データにはこれらが無い。欠けていれば初期値で補う。
    // 名簿に無いID・無効化されたIDは null / 除去して安全に復旧する。
    selectedAvatarId: isValidAvatarId(data.selectedAvatarId) ? data.selectedAvatarId : null,
    metAvatarIds: asAvatarIdArray(data.metAvatarIds).slice(0, MET_AVATAR_LIMIT),
    recentNpcAvatarIds: asAvatarIdArray(data.recentNpcAvatarIds).slice(0, RECENT_WINDOW),
  };
}

// ---- 派生値 ---------------------------------------------------------------

/** YYYY-MM-DD 形式のローカル日付。 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/**
 * 連続学習日数。今日、または昨日までの連続日数を数える。
 * 2日以上空いていれば 0。
 */
export function computeStreak(playedDates: readonly string[], todayKey: string): number {
  if (playedDates.length === 0) return 0;
  const set = new Set(playedDates);

  let cursor: string;
  if (set.has(todayKey)) {
    cursor = todayKey;
  } else if (set.has(shiftDays(todayKey, -1))) {
    cursor = shiftDays(todayKey, -1);
  } else {
    return 0;
  }

  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

export function lifetimeAccuracy(record: LearningRecord): number {
  return calculateAccuracy(record.totalCorrect, record.totalIncorrect);
}

export function bestTimeOverall(record: LearningRecord): number | null {
  const times = Object.values(record.bestTimeMs).filter((t): t is number => typeof t === 'number');
  return times.length === 0 ? null : Math.min(...times);
}

// ---- 更新 -----------------------------------------------------------------

/**
 * 1プレイ分の結果を記録へ反映した新しい記録を返す純粋関数。
 * 習得したペアは復習対象から外し、復習判定のペアは復習対象へ入れる。
 */
export function applyPlayResult(
  record: LearningRecord,
  result: PlayResult,
  playedAt: Date,
): LearningRecord {
  const dateKey = toDateKey(playedAt);
  const mastered = new Set(record.masteredPairIds);
  const review = new Set(record.reviewPairIds);

  for (const stat of result.pairStats) {
    const level: MasteryLevel = masteryFor(stat.mistakes);
    if (level === 'mastered') {
      mastered.add(stat.pairId);
      review.delete(stat.pairId);
    } else if (level === 'review') {
      review.add(stat.pairId);
      mastered.delete(stat.pairId);
    }
  }

  const previousBest = record.bestTimeMs[result.cardCount];
  const bestTimeMs = { ...record.bestTimeMs };
  if (result.elapsedMs > 0 && (previousBest === undefined || result.elapsedMs < previousBest)) {
    bestTimeMs[result.cardCount] = result.elapsedMs;
  }

  const entry: PlayHistoryEntry = {
    date: dateKey,
    courseId: result.courseId,
    courseLabel: result.courseLabel,
    cardCount: result.cardCount,
    accuracy: result.accuracy,
    elapsedMs: result.elapsedMs,
  };

  return {
    ...record,
    version: RECORD_VERSION,
    totalPlays: record.totalPlays + 1,
    playedDates: Array.from(new Set([...record.playedDates, dateKey])).sort(),
    totalCorrect: record.totalCorrect + result.correctSelections,
    totalIncorrect: record.totalIncorrect + result.incorrectSelections,
    masteredPairIds: Array.from(mastered).sort((a, b) => a - b),
    reviewPairIds: Array.from(review).sort((a, b) => a - b),
    bestTimeMs,
    history: [entry, ...record.history].slice(0, HISTORY_LIMIT),
  };
}

/** 会話した相手を記録する。上限を超えないよう古いものから捨てる。 */
export function rememberMetAvatar(record: LearningRecord, avatarId: string): LearningRecord {
  if (!isValidAvatarId(avatarId) || record.metAvatarIds.includes(avatarId)) return record;
  return {
    ...record,
    metAvatarIds: [...record.metAvatarIds, avatarId].slice(-MET_AVATAR_LIMIT),
  };
}

export function isNewBestTime(record: LearningRecord, cardCount: CardCount, elapsedMs: number): boolean {
  const previous = record.bestTimeMs[cardCount];
  return elapsedMs > 0 && (previous === undefined || elapsedMs < previous);
}

// ---- 永続化 ---------------------------------------------------------------

export class LearningRecordStore {
  private record: LearningRecord;

  constructor(private readonly storage: KeyValueStore) {
    this.record = parseRecord(this.readRaw());
  }

  private readRaw(): string | null {
    try {
      return this.storage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  get(): LearningRecord {
    return this.record;
  }

  update(updater: (current: LearningRecord) => LearningRecord): LearningRecord {
    this.record = updater(this.record);
    this.persist();
    return this.record;
  }

  clear(): LearningRecord {
    // 音声設定と選んだキャラクターは端末の設定として残し、学習記録だけ初期化する。
    const { audioEnabled, selectedAvatarId } = this.record;
    this.record = { ...createEmptyRecord(), audioEnabled, selectedAvatarId };
    this.persist();
    return this.record;
  }

  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.record));
    } catch {
      /* 保存に失敗してもゲーム進行は止めない */
    }
  }
}
