import type { CardCount, PlayResult } from '../domain/types';
import type { CourseCategoryId } from '../data/courses';
import type { SelectedCharacterId } from '../data/characters';
import type { QuizOutcome, QuizQuestion } from '../domain/waveQuiz';
import type { LearningRecordStore } from '../storage/learningRecord';
import type { AudioService } from '../services/audioService';
import type { EntitlementService } from '../services/entitlementService';

/** 画面遷移の状態。 */
export type Route =
  | { name: 'title' }
  | { name: 'characterSelect' }
  | { name: 'courseEntry' }
  | { name: 'courseList'; categoryId: CourseCategoryId }
  | { name: 'cardCount' }
  | { name: 'worldMap' }
  | { name: 'travel' }
  | { name: 'countryIntro' }
  | { name: 'karta' }
  | { name: 'result' }
  | { name: 'quizPrompt' }
  | { name: 'quiz' }
  | { name: 'quizResult' }
  | { name: 'passport' }
  | { name: 'settings' };

/** プレイ中の選択状態。学習記録とは別に保持する。 */
export interface PlaySelection {
  categoryId: CourseCategoryId | null;
  courseId: string | null;
  cardCount: CardCount | null;
  destinationId: string | null;
}

/** 進行中のウェーブ。1つのカルタ盤面を1ウェーブとして扱う。 */
export interface WaveContext {
  /** ウェーブ識別子。保存とテスト生成に使う。 */
  waveId: string;
  /** そのウェーブで出題された pairId。確認テストはここからだけ作る。 */
  pairIds: number[];
  /** 問題順を再現するための seed。 */
  seed: number;
}

/** 確認テストの進行状態。 */
export interface QuizContext {
  questions: QuizQuestion[];
  answers: Map<string, number>;
  startedAtMs: number;
  outcome: QuizOutcome | null;
  elapsedMs: number;
}

export interface AppContext {
  readonly records: LearningRecordStore;
  readonly audio: AudioService;
  readonly entitlements: EntitlementService;
  selection: PlaySelection;
  lastResult: PlayResult | null;
  /** 直前のプレイが自己ベストを更新したか。結果画面の表示に使う。 */
  lastResultWasBest: boolean;
  /** 進行中のウェーブ。カルタ開始時に設定する。 */
  wave: WaveContext | null;
  /** 進行中の確認テスト。 */
  quiz: QuizContext | null;
  navigate(route: Route): void;
  back(): void;
  /** 表紙の「旅をはじめる」。主人公が未選択なら選択画面を挟む。 */
  startJourney(): void;
  /** 現在選ばれている主人公。 */
  selectedCharacterId(): SelectedCharacterId;
}

export function createSelection(): PlaySelection {
  return { categoryId: null, courseId: null, cardCount: null, destinationId: null };
}
