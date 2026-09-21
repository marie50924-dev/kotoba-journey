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
  /** 台帳上の使用状況。見出しが「現在の日本語」なら使用中、「日本語候補」なら候補。 */
  使用状況: '使用中' | '候補';
  確認の方法: string;
  判定: string;
  確認した資料: string;
  URL: string;
  直接確認: string;
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
  // 語数は増えるので、見出しの数字ではなく節番号で探す。
  const bodyStart = markdown.search(/\n## 8\. \d+語の確認台帳/);
  const bodyEnd = markdown.indexOf('\n## 9. この台帳を変えるときの決まり');
  expect(bodyStart, '「◯語の確認台帳」の節が無い').toBeGreaterThan(-1);
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
    const inUse = fields.has('現在の日本語');
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
      使用状況: inUse ? '使用中' : '候補',
      確認の方法: fields.get('確認の方法') ?? '',
      判定: fields.get('判定') ?? '',
      確認した資料: fields.get('確認した資料') ?? '',
      URL: fields.get('URL') ?? '',
      直接確認: fields.get('正本URLを直接開いた') ?? '',
      確認した内容: fields.get('確認した内容') ?? '',
      確認日: fields.get('確認日') ?? '',
      注意点: fields.get('注意点') ?? '',
      条件: conditions,
    };
  });
}

const ENTRIES = parseChecklist(checklist);
const byId = new Map(ENTRIES.map((e) => [e.pairId, e]));

