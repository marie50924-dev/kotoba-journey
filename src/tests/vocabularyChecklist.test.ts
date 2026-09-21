import { describe, expect, it } from 'vitest';
import checklist from '../../docs/reports/VOCABULARY_CHECKLIST.md?raw';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import { RECORD_VERSION } from '../storage/learningRecord';
import { COUNTRY_INTROS, allClaims, visibleClaims, canPublish, showsDetails } from '../data/countryIntros';

/**
 * 語彙確認チェックリスト（docs/reports/VOCABULARY_CHECKLIST.md）の自動検査。
 *
 * このチェックリストは、カルタの札に使うことばを人が資料で確かめるための台帳。
 * 国紹介の FactClaim とは別物で、ゲームの動作や公開判定には影響しない。
 *
 * ここで固定するのは「台帳が人の確認を受け取れる形になっていること」と、
 * 「既存10語がコードの実データと一致していること」。
 * Markdown を正規表現でざっくり数えるのではなく、
 * 語ごとの見出しと縦表を項目単位で読み取って照合する。
 */

interface ChecklistEntry {
  pairId: number;
  ja: string;
  en: string;
  種類: string;
  品詞: string;
  状態: string;
  確認の方法: string;
  判定: string;
  確認した資料: string;
  URL: string;
  確認した内容: string;
  確認日: string;
  注意点: string;
  /** 基本語判断の5条件。番号（1〜5）をそのまま持つ。 */
  条件: Map<number, string>;
}

