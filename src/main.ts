import './styles/base.css';
import './styles/screens.css';
import './styles/title.css';
import './styles/travel.css';
import './styles/quiz.css';
import './styles/avatar.css';
// 七海（middle-f-01）の実機確認用候補。avatar.css のあとに読む。
import './styles/reference-v23-card.css';
// 合成座標の候補 fit-v3。上の v23 CSS の後に読む。
import './styles/nanami-fit-v3.css';
import './styles/chat.css';
import './styles/karta.css';
import { createApp } from './app/router';
import { createBrowserStore } from './storage/safeStorage';
import { LearningRecordStore } from './storage/learningRecord';
import { createAudioService } from './services/audioService';
import { createEffectService } from './services/effectService';
import { createEntitlementService } from './services/entitlementService';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app が見つかりません');

// 保存データが壊れていても LearningRecordStore が初期値へ復旧するため、起動は止まらない。
const records = new LearningRecordStore(createBrowserStore());

const audio = createAudioService();
audio.setEnabled(records.get().audioEnabled);

// 効果音は発音とは別の設定で動く。音声コンテキストの準備は
// 自動再生の制限があるため、最初のユーザー操作のときに行う。
const effects = createEffectService();
effects.setEnabled(records.get().sfxEnabled);

/*
 * 画面のどこでもよいので、最初のユーザー操作で音声を使える状態にしておく。
 *
 * 札をさわったときだけ用意していると、1枚目と2枚目を続けてさわる操作では
 * 解除が間に合わず、最初の正解が無音になることがある。
 * 表紙の「旅をはじめる」など、もっと早い操作で済ませておく。
 * 効果音がOFFのときは音声を作らない（OFFから入れ直したときは、
 * 切り替えそのものが操作なので、そちらで用意される）。
 */
function warmUpAudio(): void {
  window.removeEventListener('pointerdown', warmUpAudio, true);
  window.removeEventListener('keydown', warmUpAudio, true);
  if (!effects.isEnabled()) return;
  void effects.prepare();
}
window.addEventListener('pointerdown', warmUpAudio, true);
window.addEventListener('keydown', warmUpAudio, true);

/*
 * 別のアプリへ移って戻ると、音声が止まったままになる端末がある。
 * 画面が見える状態へ戻ったときに、もう一度動かし直す。
 * ここでの失敗は無視される（端末が非対応とは扱わない）。
 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!effects.isEnabled()) return;
  void effects.prepare();
});

createApp({
  root,
  records,
  audio,
  effects,
  entitlements: createEntitlementService(),
});