describe('語彙確認チェックリストの形', () => {
  it('45語あり、使用中25語・候補20語に分かれる', () => {
    expect(ENTRIES).toHaveLength(45);
    expect(inGame(ENTRIES)).toHaveLength(25);
    expect(notInGame(ENTRIES)).toHaveLength(20);
    expect(notInGame(ENTRIES).map((e) => e.pairId))
      .toEqual([12, 20, 22, 25, 27, ...DAILY_IDS]);
  });

  it('日本語・英語に重複がない', () => {
    expect(new Set(ENTRIES.map((e) => e.ja)).size).toBe(45);
    expect(new Set(ENTRIES.map((e) => e.en)).size).toBe(45);
  });

  it('2軸の内訳が 23・15・2・5 になる', () => {
    const verifiedInGame = inGame(ENTRIES).filter((e) => e.状態 === '確認済み');
    const verifiedOnly = notInGame(ENTRIES).filter((e) => e.状態 === '確認済み');
    const pendingInGame = inGame(ENTRIES).filter((e) => e.状態 !== '確認済み');
    const pendingOnly = notInGame(ENTRIES).filter((e) => e.状態 !== '確認済み');
    expect(verifiedInGame).toHaveLength(23);
    expect(verifiedOnly).toHaveLength(15);
    expect(pendingInGame).toHaveLength(2);
    expect(pendingOnly).toHaveLength(5);
    expect(verifiedOnly.map((e) => e.pairId)).toEqual(DAILY_IDS);
    expect(pendingInGame.map((e) => e.pairId)).toEqual([8, 10]);
    expect(pendingOnly.map((e) => e.pairId)).toEqual([12, 20, 22, 25, 27]);
  });

  it('pairId は 1〜45 で重複しない', () => {
    const ids = ENTRIES.map((e) => e.pairId);
    expect(new Set(ids).size).toBe(45);
    expect([...ids].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 45 }, (_, i) => i + 1),
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
const WORD_FORMS = ['名詞の単数形', '名詞（不可算）', '動詞の原形', '色'];
/** 今回まとめて基本語判断で確認した語と、確認を残した語。 */
const VERIFIED_IDS = [
  1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 17, 18, 19, 21, 23, 24, 26, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
];
const PENDING_IDS = [8, 10, 12, 20, 22, 25, 27];
/** 工程V-2D-2で足した日常語彙15語。まだゲームには入れていない。 */
const DAILY_IDS = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45];
const DAILY_WORDS: [number, string, string][] = [
  [31, 'かお', 'face'],
  [32, 'て', 'hand'],
  [33, 'め', 'eye'],
  [34, 'みみ', 'ear'],
  [35, 'くち', 'mouth'],
  [36, 'かさ', 'umbrella'],
  [37, 'つくえ', 'desk'],
  [38, 'いす', 'chair'],
  [39, 'まど', 'window'],
  [40, 'ドア', 'door'],
  [41, 'えんぴつ', 'pencil'],
  [42, 'あるく', 'walk'],
  [43, 'およぐ', 'swim'],
  [44, 'うたう', 'sing'],
  [45, 'わらう', 'laugh'],
];
const COLOR_IDS = [3, 15, 16, 17, 18, 19];
const VERB_IDS = [28, 29, 30, 42, 43, 44, 45];
const UNCOUNTABLE_IDS = [7];
const COUNTABLE_NOUN_IDS = VERIFIED_IDS.filter(
  (id) => ![...COLOR_IDS, ...VERB_IDS, ...UNCOUNTABLE_IDS].includes(id),
);

/** ゲームデータに入っている語／入っていない語。 */
const inGame = (entries: ChecklistEntry[]) =>
  entries.filter((e) => SAMPLE_PAIRS.some((p) => p.pairId === e.pairId));
const notInGame = (entries: ChecklistEntry[]) =>
  entries.filter((e) => !SAMPLE_PAIRS.some((p) => p.pairId === e.pairId));
/** 基本語判断の5条件。番号と見出しの対応。 */
/**
 * 条件3から語形を取り出す。
 * 語形は「適合：」のすぐ後ろに書く決まりなので、含まれるかではなく先頭で見る。
 * 「色（名詞にも形容詞にもせず…）」のように説明が続いても正しく読める。
 */
function wordForm(entry: ChecklistEntry): string {
  const value = (entry.条件.get(3) ?? '').split('\t')[1] ?? '';
  const body = value.replace('適合：', '');
  return WORD_FORMS.find((form) => body.startsWith(form)) ?? '';
}

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
      const expected = entry.使用状況 === '使用中' ? '要確認（使用中）' : '要確認（候補）';
      expect(entry.状態, `${entry.pairId} の状態`).toBe(expected);
      expect(entry.確認の方法, `${entry.pairId} の確認の方法`).toBe('');
      expect(entry.判定, `${entry.pairId} の判定`).toBe('');
      expect(entry.確認した資料, `${entry.pairId} の確認した資料`).toBe('');
      expect(entry.URL, `${entry.pairId} のURL`).toBe('');
      expect(entry.直接確認, `${entry.pairId} の直接確認`).toBe('');
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

  it('資料確認の語は、資料名と、直接開いた正本URLを持つ', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '資料確認')) {
      expect(entry.確認した資料, `${entry.pairId} の資料名が空`).not.toBe('');
      expect(entry.URL, `${entry.pairId} のURL`).toMatch(/^https:\/\//);
      // 台帳そのものを根拠にはできない。
      expect(entry.URL, `${entry.pairId} がこの台帳自身を資料にしている`)
        .not.toContain('VOCABULARY_CHECKLIST');
      // 検索結果に出ただけのURLを登録させない。
      expect(entry.直接確認, `${entry.pairId} の「正本URLを直接開いた」が はい でない`).toBe('はい');
      // 2つの道を混ぜない。
      expect(entry.条件.size, `${entry.pairId} は資料確認なのに基本語条件がある`).toBe(0);
    }
  });

  it('判定は、採用・修正・見送りのうち1つだけを選ぶ', () => {
    for (const entry of verified) {
      const chosen = ['採用', '修正', '見送り'].filter((v) => entry.判定.includes(v));
      expect(chosen, `${entry.pairId} の判定: ${entry.判定}`).toHaveLength(1);
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

  it('条件3・語形には、4種類のどれかを書く', () => {
    for (const entry of verified.filter((e) => e.確認の方法 === '基本語判断')) {
      expect(
        wordForm(entry),
        `${entry.pairId} の条件3に語形が書かれていない: ${entry.条件.get(3)}`,
      ).not.toBe('');
    }
  });

  it('数えられない名詞は「名詞の単数形」と書かない', () => {
    // みず / water は a water や waters の形にしないため、不可算名詞として記録する。
    for (const pairId of UNCOUNTABLE_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('名詞（不可算）');
    }
  });

  it('色6語は条件3に「色」を書く', () => {
    for (const pairId of COLOR_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('色');
    }
  });

  it('動詞3語は条件3に「動詞の原形」を書く', () => {
    for (const pairId of VERB_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('動詞の原形');
    }
  });

  it('数えられる名詞は条件3に「名詞の単数形」を書く', () => {
    for (const pairId of COUNTABLE_NOUN_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('名詞の単数形');
    }
  });

  it('同じ定型文を全語へ複製していない', () => {
    const basic = verified.filter((e) => e.確認の方法 === '基本語判断');
    for (const number of [1, 2, 3, 4, 5]) {
      const rows = basic.map((e) => e.条件.get(number) ?? '');
      // 条件3（語形）は4種類しかないので、そこだけは重複してよい。
      const unique = new Set(rows).size;
      const least = number === 3 ? 4 : rows.length;
      expect(unique, `条件${number} の書きぶりが使い回されている`).toBeGreaterThanOrEqual(least);
    }
    expect(new Set(basic.map((e) => e.確認した内容)).size).toBe(basic.length);
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

  it('確認済み38語・要確認7語が、指定の集合と完全に一致する', () => {
    expect(verified.map((e) => e.pairId)).toEqual(VERIFIED_IDS);
    expect(pending.map((e) => e.pairId)).toEqual(PENDING_IDS);
    expect(verified).toHaveLength(38);
    expect(pending).toHaveLength(7);
    expect(ENTRIES).toHaveLength(45);
  });

  it('状態別・方法別の件数が合っている', () => {
    expect(pending.filter((e) => e.状態 === '要確認（使用中）').map((e) => e.pairId)).toEqual([8, 10]);
    expect(pending.filter((e) => e.状態 === '要確認（候補）').map((e) => e.pairId))
      .toEqual([12, 20, 22, 25, 27]);
    expect(verified.filter((e) => e.確認の方法 === '基本語判断')).toHaveLength(38);
    expect(verified.filter((e) => e.確認の方法 === '資料確認')).toHaveLength(0);
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
      '| `名詞（不可算）` | 数えられない名詞 | みず / water |',
      '数えられない名詞を `名詞の単数形` と書いてはいけません。',
      'その語が英語でつねに不可算だと決めつけないでください。',
      '### 5-1. pairId は振り直しません',
      '- pairId 1〜45 は**振り直しません**',
      '欠番として残してかまいません',
      '| 正本URLを直接開いた | はい |',
      '### 2-1. 「使用中かどうか」と「確認したかどうか」は別です',
      '「ゲームの語はすべて確認済み」ではありません。',
      '### 7-1. コースとの関係',
      '## 8. 45語の確認台帳',
      '**全24コースが、いまこのセットを参照しています。**',
    ]) {
      expect(checklist, `「${phrase}」が書かれていない`).toContain(phrase);
    }
  });
});

describe('工程V-2D-2で足した日常語彙15語', () => {
  it('pairId・日本語・英語が、指定の表と完全に一致する', () => {
    for (const [pairId, ja, en] of DAILY_WORDS) {
      const entry = byId.get(pairId);
      expect(entry, `pairId ${pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `${pairId} の日本語`).toBe(ja);
      expect(entry!.en, `${pairId} の英語`).toBe(en);
    }
  });

  it('15語とも 候補・確認済み・基本語判断・採用 になっている', () => {
    for (const pairId of DAILY_IDS) {
      const entry = byId.get(pairId)!;
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${pairId} の確認の方法`).toBe('基本語判断');
      expect(entry.判定, `${pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${pairId} の確認日`).toBe('2026-09-21');
      // まだゲームに入れていない＝台帳上は候補。
      expect(
        SAMPLE_PAIRS.some((p) => p.pairId === pairId),
        `${pairId} がゲームデータに入っている`,
      ).toBe(false);
    }
  });

  it('15語とも 資料名・URL・正本確認欄が空', () => {
    for (const pairId of DAILY_IDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認した資料, `${pairId} の資料名`).toBe('');
      expect(entry.URL, `${pairId} のURL`).toBe('');
      expect(entry.直接確認, `${pairId} の正本確認欄`).toBe('');
    }
  });

  it('31〜41は名詞の単数形、42〜45は動詞の原形', () => {
    for (const pairId of DAILY_IDS) {
      const expected = pairId <= 41 ? '名詞の単数形' : '動詞の原形';
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe(expected);
    }
  });

  it('条件2は、その語で採る意味を限定し、別の意味を否定していない', () => {
    for (const pairId of DAILY_IDS) {
      const value = byId.get(pairId)!.条件.get(2) ?? '';
      expect(value, `${pairId} の条件2が意味を限定していない`).toContain('この札で採用する');
      expect(value, `${pairId} の条件2が扱う範囲を書いていない`)
        .toContain('この札では扱わない');
      // 英語に別の意味が存在しないという断定をしていない。
      for (const word of ['意味は無い', '意味はない', '他の意味を持たない']) {
        expect(value, `${pairId} の条件2に断定がある`).not.toContain(word);
      }
    }
  });

  it('条件4は、台帳の全語を見たうえで書いてある', () => {
    // 「日本語に同音語が無い」ではなく「この台帳の45語に無い」と書く。
    const readings = new Map<string, number[]>();
    for (const entry of ENTRIES) {
      readings.set(entry.ja, [...(readings.get(entry.ja) ?? []), entry.pairId]);
    }
    for (const pairId of DAILY_IDS) {
      const entry = byId.get(pairId)!;
      // 実データでも、同じ表記の語がほかに無いことを確かめる。
      expect(readings.get(entry.ja), `${pairId}「${entry.ja}」と同じ表記の語がある`)
        .toEqual([pairId]);
      expect(entry.条件.get(4), `${pairId} の条件4が台帳の範囲で書かれていない`)
        .toContain(`この台帳の${ENTRIES.length}語`);
    }
  });

  it('40 ドア だけカタカナ、ほかはひらがなのまま', () => {
    expect(byId.get(40)!.ja).toBe('ドア');
    expect(byId.get(40)!.条件.get(5)).toContain('カタカナ');
    for (const pairId of DAILY_IDS.filter((id) => id !== 40)) {
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('ひらがな');
    }
  });

  it('15語の条件と確認内容を使い回していない', () => {
    const entries = DAILY_IDS.map((id) => byId.get(id)!);
    for (const number of [1, 2, 4, 5]) {
      const rows = entries.map((e) => e.条件.get(number) ?? '');
      expect(new Set(rows).size, `条件${number} が使い回されている`).toBe(rows.length);
    }
    expect(new Set(entries.map((e) => e.確認した内容)).size).toBe(entries.length);
  });
});

