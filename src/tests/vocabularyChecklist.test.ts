import { describe, expect, it } from 'vitest';
import checklist from '../../docs/reports/VOCABULARY_CHECKLIST.md?raw';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import { VOCABULARY_SETS, findVocabularySet } from '../data/vocabularySets';
import { COURSES } from '../data/courses';
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

const COMMON_SET_PAIR_IDS = [...findVocabularySet('common-practice')!.pairIds];
const ENTRIES = parseChecklist(checklist);
const byId = new Map(ENTRIES.map((e) => [e.pairId, e]));

describe('語彙確認チェックリストの形', () => {
  it('90語あり、使用中85語・候補5語に分かれる', () => {
    expect(ENTRIES).toHaveLength(90);
    expect(inGame(ENTRIES)).toHaveLength(85);
    expect(notInGame(ENTRIES)).toHaveLength(5);
    expect(notInGame(ENTRIES).map((e) => e.pairId)).toEqual([12, 20, 22, 25, 27]);
  });

  it('日本語・英語に重複がない', () => {
    expect(new Set(ENTRIES.map((e) => e.ja)).size).toBe(90);
    expect(new Set(ENTRIES.map((e) => e.en)).size).toBe(90);
  });

  it('2軸の内訳が 83・0・2・5 になる', () => {
    const verifiedInGame = inGame(ENTRIES).filter((e) => e.状態 === '確認済み');
    const verifiedOnly = notInGame(ENTRIES).filter((e) => e.状態 === '確認済み');
    const pendingInGame = inGame(ENTRIES).filter((e) => e.状態 !== '確認済み');
    const pendingOnly = notInGame(ENTRIES).filter((e) => e.状態 !== '確認済み');
    expect(verifiedInGame).toHaveLength(83);
    // 確認済みなのにゲームへ入れていない語は、もう残っていない。
    expect(verifiedOnly).toHaveLength(0);
    expect(pendingInGame).toHaveLength(2);
    expect(pendingOnly).toHaveLength(5);
    expect(pendingInGame.map((e) => e.pairId)).toEqual([8, 10]);
    expect(pendingOnly.map((e) => e.pairId)).toEqual([12, 20, 22, 25, 27]);
  });

  it('pairId は 1〜90 で重複しない', () => {
    const ids = ENTRIES.map((e) => e.pairId);
    expect(new Set(ids).size).toBe(90);
    expect([...ids].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 90 }, (_, i) => i + 1),
    );
  });

  it('全語に 種類・品詞・注意点 がある', () => {
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
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
];
const PENDING_IDS = [8, 10, 12, 20, 22, 25, 27];
/** 工程V-2F-1で台帳へ足した接客・飲食・宿泊の15語。まだゲームには入れていない。 */
const HOSPITALITY_IDS = [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
const HOSPITALITY_WORDS: [number, string, string, string, string][] = [
  [76, 'メニュー', 'menu', '飲食', '名詞'],
  [77, 'テーブル', 'table', '飲食・家具', '名詞'],
  [78, 'スプーン', 'spoon', '飲食・道具', '名詞'],
  [79, 'フォーク', 'fork', '飲食・道具', '名詞'],
  [80, 'ナイフ', 'knife', '飲食・道具', '名詞'],
  [81, 'おさら', 'plate', '飲食・道具', '名詞'],
  [82, 'タオル', 'towel', '宿泊・持ち物', '名詞'],
  [83, 'ベッド', 'bed', '宿泊・家具', '名詞'],
  [84, 'へや', 'room', '宿泊・場所', '名詞'],
  [85, 'シャワー', 'shower', '宿泊・設備', '名詞'],
  [86, 'エレベーター', 'elevator', '建物・設備', '名詞'],
  [87, 'まつ', 'wait', '接客・動作', '動詞'],
  [88, 'はこぶ', 'carry', '接客・動作', '動詞'],
  [89, 'あける', 'open', '接客・動作', '動詞'],
  [90, 'しめる', 'close', '接客・動作', '動詞'],
];
/** 接客15語の表記。カタカナ9語・ひらがな6語。 */
const HOSPITALITY_KATAKANA = [76, 77, 78, 79, 80, 82, 83, 85, 86];
const HOSPITALITY_HIRAGANA = [81, 84, 87, 88, 89, 90];
/** 物・場所・設備を表す名詞11語と、接客場面で見える動作4語。 */
const HOSPITALITY_NOUN_IDS = [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86];
const HOSPITALITY_VERB_IDS = [87, 88, 89, 90];
/** 工程V-2D-2で台帳へ足し、工程V-2D-3でゲームへ入れた日常語彙15語。 */
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
/** 工程V-2D-4で台帳へ足し、工程V-2D-5でゲームへ入れた旅行語彙15語。 */
const TRAVEL_IDS = [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60];
const TRAVEL_WORDS: [number, string, string][] = [
  [46, 'でんしゃ', 'train'],
  [47, 'バス', 'bus'],
  [48, 'ひこうき', 'airplane'],
  [49, 'タクシー', 'taxi'],
  [50, 'ホテル', 'hotel'],
  [51, 'きっぷ', 'ticket'],
  [52, 'パスポート', 'passport'],
  [53, 'ちず', 'map'],
  [54, 'くうこう', 'airport'],
  [55, 'えき', 'station'],
  [56, 'スーツケース', 'suitcase'],
  [57, 'かぎ', 'key'],
  [58, 'さいふ', 'wallet'],
  [59, 'カメラ', 'camera'],
  [60, 'レストラン', 'restaurant'],
];
/** 旅行語彙のうち、カタカナで書く語とひらがなで書く語。 */
const TRAVEL_KATAKANA = [47, 49, 50, 52, 56, 59, 60];
const TRAVEL_HIRAGANA = [46, 48, 51, 53, 54, 55, 57, 58];
/** 工程V-2D-6で台帳へ足し、工程V-2D-7でゲームへ入れた学校語彙15語。 */
const SCHOOL_IDS = [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75];
const SCHOOL_WORDS: [number, string, string][] = [
  [61, 'がっこう', 'school'],
  [62, 'せんせい', 'teacher'],
  [63, 'せいと', 'student'],
  [64, 'きょうしつ', 'classroom'],
  [65, 'こくばん', 'blackboard'],
  [66, 'けしゴム', 'eraser'],
  [67, 'ものさし', 'ruler'],
  [68, 'ペン', 'pen'],
  [69, 'クレヨン', 'crayon'],
  [70, 'きょうかしょ', 'textbook'],
  [71, 'としょかん', 'library'],
  [72, 'じしょ', 'dictionary'],
  [73, 'ロッカー', 'locker'],
  [74, 'コンピューター', 'computer'],
  [75, 'ページ', 'page'],
];
/** 学校語彙の表記。けしゴム だけ、ひらがなとカタカナが混ざる。 */
const SCHOOL_HIRAGANA = [61, 62, 63, 64, 65, 67, 70, 71, 72];
const SCHOOL_KATAKANA = [68, 69, 73, 74, 75];
const SCHOOL_MIXED = [66];
/** 英語に別の意味が無いと決めつける書き方。条件2で使ってはいけない。 */
const NEGATIONS = [
  '意味は無い',
  '意味はない',
  '意味がない',
  '意味が無い',
  '意味はありません',
  '他の意味を持たない',
  'ほかの意味を持たない',
  'ほかの意味はない',
  '別の意味はない',
  '別の意味は無い',
];
const COLOR_IDS = [3, 15, 16, 17, 18, 19];
const VERB_IDS = [28, 29, 30, 42, 43, 44, 45, 87, 88, 89, 90];
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

  it('確認済み83語・要確認7語が、指定の集合と完全に一致する', () => {
    expect(verified.map((e) => e.pairId)).toEqual(VERIFIED_IDS);
    expect(pending.map((e) => e.pairId)).toEqual(PENDING_IDS);
    expect(verified).toHaveLength(83);
    expect(pending).toHaveLength(7);
    expect(ENTRIES).toHaveLength(90);
  });

  it('状態別・方法別の件数が合っている', () => {
    expect(pending.filter((e) => e.状態 === '要確認（使用中）').map((e) => e.pairId)).toEqual([8, 10]);
    expect(pending.filter((e) => e.状態 === '要確認（候補）').map((e) => e.pairId))
      .toEqual([12, 20, 22, 25, 27]);
    expect(verified.filter((e) => e.確認の方法 === '基本語判断')).toHaveLength(83);
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
      '- pairId 1〜90 は**振り直しません**',
      '欠番として残してかまいません',
      '| 正本URLを直接開いた | はい |',
      '### 2-1. 「使用中かどうか」と「確認したかどうか」は別です',
      '「ゲームの語はすべて確認済み」ではありません。',
      '### 7-1. コースとの関係',
      '## 8. 90語の確認台帳',
      '**確認状態は、どのセットに入っているかとは別の軸です。**',
      '**同じ語が複数のセットに入ることがあります。**',
      '**学校のセットは、学年別の難易度を保証するものではありません。**',
      '**高校生・大学生は `common-practice` のまま**です。',
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

  it('15語とも 使用中・確認済み・基本語判断・採用 になっている', () => {
    for (const pairId of DAILY_IDS) {
      const entry = byId.get(pairId)!;
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${pairId} の確認の方法`).toBe('基本語判断');
      expect(entry.判定, `${pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${pairId} の確認日`).toBe('2026-09-21');
      // 工程V-2D-3でゲームへ入れた。台帳の区分も使用中になっている。
      expect(entry.使用状況, `${pairId} の使用状況`).toBe('使用中');
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語`).toBe(entry.ja);
      expect(pair!.en, `${pairId} の英語`).toBe(entry.en);
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
      for (const word of NEGATIONS) {
        expect(value, `${pairId} の条件2に断定がある`).not.toContain(word);
      }
    }
  });

  it('条件4は、台帳の全語を見たうえで書いてある', () => {
    // 「日本語に同音語が無い」ではなく「この台帳の75語に無い」と書く。
    const readings = new Map<string, number[]>();
    for (const entry of ENTRIES) {
      readings.set(entry.ja, [...(readings.get(entry.ja) ?? []), entry.pairId]);
    }
    for (const pairId of [...DAILY_IDS, ...TRAVEL_IDS, ...SCHOOL_IDS]) {
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

describe('工程V-2D-4で足した旅行語彙15語', () => {
  it('pairId・日本語・英語が、指定の表と完全に一致する', () => {
    for (const [pairId, ja, en] of TRAVEL_WORDS) {
      const entry = byId.get(pairId);
      expect(entry, `pairId ${pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `${pairId} の日本語`).toBe(ja);
      expect(entry!.en, `${pairId} の英語`).toBe(en);
    }
  });

  it('15語とも 使用中・確認済み・基本語判断・採用 になっている', () => {
    for (const pairId of TRAVEL_IDS) {
      const entry = byId.get(pairId)!;
      // 工程V-2D-5でゲームへ入れた。台帳の区分も使用中になっている。
      expect(entry.使用状況, `${pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${pairId} の確認の方法`).toBe('基本語判断');
      expect(entry.判定, `${pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${pairId} の確認日`).toBe('2026-09-21');
    }
  });

  it('15語とも 資料名・URL・正本確認欄が空', () => {
    for (const pairId of TRAVEL_IDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認した資料, `${pairId} の資料名`).toBe('');
      expect(entry.URL, `${pairId} のURL`).toBe('');
      expect(entry.直接確認, `${pairId} の正本確認欄`).toBe('');
    }
  });

  it('15語とも条件3が 名詞の単数形', () => {
    for (const pairId of TRAVEL_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('名詞の単数形');
    }
  });

  it('条件2は、その語で採る意味を限定し、別の意味を否定していない', () => {
    for (const pairId of TRAVEL_IDS) {
      const value = byId.get(pairId)!.条件.get(2) ?? '';
      expect(value, `${pairId} の条件2が意味を限定していない`).toContain('この札で採用する');
      expect(value, `${pairId} の条件2が扱う範囲を書いていない`)
        .toContain('この札では扱わない');
      for (const word of NEGATIONS) {
        expect(value, `${pairId} の条件2に断定がある`).not.toContain(word);
      }
    }
  });

  it('外来語7語はカタカナ、ほか8語はひらがな', () => {
    for (const pairId of TRAVEL_KATAKANA) {
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('カタカナ');
      expect(byId.get(pairId)!.ja, `${pairId} の日本語`).toMatch(/^[ァ-ヶー]+$/);
    }
    for (const pairId of TRAVEL_HIRAGANA) {
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('ひらがな');
      expect(byId.get(pairId)!.ja, `${pairId} の日本語`).toMatch(/^[ぁ-ん]+$/);
    }
    expect([...TRAVEL_KATAKANA, ...TRAVEL_HIRAGANA].sort((a, b) => a - b)).toEqual(TRAVEL_IDS);
  });

  it('15語の条件と確認内容を使い回していない', () => {
    const entries = TRAVEL_IDS.map((id) => byId.get(id)!);
    for (const number of [1, 2, 4, 5]) {
      const rows = entries.map((e) => e.条件.get(number) ?? '');
      expect(new Set(rows).size, `条件${number} が使い回されている`).toBe(rows.length);
    }
    expect(new Set(entries.map((e) => e.確認した内容)).size).toBe(entries.length);
  });

  it('ゲームデータと共通セットの、同じ番号の語と一致する', () => {
    for (const pairId of TRAVEL_IDS) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語`).toBe(byId.get(pairId)!.ja);
      expect(pair!.en, `${pairId} の英語`).toBe(byId.get(pairId)!.en);
      expect(
        COMMON_SET_PAIR_IDS.includes(pairId),
        `${pairId} が common-practice に無い`,
      ).toBe(true);
    }
    // 資料確認待ちの5語だけが、いまも台帳の外にいる。
    for (const pairId of [12, 20, 22, 25, 27]) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId)).toBe(false);
      expect(COMMON_SET_PAIR_IDS.includes(pairId)).toBe(false);
    }
  });
});

describe('工程V-2D-6で足した学校語彙15語', () => {
  it('pairId・日本語・英語が、指定の表と完全に一致する', () => {
    for (const [pairId, ja, en] of SCHOOL_WORDS) {
      const entry = byId.get(pairId);
      expect(entry, `pairId ${pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `${pairId} の日本語`).toBe(ja);
      expect(entry!.en, `${pairId} の英語`).toBe(en);
    }
  });

  it('15語とも 使用中・確認済み・基本語判断・採用 になっている', () => {
    for (const pairId of SCHOOL_IDS) {
      const entry = byId.get(pairId)!;
      // 工程V-2D-7でゲームへ入れた。台帳の区分も使用中になっている。
      expect(entry.使用状況, `${pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${pairId} の確認の方法`).toBe('基本語判断');
      expect(entry.判定, `${pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${pairId} の確認日`).toBe('2026-09-21');
    }
  });

  it('15語とも 資料名・URL・正本確認欄が空', () => {
    for (const pairId of SCHOOL_IDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認した資料, `${pairId} の資料名`).toBe('');
      expect(entry.URL, `${pairId} のURL`).toBe('');
      expect(entry.直接確認, `${pairId} の正本確認欄`).toBe('');
    }
  });

  it('15語とも条件3が 名詞の単数形', () => {
    for (const pairId of SCHOOL_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('名詞の単数形');
    }
  });

  it('条件2は、その語で採る意味を限定し、別の意味を否定していない', () => {
    for (const pairId of SCHOOL_IDS) {
      const value = byId.get(pairId)!.条件.get(2) ?? '';
      expect(value, `${pairId} の条件2が意味を限定していない`).toContain('この札で採用する');
      expect(value, `${pairId} の条件2が扱う範囲を書いていない`)
        .toContain('この札では扱わない');
      for (const word of NEGATIONS) {
        expect(value, `${pairId} の条件2に断定がある`).not.toContain(word);
      }
    }
  });

  it('ひらがな9語・カタカナ5語・混在1語が指定どおり', () => {
    for (const pairId of SCHOOL_HIRAGANA) {
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('ひらがな');
      expect(byId.get(pairId)!.ja, `${pairId} の日本語`).toMatch(/^[ぁ-ん]+$/);
    }
    for (const pairId of SCHOOL_KATAKANA) {
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('カタカナ');
      expect(byId.get(pairId)!.ja, `${pairId} の日本語`).toMatch(/^[ァ-ヶー]+$/);
    }
    // けしゴム は、ひらがなとカタカナを混ぜたまま採用した語。
    for (const pairId of SCHOOL_MIXED) {
      const entry = byId.get(pairId)!;
      expect(entry.条件.get(5), `${pairId} の条件5`).toContain('ひらがなとカタカナを混ぜた');
      expect(entry.ja, `${pairId} の日本語`).toMatch(/^[ぁ-ん]+[ァ-ヶー]+$/);
      expect(entry.ja, `${pairId} がひらがなだけになっている`).not.toMatch(/^[ぁ-ん]+$/);
    }
    expect([...SCHOOL_HIRAGANA, ...SCHOOL_KATAKANA, ...SCHOOL_MIXED].sort((a, b) => a - b))
      .toEqual(SCHOOL_IDS);
    expect(SCHOOL_HIRAGANA).toHaveLength(9);
    expect(SCHOOL_KATAKANA).toHaveLength(5);
    expect(SCHOOL_MIXED).toHaveLength(1);
  });

  it('15語の条件と確認内容を使い回していない', () => {
    const entries = SCHOOL_IDS.map((id) => byId.get(id)!);
    for (const number of [1, 2, 4, 5]) {
      const rows = entries.map((e) => e.条件.get(number) ?? '');
      expect(new Set(rows).size, `条件${number} が使い回されている`).toBe(rows.length);
    }
    expect(new Set(entries.map((e) => e.確認した内容)).size).toBe(entries.length);
  });

  it('ゲームデータと共通セットの、同じ番号の語と一致する', () => {
    for (const pairId of SCHOOL_IDS) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語`).toBe(byId.get(pairId)!.ja);
      expect(pair!.en, `${pairId} の英語`).toBe(byId.get(pairId)!.en);
      expect(
        COMMON_SET_PAIR_IDS.includes(pairId),
        `${pairId} が common-practice に無い`,
      ).toBe(true);
    }
    // 資料確認待ちの5語だけが、いまもゲームの外にいる。
    for (const pairId of [12, 20, 22, 25, 27]) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId)).toBe(false);
      expect(COMMON_SET_PAIR_IDS.includes(pairId)).toBe(false);
    }
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
    expect(SAMPLE_PAIRS).toHaveLength(85);
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

  it('ゲームの85語は、台帳の同じ番号の語と完全一致する（採用でも表記は変わらない）', () => {
    expect(SAMPLE_PAIRS).toHaveLength(85);
    // 台帳は90語。資料確認待ちの5語だけがゲームの外にいる。
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).not.toContain(12);
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
    expect(stillCandidates.map((e) => e.pairId)).toEqual([12, 20, 22, 25, 27]);
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

describe('工程V-2F-1で確認し、工程V-2F-2でゲームへ入れた接客・飲食・宿泊の15語', () => {
  const entries = HOSPITALITY_IDS.map((id) => byId.get(id)!);

  it('pairId 76〜90 が連番でそろっている', () => {
    expect(HOSPITALITY_IDS).toEqual(Array.from({ length: 15 }, (_, i) => i + 76));
    for (const pairId of HOSPITALITY_IDS) {
      expect(byId.get(pairId), `pairId ${pairId} が台帳に無い`).toBeDefined();
    }
    // 予約欠番は埋めない。
    for (const pairId of [12, 20, 22, 25, 27]) {
      expect(byId.get(pairId)!.使用状況, `${pairId} が使用中になっている`).toBe('候補');
      expect(byId.get(pairId)!.状態, `${pairId} の状態`).toBe('要確認（候補）');
    }
  });

  it('日本語・英語・種類・品詞が、指定の表と完全に一致する', () => {
    for (const [pairId, ja, en, kind, pos] of HOSPITALITY_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.ja, `${pairId} の日本語`).toBe(ja);
      expect(entry.en, `${pairId} の英語`).toBe(en);
      expect(entry.種類, `${pairId} の種類`).toBe(kind);
      expect(entry.品詞, `${pairId} の品詞`).toBe(pos);
    }
  });

  it('15語とも 使用中・確認済み・基本語判断・採用 になっている', () => {
    for (const entry of entries) {
      // 工程V-2F-2でゲームへ入れた。確認記録そのものは V-2F-1 のまま。
      expect(entry.使用状況, `${entry.pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${entry.pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${entry.pairId} の確認の方法`).toBe('基本語判断');
      expect(entry.判定, `${entry.pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${entry.pairId} の確認日`).toBe('2026-09-22');
    }
  });

  it('15語とも 資料名・URL・正本確認欄が空', () => {
    // 基本語判断なので、外部資料を確認したようには書かない。
    for (const entry of entries) {
      expect(entry.確認した資料, `${entry.pairId} の資料名`).toBe('');
      expect(entry.URL, `${entry.pairId} のURL`).toBe('');
      expect(entry.直接確認, `${entry.pairId} の正本確認欄`).toBe('');
    }
  });

  it('5条件が5行そろい、どの行も中身が空でない', () => {
    for (const entry of entries) {
      expect(
        [...entry.条件.keys()].sort((a, b) => a - b),
        `${entry.pairId} の条件の番号がそろっていない`,
      ).toEqual([1, 2, 3, 4, 5]);
      for (const [number, name] of CONDITION_NAMES) {
        const [label, value] = (entry.条件.get(number) ?? '').split('\t');
        expect(label, `${entry.pairId} の条件${number}の見出し`).toBe(name);
        expect(
          value.replace('適合：', '').trim().length,
          `${entry.pairId} の条件${number}に中身が無い`,
        ).toBeGreaterThan(5);
      }
      expect(entry.確認した内容.length, `${entry.pairId} の判断理由が短すぎる`).toBeGreaterThan(40);
    }
  });

  it('15語の条件と確認内容を使い回していない', () => {
    for (const number of [1, 2, 3, 4, 5]) {
      const rows = entries.map((e) => e.条件.get(number) ?? '');
      expect(new Set(rows).size, `条件${number} が使い回されている`).toBe(rows.length);
    }
    expect(new Set(entries.map((e) => e.確認した内容)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.注意点)).size).toBe(entries.length);
  });

  it('条件2は、その語で採る意味を限定し、別の意味を否定していない', () => {
    for (const entry of entries) {
      const value = entry.条件.get(2) ?? '';
      expect(value, `${entry.pairId} の条件2が意味を限定していない`).toContain('この札で採用する');
      expect(value, `${entry.pairId} の条件2が扱う範囲を書いていない`).toContain('この札では');
      for (const word of NEGATIONS) {
        expect(value, `${entry.pairId} の条件2に断定がある`).not.toContain(word);
      }
    }
  });

  it('多義語について「ほかの意味が無い」と書いていない', () => {
    // 指定された誤った断定が、台帳のどこにも入っていないこと。
    for (const phrase of [
      'fork には食器以外の意味がない',
      'fork に食器以外の意味はない',
      'table には家具以外の意味がない',
      'plate には皿以外の意味がない',
      'room には部屋以外の意味がない',
      'open は動詞以外に使われない',
      'close は動詞以外に使われない',
      '同音語は無い',
      '同じ読みの語は存在しない',
    ]) {
      expect(checklist, `「${phrase}」という断定がある`).not.toContain(phrase);
    }
  });

  it('多義語・同音語の論点を、隠さず注意点に残している', () => {
    const POINTS: [number, string[]][] = [
      [76, ['menu']],
      [77, ['表']],
      [79, ['fork']],
      [81, ['プレート']],
      [83, ['bed']],
      [84, ['余地']],
      [85, ['shower']],
      [86, ['lift']],
      [87, ['松']],
      [88, ['carry']],
      [89, ['明ける']],
      [90, ['締める']],
    ];
    for (const [pairId, words] of POINTS) {
      for (const word of words) {
        expect(byId.get(pairId)!.注意点, `${pairId} に「${word}」の論点が無い`).toContain(word);
      }
    }
  });

  it('76〜86は名詞の単数形、87〜90は動詞の原形', () => {
    for (const pairId of HOSPITALITY_NOUN_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('名詞の単数形');
    }
    for (const pairId of HOSPITALITY_VERB_IDS) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('動詞の原形');
    }
    expect([...HOSPITALITY_NOUN_IDS, ...HOSPITALITY_VERB_IDS]).toEqual(HOSPITALITY_IDS);
  });

  it('英語に複数形・過去形・進行形を混ぜていない', () => {
    // 語尾の形だけで判断すると bed のような語を誤って弾くので、
    // この15語について実際に起こりうる語形変化を並べて照合する。
    const INFLECTED = [
      'menus', 'tables', 'spoons', 'forks', 'knives', 'plates',
      'towels', 'beds', 'rooms', 'showers', 'elevators',
      'waits', 'waited', 'waiting',
      'carries', 'carried', 'carrying',
      'opens', 'opened', 'opening',
      'closes', 'closed', 'closing',
    ];
    for (const [pairId, , en] of HOSPITALITY_WORDS) {
      expect(INFLECTED, `${pairId} の英語が語形変化した形になっている（${en}）`)
        .not.toContain(en);
    }
    // 条件3の記録でも、変化した形をカードへ持ち込まないと書いてある。
    for (const entry of entries) {
      expect(entry.条件.get(3), `${entry.pairId} の条件3`).toContain('カードへ持ち込まない');
    }
  });

  it('カタカナ9語・ひらがな6語が指定どおり', () => {
    for (const pairId of HOSPITALITY_KATAKANA) {
      expect(byId.get(pairId)!.ja, `${pairId} の日本語`).toMatch(/^[ァ-ヶー]+$/);
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('カタカナ');
    }
    for (const pairId of HOSPITALITY_HIRAGANA) {
      expect(byId.get(pairId)!.ja, `${pairId} の日本語`).toMatch(/^[ぁ-ん]+$/);
      expect(byId.get(pairId)!.条件.get(5), `${pairId} の条件5`).toContain('ひらがな');
    }
    expect(HOSPITALITY_KATAKANA).toHaveLength(9);
    expect(HOSPITALITY_HIRAGANA).toHaveLength(6);
    expect([...HOSPITALITY_KATAKANA, ...HOSPITALITY_HIRAGANA].sort((a, b) => a - b))
      .toEqual(HOSPITALITY_IDS);
  });

  it('条件4は、更新後の台帳90語の範囲で書いてある', () => {
    for (const entry of entries) {
      expect(entry.条件.get(4), `${entry.pairId} の条件4が台帳の範囲で書かれていない`)
        .toContain(`この台帳の${ENTRIES.length}語`);
    }
    expect(ENTRIES).toHaveLength(90);
  });

  it('ゲームデータと共通セットの、同じ番号の語と一致する', () => {
    const common = findVocabularySet('common-practice')!;
    for (const [pairId, ja, en] of HOSPITALITY_WORDS) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語`).toBe(ja);
      expect(pair!.en, `${pairId} の英語`).toBe(en);
      expect(common.pairIds, `${pairId} が共通セットに無い`).toContain(pairId);
    }
    expect(SAMPLE_PAIRS).toHaveLength(85);
    // 共通セットの末尾15件が、昇順で 76〜90 になっている。
    expect([...common.pairIds].slice(-15)).toEqual(HOSPITALITY_IDS);
  });

  it('テーマ別のセットへは広げていない', () => {
    // 接客・観光の専用セットはまだ作っていない。旅行・学校のセットにも入れない。
    for (const setId of ['travel-practice', 'school-practice'] as const) {
      const set = findVocabularySet(setId)!;
      expect(set.pairIds, `${setId} の語数が変わっている`).toHaveLength(30);
      for (const pairId of HOSPITALITY_IDS) {
        expect(set.pairIds, `${pairId} が ${setId} に入っている`).not.toContain(pairId);
      }
    }
    expect(VOCABULARY_SETS).toHaveLength(3);
  });
});

describe('語彙セットと台帳の説明が食い違っていないこと', () => {
  const common = findVocabularySet('common-practice')!;
  const travel = findVocabularySet('travel-practice')!;
  const school = findVocabularySet('school-practice')!;
  const coursesUsing = (id: string) =>
    COURSES.filter((c) => c.vocabularySetId === id).map((c) => c.id);

  it('セットは3件で、共通85語・旅30語・学校30語', () => {
    expect(VOCABULARY_SETS).toHaveLength(3);
    expect(common.pairIds).toHaveLength(85);
    expect(travel.pairIds).toHaveLength(30);
    expect(school.pairIds).toHaveLength(30);
    expect(SAMPLE_PAIRS).toHaveLength(85);
  });

  it('旅・学校のセットの語は、すべて台帳で確認済み', () => {
    for (const [name, set] of [['旅', travel], ['学校', school]] as const) {
      for (const pairId of set.pairIds) {
        const entry = byId.get(pairId);
        expect(entry, `${name}: pairId ${pairId} が台帳に無い`).toBeDefined();
        expect(entry!.状態, `${name}: ${pairId}「${entry!.ja}」が確認済みでない`).toBe('確認済み');
        expect(entry!.使用状況, `${name}: ${pairId} が使用中でない`).toBe('使用中');
      }
    }
  });

  it('旅・学校のセットに、未確認の 8・10 と予約欠番5件が入っていない', () => {
    for (const [name, set] of [['旅', travel], ['学校', school]] as const) {
      for (const pairId of [8, 10, 12, 20, 22, 25, 27]) {
        expect(set.pairIds, `${pairId} が${name}のセットに入っている`).not.toContain(pairId);
      }
    }
    // 8・10 は共通セットでは使用中のまま。外したことは削除ではない。
    for (const pairId of [8, 10]) {
      expect(common.pairIds, `${pairId} が共通セットから消えている`).toContain(pairId);
      expect(byId.get(pairId)!.使用状況).toBe('使用中');
      expect(byId.get(pairId)!.状態).toBe('要確認（使用中）');
    }
  });

  it('共通21コース・旅1コース・学校2コース', () => {
    expect(coursesUsing('common-practice')).toHaveLength(21);
    expect(coursesUsing('travel-practice')).toEqual(['biz-travel']);
    expect(coursesUsing('school-practice')).toEqual(['grade-elementary', 'grade-junior']);
    // 台帳の表に書いた語数・件数と、実データが一致していること。
    const row = (label: string, id: string, courses: string) =>
      `| \`${id}\`（${label}） | ${findVocabularySet(id)!.pairIds.length}語 | `
      + `${id === 'common-practice' ? `ゲーム内${SAMPLE_PAIRS.length}語すべて` : id === 'travel-practice' ? '旅の場面の語' : '学校の場面の語'}`
      + ` | ${courses} | ${coursesUsing(id).length} |`;
    expect(checklist).toContain(row('共通の練習用ことば', 'common-practice', '下の2セット以外のすべて'));
    expect(checklist).toContain(row('旅のことば', 'travel-practice', '海外旅行'));
    expect(checklist).toContain(row('学校のことば', 'school-practice', '小学生・中学生'));
  });

  it('学校のセットを難易度の保証として書いていない', () => {
    expect(checklist).toContain('**学校のセットは、学年別の難易度を保証するものではありません。**');
    for (const phrase of ['難易度確認済み', '学習指導要領', '学年別に確認']) {
      expect(checklist, `「${phrase}」と読める説明がある`).not.toContain(phrase);
    }
  });

  it('古いコース数・セット数の説明が残っていない', () => {
    for (const phrase of [
      '全24コースが、いまこのセットを参照しています。',
      'コースごとに違うことばを出す仕組みは、まだ作っていません。',
      '| それ以外のすべて | `common-practice`（70語） | 23 |',
      '語彙セットは2件',
      '共通23コース',
    ]) {
      expect(checklist, `古い説明「${phrase}」が残っている`).not.toContain(phrase);
    }
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
