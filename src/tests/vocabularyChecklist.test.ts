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
  /** 誰が本文を開いたか。資料確認の語だけが持つ。 */
  確認経路: string;
  確認した内容: string;
  確認日: string;
  注意点: string;
  /** 基本語判断の5条件。番号（1〜5）をそのまま持つ。 */
  条件: Map<number, string>;
  /**
   * 資料確認の5条件。番号（1〜5）をそのまま持つ。
   * 基本語判断の `条件` とは別の Map にしている。
   * 同じ入れ物にすると、資料を開かずに採用した語と、資料で確かめた語の
   * 区別が付かなくなるため（台帳 第3-1節）。
   */
  資料条件: Map<number, string>;
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
    const sourceConditions = new Map<number, string>();
    for (const [key, value] of fields) {
      const matched = key.match(/^基本語条件([1-5])・(.+)$/);
      if (matched) conditions.set(Number(matched[1]), `${matched[2]}\t${value}`);
      const sourceMatched = key.match(/^資料確認条件([1-5])・(.+)$/);
      if (sourceMatched) sourceConditions.set(Number(sourceMatched[1]), `${sourceMatched[2]}\t${value}`);
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
      確認経路: fields.get('本文確認の経路') ?? '',
      確認した内容: fields.get('確認した内容') ?? '',
      確認日: fields.get('確認日') ?? '',
      注意点: fields.get('注意点') ?? '',
      条件: conditions,
      資料条件: sourceConditions,
    };
  });
}

const COMMON_SET_PAIR_IDS = [...findVocabularySet('common-practice')!.pairIds];
const ENTRIES = parseChecklist(checklist);
const byId = new Map(ENTRIES.map((e) => [e.pairId, e]));

