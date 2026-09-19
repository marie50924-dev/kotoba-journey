import type { CardCount, PlayResult } from '../domain/types';
import type { CourseCategoryId } from '../data/courses';
import type { LearningRecordStore } from '../storage/learningRecord';
import type { AudioService } from '../services/audioService';
import type { EntitlementService } from '../services/entitlementService';

/** 画面遷移の状態。 */
export type Route =
  | { name: 'title' }
  | { name: 'courseEntry' }
  | { name: 'courseList'; categoryId: CourseCategoryId }
  | { name: 'cardCount' }
  | { name: 'worldMap' }
  | { name: 'karta' }
  | { name: 'result' }
  | { name: 'passport' }
  | { name: 'settings' };

/** プレイ中の選択状態。学習記録とは別に保持する。 */
export interface PlaySelection {
  categoryId: CourseCategoryId | null;
  courseId: string | null;
  cardCount: CardCount | null;
  destinationId: string | null;
}

export interface AppContext {
  readonly records: LearningRecordStore;
  readonly audio: AudioService;
  readonly entitlements: EntitlementService;
  selection: PlaySelection;
  lastResult: PlayResult | null;
  /** 直前のプレイが自己ベストを更新したか。結果画面の表示に使う。 */
  lastResultWasBest: boolean;
  navigate(route: Route): void;
  back(): void;
}

export function createSelection(): PlaySelection {
  return { categoryId: null, courseId: null, cardCount: null, destinationId: null };
}
