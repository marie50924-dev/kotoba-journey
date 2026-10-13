import { describe, expect, it } from 'vitest';
import mainSource from '../main.ts?raw';
import selectScreenSource from '../screens/avatarSelectScreen.ts?raw';
import groundCssInline from '../styles/nanami-ground-v1.css?inline';
import structCssInline from '../styles/nanami-struct-v1.css?inline';
import bodyExtensionCssInline from '../styles/nanami-body-extension-v1.css?inline';
import headSeamSource from '../components/attachNanamiHeadSeamV11.ts?raw';
import bodyExtensionSource from '../components/attachNanamiBodyExtensionV1.ts?raw';
import structSource from '../components/fitNanamiStructV1.ts?raw';

/**
 * 七海（middle-f-01）のカードの採用構成を固定する検査。
 *
 * 採用したもの
 *   struct-v1 ／ 地色 ／ body-extension-v1 ／ head-seam-v1.1 ／ くもりなし
 *
 * 採用しなかったもの（実行経路へ接続しない）
 *   fit-v3 ／ back-haze-v1 ／ back-haze-v1.1 ／ outer-haze-v1 ／ outer-haze-v1.1 ／
 *   head-seam-v1
 *
 * 守る約束
 *   1. 採用した3つの CSS を、v23 のカード CSS の後にこの順で読む。
 *   2. 採用しなかった候補の CSS を読まない。関数も呼ばない。
 *   3. 七海だけに当てる。他の15人・他年代へは広げない。
 *   4. 接続は body-extension → head-seam の順。解除は head-seam → body-extension の順。
 *   5. 比較用の切り替え定数を実行経路へ残さない。
 *   6. 画像が未読み込みでも接続でき、カードを作り直しても解除が働く。
 *   7. 地色は未選択のときだけ当て、選択中は共通の選択色へ戻す。
 *
 * 実際に何 px に描かれるかは実ブラウザテストで測る。
 * ここでは「読み込みと接続がその形になっているか」を見る。
 */

const main = String(mainSource);
const screen = String(selectScreenSource);
const groundCss = String(groundCssInline);
const structCss = String(structCssInline);
const bodyExtensionCss = String(bodyExtensionCssInline);

/** コメントを外した CSS。コメントの中の文字を規則と取り違えないため。 */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 採用しなかった候補。名前とファイル名の両方で見る。 */
const NOT_ADOPTED = [
  { name: 'fit-v3', css: 'nanami-fit-v3.css', fn: 'fitNanamiV3' },
  { name: 'back-haze-v1', css: 'nanami-back-haze-v1.css', fn: 'attachNanamiBackHazeV1(' },
  { name: 'back-haze-v1.1', css: 'nanami-back-haze-v1-1.css', fn: 'attachNanamiBackHazeV11' },
  { name: 'outer-haze-v1', css: 'nanami-outer-haze-v1.css', fn: 'attachNanamiOuterHazeV1(' },
  { name: 'outer-haze-v1.1', css: 'nanami-outer-haze-v1-1.css', fn: 'attachNanamiOuterHazeV11' },
  { name: 'head-seam-v1', css: '', fn: 'attachNanamiHeadSeamV1(' },
];

describe('七海のカード：採用した構成の読み込み', () => {
  it('採用した3つの CSS を、v23 のカード CSS の後にこの順で読む', () => {
    const order = [
      "import './styles/reference-v23-card.css';",
      "import './styles/nanami-struct-v1.css';",
      "import './styles/nanami-ground-v1.css';",
      "import './styles/nanami-body-extension-v1.css';",
    ];
    let previous = -1;
    for (const line of order) {
      const at = main.indexOf(line);
      expect(at, `${line} を読んでいない`).toBeGreaterThan(-1);
      expect(at, `${line} の読み込む順が前後している`).toBeGreaterThan(previous);
      previous = at;
    }
  });

  it('採用しなかった候補の CSS を読まない', () => {
    for (const { name, css } of NOT_ADOPTED) {
      if (!css) continue;
      expect(main, `${name} の CSS を読んでいる`).not.toContain(`import './styles/${css}'`);
    }
  });
});

