import { describe, expect, it } from 'vitest';
import avatarCssInline from '../styles/avatar.css?inline';
import thumbSource from '../components/avatarThumb.ts?raw';
import { AVATARS, avatarImageUrl, isSafeImageKey } from '../data/avatars';

/**
 * 主人公画像の表示機構の検査。
 *
 * 基準画像はまだ届いていないため、名簿の imageKey は全員 null のままである。
 * そこで検査するのは「画像が入ったときに安全に出る仕組みになっているか」と
 * 「入っていない間は今までどおり仮サムネイルが出るか」の2点。
 *
 * 画像そのものの見え方（顔の大きさ・絵柄）は画像が届いてから確かめる。
 */

function asCss(value: unknown, name: string): string {
  const text = String(value);
  expect(text.length, `${name} を文字列として読めていない`).toBeGreaterThan(0);
  return text;
}

const avatarCss = asCss(avatarCssInline, 'avatar.css');

/**
 * コメントを取り除いた実行部分だけの本文。
 *
 * 「throw を書いていない」「仮表示という語を画面へ出していない」といった検査を
 * 本文そのままに当てると、説明コメントの中の同じ語に引っかかって
 * 実装が正しくても落ちる。検査はコメントを外した側へ当てる。
 */
const runtimeSource = thumbSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('//'))
  .join('\n');