describe('コードの実データとの照合', () => {
  it('ゲームデータの pairId は、台帳の同じ番号の語と一致する', () => {
    // pairId は振り直さない決まり。欠番を詰めて別の語へ割り当てると、
    // その番号で保存された過去の学習記録が別の語を指してしまう。
    // SAMPLE_PAIRS が将来増えても、この検査がそのまま効く。
    for (const pair of SAMPLE_PAIRS) {
      const entry = byId.get(pair.pairId);
      expect(entry, `pairId ${pair.pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `pairId ${pair.pairId} の日本語が台帳と違う`).toBe(pair.ja);
      expect(entry!.en, `pairId ${pair.pairId} の英語が台帳と違う`).toBe(pair.en);
    }
  });

  it('台帳の説明が、ゲームの実態から取り残されていない', () => {
    // 15語をゲームへ入れたのに「まだコードのどこにも入っていません」と
    // 書いたままにしてしまったことがある。説明文も実データで縛る。
    expect(checklist, '候補語が未実装だという古い説明が残っている')
      .not.toContain('まだコードのどこにも入っていません');
    const added = SAMPLE_PAIRS.filter((p) => p.pairId > 10).map((p) => p.pairId);
    expect(checklist, 'ゲームへ入れた語の一覧が台帳に書かれていない')
      .toContain(`ゲームへ入れた${added.length}語: ${added.join(', ')}`);
  });

  it('台帳の「使用中／候補」は、実際のゲームデータと合っている', () => {
    // 区分を手で書き換えても、実データと食い違えば落ちる。
    for (const entry of ENTRIES) {
      const isInGame = SAMPLE_PAIRS.some((p) => p.pairId === entry.pairId);
      expect(entry.使用状況 === '使用中', `${entry.pairId} の区分がゲームデータと違う`)
        .toBe(isInGame);
    }
    expect(SAMPLE_PAIRS).toHaveLength(25);
  });

  it('ゲームへ入れた語は、台帳で確認済みか、もとから使っていた語だけ', () => {
    // あとから足せるのは確認済みの語だけ。8・10 は Phase 0 から使っている未確認語。
    const LEGACY_UNVERIFIED = [8, 10];
    for (const pair of SAMPLE_PAIRS) {
      const entry = byId.get(pair.pairId)!;
      if (entry.状態 === '確認済み') continue;
      expect(LEGACY_UNVERIFIED, `未確認の ${pair.pairId} がゲームに入っている`)
        .toContain(pair.pairId);
    }
    // 未確認のまま使っているのは、その2語だけ。
    const unverifiedInGame = SAMPLE_PAIRS
      .filter((p) => byId.get(p.pairId)!.状態 !== '確認済み')
      .map((p) => p.pairId);
    expect(unverifiedInGame).toEqual(LEGACY_UNVERIFIED);
  });

  it('資料確認待ちの5語は、まだゲームへ入れていない', () => {
    for (const pairId of [12, 20, 22, 25, 27]) {
      expect(byId.get(pairId)!.状態, `${pairId} の状態`).toBe('要確認（候補）');
      expect(
        SAMPLE_PAIRS.some((p) => p.pairId === pairId),
        `未確認の ${pairId} がゲームに入っている`,
      ).toBe(false);
    }
  });

  it('見送りにした語は、ゲームデータへ入れない', () => {
    const dropped = ENTRIES.filter((e) => e.判定.includes('見送り')).map((e) => e.pairId);
    for (const pairId of dropped) {
      expect(
        SAMPLE_PAIRS.some((p) => p.pairId === pairId),
        `見送りの pairId ${pairId} がゲームデータにある`,
      ).toBe(false);
    }
  });

  it('ゲームの25語は、台帳の同じ番号の語と完全一致する（採用でも表記は変わらない）', () => {
    expect(SAMPLE_PAIRS).toHaveLength(25);
    // 台帳が45語になっても、ゲームへ入れたのは25語だけ。
    expect(SAMPLE_PAIRS.every((p) => p.pairId <= 30)).toBe(true);
    for (const pair of SAMPLE_PAIRS) {
      const entry = byId.get(pair.pairId);
      expect(entry, `pairId ${pair.pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `pairId ${pair.pairId} の日本語`).toBe(pair.ja);
      expect(entry!.en, `pairId ${pair.pairId} の英語`).toBe(pair.en);
    }
  });

  it('「候補」のままの語は、まだ SAMPLE_PAIRS に入っていない', () => {
    const usedJa = new Set(SAMPLE_PAIRS.map((p) => p.ja));
    const usedEn = new Set(SAMPLE_PAIRS.map((p) => p.en));
    const usedIds = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    const stillCandidates = notInGame(ENTRIES);
    expect(stillCandidates.map((e) => e.pairId)).toEqual([12, 20, 22, 25, 27, ...DAILY_IDS]);
    for (const entry of stillCandidates) {
      expect(usedIds.has(entry.pairId), `仮ID ${entry.pairId} が実データにある`).toBe(false);
      expect(usedJa.has(entry.ja), `候補「${entry.ja}」が実データにある`).toBe(false);
      expect(usedEn.has(entry.en), `候補「${entry.en}」が実データにある`).toBe(false);
    }
  });

  it('もとからの10語は変わっていない', () => {
    expect(SAMPLE_PAIRS.filter((p) => p.pairId <= 10).map((p) => [p.pairId, p.ja, p.en])).toEqual([
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