describe('七海のカード：採用した接続', () => {
  it('一覧の行の高さ struct-v1 を当て、画面を捨てるときに解除する', () => {
    expect(screen).toContain("import { applyStructV1 } from '../components/fitNanamiStructV1';");
    expect(screen).toContain('const structTeardown = applyStructV1(grid);');
    // 画面を捨てるときの処理の中で呼ぶ。
    const destroy = screen.match(/screen\.addEventListener\('screen:destroy',[\s\S]*?\n  \}\);/);
    expect(destroy, '画面を捨てるときの処理が見つからない').not.toBeNull();
    expect((destroy as RegExpMatchArray)[0]).toContain('structTeardown();');
  });

  it('七海だけに胴体の表示と肩の接合を足す（他の人物には足さない）', () => {
    expect(screen).toContain("import { attachNanamiBodyExtensionV1 } from '../components/attachNanamiBodyExtensionV1';");
    expect(screen).toContain("import { attachNanamiHeadSeamV11 } from '../components/attachNanamiHeadSeamV11';");
    // 呼び出しは七海の id を確かめる分岐の中だけ。
    const branch = screen.match(/if \(avatar\.id === 'middle-f-01'\) \{[\s\S]*?\n {8}\}/);
    expect(branch, '七海だけに当てる分岐が見つからない').not.toBeNull();
    const inside = (branch as RegExpMatchArray)[0];
    expect(inside).toContain('attachNanamiBodyExtensionV1(card)');
    expect(inside).toContain('attachNanamiHeadSeamV11(card)');
    // 分岐の外で呼んでいないこと（全体の出現回数が分岐の中と同じ）。
    for (const call of ['attachNanamiBodyExtensionV1(card)', 'attachNanamiHeadSeamV11(card)']) {
      expect(screen.split(call).length - 1, `${call} を七海の分岐の外でも呼んでいる`).toBe(1);
    }
  });

  it('接続は body-extension → head-seam、解除は head-seam → body-extension の順', () => {
    const body = screen.indexOf('attachNanamiBodyExtensionV1(card)');
    const seam = screen.indexOf('attachNanamiHeadSeamV11(card)');
    expect(body, '胴体の表示を先に接続していない').toBeLessThan(seam);
    // fitTeardowns は積んだ順に呼ばれるので、head-seam を先に積む。
    expect(screen).toContain('fitTeardowns.push(offSeam, offBody);');
  });

  it('カードを作り直すときと画面を捨てるときに、積んだ解除関数をすべて呼ぶ', () => {
    const calls = [...screen.matchAll(/for \(const off of fitTeardowns\) off\(\);\n\s*fitTeardowns\.length = 0;/g)];
    // 1つはカードを作り直すとき、もう1つは画面を捨てるとき。
    expect(calls.length, '解除の呼び出しが2か所にない').toBe(2);
  });

  it('採用しなかった候補の関数を呼ばない', () => {
    for (const { name, fn } of NOT_ADOPTED) {
      expect(screen, `${name} の関数を呼んでいる`).not.toContain(fn);
      expect(main, `${name} の関数を読み込んでいる`).not.toContain(fn);
    }
  });

  it('比較用の切り替え定数を実行経路へ残していない', () => {
    for (const name of [
      'GROUND_V1_MODE',
      'BODY_EXTENSION_V1',
      'OUTER_HAZE_V11',
      'HEAD_SEAM_V11',
      'HEAD_SEAM_V1',
    ]) {
      expect(screen, `比較用の切り替え ${name} が残っている`).not.toContain(name);
    }
    // 診断用の一時的な非表示や、測定のための分岐も入れない。
    expect(screen).not.toContain('opacity:0');
    expect(screen).not.toContain('import.meta.env');
  });
});