/** セレクタの宣言ブロックを取り出す（行頭のセレクタだけを拾う）。 */
function block(selector: string): string {
  const pattern = new RegExp(
    `^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  );
  const found = avatarCss.match(pattern);
  expect(found, `${selector} の宣言ブロックが見つからない`).not.toBeNull();
  return (found as RegExpMatchArray)[1];
}

function prop(blockText: string, name: string): string {
  const pattern = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'm');
  const found = blockText.match(pattern);
  expect(found, `${name} の指定が見つからない`).not.toBeNull();
  return (found as RegExpMatchArray)[1].trim().replace(/\s+/g, ' ');
}

describe('imageKey は拡張子を含まない安全なキーとして扱う', () => {
  const allowed = ['elementary-m', 'middle-f', 'adult-f-03', 'high1', 'a'];
  const rejected = [
    'elementary-m.webp',
    'assets/avatars/elementary-m',
    '../secret',
    '/etc/passwd',
    'Elementary-M',
    'elementary_m',
    '-leading',
    'trailing-',
    'double--hyphen'.replace('--', '--'),
    '',
    'あ',
    'a b',
    'a?b=1',
  ];

  for (const key of allowed) {
    it(`許す: ${JSON.stringify(key)}`, () => {
      expect(isSafeImageKey(key)).toBe(true);
    });
  }

  for (const key of rejected) {
    it(`はじく: ${JSON.stringify(key)}`, () => {
      expect(isSafeImageKey(key)).toBe(false);
    });
  }

  it('文字列以外はすべてはじく', () => {
    for (const value of [null, undefined, 0, 1, true, false, {}, [], () => 'x']) {
      expect(isSafeImageKey(value)).toBe(false);
    }
  });
});

describe('画像URLの作り方', () => {
  it('imageKey が null なら URL を作らない（仮サムネイルへ落ちる）', () => {
    expect(avatarImageUrl({ imageKey: null })).toBeNull();
  });

  it('安全でないキーは URL を作らない', () => {
    for (const key of ['elementary-m.webp', '../x', 'a/b', 'A']) {
      expect(avatarImageUrl({ imageKey: key }), `${key} で URL を作ってしまった`).toBeNull();
    }
  });

  it('安全なキーからは 拡張子 .webp 付きの URL を作る', () => {
    const url = avatarImageUrl({ imageKey: 'elementary-m' });
    expect(url).not.toBeNull();
    expect(url as string).toMatch(/assets\/avatars\/elementary-m\.webp$/);
  });

  it('URL は base（サブパス公開）を反映している', () => {
    const url = avatarImageUrl({ imageKey: 'adult-f' }) as string;
    // 本番の base は '/kotoba-journey/'。テスト時は '/' になる環境もあるため、
    // 先頭が base で始まり、キーの前にディレクトリが入ることだけを見る。
    expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true);
    expect(url).toBe(`${import.meta.env.BASE_URL}assets/avatars/adult-f.webp`);
  });

  it('キーを2回入れたり拡張子を二重に付けたりしない', () => {
    const url = avatarImageUrl({ imageKey: 'middle-m' }) as string;
    expect(url.match(/middle-m/g)).toHaveLength(1);
    expect(url.match(/\.webp/g)).toHaveLength(1);
  });
});

describe('名簿の現状（基準画像10枚を共有）', () => {
  it('80人ぶんあり、imageKey が全員に入っている', () => {
    expect(AVATARS).toHaveLength(80);
    expect(AVATARS.filter((a) => a.imageKey === null)).toHaveLength(0);
  });

  it('全員ぶん URL が作られる（＝全員が実画像）', () => {
    expect(AVATARS.filter((a) => avatarImageUrl(a) === null)).toHaveLength(0);
  });

  it('誰も無効化していない', () => {
    expect(AVATARS.filter((a) => !a.enabled)).toHaveLength(0);
  });
});

describe('avatarThumb の組み立て方', () => {
  it('imageKey から URL を引いて使っている', () => {
    expect(thumbSource).toContain('avatarImageUrl(avatar)');
  });

  it('仮サムネイルは、画像があるかどうかに関わらず必ず組み立てている', () => {
    // 生成が if より前にあること。
    const fallbackAt = runtimeSource.indexOf("class: 'avatar-thumb__fallback'");
    const branchAt = runtimeSource.indexOf('if (imageUrl !== null)');
    expect(fallbackAt).toBeGreaterThan(0);
    expect(branchAt).toBeGreaterThan(0);
    expect(fallbackAt, '仮サムネイルが条件分岐の中で作られている').toBeLessThan(branchAt);
  });

  it('仮サムネイルを、条件を付けずに円へ入れている', () => {
    // 生成が分岐の外にあっても、円へ入れるところで条件を付けられると
    // 画像があるときに仮サムネイルが無くなり、失敗時に空の円が出てしまう。
    // 子要素として素の fallback を渡していることを見る。
    expect(runtimeSource, '円の子要素が [fallback] になっていない').toMatch(
      /\[\s*fallback\s*,?\s*\]/,
    );
    // fallback に三項演算子や && を掛けていないこと。
    expect(runtimeSource, '仮サムネイルに条件が付いている').not.toMatch(
      /[?&|]\s*[^\n]*\bfallback\b/,
    );
    expect(runtimeSource, '仮サムネイルに条件が付いている').not.toMatch(
      /\bfallback\b[^\n]*[?]/,
    );
  });

  it('URL が無いときは <img> を作らない', () => {
    const branchAt = thumbSource.indexOf('if (imageUrl !== null)');
    const imgAt = thumbSource.indexOf("el('img'");
    expect(imgAt).toBeGreaterThan(branchAt);
  });

  /*
   * 以前は <img> の alt にも氏名を入れていたが、外側にも role="img" があったため
   * 画像のロールが二重になり、装飾として渡した空ラベルが
   * 「名前のない画像」として残っていた。
   * いまは名前を持つ場所を丸い顔1か所に限り、<img> は装飾にしている。
   * 検査もその形に合わせる（氏名がどこかに必ずあることは下で見る）。
   */
  it('<img> は装飾にしてあり、画像のロールを二重にしない', () => {
    expect(runtimeSource, '<img> の alt が空になっていない').toContain("alt: ''");
    expect(
      runtimeSource.match(/alt:/g) ?? [],
      'alt を書いている箇所が1つではない',
    ).toHaveLength(1);
    expect(
      runtimeSource.match(/role: /g) ?? [],
      "role を付けている箇所が1つではない（画像のロールが二重になる）",
    ).toHaveLength(1);
  });

  it('名前を持つのは丸い顔だけで、氏名と年代を渡している', () => {
    expect(runtimeSource).toContain("class: 'avatar-thumb__face'");
    expect(runtimeSource, '顔に aria-label を渡していない').toMatch(
      /'aria-label': decorative \? undefined : label/,
    );
    expect(runtimeSource, 'ラベルが姓名と年代になっていない').toContain(
      'const label = options.label ?? `${fullName(avatar)}（${AGE_GROUP_LABEL[avatar.ageGroup]}）`',
    );
  });

  it('空のラベルを渡したときは、名前のない画像のロールを残さない', () => {
    expect(runtimeSource, '空ラベルを装飾として扱っていない').toContain(
      "const decorative = options.label === ''",
    );
    expect(runtimeSource, '装飾のときに role を外していない').toMatch(
      /role: decorative \? undefined : 'img'/,
    );
    expect(runtimeSource, '装飾のときに読み上げから外していない').toMatch(
      /'aria-hidden': decorative \? 'true' : undefined/,
    );
    // 空文字をそのまま aria-label に入れないこと（名前のない画像になる）。
    expect(runtimeSource, "aria-label に空文字が入りうる書き方が残っている").not.toMatch(
      /'aria-label':\s*options\.label\s*\?\?/,
    );
  });

  it('名前を添える指定（withName）は、読み上げから外れない位置にある', () => {
    // aria-hidden は丸い顔だけに付ける。外側の箱に付けると、
    // withName で添えた名前まで一緒に隠れてしまう。
    const outerAt = runtimeSource.lastIndexOf("class: ['avatar-thumb'");
    const nameAt = runtimeSource.indexOf('avatar-thumb__name');
    const hiddenAt = runtimeSource.indexOf("'aria-hidden'");
    expect(outerAt).toBeGreaterThan(0);
    expect(nameAt).toBeGreaterThan(outerAt);
    expect(hiddenAt, 'aria-hidden が外側の箱に付いている').toBeLessThan(outerAt);
  });

  it('成功したときだけ has-image を付け、失敗時は image-failed を付ける', () => {
    expect(thumbSource).toContain("face.classList.add('has-image')");
    expect(thumbSource).toContain("face.classList.add('image-failed')");
    expect(thumbSource).toContain("image.addEventListener('load'");
    expect(thumbSource).toContain("image.addEventListener('error'");
  });

  it('listener を付ける前に読み終わっていた場合も取りこぼさない', () => {
    expect(thumbSource).toContain('if (image.complete)');
    expect(thumbSource).toContain('image.naturalWidth > 0');
  });

  it('失敗時に例外を投げたりログを出したりしない', () => {
    expect(runtimeSource, 'throw が実行部分に残っている').not.toMatch(/\bthrow\b/);
    expect(runtimeSource, 'console 出力が実行部分に残っている').not.toMatch(/console\./);
  });

  it('開発状況（仮表示であること）を画面にも読み上げにも出さない', () => {
    for (const word of ['仮表示', '未納品', '準備中', 'placeholder', 'TODO']) {
      expect(runtimeSource, `${word} が画面へ出る文字列に入っている`).not.toContain(word);
    }
  });
});

describe('CSS：画像は円形で、寸法を変えない', () => {
  const face = block('.avatar-thumb__face');
  const img = block('.avatar-thumb__img');

  it('円の中に重ねる基準があり、はみ出しを切っている', () => {
    expect(prop(face, 'position')).toBe('relative');
    expect(prop(face, 'overflow')).toBe('hidden');
    expect(prop(face, 'border-radius')).toBe('50%');
  });

  it('画像は円形・cover・中央合わせ', () => {
    expect(prop(img, 'border-radius')).toBe('50%');
    expect(prop(img, 'object-fit')).toBe('cover');
    expect(prop(img, 'object-position')).toBe('center');
  });

  it('画像は円に追従するので、寸法は円の指定だけで決まる', () => {
    expect(prop(img, 'position')).toBe('absolute');
    expect(prop(img, 'inset')).toBe('0');
    expect(prop(img, 'width')).toBe('100%');
    expect(prop(img, 'height')).toBe('100%');
    // 画像側に固定の px を持たせていないこと（レイアウトが跳ねる原因になる）。
    expect(img).not.toMatch(/(?:^|;)\s*(?:width|height)\s*:\s*\d+px/);
  });

  it('96 / 58 / 40px の3種類が残っている', () => {
    expect(prop(block('.avatar-thumb--lg .avatar-thumb__face'), 'width')).toBe('96px');
    expect(prop(block('.avatar-thumb--md .avatar-thumb__face'), 'width')).toBe('58px');
    expect(prop(block('.avatar-thumb--sm .avatar-thumb__face'), 'width')).toBe('40px');
  });

  it('読み込み前は透明にしてあり、display:none にはしていない', () => {
    // display:none だと loading="lazy" の画像を読み込まない環境がある。
    expect(prop(img, 'opacity')).toBe('0');
    expect(img).not.toMatch(/display\s*:\s*none/);
  });

  it('成功したときだけ画像を出し、仮表示と破線を消す', () => {
    expect(prop(block('.avatar-thumb__face.has-image .avatar-thumb__img'), 'opacity')).toBe('1');
    expect(prop(block('.avatar-thumb__face.has-image .avatar-thumb__fallback'), 'display')).toBe(
      'none',
    );
    expect(prop(block('.avatar-thumb__face.has-image'), 'border-style')).toBe('none');
  });

  it('失敗したときは画像だけを消し、仮サムネイルは残す', () => {
    expect(prop(block('.avatar-thumb__face.image-failed .avatar-thumb__img'), 'display')).toBe(
      'none',
    );
    // 枠ごと消していないこと（年齢層イラストの is-missing とは違う扱い）。
    expect(avatarCss).not.toMatch(/^\.avatar-thumb__face\.image-failed\s*\{[^}]*display\s*:\s*none/m);
    expect(avatarCss).not.toMatch(/^\.avatar-thumb\.image-failed\s*\{[^}]*display\s*:\s*none/m);
  });

  it('仮サムネイルの破線は、画像が無いときは残っている', () => {
    expect(prop(face, 'border')).toContain('dashed');
  });
});