describe('語彙確認チェックリストの形', () => {
  it('90語あり、90語とも使用中（台帳だけの語は無い）', () => {
    expect(ENTRIES).toHaveLength(90);
    expect(inGame(ENTRIES)).toHaveLength(90);
    expect(notInGame(ENTRIES)).toHaveLength(0);
    expect(notInGame(ENTRIES).map((e) => e.pairId)).toEqual([]);
  });

  it('日本語・英語に重複がない', () => {
    expect(new Set(ENTRIES.map((e) => e.ja)).size).toBe(90);
    expect(new Set(ENTRIES.map((e) => e.en)).size).toBe(90);
  });

  it('2軸の内訳が 90・0・0・0 になる', () => {
    const verifiedInGame = inGame(ENTRIES).filter((e) => e.状態 === '確認済み');
    const verifiedOnly = notInGame(ENTRIES).filter((e) => e.状態 === '確認済み');
    const pendingInGame = inGame(ENTRIES).filter((e) => e.状態 !== '確認済み');
    const pendingOnly = notInGame(ENTRIES).filter((e) => e.状態 !== '確認済み');
    expect(verifiedInGame).toHaveLength(90);
    // 工程V-2I-2で候補5語をゲームへ入れたので、台帳だけの語は無くなった。
    // 2つが別の軸であることは変わらない。いまはたまたま重なっているだけ。
    expect(verifiedOnly).toHaveLength(0);
    expect(verifiedOnly.map((e) => e.pairId)).toEqual([]);
    // 未確認の語は、使用中にも候補にも残っていない。
    expect(pendingInGame).toHaveLength(0);
    expect(pendingOnly).toHaveLength(0);
    expect(pendingInGame.map((e) => e.pairId)).toEqual([]);
    expect(pendingOnly.map((e) => e.pairId)).toEqual([]);
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
/** 確認済みの90語。いまは台帳の全語。台帳に出てくる順（pairId 順）で書く。 */
const VERIFIED_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
];
/**
 * `資料確認` として確認した7語。
 * 8・10 は工程V-2G-2、12・20・22・25・27 は工程V-2I-1。
 * ほかの83語は `基本語判断` なので、5条件の書き方も検査のしかたも別。
 */
const SOURCE_CHECKED_IDS = [8, 10, 12, 20, 22, 25, 27];
/**
 * 工程V-2I-1で確認し、工程V-2I-2でゲームへ入れた5語。
 * 確認が済んだ時点では `候補` のままで、ゲームへ入れたのは別の判断。
 */
const ADDED_IN_V2I2: [number, string, string][] = [
  [12, 'さかな', 'fish'],
  [20, 'パン', 'bread'],
  [22, 'ぎゅうにゅう', 'milk'],
  [25, 'うみ', 'sea'],
  [27, 'いえ', 'house'],
];
const ADDED_IN_V2I2_IDS = ADDED_IN_V2I2.map(([id]) => id);
/** 場面別の3セットへ入れていない7件。確認済みで、共通セットでは使用中。 */
const PAIR_IDS_NOT_IN_THEME_SET = [8, 10, 12, 20, 22, 25, 27];
/** 未確認のまま残っている語。工程V-2I-1で0件になった。 */
const PENDING_IDS: number[] = [];
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
// 資料確認の2語は基本語条件の行を持たないので、この検査の対象から外す。
const COUNTABLE_NOUN_IDS = VERIFIED_IDS.filter(
  (id) => ![...COLOR_IDS, ...VERB_IDS, ...UNCOUNTABLE_IDS, ...SOURCE_CHECKED_IDS].includes(id),
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
      // 誰が本文を開いたかを必ず書く。開発環境が開けたことにしない。
      expect(entry.確認経路.length, `${entry.pairId} の「本文確認の経路」が空`).toBeGreaterThan(20);
      // 2つの道を混ぜない。
      expect(entry.条件.size, `${entry.pairId} は資料確認なのに基本語条件がある`).toBe(0);
      // 代わりに資料確認の5条件がそろっている。
      expect(
        [...entry.資料条件.keys()].sort((a, b) => a - b),
        `${entry.pairId} の資料確認条件の番号がそろっていない`,
      ).toEqual([1, 2, 3, 4, 5]);
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

  it(`動詞${VERB_IDS.length}語は条件3に「動詞の原形」を書く`, () => {
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

  it('確認済み90語・要確認0語が、指定の集合と完全に一致する', () => {
    expect(verified.map((e) => e.pairId)).toEqual(VERIFIED_IDS);
    expect(pending.map((e) => e.pairId)).toEqual(PENDING_IDS);
    expect(verified).toHaveLength(90);
    expect(pending).toHaveLength(0);
    expect(ENTRIES).toHaveLength(90);
  });

  it('状態別・方法別の件数が合っている', () => {
    // 未確認の語は、使用中にも候補にも残っていない。
    expect(pending.filter((e) => e.状態 === '要確認（使用中）').map((e) => e.pairId)).toEqual([]);
    expect(pending.filter((e) => e.状態 === '要確認（候補）').map((e) => e.pairId)).toEqual([]);
    expect(verified.filter((e) => e.確認の方法 === '基本語判断')).toHaveLength(83);
    expect(verified.filter((e) => e.確認の方法 === '資料確認').map((e) => e.pairId))
      .toEqual(SOURCE_CHECKED_IDS);
    // 確認済み90語 = 基本語判断83 + 資料確認7。
    expect(verified).toHaveLength(83 + SOURCE_CHECKED_IDS.length);
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
      '**開発環境が本文を開けたかのように書いてはいけません。**',
      '| `資料確認条件2・意味範囲` | この札で採る意味と、**この札では扱わない意味** |',
      '### 2-1. 「使用中かどうか」と「確認したかどうか」は別です',
      '**この2つが別の軸であることは、これからも変わりません。**',
      '**「ゲームに入ったから確認済みになる」わけではありません。**',
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
    // 工程V-2I-2で5語が入り、共通セットは90語になった。
    for (const pairId of ADDED_IN_V2I2_IDS) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId)).toBe(true);
      expect(COMMON_SET_PAIR_IDS.includes(pairId)).toBe(true);
    }
    expect(COMMON_SET_PAIR_IDS).toHaveLength(90);
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
    // 工程V-2I-2で5語が入り、共通セットは90語になった。
    for (const pairId of ADDED_IN_V2I2_IDS) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId)).toBe(true);
      expect(COMMON_SET_PAIR_IDS.includes(pairId)).toBe(true);
    }
    expect(COMMON_SET_PAIR_IDS).toHaveLength(90);
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
    expect(SAMPLE_PAIRS).toHaveLength(90);
  });

  it('ゲームへ入れた語は、いま全部が台帳で確認済み', () => {
    // 工程V-2G-2で 8・10 の資料確認が済んだので、未確認のまま使っている語は無い。
    // 「入れたから確認済み」ではなく「確認できたから確認済み」。
    const unverifiedInGame = SAMPLE_PAIRS
      .filter((p) => byId.get(p.pairId)!.状態 !== '確認済み')
      .map((p) => p.pairId);
    expect(unverifiedInGame).toEqual([]);
    for (const pair of SAMPLE_PAIRS) {
      expect(byId.get(pair.pairId)!.状態, `${pair.pairId} の状態`).toBe('確認済み');
    }
  });

  it('工程V-2I-2で足した5語が、台帳でもゲームでも使用中になっている', () => {
    // 確認済みになったのは工程V-2I-1、ゲームへ入れたのは工程V-2I-2。
    // 台帳の「使用状況」と実データが食い違っていないことを見る。
    for (const [pairId, ja, en] of ADDED_IN_V2I2) {
      const entry = byId.get(pairId)!;
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.使用状況, `${pairId} の使用状況`).toBe('使用中');
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語`).toBe(ja);
      expect(pair!.en, `${pairId} の英語`).toBe(en);
      expect(entry.ja, `${pairId} の台帳の日本語`).toBe(ja);
      expect(entry.en, `${pairId} の台帳の英語`).toBe(en);
    }
    expect(SAMPLE_PAIRS).toHaveLength(90);
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

  it('ゲームの90語は、台帳の同じ番号の語と完全一致する（採用でも表記は変わらない）', () => {
    expect(SAMPLE_PAIRS).toHaveLength(90);
    // 台帳も90語。いまは台帳の全語がゲームに入っている。
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(ENTRIES.map((e) => e.pairId));
    for (const pair of SAMPLE_PAIRS) {
      const entry = byId.get(pair.pairId);
      expect(entry, `pairId ${pair.pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `pairId ${pair.pairId} の日本語`).toBe(pair.ja);
      expect(entry!.en, `pairId ${pair.pairId} の英語`).toBe(pair.en);
    }
  });

  it('「候補」のままの語はもう無く、台帳の全語がゲームに入っている', () => {
    // この検査は「候補の語がうっかりゲームへ混ざる」ことを見張っていた。
    // いま候補は0件なので、台帳とゲームが1対1であることを見る形にする。
    // これから候補の語を足したときは、また下のループが効く。
    const stillCandidates = notInGame(ENTRIES);
    expect(stillCandidates.map((e) => e.pairId)).toEqual([]);
    const usedJa = new Set(SAMPLE_PAIRS.map((p) => p.ja));
    const usedEn = new Set(SAMPLE_PAIRS.map((p) => p.en));
    const usedIds = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (const entry of stillCandidates) {
      expect(usedIds.has(entry.pairId), `仮ID ${entry.pairId} が実データにある`).toBe(false);
      expect(usedJa.has(entry.ja), `候補「${entry.ja}」が実データにある`).toBe(false);
      expect(usedEn.has(entry.en), `候補「${entry.en}」が実データにある`).toBe(false);
    }
    expect(usedIds.size).toBe(90);
    expect(ENTRIES.every((e) => usedIds.has(e.pairId))).toBe(true);
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

  it('22 ぎゅうにゅう の注意点から、採用前の保留メモが消えている', () => {
    // 工程V-2I-1で判定が 採用 になった。「まだ正式採用ではない」は事実に合わない。
    expect(byId.get(22)!.判定).toBe('採用');
    expect(byId.get(22)!.注意点).not.toContain('正式採用ではない');
    // 代わりに、milk が指す広い範囲を注意点へ残してある。
    expect(byId.get(22)!.注意点).toContain('母乳');
  });
});