describe('七海のカード：採用した CSS の中身', () => {
  it('地色は未選択のときだけ当て、選択中は外れる', () => {
    const css = withoutComments(groundCss);
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    expect(rules.length, '地色の規則は1つだけにする').toBe(1);
    const [, selector, body] = rules[0];
    expect(selector).toContain('[data-avatar-id="middle-f-01"]');
    expect(selector).toContain('[data-reference-v23="true"]');
    expect(selector).toContain(':not([aria-selected="true"])');
    expect(selector).toContain('.screen--avatar-select .avatar-list');
    // 比較のときの B 案は本番へ入れない。
    expect(css, '比較用の切り替え属性が残っている').not.toContain('data-nanami-ground-v1');
    // 採用した値そのもの。ここで再調整しない。
    expect(body.replace(/\s+/g, '')).toBe(
      'background:linear-gradient(180deg,rgba(148,170,191,.28)0%,rgba(148,170,191,.34)100%);',
    );
  });

  it('七海以外の人物・他の年代へは広げない', () => {
    for (const css of [groundCss, bodyExtensionCss]) {
      for (const selector of withoutComments(css).match(/[^{}]+(?=\{)/g) ?? []) {
        expect(selector, `七海以外にも当たる指定: ${selector.trim()}`)
          .toContain('[data-avatar-id="middle-f-01"]');
      }
    }
    // struct-v1 は一覧の行の高さだけ、中学生の一覧へ当てる（印は中学生のときだけ付く）。
    for (const selector of withoutComments(structCss).match(/[^{}]+(?=\{)/g) ?? []) {
      const onlyNanami = selector.includes('[data-avatar-id="middle-f-01"]');
      const onlyGrid = selector.includes('.avatar-grid[data-struct-v1="true"]');
      expect(onlyNanami || onlyGrid, `対象が広すぎる指定: ${selector.trim()}`).toBe(true);
    }
    expect(structSource).toContain("const TARGET_AGE = 'middle';");
  });
});

describe('七海のカード：安全な接続と解除', () => {
  it('画像が未読み込みでも接続でき、読み込めてから描く', () => {
    // 接続の時点では has-image が付いていないことがある。load と class の変化を見張る。
    for (const source of [headSeamSource, bodyExtensionSource]) {
      expect(source).toContain("addEventListener('load'");
      expect(source).toContain('MutationObserver');
      expect(source).toContain("attributeFilter: ['class']");
      expect(source).toContain('ResizeObserver');
    }
  });

  it('同じカードへ二重に接続しない', () => {
    expect(bodyExtensionSource).toContain("card.dataset.bodyExtensionV1 === 'true') return () => {}");
    expect(headSeamSource).toContain("card.dataset.headSeamV11 === 'true') return () => {}");
  });

  it('解除すると、追加した層・監視・印をすべて片づける', () => {
    expect(bodyExtensionSource).toContain('layer.remove();');
    expect(bodyExtensionSource).toContain('delete card.dataset.bodyExtensionV1;');
    expect(headSeamSource).toContain('delete card.dataset.headSeamV11; delete card.dataset.headSeamReady;');
    // 寸法と中身の見張りは、解除のときに必ず外す（名前は各ファイルのまま）。
    expect(bodyExtensionSource).toContain('resizeObserver.disconnect();');
    expect(bodyExtensionSource).toContain('mutationObserver.disconnect();');
    expect(headSeamSource).toContain('resize.disconnect(); mutation.disconnect();');
    for (const source of [headSeamSource, bodyExtensionSource]) {
      expect(source).toContain('cancelAnimationFrame(frame)');
      expect(source).toContain("removeEventListener('load'");
      expect(source).toContain("window.removeEventListener('resize', schedule)");
    }
  });

  it('解除すると、head へ入れたインラインのマスク指定を元へ戻す', () => {
    // 8つの指定を保存しておき、解除のときに元の値へ戻す（無ければ消す）。
    expect(headSeamSource).toContain("const properties = ['mask-image', '-webkit-mask-image', 'mask-composite', '-webkit-mask-composite',");
    expect(headSeamSource).toContain("'mask-size', '-webkit-mask-size', 'mask-repeat', '-webkit-mask-repeat'];");
    expect(headSeamSource).toContain('head.style.getPropertyValue(p), head.style.getPropertyPriority(p)');
    expect(headSeamSource).toContain('if (value) head.style.setProperty(p, value, priority); else head.style.removeProperty(p);');
  });

  it('原画・胴体・既存マスクの画像を作り直したり差し替えたりしない', () => {
    for (const source of [headSeamSource, bodyExtensionSource, structSource]) {
      // 画像ファイルを書き出す処理は入れない。
      expect(source).not.toContain('toBlob');
      expect(source).not.toContain('createObjectURL');
    }
    // 表示用のマスクはブラウザの中だけで作り、素材そのものは触らない。
    expect(headSeamSource).toContain("output.c.toDataURL('image/png')");
  });
});