/** 語ごとの節（### 見出し ＋ 縦表）を項目単位で読み取る。 */
function parseChecklist(markdown: string): ChecklistEntry[] {
  // 台帳の本体だけを見る。説明文の中の表を拾わないようにする。
  // 見出しは行頭から探す。「### 9. とり」のような語の見出しと取り違えないため。
  const bodyStart = markdown.indexOf('\n## 8. 30語の確認台帳');
  const bodyEnd = markdown.indexOf('\n## 9. この台帳を変えるときの決まり');
  expect(bodyStart, '「30語の確認台帳」の節が無い').toBeGreaterThan(-1);
  expect(bodyEnd, '台帳の終わりが見つからない').toBeGreaterThan(bodyStart);
  const body = markdown.slice(bodyStart, bodyEnd);

  const sections = body.split(/^### /m).slice(1);
  return sections.map((section) => {
    const heading = section.split('\n', 1)[0].trim();
    const fields = new Map<string, string>();
    for (const line of section.split('\n')) {
      const cells = line.match(/^\|(.+)\|$/);
      if (!cells) continue;
      const parts = cells[1].split('|');
      if (parts.length !== 2) continue;
      const key = parts[0].trim();
      if (key === '項目' || /^-+$/.test(key)) continue;
      fields.set(key, parts[1].trim());
    }

    // 「基本語条件3・語形」のような行を、番号ごとに取り出す。
    const conditions = new Map<number, string>();
    for (const [key, value] of fields) {
      const matched = key.match(/^基本語条件([1-5])・(.+)$/);
      if (matched) conditions.set(Number(matched[1]), `${matched[2]}\t${value}`);
    }

    const pairId = Number(fields.get('pairId'));
    // 使用中の語は「現在の日本語」、候補は「日本語候補」で書き分けている。
    const ja = fields.get('現在の日本語') ?? fields.get('日本語候補') ?? '';
    const en = fields.get('現在の英語') ?? fields.get('英語候補') ?? '';
    expect(heading.startsWith(`${pairId}. `), `見出しとpairIdが食い違う: ${heading}`).toBe(true);

    return {
      pairId,
      ja,
      en,
      種類: fields.get('種類') ?? '',
      品詞: fields.get('品詞') ?? '',
      状態: fields.get('状態') ?? '',
      確認の方法: fields.get('確認の方法') ?? '',
      判定: fields.get('判定') ?? '',
      確認した資料: fields.get('確認した資料') ?? '',
      URL: fields.get('URL') ?? '',
      確認した内容: fields.get('確認した内容') ?? '',
      確認日: fields.get('確認日') ?? '',
      注意点: fields.get('注意点') ?? '',
      条件: conditions,
    };
  });
}

const ENTRIES = parseChecklist(checklist);
const byId = new Map(ENTRIES.map((e) => [e.pairId, e]));
const candidates = ENTRIES.filter((e) => e.pairId >= 11);

describe('語彙確認チェックリストの形', () => {
  it('30語ある（使用中10語・候補20語）', () => {
    expect(ENTRIES).toHaveLength(30);
    expect(ENTRIES.filter((e) => e.pairId <= 10)).toHaveLength(10);
    expect(candidates).toHaveLength(20);
  });

  it('pairId は 1〜30 で重複しない', () => {
    const ids = ENTRIES.map((e) => e.pairId);
    expect(new Set(ids).size).toBe(30);
    expect([...ids].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
  });

  it('30語すべてに 種類・品詞・注意点 がある', () => {
    for (const entry of ENTRIES) {
      expect(entry.種類, `${entry.pairId} の種類が空`).not.toBe('');
      expect(entry.品詞, `${entry.pairId} の品詞が空`).not.toBe('');
      expect(entry.注意点.length, `${entry.pairId} の注意点が短すぎる`).toBeGreaterThan(10);
    }
  });

  it('品詞は 名詞・動詞・色 のどれかで書く', () => {
    for (const entry of ENTRIES) {
      expect(['名詞', '動詞', '色'], `${entry.pairId}: ${entry.品詞}`).toContain(entry.品詞);
    }
  });
});

const STATES = ['要確認（使用中）', '要確認（候補）', '確認済み'];
const METHODS = ['資料確認', '基本語判断'];
/** 基本語判断の5条件。番号と見出しの対応。 */
const CONDITION_NAMES: [number, string][] = [
  [1, '具体性'],
  [2, '対応'],
  [3, '語形'],
  [4, '同音'],
  [5, '表記'],
];
const verified = ENTRIES.filter((e) => e.状態 === '確認済み');
const pending = ENTRIES.filter((e) => e.状態 !== '確認済み');

describe('確認の進みかた', () => {
  it('状態は3種類しか使わない', () => {
    for (const entry of ENTRIES) {
      expect(STATES, `${entry.pairId}: ${entry.状態}`).toContain(entry.状態);
    }
  });

  it('未確認の語は、まだ何も記入されていない', () => {
    for (const entry of pending) {
      const expected = entry.pairId <= 10 ? '要確認（使用中）' : '要確認（候補）';
      expect(entry.状態, `${entry.pairId} の状態`).toBe(expected);
      expect(entry.確認の方法, `${entry.pairId} の確認の方法`).toBe('');
      expect(entry.判定, `${entry.pairId} の判定`).toBe('');
      expect(entry.確認した資料, `${entry.pairId} の確認した資料`).toBe('');
      expect(entry.URL, `${entry.pairId} のURL`).toBe('');
      expect(entry.確認した内容, `${entry.pairId} の確認した内容`).toBe('');
      expect(entry.確認日, `${entry.pairId} の確認日`).toBe('');
    }
  });

  it('確認済みの語は、方法・判定・確認した内容・確認日がそろっている', () => {
    for (const entry of verified) {
      expect(METHODS, `${entry.pairId} の確認の方法: ${entry.確認の方法}`).toContain(entry.確認の方法);
      expect(entry.判定, `${entry.pairId} の判定が空`).not.toBe('');
      expect(['採用', '修正', '見送り'].some((v) => entry.判定.includes(v)),
        `${entry.pairId} の判定に 採用/修正/見送り が無い: ${entry.判定}`).toBe(true);
      // 「採用／修正／見送り」をそのまま貼っただけの記録を弾く。
      expect(entry.判定, `${entry.pairId} の判定が選ばれていない`).not.toBe('採用／修正／見送り');
      expect(entry.確認した内容.length, `${entry.pairId} の確認した内容が短すぎる`).toBeGreaterThan(20);
      expect(entry.確認日, `${entry.pairId} の確認日`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('資料確認の語は、資料名とURLを持つ', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '資料確認')) {
      expect(entry.確認した資料, `${entry.pairId} の資料名が空`).not.toBe('');
      expect(entry.URL, `${entry.pairId} のURL`).toMatch(/^https?:\/\//);
      // 台帳そのものを根拠にはできない。
      expect(entry.URL, `${entry.pairId} がこの台帳自身を資料にしている`)
        .not.toContain('VOCABULARY_CHECKLIST');
    }
  });

  it('基本語判断の語は、資料を使わない代わりに判断の理由を書く', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '基本語判断')) {
      expect(entry.確認した資料, `${entry.pairId} は資料欄を空にする`).toBe('');
      expect(entry.URL, `${entry.pairId} はURL欄を空にする`).toBe('');
      // 「基本語だから」だけの記録を弾く。
      expect(entry.確認した内容.length, `${entry.pairId} の判断理由が短すぎる`).toBeGreaterThan(40);
    }
  });

  it('基本語判断の語は、5条件を1行ずつ書いてある', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '基本語判断')) {
      expect(
        [...entry.条件.keys()].sort((a, b) => a - b),
        `${entry.pairId} の条件の番号がそろっていない`,
      ).toEqual([1, 2, 3, 4, 5]);

      for (const [number, name] of CONDITION_NAMES) {
        const row = entry.条件.get(number) ?? '';
        const [label, value] = row.split('\t');
        expect(label, `${entry.pairId} の条件${number}の見出し`).toBe(name);
        // 「適合」と書いただけで中身が無い記録を弾く。
        expect(value.startsWith('適合：'), `${entry.pairId} の条件${number}が「適合：」で始まらない: ${value}`).toBe(true);
        expect(
          value.replace('適合：', '').trim().length,
          `${entry.pairId} の条件${number}に理由が書かれていない`,
        ).toBeGreaterThan(5);
      }
    }
  });

  it('条件3・語形には、名詞の単数形・動詞の原形・色 のどれかを書く', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '基本語判断')) {
      const 語形 = entry.条件.get(3) ?? '';
      expect(
        ['名詞の単数形', '動詞の原形', '色'].some((form) => 語形.includes(form)),
        `${entry.pairId} の条件3に語形が書かれていない: ${語形}`,
      ).toBe(true);
    }
  });

  it('条件4・同音は、同じ読みの語が本当に他にないときだけ書ける', () => {
    // 台帳に載っている30語の中で、読みが重なっていないことを実データから確かめる。
    const readings = new Map<string, number[]>();
    for (const entry of ENTRIES) {
      readings.set(entry.ja, [...(readings.get(entry.ja) ?? []), entry.pairId]);
    }
    for (const entry of verified.filter((e) => e.確認の方法 === '基本語判断')) {
      expect(
        readings.get(entry.ja),
        `${entry.pairId}「${entry.ja}」と同じ表記の語が台帳に複数ある`,
      ).toEqual([entry.pairId]);
    }
  });

  it('未確認の語には、条件の行を書かない', () => {
    for (const entry of pending) {
      expect(entry.条件.size, `${entry.pairId} に条件の行がある`).toBe(0);
    }
  });

  it('資料確認の語には、基本語条件を書かない', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '資料確認')) {
      expect(entry.条件.size, `${entry.pairId} は資料確認なのに基本語条件がある`).toBe(0);
    }
  });

  it('語の行へ国紹介の状態名を持ち込まない', () => {
    for (const entry of ENTRIES) {
      const row = Object.values(entry).join(' ');
      for (const word of ['body-checked', 'rejected', 'withdrawn']) {
        expect(row, `${entry.pairId} に「${word}」がある`).not.toContain(word);
      }
    }
  });

  it('いまの確認済みは pairId 5 だけ', () => {
    expect(verified.map((e) => e.pairId)).toEqual([5]);
    expect(pending).toHaveLength(29);
  });
});