describe('工程V-2F-1で確認し、工程V-2F-2でゲームへ入れた接客・飲食・宿泊の15語', () => {
  const entries = HOSPITALITY_IDS.map((id) => byId.get(id)!);

  it('pairId 76〜90 が連番でそろっている', () => {
    expect(HOSPITALITY_IDS).toEqual(Array.from({ length: 15 }, (_, i) => i + 76));
    for (const pairId of HOSPITALITY_IDS) {
      expect(byId.get(pairId), `pairId ${pairId} が台帳に無い`).toBeDefined();
    }
    // かつての欠番5語は、工程V-2I-2で台帳と同じ番号のままゲームへ入った。
    // 番号を詰め直していないので、76〜90 の位置は動いていない。
    for (const pairId of ADDED_IN_V2I2_IDS) {
      expect(byId.get(pairId)!.使用状況, `${pairId} が使用中でない`).toBe('使用中');
      expect(
        SAMPLE_PAIRS.some((p) => p.pairId === pairId),
        `${pairId} がゲームに入っていない`,
      ).toBe(true);
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
    expect(SAMPLE_PAIRS).toHaveLength(90);
    // 共通セットの末尾15件が、昇順で 76〜90 になっている。
    expect([...common.pairIds].slice(-15)).toEqual(HOSPITALITY_IDS);
  });

  it('旅・学校のセットへは広げず、接客・観光のセットの核になっている', () => {
    for (const setId of ['travel-practice', 'school-practice'] as const) {
      const set = findVocabularySet(setId)!;
      expect(set.pairIds, `${setId} の語数が変わっている`).toHaveLength(30);
      for (const pairId of HOSPITALITY_IDS) {
        expect(set.pairIds, `${pairId} が ${setId} に入っている`).not.toContain(pairId);
      }
    }
    // 工程V-2F-3で作った接客・観光のセットには、15語すべてが核として入っている。
    const hospitality = findVocabularySet('hospitality-practice')!;
    expect([...hospitality.pairIds].slice(-15)).toEqual(HOSPITALITY_IDS);
    expect(VOCABULARY_SETS).toHaveLength(4);
  });
});

describe('語彙セットと台帳の説明が食い違っていないこと', () => {
  const common = findVocabularySet('common-practice')!;
  const travel = findVocabularySet('travel-practice')!;
  const school = findVocabularySet('school-practice')!;
  const hospitality = findVocabularySet('hospitality-practice')!;
  const coursesUsing = (id: string) =>
    COURSES.filter((c) => c.vocabularySetId === id).map((c) => c.id);

  it('セットは4件で、共通90語・旅30語・学校30語・接客30語', () => {
    expect(VOCABULARY_SETS).toHaveLength(4);
    expect(common.pairIds).toHaveLength(90);
    expect(travel.pairIds).toHaveLength(30);
    expect(school.pairIds).toHaveLength(30);
    expect(hospitality.pairIds).toHaveLength(30);
    expect(SAMPLE_PAIRS).toHaveLength(90);
  });

  it('旅・学校・接客のセットの語は、すべて台帳で確認済み', () => {
    for (const [name, set] of
      [['旅', travel], ['学校', school], ['接客', hospitality]] as const) {
      for (const pairId of set.pairIds) {
        const entry = byId.get(pairId);
        expect(entry, `${name}: pairId ${pairId} が台帳に無い`).toBeDefined();
        expect(entry!.状態, `${name}: ${pairId}「${entry!.ja}」が確認済みでない`).toBe('確認済み');
        expect(entry!.使用状況, `${name}: ${pairId} が使用中でない`).toBe('使用中');
      }
    }
  });

  it('旅・学校・接客のセットに、場面別へ入れていない7件が入っていない', () => {
    // 除外表は7件から減らさない。1件でも抜けると、その pairId の混入に気づけない。
    expect(PAIR_IDS_NOT_IN_THEME_SET).toEqual([8, 10, 12, 20, 22, 25, 27]);
    for (const [name, set] of
      [['旅', travel], ['学校', school], ['接客', hospitality]] as const) {
      for (const pairId of PAIR_IDS_NOT_IN_THEME_SET) {
        expect(set.pairIds, `${pairId} が${name}のセットに入っている`).not.toContain(pairId);
      }
    }
    // 8・10 は工程V-2G-2で確認済みになったが、場面別セットへは入れない。
    // 確認が済んだことは、そのセットの場面に合うという意味ではないため。
    for (const pairId of [8, 10]) {
      expect(common.pairIds, `${pairId} が共通セットから消えている`).toContain(pairId);
      expect(byId.get(pairId)!.使用状況).toBe('使用中');
      expect(byId.get(pairId)!.状態).toBe('確認済み');
    }
  });

  it('共通20コース・旅1コース・学校2コース・接客1コース', () => {
    expect(coursesUsing('common-practice')).toHaveLength(20);
    expect(coursesUsing('travel-practice')).toEqual(['biz-travel']);
    expect(coursesUsing('school-practice')).toEqual(['grade-elementary', 'grade-junior']);
    expect(coursesUsing('hospitality-practice')).toEqual(['biz-hospitality']);
    // 4集合を合わせて24コース、重なりなし。
    const all = ['common-practice', 'travel-practice', 'school-practice', 'hospitality-practice']
      .flatMap((id) => coursesUsing(id));
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
    // 台帳の表に書いた語数・件数と、実データが一致していること。
    const BODY: Record<string, string> = {
      'common-practice': `ゲーム内${SAMPLE_PAIRS.length}語すべて`,
      'travel-practice': '旅行の場面の語',
      'school-practice': '学校の場面の語',
      'hospitality-practice': '接客・飲食・宿泊・観光の場面の語',
    };
    const row = (label: string, id: string, courses: string) =>
      `| \`${id}\`（${label}） | ${findVocabularySet(id)!.pairIds.length}語 | `
      + `${BODY[id]} | ${courses} | ${coursesUsing(id).length} |`;
    expect(checklist).toContain(row('共通の練習用ことば', 'common-practice', '下の3セット以外のすべて'));
    expect(checklist).toContain(row('旅のことば', 'travel-practice', '海外旅行'));
    expect(checklist).toContain(row('学校のことば', 'school-practice', '小学生・中学生'));
    expect(checklist).toContain(row('接客・観光のことば', 'hospitality-practice', '接客・観光'));
  });

  it('接客・観光のセットは、核15語をすべて含み、旅と15語を共有する', () => {
    const CORE = [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
    const SHARED = [7, 28, 29, 30, 38, 40, 46, 47, 49, 50, 51, 52, 53, 57, 60];
    for (const pairId of CORE) {
      expect(hospitality.pairIds, `核の ${pairId} が無い`).toContain(pairId);
      expect(byId.get(pairId)!.状態, `${pairId} の確認状態`).toBe('確認済み');
      expect(byId.get(pairId)!.使用状況, `${pairId} の使用状況`).toBe('使用中');
    }
    const travelIds = new Set(travel.pairIds);
    expect([...hospitality.pairIds].filter((id) => travelIds.has(id)).sort((a, b) => a - b))
      .toEqual(SHARED);
    // 台帳にも、共有15語と核15語のことが書いてある。
    expect(checklist).toContain('**旅のことばと接客・観光のことばは、15語を共有しています。**');
    expect(checklist).toContain(SHARED.join(', ') + ' の15語です。');
  });

  it('接客・観光のセットを、職業能力や難易度の保証として書いていない', () => {
    expect(checklist)
      .toContain('**接客・観光のセットは、職業の能力や学習の難しさを保証するものではありません。**');
    for (const phrase of [
      '接客業に必要な語を網羅',
      '接客技能を確認済み',
      '観光業の職業訓練',
      '職業基準に準拠',
      '接客・観光コースの学習内容が完成',
    ]) {
      expect(checklist, `「${phrase}」と読める説明がある`).not.toContain(phrase);
    }
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
      '語彙セットは3件',
      '共通21コース',
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

/**
 * 工程V-2G-2。最後まで `要確認（使用中）` だった 8・10 の資料確認。
 *
 * この2語だけは、開発環境から本文を開けなかった。
 * 依頼者が別のWeb取得環境で本文を直接確認し、その記録を受け取って台帳へ反映した。
 * だから、ここで一番大事なのは「誰が本文を開いたか」を台帳が偽っていないこと。
 * 件数が合っていても、経路の記録が消えたり、開発環境が開けたことにされたりしたら
 * この検査は落ちる。
 *
 * 外部サイトへはアクセスしない。資料名・URL・台帳の記述を静的に読むだけ。
 */
describe('工程V-2G-2で資料確認した 8 つき / 10 くるま', () => {
  const SOURCE_WORDS: [number, string, string][] = [
    [8, 'つき', 'moon'],
    [10, 'くるま', 'car'],
  ];
  /** 台帳が主張してはいけない、確認経路の偽り方。 */
  const FALSE_ROUTES = [
    'Claude Code が本文を直接確認',
    'Claude Codeが本文を直接確認',
    'Claude Code が直接確認',
    'Claude Codeが直接確認',
    'Claude Code の実行環境から本文を確認',
    'Claude Codeの実行環境から本文を確認',
  ];

  it('2語とも 使用中・確認済み・資料確認・採用 になっている', () => {
    for (const [pairId] of SOURCE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.使用状況, `${pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${pairId} の確認の方法`).toBe('資料確認');
      expect(entry.判定, `${pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${pairId} の確認日`).toBe('2026-09-22');
    }
  });

  it('表記はゲームデータと完全に一致している', () => {
    // 採用でも表記は変えない。台帳だけ直してゲームが置いていかれることを防ぐ。
    for (const [pairId, ja, en] of SOURCE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.ja, `${pairId} の日本語`).toBe(ja);
      expect(entry.en, `${pairId} の英語`).toBe(en);
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語がゲームデータと違う`).toBe(ja);
      expect(pair!.en, `${pairId} の英語がゲームデータと違う`).toBe(en);
    }
  });

  it('資料名とURLが空でなく、本文を直接開いた記録がある', () => {
    for (const [pairId] of SOURCE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認した資料.length, `${pairId} の資料名が短すぎる`).toBeGreaterThan(20);
      expect(entry.URL, `${pairId} のURL`).toMatch(/^https:\/\//);
      expect(entry.直接確認, `${pairId} の「正本URLを直接開いた」`).toBe('はい');
      expect(entry.確認した内容.length, `${pairId} の確認した内容が短すぎる`).toBeGreaterThan(80);
    }
  });

  it('本文を開いたのは依頼者側だと書いてあり、開発環境が開けたことにしていない', () => {
    for (const [pairId] of SOURCE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認経路, `${pairId} に依頼者側提供の記録が無い`)
        .toContain('依頼者側から提供された本文確認記録');
      expect(entry.確認経路, `${pairId} に別環境で確認したことが書かれていない`)
        .toContain('別のWeb取得環境で直接確認');
      expect(entry.確認経路, `${pairId} に開発環境から見ていないことが書かれていない`)
        .toContain('Claude Codeの実行環境から閲覧したものではない');
    }
    // 台帳のどこにも、開発環境が本文を開けたという書き方をしない。
    for (const phrase of FALSE_ROUTES) {
      expect(checklist, `台帳に「${phrase}」という偽りがある`).not.toContain(phrase);
    }
  });

  it('資料の帰属が正確に書いてある', () => {
    const moon = byId.get(8)!;
    expect(moon.確認した資料, '8 の主資料が教育出版でない').toContain('教育出版');
    expect(moon.確認した資料, '8 の発行元が書かれていない').toContain('教育出版株式会社');
    expect(moon.確認した資料, '8 の著作権表示が書かれていない').toContain('KYOIKU-SHUPPAN.Co.,Ltd.');
    expect(moon.確認した資料, '8 の補助資料が学研でない').toContain('学研キッズネット');

    const car = byId.get(10)!;
    // 発行元は小学館。コトバンクは掲載サイトであって発行元ではない。
    expect(car.確認した資料, '10 の日本語資料が小学館デジタル大辞泉でない')
      .toContain('小学館『デジタル大辞泉』');
    expect(car.確認した資料, '10 にコトバンクが掲載サイトだと書かれていない')
      .toContain('コトバンクは掲載サイトであって辞書の発行元ではない');
    expect(car.確認した資料, '10 の英語資料が Collins でない').toContain('Collins English Dictionary');
    expect(car.確認した資料, '10 の発行元が書かれていない').toContain('HarperCollins Publishers');
  });

  it('資料確認の5条件が5行そろい、どの行も中身がある', () => {
    const NAMES: [number, string][] = [
      [1, '具体性'],
      [2, '意味範囲'],
      [3, '語形'],
      [4, '重複'],
      [5, '表記'],
    ];
    for (const [pairId] of SOURCE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(
        [...entry.資料条件.keys()].sort((a, b) => a - b),
        `${pairId} の資料確認条件の番号`,
      ).toEqual([1, 2, 3, 4, 5]);
      for (const [number, name] of NAMES) {
        const [label, value] = (entry.資料条件.get(number) ?? '').split('\t');
        expect(label, `${pairId} の条件${number}の見出し`).toBe(name);
        expect(value.startsWith('適合：'), `${pairId} の条件${number}: ${value}`).toBe(true);
        expect(
          value.replace('適合：', '').trim().length,
          `${pairId} の条件${number}に理由が書かれていない`,
        ).toBeGreaterThan(5);
      }
      // 2語で同じ文言を使い回していない。
      expect(entry.資料条件.get(4)).toBeDefined();
    }
    for (const number of [1, 2, 3, 5]) {
      const rows = SOURCE_WORDS.map(([pairId]) => byId.get(pairId)!.資料条件.get(number));
      expect(new Set(rows).size, `条件${number} の書きぶりが使い回されている`).toBe(rows.length);
    }
    expect(new Set(SOURCE_WORDS.map(([id]) => byId.get(id)!.確認した内容)).size).toBe(2);
  });

  it('8 は天体の月だけを扱い、month を扱わないと書いてある', () => {
    const moon = byId.get(8)!;
    const range = (moon.資料条件.get(2) ?? '').split('\t')[1] ?? '';
    expect(range, '8 の条件2に天体の限定が無い').toContain('天体の月だけ');
    expect(range, '8 の条件2に month を扱わないと書かれていない').toContain('month');
    expect(range, '8 の条件2が「扱わない」と書いていない').toContain('扱わない');
    expect(moon.注意点, '8 の注意点に month が無い').toContain('month');
    // month を扱わないのは、こちらの限定であって資料の主張ではない。
    expect(moon.確認した内容, '8 で month との比較を資料の主張にしている')
      .toContain('資料本文に month との比較が書かれていたという記録ではない');
  });

  it('10 は乗用自動車に限定し、別の語義を隠していない', () => {
    const car = byId.get(10)!;
    const range = (car.資料条件.get(2) ?? '').split('\t')[1] ?? '';
    expect(range, '10 の条件2に乗用自動車への限定が無い').toContain('乗用自動車');
    expect(range, '10 の条件2に鉄道車両を扱わないと書かれていない').toContain('鉄道車両');
    // 別の語義があることを、隠さず残す。
    expect(car.確認した内容, '10 の確認内容に列車の語義が無い').toContain('列車');
    expect(car.注意点, '10 の注意点に別の語義が無い').toContain('別の語義');
    expect(car.注意点, '10 の注意点に日本語側の広さが無い').toContain('乗り物');
    for (const phrase of NEGATIONS) {
      expect(car.確認した内容, `10 が「${phrase}」と断定している`).not.toContain(phrase);
      expect(car.注意点, `10 の注意点が「${phrase}」と断定している`).not.toContain(phrase);
    }
    expect(car.確認した内容, '10 が car の語義を1つに断定している')
      .toContain('car が指すのは乗用自動車だけだとは判断していない');
  });

  it('10 は車輪そのものを札の範囲から外し、その判断の根拠を偽っていない', () => {
    // 「くるま」は自動車と車輪を取り違えやすい。どちらを指す札かを言い切っておく。
    const car = byId.get(10)!;
    const range = (car.資料条件.get(2) ?? '').split('\t')[1] ?? '';
    expect(range, '10 の条件2に車輪を扱わないと書かれていない').toContain('車輪そのもの');
    expect(car.注意点, '10 の注意点に車輪の論点が無い').toContain('車輪そのもの');
    // 札の範囲を狭めるのはこちらの判断。資料がそう書いていたとは記録しない。
    expect(car.注意点, '10 で車輪の用法を確認済みのように書いている').toContain('要確認');
    expect(car.確認した内容, '10 の確認内容に、資料が言っていない車輪の語義を足している')
      .not.toContain('車輪そのもの');
  });

  it('8・10 を旅行・学校・接客観光のセットへ入れていない', () => {
    // 確認が済んだことと、場面別セットに入れることは別の軸。
    for (const setId of ['travel-practice', 'school-practice', 'hospitality-practice'] as const) {
      const set = findVocabularySet(setId);
      expect(set, `${setId} が無い`).toBeDefined();
      for (const [pairId] of SOURCE_WORDS) {
        expect(set!.pairIds, `${setId} に ${pairId} が入っている`).not.toContain(pairId);
      }
      expect(set!.pairIds, `${setId} の語数`).toHaveLength(30);
    }
    // 共通セットには、これまでどおり2語とも残っている。
    for (const [pairId] of SOURCE_WORDS) {
      expect(COMMON_SET_PAIR_IDS, `common-practice から ${pairId} が消えている`).toContain(pairId);
    }
    expect(COMMON_SET_PAIR_IDS).toHaveLength(90);
    expect(VOCABULARY_SETS).toHaveLength(4);
  });

  it('未確認の語は1件も残っていない', () => {
    expect(PENDING_IDS).toEqual([]);
    for (const entry of ENTRIES) {
      expect(entry.状態, `${entry.pairId} の状態`).toBe('確認済み');
    }
    expect(SAMPLE_PAIRS).toHaveLength(90);
    // コースの割り当ては、この工程でも動かしていない。
    expect(COURSES).toHaveLength(24);
  });
});

/**
 * 工程V-2I-1。まだゲームへ入れていない候補5語の資料確認。
 *
 * この5語は、意味の範囲や数えかたに迷いがあるとして `基本語判断` を避け、
 * ずっと `要確認（候補）` のまま置いてあった。
 * 開発環境からは資料の本文を開けないので、依頼者が別のChatGPT Web取得環境で
 * 本文を直接確認し、その記録の提供を受けて台帳へ反映した。
 *
 * ここで一番大事なのは2つ。
 * 1. 誰が本文を開いたかを、台帳が偽っていないこと。
 * 2. 確認が済んでも、5語が勝手にゲームへ入っていないこと。
 *    「確認済み」と「ゲームで使用中」は別の軸で、確認は札を増やす理由にならない。
 *
 * 外部サイトへはアクセスしない。資料名・URL・台帳の記述を静的に読むだけ。
 */
describe('工程V-2I-1で資料確認した候補5語', () => {
  const CANDIDATE_WORDS: [number, string, string][] = [
    [12, 'さかな', 'fish'],
    [20, 'パン', 'bread'],
    [22, 'ぎゅうにゅう', 'milk'],
    [25, 'うみ', 'sea'],
    [27, 'いえ', 'house'],
  ];
  /** 台帳が主張してはいけない、確認経路の偽り方。 */
  const FALSE_ROUTES = [
    'Claude Code が本文を直接確認',
    'Claude Codeが本文を直接確認',
    'Claude Code が直接確認',
    'Claude Codeが直接確認',
    'Claude Code の実行環境から本文を確認',
    'Claude Codeの実行環境から本文を確認',
  ];

  it('pairId・日本語・英語が、指定の表と完全に一致する', () => {
    expect(CANDIDATE_WORDS.map(([id]) => id)).toEqual(ADDED_IN_V2I2_IDS);
    for (const [pairId, ja, en] of CANDIDATE_WORDS) {
      const entry = byId.get(pairId);
      expect(entry, `pairId ${pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `${pairId} の日本語`).toBe(ja);
      expect(entry!.en, `${pairId} の英語`).toBe(en);
    }
  });

  it('5語とも 確認済み・資料確認・採用 で、いまは使用中', () => {
    // 工程V-2I-1では `候補` だった。工程V-2I-2でゲームへ入れて `使用中` になった。
    // 資料確認の記録（方法・判定・確認日・資料・経路・条件・内容）はそのまま。
    for (const [pairId] of CANDIDATE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.使用状況, `${pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${pairId} の確認の方法`).toBe('資料確認');
      expect(entry.判定, `${pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${pairId} の確認日`).toBe('2026-09-22');
    }
  });

  it('資料名・発行元・URLが空でない', () => {
    for (const [pairId] of CANDIDATE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認した資料.length, `${pairId} の資料名が短すぎる`).toBeGreaterThan(30);
      // 日本語資料と英語資料の両方を挙げている。
      expect(entry.確認した資料, `${pairId} に日本語資料が無い`).toContain('日本語:');
      expect(entry.確認した資料, `${pairId} に英語資料が無い`).toContain('英語:');
      // 英語資料の発行元は Collins ではなく HarperCollins。掲載社と発行元を取り違えない。
      expect(entry.確認した資料, `${pairId} に英語資料の発行元が無い`)
        .toContain('HarperCollins Publishers');
      expect(entry.URL, `${pairId} の日本語資料URL`).toMatch(/^https:\/\//);
      expect(entry.確認した内容.length, `${pairId} の確認した内容が短すぎる`).toBeGreaterThan(100);
    }
  });

  it('本文を開いたのは依頼者側だと書いてあり、開発環境が開けたことにしていない', () => {
    for (const [pairId] of CANDIDATE_WORDS) {
      const entry = byId.get(pairId)!;
      expect(entry.確認経路, `${pairId} に依頼者側提供の記録が無い`)
        .toContain('依頼者側から提供された本文確認記録');
      expect(entry.確認経路, `${pairId} に確認した環境が書かれていない`)
        .toContain('別のChatGPT Web取得環境で直接確認');
      expect(entry.確認経路, `${pairId} に開発環境から見ていないことが書かれていない`)
        .toContain('Claude Codeの実行環境から閲覧したものではない');
    }
    for (const phrase of FALSE_ROUTES) {
      expect(checklist, `台帳に「${phrase}」という偽りがある`).not.toContain(phrase);
    }
  });

  it('5語とも資料確認条件1〜5がそろい、どの行も中身がある', () => {
    const NAMES: [number, string][] = [
      [1, '具体性'],
      [2, '意味範囲'],
      [3, '語形'],
      [4, '重複'],
      [5, '表記'],
    ];
    for (const [pairId] of CANDIDATE_WORDS) {
      const entry = byId.get(pairId)!;
      // 基本語判断とは道が違う。基本語条件は書かない。
      expect(entry.条件.size, `${pairId} は資料確認なのに基本語条件がある`).toBe(0);
      expect(
        [...entry.資料条件.keys()].sort((a, b) => a - b),
        `${pairId} の資料確認条件の番号`,
      ).toEqual([1, 2, 3, 4, 5]);
      for (const [number, name] of NAMES) {
        const [label, value] = (entry.資料条件.get(number) ?? '').split('\t');
        expect(label, `${pairId} の条件${number}の見出し`).toBe(name);
        expect(value.startsWith('適合：'), `${pairId} の条件${number}: ${value}`).toBe(true);
        expect(
          value.replace('適合：', '').trim().length,
          `${pairId} の条件${number}に理由が書かれていない`,
        ).toBeGreaterThan(10);
      }
      // 条件2には、必ず「この札では扱わない」側を書く。
      expect(
        (entry.資料条件.get(2) ?? '').split('\t')[1] ?? '',
        `${pairId} の条件2に扱わない意味が無い`,
      ).toContain('扱わない');
    }
    // 5語で同じ文言を使い回していない。
    for (const number of [1, 2, 3, 4, 5]) {
      const rows = CANDIDATE_WORDS.map(([id]) => byId.get(id)!.資料条件.get(number));
      expect(new Set(rows).size, `条件${number} の書きぶりが使い回されている`).toBe(rows.length);
    }
    expect(new Set(CANDIDATE_WORDS.map(([id]) => byId.get(id)!.確認した内容)).size).toBe(5);
  });

  it('fish の複数形を1つに単純化していない', () => {
    const fish = byId.get(12)!;
    expect(fish.確認した内容, '12 に fishes の記録が無い').toContain('fishes');
    expect(fish.注意点, '12 の注意点に単数の話が無い').toContain('単数');
    expect(fish.注意点, '12 の注意点に複数の話が無い').toContain('複数');
    // 「複数形は必ず fish」と決めつけない。
    expect(fish.確認した内容, '12 が複数形を1つに断定している')
      .toContain('複数形が1つだけだとは扱わず');
    // 料理・動詞・酒の肴は、この札では扱わないと書いてある。
    expect((fish.資料条件.get(2) ?? '').split('\t')[1] ?? '').toContain('肴');
  });

  it('bread を常に不可算だと断定していない', () => {
    const bread = byId.get(20)!;
    expect(bread.確認した内容, '20 に variable noun の記録が無い').toContain('variable noun');
    expect(bread.確認した内容, '20 が bread を常に不可算だと断定している')
      .toContain('常に不可算名詞だとは判断していない');
    expect(bread.注意点, '20 の注意点に不可算の論点が無い').toContain('不可算');
    // 比喩と動詞の意味を隠さない。
    expect(bread.注意点, '20 の注意点に別の意味が無い').toContain('動詞');
  });

  it('milk の広い意味を隠していない', () => {
    const milk = byId.get(22)!;
    for (const word of ['母乳', '植物', '化粧品', '動詞']) {
      expect(milk.確認した内容, `22 の確認内容に「${word}」が無い`).toContain(word);
      expect(milk.注意点, `22 の注意点に「${word}」が無い`).toContain(word);
    }
    expect(milk.確認した内容, '22 が milk の意味を牛の乳だけに断定している')
      .toContain('牛の乳だけを指すとは判断していない');
    expect(milk.注意点, '22 の注意点に「ミルク」が無い').toContain('ミルク');
  });

  it('sea と ocean が常に同じだとは書いていない', () => {
    const sea = byId.get(25)!;
    expect(sea.確認した内容, '25 に ocean との違いの記録が無い').toContain('ocean');
    expect(sea.確認した内容, '25 が sea と ocean を同一視している')
      .toContain('sea と ocean が常に同じだとは判断していない');
    expect(sea.確認した内容, '25 が「うみ」を必ず sea だとしている')
      .toContain('すべての文脈で必ず sea になるとも書かない');
    expect(sea.注意点, '25 の注意点に ocean が無い').toContain('ocean');
    // 湖やプールは、この札では扱わないと書いてある。
    expect(sea.注意点, '25 の注意点に湖・プールの除外が無い').toContain('プール');
  });

  it('house と home が常に同じだとは書いていない', () => {
    const house = byId.get(27)!;
    expect(house.確認した内容, '27 に home との違いの記録が無い').toContain('home');
    expect(house.確認した内容, '27 が house と home を同一視している')
      .toContain('house と home が常に同じだとは判断していない');
    expect(house.注意点, '27 の注意点に home が無い').toContain('home');
    // 家族・会社・議会という別の意味を隠さない。
    for (const word of ['家族', '議会']) {
      expect(house.注意点, `27 の注意点に「${word}」が無い`).toContain(word);
    }
  });

  it('5語とも「ほかの意味は無い」と断定していない', () => {
    for (const [pairId] of CANDIDATE_WORDS) {
      const entry = byId.get(pairId)!;
      for (const phrase of NEGATIONS) {
        expect(entry.確認した内容, `${pairId} が「${phrase}」と断定している`).not.toContain(phrase);
        expect(entry.注意点, `${pairId} の注意点が「${phrase}」と断定している`).not.toContain(phrase);
      }
    }
  });

  it('5語は共通セットにだけ入り、場面別の3セットには入っていない', () => {
    // 工程V-2I-2でゲームと共通セットへ入れた。場面別の3セットへは広げていない。
    const gameIds = SAMPLE_PAIRS.map((p) => p.pairId);
    const gameJa = new Set(SAMPLE_PAIRS.map((p) => p.ja));
    const gameEn = new Set(SAMPLE_PAIRS.map((p) => p.en));
    for (const [pairId, ja, en] of CANDIDATE_WORDS) {
      expect(gameIds, `${pairId} がゲームデータに無い`).toContain(pairId);
      expect(gameJa.has(ja), `「${ja}」がゲームデータに無い`).toBe(true);
      expect(gameEn.has(en), `「${en}」がゲームデータに無い`).toBe(true);
      expect(COMMON_SET_PAIR_IDS, `common-practice に ${pairId} が無い`).toContain(pairId);
      for (const set of VOCABULARY_SETS) {
        if (set.id === 'common-practice') continue;
        expect(set.pairIds, `${set.id} に ${pairId} が入っている`).not.toContain(pairId);
        expect(set.pairIds, `${set.id} の語数`).toHaveLength(30);
      }
    }
    // ゲーム内90語・4セット・24コース。コース割り当ては動かしていない。
    expect(SAMPLE_PAIRS).toHaveLength(90);
    expect(VOCABULARY_SETS).toHaveLength(4);
    expect(COMMON_SET_PAIR_IDS).toHaveLength(90);
    expect(COURSES).toHaveLength(24);
  });

  it('「確認済み」と「ゲームで使用中」が別の軸だと、台帳に書いてある', () => {
    expect(checklist, '2つが別の軸だという説明が消えている')
      .toContain('**この2つが別の軸であることは、これからも変わりません。**');
    expect(checklist, '確認とゲーム追加が別だという説明が無い')
      .toContain('**確認が終わったことと、ゲームに入れることは、別のことです。**');
    // いまは90語すべてが確認済みかつ使用中だが、それは「たまたま重なっている」だけ。
    // 確認が済んだだけで語が自動的に入るわけではない、と明記してある。
    expect(checklist, '確認が札を増やす理由ではないと書かれていない')
      .toContain('確認が済んだからといって、語が自動的にゲームへ入ることはありません。');
    expect(checklist, 'ゲームへ入れたのが別の判断だったと書かれていない')
      .toContain('ゲームへ入れたのは、工程 V-2I-2 で**明示的にそう決めたから**です。');
  });
});
