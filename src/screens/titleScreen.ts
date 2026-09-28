import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { TITLE_ASSETS, TITLE_ASSET_SIZES, TITLE_COVER_BUTTON_BOX } from '../data/titleAssets';
import type { AppContext } from '../app/state';

/**
 * 正式表紙。
 *
 * 採用された表紙は一枚絵で、ロゴ・パイロット・CA・旅行かばん・
 * 「旅をはじめる」ボタンの絵がすべてその中に描かれている。
 * そのため、以前のように DOM のロゴ画像やキャラクター画像を重ねると
 * 絵の中のロゴ・人物と二重になる。重ねるのは操作できるボタンだけにする。
 *
 * ボタンの扱い：
 * - 絵の中のボタンは「絵」なので、押せるのは本物の <button> のほう。
 *   絵に描かれたボタンの位置（TITLE_COVER_BUTTON）へ重ねて置く。
 * - 本物のボタンなので、Tab で移動でき、Enter と Space で押せる。
 *   触れる範囲は 44x44 CSS px 以上を保つ。絵のボタンが小さく写る幅でも、
 *   上下へ均等に広げて確保する（見た目は絵のまま、触れる範囲だけ広い）。
 * - 読み上げ用の文字はボタンの中に持たせる。絵の文字は読み上げられないため。
 *
 * 絵が読み込めなかったとき：
 * ボタンを画面下の操作列へ移し、通常の青いボタンとして出す。
 * 文字だけのロゴも出す。絵が無くても旅を始められる状態を保つ。
 *
 * 絵は切り抜かずに全体を見せる。画面の縦横比と絵の縦横比が違う幅では、
 * 左右に余白が出る。ロゴ・顔・ボタンが切れるより、余白が出るほうを選ぶ。
 */
export function titleScreen(ctx: AppContext): HTMLElement {
  const root = el('section', { class: 'screen screen--fixed screen--title' });

  const cover = el('img', {
    class: 'title__cover',
    src: TITLE_ASSETS.cover,
    width: TITLE_ASSET_SIZES.cover.width,
    height: TITLE_ASSET_SIZES.cover.height,
    // 絵の中にロゴと人物があるので、装飾ではなく内容として説明する。
    // ボタンの文字は本物のボタン側が読み上げるので、ここでは繰り返さない。
    alt: `${UI.app.titleJa} ${UI.app.titleEn}。世界の名所にかこまれて、パイロットとCAの2人が旅行かばんとならんでいる表紙の絵。`,
    decoding: 'async',
    fetchpriority: 'high',
  });

  const startButton = button(UI.actions.start, () => ctx.startJourney(), {
    class: 'btn title__start',
  });
  // 絵に描かれたボタンの位置を、そのまま比率で当てる。
  // 数値は titleAssets.ts の実測値だけを正とし、CSS 側には書かない。
  const box = TITLE_COVER_BUTTON_BOX;
  startButton.style.left = `${(box.left * 100).toFixed(4)}%`;
  startButton.style.width = `${(box.width * 100).toFixed(4)}%`;
  startButton.style.top = `${(box.centerY * 100).toFixed(4)}%`;
  startButton.style.height = `${(box.height * 100).toFixed(4)}%`;
  // 文字は絵の中にも描かれている。読み上げのために DOM にも持たせるが、
  // 二重に見えないよう、絵が出ているあいだは表示しない（title.css）。
  startButton.textContent = '';
  startButton.append(el('span', { class: 'title__start-label', text: UI.actions.start }));

  const coverBox = el('div', { class: 'title__cover-box' }, [cover, startButton]);

  const subActions = el('div', { class: 'title__sub-actions' }, [
    button(UI.actions.passport, () => ctx.navigate({ name: 'passport' }), { class: 'btn btn--ghost' }),
    button(UI.actions.settings, () => ctx.navigate({ name: 'settings' }), { class: 'btn btn--ghost' }),
  ]);

  const actions = el('div', { class: 'title__actions' }, [subActions]);

  // 絵が出ないときは、文字のロゴと通常の青いボタンへ切り替える。
  cover.addEventListener('error', () => {
    root.classList.add('is-cover-missing');
    cover.remove();
    // 絵に合わせた位置指定は、絵が無くなった時点で意味を失う。
    startButton.removeAttribute('style');
    startButton.classList.add('btn--primary', 'btn--large');
    actions.prepend(startButton);
  });

  // 開発用の説明文は表紙へ出さない。利用者に向けた文ではないため。
  root.append(
    el('div', { class: 'title__art' }, [
      el('div', { class: 'title__fallback' }, [
        el('p', { class: 'title__ja', text: UI.app.titleJa }),
        el('p', { class: 'title__en', text: UI.app.titleEn }),
      ]),
      coverBox,
    ]),
    actions,
  );

  return root;
}
