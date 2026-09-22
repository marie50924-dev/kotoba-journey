import { describe, expect, it } from 'vitest';
import readme from '../../README.md?raw';
import indexHtml from '../../index.html?raw';
import packageJson from '../../package.json?raw';
import checklist from '../../docs/reports/VOCABULARY_CHECKLIST.md?raw';

/**
 * アプリの対象範囲（だれ向けか）の記述を固定する検査。
 *
 * このアプリは、子どもから大人までを対象にしている。
 * けれど以前は説明文に対象が書かれておらず、
 * ひらがな表記や小学生コースがあることから
 * 「子ども専用のアプリ」と読まれる余地が残っていた。
 *
 * 対象範囲は、読む人がゲームを開く前に目にする4か所へ書く。
 * 書いた文が消えたり、対象を子どもだけに狭める書き方へ戻ったりしたら、
 * ここで落ちるようにしておく。
 *
 * 外部へは通信しない。リポジトリ内の文字列だけを静的に読む。
 * 4か所はそれぞれ役割が違うので、1件ずつ独立した検査にする
 * （1つ落ちても、残りのどこが書けているかが分かるようにするため）。
 */

/** 対象を狭める書き方。新たに使わない。 */
const AUDIENCE_NARROWING = [
  '子ども向けアプリ',
  '子ども向けゲーム',
  '子ども専用',
  'こども専用',
  '子供専用',
  '小学生向けゲーム',
  '児童向け',
  'for kids',
  'kids only',
  'children only',
];

describe('アプリの対象範囲が、遊ぶ前に読む場所へ書いてあること', () => {
  it('README の冒頭に、子どもから大人までを対象にすると書いてある', () => {
    expect(readme, 'README に対象範囲の1文が無い').toContain(
      '子どもから大人まで、楽しくゲームをしながら英語を学べるスマートフォン向けWebアプリです。',
    );
    // もとからの説明も消さない。対象範囲は足すもので、置き換えるものではない。
    expect(readme, 'README のもとからのゲーム説明が消えている').toContain(
      '日本語カードと英語カードを同じ盤面へ混ぜたカルタ',
    );
    for (const phrase of AUDIENCE_NARROWING) {
      expect(readme, `README が「${phrase}」と対象を狭めている`).not.toContain(phrase);
    }
  });

  it('index.html のメタ説明に、対象範囲と英語学習アプリであることが書いてある', () => {
    // 検索結果やSNSへ出るのはこの1か所だけ。OGPタグは置いていない。
    const matched = indexHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/);
    expect(matched, 'meta name="description" が無い').not.toBeNull();
    const description = matched![1];
    expect(description, 'メタ説明に対象範囲が無い').toContain('子どもから大人まで');
    expect(description, 'メタ説明に英語学習だと書かれていない').toContain('英語');
    expect(description, 'メタ説明にスマートフォン向けWebアプリだと書かれていない')
      .toContain('スマートフォン向けWebアプリ');
    for (const phrase of AUDIENCE_NARROWING) {
      expect(description, `メタ説明が「${phrase}」と対象を狭めている`).not.toContain(phrase);
    }
  });

  it('語彙台帳の冒頭に、子どもから大人までを対象にすると書いてある', () => {
    // 台帳は札のことばを決める場所。どの年齢に向けて選ぶかが、判断の前提になる。
    expect(checklist, '台帳に対象範囲の1文が無い').toContain(
      'ことばトラベルは、子どもから大人まで、楽しくゲームをしながら英語を学べるスマートフォン向けWebアプリです。',
    );
    // 対象範囲は第1節（このチェックリストは何か）に置く。末尾へ紛れ込ませない。
    const section1 = checklist.indexOf('## 1. このチェックリストは何か');
    const section2 = checklist.indexOf('## 2. 状態の3種類');
    expect(section1, '台帳の第1節が無い').toBeGreaterThan(-1);
    expect(section2, '台帳の第2節が無い').toBeGreaterThan(section1);
    expect(
      checklist.slice(section1, section2),
      '対象範囲の1文が第1節に無い',
    ).toContain('子どもから大人まで');
  });

  it('package.json の説明に、子どもと大人の両方が対象だと書いてある', () => {
    const parsed = JSON.parse(packageJson) as { description?: string; private?: boolean };
    expect(parsed.description, 'description が無い').toBeDefined();
    expect(parsed.description, 'description に対象範囲が無い')
      .toContain('for children and adults');
    // 公開用パッケージにはしない。ここは変えない。
    expect(parsed.private, 'private が true でない').toBe(true);
    for (const phrase of AUDIENCE_NARROWING) {
      expect(parsed.description, `description が「${phrase}」と対象を狭めている`)
        .not.toContain(phrase);
    }
  });
});