describe('確認の方法が2通りあると書いてあること', () => {
  it('資料確認と基本語判断の両方を説明している', () => {
    for (const phrase of [
      '`資料確認`',
      '`基本語判断`',
      '### 3-1. `資料確認` の条件',
      '### 3-2. `基本語判断` の条件',
      '### 3-3. `基本語判断` を使ってはいけない語',
      'このチェックリスト自身を資料として記録する',
      '同じ読みの別の語が、同じ札のセットに入っていない',
      '### 3-2-1. 5条件は、語ごとに1行ずつ書く',
      '**5行すべてが必要です。**',
    ]) {
      expect(checklist, `「${phrase}」が書かれていない`).toContain(phrase);
    }
  });
});

describe('コードの実データとの照合', () => {
  it('既存 1〜10 は SAMPLE_PAIRS と完全一致する（採用でも表記は変わらない）', () => {
    expect(SAMPLE_PAIRS).toHaveLength(10);
    for (const pair of SAMPLE_PAIRS) {
      const entry = byId.get(pair.pairId);
      expect(entry, `pairId ${pair.pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `pairId ${pair.pairId} の日本語`).toBe(pair.ja);
      expect(entry!.en, `pairId ${pair.pairId} の英語`).toBe(pair.en);
    }
  });

  it('候補 11〜30 は、まだ SAMPLE_PAIRS に入っていない', () => {
    const usedJa = new Set(SAMPLE_PAIRS.map((p) => p.ja));
    const usedEn = new Set(SAMPLE_PAIRS.map((p) => p.en));
    const usedIds = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (const entry of candidates) {
      expect(usedIds.has(entry.pairId), `仮ID ${entry.pairId} が実データにある`).toBe(false);
      expect(usedJa.has(entry.ja), `候補「${entry.ja}」が実データにある`).toBe(false);
      expect(usedEn.has(entry.en), `候補「${entry.en}」が実データにある`).toBe(false);
    }
  });

  it('語彙10語そのものが変わっていない', () => {
    expect(SAMPLE_PAIRS.map((p) => [p.pairId, p.ja, p.en])).toEqual([
      [1, 'りんご', 'apple'],
      [2, 'ねこ', 'cat'],
      [3, 'あお', 'blue'],
      [4, 'いぬ', 'dog'],
      [5, 'はな', 'flower'],
      [6, 'ほん', 'book'],
      [7, 'みず', 'water'],
      [8, 'つき', 'moon'],
      [9, 'とり', 'bird'],
      [10, 'くるま', 'car'],
    ]);
  });

  it('保存形式は version 3 のまま', () => {
    expect(RECORD_VERSION).toBe(3);
  });
});

describe('人が確認すべき論点が書いてあること', () => {
  // 指定された語には、指定された論点が残っていること。
  const POINTS: [number, string[]][] = [
    [3, ['色']],
    [5, ['鼻']],
    [6, ['本']],
    [8, ['月']],
    [9, ['取り']],
    [10, ['乗り物']],
    [12, ['単数', '複数']],
    [15, ['色']],
    [16, ['色']],
    [17, ['色']],
    [18, ['色']],
    [19, ['色']],
    [20, ['不可算']],
    [22, ['ミルク']],
    [25, ['ocean']],
    [27, ['home']],
    [28, ['原形']],
    [29, ['原形']],
    [30, ['go to bed']],
  ];

  it.each(POINTS)('pairId %i の注意点に論点が書いてある', (pairId, words) => {
    const entry = byId.get(pairId as number);
    expect(entry, `pairId ${pairId} が無い`).toBeDefined();
    for (const word of words as string[]) {
      expect(entry!.注意点, `pairId ${pairId} に「${word}」の論点が無い`).toContain(word);
    }
  });

  it('色の5語は、色を表す札としてそろえる論点を持つ', () => {
    for (const pairId of [15, 16, 17, 18, 19]) {
      expect(byId.get(pairId)!.注意点).toContain('名詞ではなく色');
    }
  });

  it('22 ぎゅうにゅう は、まだ正式採用ではないと書いてある', () => {
    expect(byId.get(22)!.注意点).toContain('正式採用ではない');
  });
});

describe('国紹介から切り離されていること', () => {
  it('チェックリスト本文が、FactClaim と別物だと明記している', () => {
    for (const phrase of [
      '語彙は国紹介の `FactClaim` **ではありません**',
      '国紹介の `canPublish()` に**影響しません**',
      '日本の `publicationStatus` に**影響しません**',
      '国紹介は**自動で公開されません**',
      '国紹介の `checkedAt` は**別の記録**',
      '`body-checked` / `rejected` / `withdrawn` という名前は**使いません**',
    ]) {
      expect(checklist, `「${phrase}」が書かれていない`).toContain(phrase);
    }
  });

  it('国紹介の状態がこの工程で変わっていない', () => {
    const japan = COUNTRY_INTROS[0];
    const all = allClaims(japan);
    const count = (v: string) => all.filter((c) => c.verification === v).length;

    expect(COUNTRY_INTROS).toHaveLength(1);
    expect(japan.publicationStatus).toBe('draft');
    expect(all).toHaveLength(46);
    expect(count('body-checked')).toBe(15);
    expect(count('unchecked')).toBe(1);
    expect(count('rejected')).toBe(2);
    expect(count('withdrawn')).toBe(28);
    expect(japan.sources).toHaveLength(28);
    expect(japan.sources.filter((s) => s.verification === 'body-checked')).toHaveLength(19);
    expect(japan.sources.filter((s) => s.verification === 'url-only')).toHaveLength(9);

    // あいさつは未確認のまま。
    const greeting = all.find((c) => c.id === 'jp-claim-greeting-hello');
    expect(greeting?.verification).toBe('unchecked');

    // 語彙の台帳を足しても、国紹介は公開されない。
    expect(canPublish(japan)).toBe(false);
    expect(showsDetails(japan)).toBe(false);
    expect(showsDetails(japan) ? visibleClaims(japan).length : 0).toBe(0);
  });
});
