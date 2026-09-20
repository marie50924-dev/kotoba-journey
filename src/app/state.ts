import type { CardCount, PlayResult } from '../domain/types';
import type { CourseCategoryId } from '../data/courses';
import type { QuizOutcome, QuizQuestion } from '../domain/waveQuiz';
import type { LearningRecordStore } from '../storage/learningRecord';
import type { AudioService } from '../services/audioService';
import type { EntitlementService } from '../services/entitlementService';

/**
 * 画面遷移の状態。
 *
 * quizPrompt / quiz / quizResult は Phase 1 の選択式確認テストの名残。
 * 最終仕様（スマートフォンのキーボードから直接入力する方式）と異なるため、
 * FEATURES.waveQuiz = false で通常導線から外してある。
 * Phase 1-C2 で直接入力テストへ差し替える境界として残す。
 */
export type Route =
  | { name: 'title' }
  | { name: 'avatarSelect' }
  | { name: 'avatarConfirm' }
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

/** 確認テストの進行状態。Phase 1-C2 の直接入力テストで置き換える。 */
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
  /** 進行中の確認テスト。通常導線では使わない。 */
  quiz: QuizContext | null;
  /** 確定前に選んでいるキャラクター。確定するまで保存しない。 */
  pendingAvatarId: string | null;
  /** NPC 選出の seed。起動ごとに変わり、同一起動中は再現できる。 */
  readonly castSeed: number;
  navigate(route: Route): void;
  back(): void;
  /** 戻れる履歴があるか。初回のキャラクター選択では戻り先が無い。 */
  canGoBack(): boolean;
  /** 表紙の「旅をはじめる」。未選択ならキャラクター選択を挟む。 */
  startJourney(): void;
}

export function createSelection(): PlaySelection {
  return { categoryId: null, courseId: null, cardCount: null, destinationId: null };
}
