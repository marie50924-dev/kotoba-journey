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
  /** あとから語義を追加で確かめたときの記録。持たない語は空。 */
  追加確認日: string;
  追加確認経路: string;
  追加確認内容: string;
  確認した内容: string;
  確認日: string;
  注意点: string;
  /** 候補の語だけが持つ、札に採るときの日本語表記（ひらがな／カタカナ）。 */
  表記: string;
  /** 資料確認の語が持つ、辞書の発行元と英語資料のURL。基本語判断の語は空。 */
  発行元: string;
  英語URL: string;
  本文確認日: string;
  /** 見送りにした候補だけが持つ日付と理由。持たない語は空。 */
  見送り日: string;
  見送り理由: string;
  /** 候補の表記を変えたときの記録。変えていない語は空。 */
  表記変更日: string;
  表記変更理由: string;
  /**
   * 候補の語だけが持つ、確認前に分かっている論点。
   * 確認の結果を書く `基本語条件` / `資料確認条件` とは別の行にしている。
   * 確認前の疑問を「適合」として並べてしまわないため（台帳 第9節）。
   */
  論点: string;
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
  const bodyStart = markdown.search(/\n## 8\. /);
  const bodyEnd = markdown.indexOf('\n## 9. この台帳を変えるときの決まり');
  expect(bodyStart, '語ごとの確認台帳の節が無い').toBeGreaterThan(-1);
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
      追加確認日: fields.get('追加確認日') ?? '',
      追加確認経路: fields.get('追加確認の経路') ?? '',
      追加確認内容: fields.get('追加確認の内容') ?? '',
      確認した内容: fields.get('確認した内容') ?? '',
      確認日: fields.get('確認日') ?? '',
      注意点: fields.get('注意点') ?? '',
      表記: fields.get('表記') ?? '',
      発行元: fields.get('発行元') ?? '',
      英語URL: fields.get('英語資料URL') ?? '',
      本文確認日: fields.get('本文確認日') ?? '',
      見送り日: fields.get('見送り日') ?? '',
      見送り理由: fields.get('見送りの理由') ?? '',
      表記変更日: fields.get('候補表記の変更日') ?? '',
      表記変更理由: fields.get('候補表記を変えた理由') ?? '',
      論点: fields.get('確認する論点') ?? '',
      条件: conditions,
      資料条件: sourceConditions,
    };
  });
}

const COMMON_SET_PAIR_IDS = [...findVocabularySet('common-practice')!.pairIds];
const ENTRIES = parseChecklist(checklist);
const byId = new Map(ENTRIES.map((e) => [e.pairId, e]));

/**
 * 工程V-2M-2で台帳へ足した、医療・介護の場面の候補15語。
 *
 * この15語は **候補** であって、まだ確認していない。
 * - 台帳の状態は `要確認（候補）`
 * - 確認の方法・判定・確認日・資料欄はすべて空
 * - `src/data/wordPairs.ts` にも4つの語彙セットにも入っていない
 *
 * 日本語候補・英語候補は仮の表記で、次の資料確認工程で変わることがある。
 * ここで固定するのは「いま台帳に何が、どの状態で書いてあるか」だけで、
 * 語の意味や英語との対応が正しいと主張するものではない。
 *
 * 外部サイトへはアクセスしない。台帳の記述を静的に読むだけ。
 */
const CARE_CANDIDATES: [number, string, string, string, string, string][] = [
  [91, 'びょういん', 'hospital', '場所', '名詞', 'ひらがな'],
  [92, 'いしゃ', 'doctor', '人', '名詞', 'ひらがな'],
  [93, 'かんごし', 'nurse', '人', '名詞', 'ひらがな'],
  [94, 'くすり', 'medicine', '物', '名詞', 'ひらがな'],
  [95, 'くるまいす', 'wheelchair', '物', '名詞', 'ひらがな'],
  [96, 'つえ', 'cane', '物', '名詞', 'ひらがな'],
  [97, 'マスク', 'mask', '物', '名詞', 'カタカナ'],
  [98, 'あたま', 'head', '体', '名詞', 'ひらがな'],
  [100, 'おなか', 'stomach', '体', '名詞', 'ひらがな'],
  [101, 'ゆび', 'finger', '体', '名詞', 'ひらがな'],
  [102, 'たすける', 'help', '動作', '動詞', 'ひらがな'],
  [103, 'すわる', 'sit', '動作', '動詞', 'ひらがな'],
  [104, 'たつ', 'stand', '動作', '動詞', 'ひらがな'],
  [105, 'あらう', 'wash', '動作', '動詞', 'ひらがな'],
  [106, 'ひざ', 'knee', '体', '名詞', 'ひらがな'],
];
/**
 * 医療・介護の15語。工程V-2O-1でゲームへ入れたので、いまは `使用中`。
 * 見送りの 99 は入らない。
 */
const CARE_CANDIDATE_IDS = CARE_CANDIDATES.map(([id]) => id);
/** 工程V-2N-1で `基本語判断` を終えた候補7語。確認済みだが、まだゲームには入れていない。 */
const CARE_CONFIRMED_IDS = [91, 95, 98, 102, 103, 105, 106];
/** 工程V-2N-2で `資料確認` を終えた候補8語。確認済みだが、まだゲームには入れていない。 */
const CARE_SOURCE_IDS = [92, 93, 94, 96, 97, 100, 101, 104];
/** 辞書の本文をまだ確かめていない候補。工程V-2N-2で0件になった。 */
const CARE_PENDING_IDS: number[] = [];
/** 見送りにした候補。履歴として台帳に残すだけで、現在管理する語には数えない。 */
const DROPPED_IDS = [99];
/** 台帳の掲載記録。現在管理する105語＋見送り履歴1件。 */
const LEDGER_RECORD_COUNT = 106;
/** いま管理している語数（ゲームで使用中90＋有効な候補15）。 */
const MANAGED_WORD_COUNT = 105;
/** 確認済みにした7語の注意点に、採用範囲として必ず残す語。 */
const CARE_CONFIRMED_NOTES: [number, string[]][] = [
  [91, ['びよういん']],
  [95, ['くるま', 'いす']],
  [98, ['先頭']],
  [102, ['名詞']],
  [103, ['sit down']],
  [105, ['名詞']],
  [106, ['leg', 'foot']],
];

describe('語彙確認チェックリストの形', () => {
  it('掲載記録106件・現在管理する105語・見送り1件に分かれる', () => {
    expect(ENTRIES).toHaveLength(LEDGER_RECORD_COUNT);
    expect(dropped.map((e) => e.pairId)).toEqual(DROPPED_IDS);
    expect(managed).toHaveLength(MANAGED_WORD_COUNT);
    expect(ENTRIES.length - dropped.length).toBe(MANAGED_WORD_COUNT);
    // 工程V-2O-1で候補15語をゲームへ入れたので、105語すべてが `使用中`。
    expect(inGame(managed)).toHaveLength(105);
    expect(notInGame(managed)).toHaveLength(0);
    expect(notInGame(managed).map((e) => e.pairId)).toEqual([]);
    // 見送りの語はゲームに入っていない。
    expect(inGame(dropped)).toHaveLength(0);
  });

  it('日本語・英語に重複がない（見送りの履歴も含めて106件）', () => {
    expect(new Set(ENTRIES.map((e) => e.ja)).size).toBe(LEDGER_RECORD_COUNT);
    expect(new Set(ENTRIES.map((e) => e.en)).size).toBe(LEDGER_RECORD_COUNT);
  });

  it('2軸の内訳が 105・0・0・0 になる（見送り1件は数えない）', () => {
    // この表は見送りを含めない。現在管理する105語だけを2軸で分ける。
    const verifiedInGame = inGame(managed).filter((e) => e.状態 === '確認済み');
    const verifiedOnly = notInGame(managed).filter((e) => e.状態 === '確認済み');
    const pendingInGame = inGame(managed).filter((e) => e.状態 !== '確認済み');
    const pendingOnly = notInGame(managed).filter((e) => e.状態 !== '確認済み');
    expect(verifiedInGame).toHaveLength(105);
    // 工程V-2O-1で15語をゲームへ入れたので、台帳だけの語は無くなった。
    expect(verifiedOnly).toHaveLength(0);
    expect(verifiedOnly.map((e) => e.pairId)).toEqual([]);
    // 未確認のままゲームで使っている語は無い。
    expect(pendingInGame).toHaveLength(0);
    expect(pendingInGame.map((e) => e.pairId)).toEqual([]);
    expect(pendingOnly).toHaveLength(0);
    expect(pendingOnly.map((e) => e.pairId)).toEqual(CARE_PENDING_IDS);
    // 105 + 0 + 0 + 0 = 105。見送りの1件はこの表に入らない。
    expect(
      verifiedInGame.length + verifiedOnly.length + pendingInGame.length + pendingOnly.length,
    ).toBe(MANAGED_WORD_COUNT);
  });

  it('pairId は 1〜106 が台帳に一度ずつ出てくる', () => {
    const ids = ENTRIES.map((e) => e.pairId);
    expect(new Set(ids).size).toBe(LEDGER_RECORD_COUNT);
    expect([...ids].sort((a, b) => a - b)).toEqual(
      Array.from({ length: LEDGER_RECORD_COUNT }, (_, i) => i + 1),
    );
    // 台帳に出てくる順も 1〜106 の昇順で、欠番が無い。
    // 見送りの 99 も番号を空けず、履歴としてその位置に残す。
    expect(ids).toEqual(Array.from({ length: LEDGER_RECORD_COUNT }, (_, i) => i + 1));
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

const STATES = ['要確認（使用中）', '要確認（候補）', '確認済み', '見送り（候補）'];
const METHODS = ['資料確認', '基本語判断'];
/** 基本語判断の5条件。番号と見出しの対応。 */
const WORD_FORMS = ['名詞の単数形', '名詞（不可算）', '動詞の原形', '色'];
/**
 * 確認済みの105語。いま管理している語のすべて。
 * ゲームで使っている90語＋有効な候補15語で、pairId 99（見送り）だけが入らない。
 * 台帳に出てくる順（pairId 順）で書く。
 */
const VERIFIED_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
  91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 102, 103, 104, 105, 106,
];
/**
 * `資料確認` として確認した15語。
 * 8・10 は工程V-2G-2、12・20・22・25・27 は工程V-2I-1、
 * 92・93・94・96・97・100・101・104 は工程V-2N-2。
 * ほかの90語は `基本語判断` なので、5条件の書き方も検査のしかたも別。
 */
const SOURCE_CHECKED_IDS = [
  8, 10, 12, 20, 22, 25, 27,
  // 工程V-2N-2で `資料確認` を終えた候補8語。
  92, 93, 94, 96, 97, 100, 101, 104,
];
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
/**
 * 台帳で `要確認` のまま残っている語。
 * 工程V-2I-1でいったん0件になり、工程V-2M-2で候補15語を足して15件、
 * 工程V-2N-1で7語を確認して8件になった。
 */
const PENDING_IDS: number[] = [...CARE_PENDING_IDS];
/**
 * ゲームで使っているのに未確認、という語。工程V-2G-2で0件になった。
 * 候補（91〜106）はゲームに入っていないので、ここには入らない。
 */
const PENDING_IN_USE_IDS: number[] = [];
/**
 * 条件4を書いた時点の台帳の語数。
 * 90語の時点で確認した語は「この台帳の90語に」と書いてある。
 * あとから候補を足しても、確認したときに見た範囲は変わらないので、
 * この数は台帳の総語数（いまは105）に追従させない。
 * 代わりに、表記が本当に重なっていないことは ENTRIES 全体の実データで確かめる。
 */
const LEDGER_SIZE_AT_VERIFICATION = 90;
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
const VERB_IDS = [28, 29, 30, 42, 43, 44, 45, 87, 88, 89, 90, 102, 103, 105];
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
/** 見送りは「未確認」ではない。確認済みでもないので、3つ目の区分として分ける。 */
const dropped = ENTRIES.filter((e) => e.状態 === '見送り（候補）');
const pending = ENTRIES.filter((e) => e.状態 !== '確認済み' && e.状態 !== '見送り（候補）');
/** 見送りを除いた、いま管理している語。 */
const managed = ENTRIES.filter((e) => e.状態 !== '見送り（候補）');

describe('確認の進みかた', () => {
  it('状態は、決めた4つの値しか使わない', () => {
    for (const entry of ENTRIES) {
      expect(STATES, `${entry.pairId}: ${entry.状態}`).toContain(entry.状態);
    }
    // 現在管理する105語が使えるのは `確認済み` と `要確認（…）` だけ。
    // 工程V-2N-2で要確認が0語になったので、いま実際に出てくるのは `確認済み` のみ。
    for (const entry of managed) {
      expect(['確認済み', '要確認（使用中）', '要確認（候補）'], `${entry.pairId} の状態`)
        .toContain(entry.状態);
    }
    expect(new Set(managed.map((e) => e.状態))).toEqual(new Set(['確認済み']));
    expect(new Set(dropped.map((e) => e.状態))).toEqual(new Set(['見送り（候補）']));
    // 第2節に、見送りをどう扱うかが書いてある。
    expect(checklist, '第2節の見出しが変わっている')
      .toContain('## 2. 状態の3種類と、見送りの扱い');
    expect(checklist, '見送りの状態の説明が無い')
      .toContain('| `見送り（候補）` | 候補として挙げたが、札にしないと決めた');
    expect(checklist, '見送りが確認済みでも要確認でもないと書かれていない')
      .toContain('`見送り（候補）` の語は、**確認済みでも要確認でもありません**。');
  });

  it('未確認の語は、まだ何も記入されていない', () => {
    // 見送りの語は判定に「見送り」が入るので、この検査の対象にしない（別の検査で見る）。
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

  it('確認済み105語・要確認0語・見送り1件が、指定の集合と完全に一致する', () => {
    expect(verified.map((e) => e.pairId)).toEqual(VERIFIED_IDS);
    expect(pending.map((e) => e.pairId)).toEqual(PENDING_IDS);
    expect(dropped.map((e) => e.pairId)).toEqual(DROPPED_IDS);
    expect(verified).toHaveLength(105);
    expect(pending).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    // 105 + 0 = 105（現在管理する語）、+ 見送り1件 = 106（掲載記録）。
    expect(verified.length + pending.length).toBe(MANAGED_WORD_COUNT);
    expect(ENTRIES).toHaveLength(LEDGER_RECORD_COUNT);
  });

  it('状態別・方法別の件数が合っている', () => {
    // 未確認の語は、使用中にも候補にも残っていない。
    expect(pending.filter((e) => e.状態 === '要確認（使用中）').map((e) => e.pairId))
      .toEqual(PENDING_IN_USE_IDS);
    expect(pending.filter((e) => e.状態 === '要確認（候補）').map((e) => e.pairId))
      .toEqual(CARE_PENDING_IDS);
    // 確認方法が決まっていないのは、いまは見送りの1件だけ。
    expect(ENTRIES.filter((e) => e.確認の方法 === '').map((e) => e.pairId))
      .toEqual([...DROPPED_IDS]);
    expect(pending.filter((e) => e.確認の方法 === '')).toHaveLength(0);
    expect(dropped.filter((e) => e.確認の方法 === '')).toHaveLength(1);
    expect(verified.filter((e) => e.確認の方法 === '基本語判断')).toHaveLength(90);
    expect(verified.filter((e) => e.確認の方法 === '資料確認').map((e) => e.pairId))
      .toEqual(SOURCE_CHECKED_IDS);
    expect(SOURCE_CHECKED_IDS).toHaveLength(15);
    // 確認済み105語 = 基本語判断90 + 資料確認15。
    expect(verified).toHaveLength(90 + SOURCE_CHECKED_IDS.length);
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
      '- pairId 1〜106 は**振り直しません**',
      '欠番として残してかまいません',
      '| 正本URLを直接開いた | はい |',
      '**開発環境が本文を開けたかのように書いてはいけません。**',
      '| `資料確認条件2・意味範囲` | この札で採る意味と、**この札では扱わない意味** |',
      '### 2-1. 「使用中かどうか」と「確認したかどうか」は別です',
      '**この2つが別の軸であることは、これからも変わりません。**',
      '**「ゲームに入ったから確認済みになる」わけではありません。**',
      '### 7-1. コースとの関係',
      '## 8. 語ごとの確認台帳（掲載記録106件）',
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
        .toContain(`この台帳の${LEDGER_SIZE_AT_VERIFICATION}語`);
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
    // 工程V-2O-1で15語が入り、共通セットは105語になった。
    for (const pairId of ADDED_IN_V2I2_IDS) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId)).toBe(true);
      expect(COMMON_SET_PAIR_IDS.includes(pairId)).toBe(true);
    }
    expect(COMMON_SET_PAIR_IDS).toHaveLength(105);
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
    // 工程V-2O-1で15語が入り、共通セットは105語になった。
    for (const pairId of ADDED_IN_V2I2_IDS) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId)).toBe(true);
      expect(COMMON_SET_PAIR_IDS.includes(pairId)).toBe(true);
    }
    expect(COMMON_SET_PAIR_IDS).toHaveLength(105);
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
    // ゲームへ入れた語の一覧は、工程V-2I-2までの80語ぶんを履歴として残している。
    // そのあとの15語は、この節のあとの表で状態ごとに書いてある。
    const addedUpTo90 = SAMPLE_PAIRS
      .filter((p) => p.pairId > 10 && p.pairId <= 90)
      .map((p) => p.pairId);
    expect(checklist, 'ゲームへ入れた語の一覧が台帳に書かれていない')
      .toContain(`ゲームへ入れた${addedUpTo90.length}語: ${addedUpTo90.join(', ')}`);
    expect(checklist, '工程V-2O-1で入れた15語の一覧が台帳に無い')
      .toContain('| ゲームで使用中・確認済み | 105語 | 1〜98・100〜106 |');
  });

  it('台帳の「使用中／候補」は、実際のゲームデータと合っている', () => {
    // 区分を手で書き換えても、実データと食い違えば落ちる。
    for (const entry of ENTRIES) {
      const isInGame = SAMPLE_PAIRS.some((p) => p.pairId === entry.pairId);
      expect(entry.使用状況 === '使用中', `${entry.pairId} の区分がゲームデータと違う`)
        .toBe(isInGame);
    }
    expect(SAMPLE_PAIRS).toHaveLength(105);
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
    expect(SAMPLE_PAIRS).toHaveLength(105);
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

  it('ゲームの105語は、台帳の同じ番号の語と完全一致する（採用でも表記は変わらない）', () => {
    expect(SAMPLE_PAIRS).toHaveLength(105);
    // 台帳の掲載記録は106件。ゲームに入っているのは、見送りの99を除く105語。
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(inGame(ENTRIES).map((e) => e.pairId));
    for (const pair of SAMPLE_PAIRS) {
      const entry = byId.get(pair.pairId);
      expect(entry, `pairId ${pair.pairId} が台帳に無い`).toBeDefined();
      expect(entry!.ja, `pairId ${pair.pairId} の日本語`).toBe(pair.ja);
      expect(entry!.en, `pairId ${pair.pairId} の英語`).toBe(pair.en);
    }
  });

  it('ゲームへ入れていない語（いまは見送りの99だけ）が、ゲームデータへ混ざっていない', () => {
    // この検査は「台帳だけの語がうっかりゲームへ混ざる」ことを見張っている。
    // 工程V-2O-1で候補15語がゲームへ入ったので、残るのは見送りの99だけ。
    const stillCandidates = notInGame(ENTRIES);
    expect(stillCandidates.map((e) => e.pairId)).toEqual([...DROPPED_IDS]);
    const usedJa = new Set(SAMPLE_PAIRS.map((p) => p.ja));
    const usedEn = new Set(SAMPLE_PAIRS.map((p) => p.en));
    const usedIds = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (const entry of stillCandidates) {
      expect(usedIds.has(entry.pairId), `仮ID ${entry.pairId} が実データにある`).toBe(false);
      expect(usedJa.has(entry.ja), `候補「${entry.ja}」が実データにある`).toBe(false);
      expect(usedEn.has(entry.en), `候補「${entry.en}」が実データにある`).toBe(false);
    }
    expect(usedIds.size).toBe(105);
    // 語数と最大pairIdは別の数。
    expect(Math.max(...usedIds)).toBe(106);
    // ゲームデータの語は、すべて台帳にある（逆は成り立たない）。
    expect(SAMPLE_PAIRS.every((p) => byId.has(p.pairId))).toBe(true);
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

  it('条件4は、確認した時点の台帳90語の範囲で書いてある', () => {
    for (const entry of entries) {
      expect(entry.条件.get(4), `${entry.pairId} の条件4が台帳の範囲で書かれていない`)
        .toContain(`この台帳の${LEDGER_SIZE_AT_VERIFICATION}語`);
    }
    // 台帳の掲載記録は106件まで増えたが、確認したときに見た範囲は90語のまま。
    expect(ENTRIES).toHaveLength(LEDGER_RECORD_COUNT);
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
    expect(SAMPLE_PAIRS).toHaveLength(105);
    // 工程V-2O-1で医療・介護の15語が末尾へ入ったので、76〜90 はその手前。
    expect([...common.pairIds].slice(-30, -15)).toEqual(HOSPITALITY_IDS);
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
    // 工程V-2O-1の医療・介護セットは、核15語のうち4語だけを共有基礎として使う。
    const care = findVocabularySet('care-practice')!;
    expect(HOSPITALITY_IDS.filter((id) => care.pairIds.includes(id)))
      .toEqual([78, 82, 83, 85]);
    expect(VOCABULARY_SETS).toHaveLength(5);
  });
});

describe('語彙セットと台帳の説明が食い違っていないこと', () => {
  const common = findVocabularySet('common-practice')!;
  const travel = findVocabularySet('travel-practice')!;
  const school = findVocabularySet('school-practice')!;
  const hospitality = findVocabularySet('hospitality-practice')!;
  const coursesUsing = (id: string) =>
    COURSES.filter((c) => c.vocabularySetId === id).map((c) => c.id);

  it('セットは5件で、共通105語・旅30語・学校30語・接客30語・医療介護30語', () => {
    expect(VOCABULARY_SETS).toHaveLength(5);
    expect(common.pairIds).toHaveLength(105);
    expect(travel.pairIds).toHaveLength(30);
    expect(school.pairIds).toHaveLength(30);
    expect(hospitality.pairIds).toHaveLength(30);
    expect(findVocabularySet('care-practice')!.pairIds).toHaveLength(30);
    expect(SAMPLE_PAIRS).toHaveLength(105);
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

  it('共通19コース・旅1コース・学校2コース・接客1コース・医療介護1コース', () => {
    expect(coursesUsing('common-practice')).toHaveLength(19);
    expect(coursesUsing('travel-practice')).toEqual(['biz-travel']);
    expect(coursesUsing('school-practice')).toEqual(['grade-elementary', 'grade-junior']);
    expect(coursesUsing('hospitality-practice')).toEqual(['biz-hospitality']);
    expect(coursesUsing('care-practice')).toEqual(['biz-care']);
    // 5集合を合わせて24コース、重なりなし。
    const all = [
      'common-practice', 'travel-practice', 'school-practice',
      'hospitality-practice', 'care-practice',
    ].flatMap((id) => coursesUsing(id));
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
    // 台帳の表に書いた語数・件数と、実データが一致していること。
    const BODY: Record<string, string> = {
      'common-practice': `ゲーム内${SAMPLE_PAIRS.length}語すべて`,
      'travel-practice': '旅行の場面の語',
      'school-practice': '学校の場面の語',
      'hospitality-practice': '接客・飲食・宿泊・観光の場面の語',
      'care-practice': '医療・介護の場面の語',
    };
    const row = (label: string, id: string, courses: string) =>
      `| \`${id}\`（${label}） | ${findVocabularySet(id)!.pairIds.length}語 | `
      + `${BODY[id]} | ${courses} | ${coursesUsing(id).length} |`;
    expect(checklist).toContain(row('共通の練習用ことば', 'common-practice', '下の4セット以外のすべて'));
    expect(checklist).toContain(row('旅のことば', 'travel-practice', '海外旅行'));
    expect(checklist).toContain(row('学校のことば', 'school-practice', '小学生・中学生'));
    expect(checklist).toContain(row('接客・観光のことば', 'hospitality-practice', '接客・観光'));
    expect(checklist).toContain(row('医療・介護のことば', 'care-practice', '医療・介護'));
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

  it('台帳に未確認の論点は1件も残っていない', () => {
    // 工程V-2K-1で、10「くるま」の車輪の論点が解消した。
    // 「いまも1件残っている」と読める書き方が戻っていないことを見る。
    const section = checklist.slice(
      checklist.indexOf('### 3-1-1.'),
      checklist.indexOf('### 3-2.'),
    );
    expect(section, '未確認の論点が0件だと書かれていない')
      .toContain('**いま、台帳に未確認の論点は0件です。**');
    expect(section, '10 の論点が解消したと書かれていない').toContain('この論点は解消しています');
    // 解消したのに、現在も残っていると読める書き方をしていないこと。
    for (const phrase of [
      '未確認の論点として\n注意点に残っています',
      '未確認の論点が1件残っています',
      'いまも未確認の論点が残って',
    ]) {
      expect(checklist, `台帳に「${phrase}」が残っている`).not.toContain(phrase);
    }
    // 語ごとの注意点にも、未解消の調べ残しは無い。
    for (const entry of ENTRIES) {
      expect(entry.注意点, `${entry.pairId} の注意点に未解消の調べ残しがある`)
        .not.toContain('資料の本文で確認できていない');
    }
    // 集計は動いたが、調べ残しは0件のまま。確認済みは105語。
    expect(ENTRIES.filter((e) => e.状態 === '確認済み')).toHaveLength(105);
    // 要確認0語は「採否の確認が終わった」という別の数え方。
    // 未確認の論点0件（注意点に調べ残しが無いこと）と同じ話ではない。
    expect(pending.map((e) => e.pairId)).toEqual(CARE_PENDING_IDS);
    expect(section, '「未確認の論点0件」と「要確認0語」の違いが書かれていない')
      .toContain('### 3-1-2. 「未確認の論点0件」と「要確認0語」は別の話です');
    expect(section, '2つが別々に動くと書かれていない')
      .toContain('**この2つは別々に動きます。**');
    expect(section, '同じ0でも数えているものが違うと書かれていない')
      .toContain('**数えているものが違います**');
  });

  it('10 は車輪の語義を本文で確かめた記録を持っている', () => {
    const car = byId.get(10)!;
    // 追加確認の資料。掲載サイトと発行元を取り違えない。
    expect(car.追加確認内容, '10 の追加確認に辞書名が無い').toContain('小学館『デジタル大辞泉』');
    expect(car.追加確認内容, '10 の追加確認で掲載サイトと発行元を書き分けていない')
      .toContain('掲載サイトはコトバンクで、辞書の発行元は小学館');
    expect(car.URL, '10 の正本URL').toBe('https://kotobank.jp/word/%E8%BB%8A-57345');
    expect(car.追加確認日, '10 の追加確認日').toBe('2026-09-23');
    // 本文で分かれていた2つの語義。どちらも記録してある。
    expect(car.追加確認内容, '10 に車輪の語義が無い').toContain('軸を中心に回転する輪、すなわち車輪');
    expect(car.追加確認内容, '10 に自動車の語義が無い').toContain('現代では特に自動車');
    // 論点が解消したことも書いてある。
    expect(car.追加確認内容, '10 の追加確認に論点解消の記録が無い').toContain('未確認の論点は解消した');
    expect(car.注意点, '10 の注意点に車輪の語義が無い').toContain('車輪そのものも指す');
    expect(car.注意点, '10 の注意点に確認日が無い').toContain('2026-09-23');
  });

  it('10 の採用範囲は広がっておらず、車輪と乗用自動車を混ぜていない', () => {
    const car = byId.get(10)!;
    const range = (car.資料条件.get(2) ?? '').split('\t')[1] ?? '';
    // この札で採るのは道路を走る乗用自動車だけ。
    expect(range, '10 の条件2に乗用自動車への限定が無い').toContain('乗用自動車に意味を限定');
    for (const excluded of ['車輪そのもの', '乗り物全般', '荷車', '鉄道車両']) {
      expect(range, `10 の条件2に「${excluded}」を扱わないと書かれていない`).toContain(excluded);
    }
    expect(range, '10 の条件2が「扱わない」と書いていない').toContain('扱わない');
    expect(car.注意点, '10 の注意点で車輪を扱わないと書かれていない').toContain('この札では扱わない');
    expect(car.注意点, '10 の注意点で車輪と自動車を混ぜないと書かれていない')
      .toContain('車輪と乗用自動車を同じ札の意味として混ぜることはしない');
    // 車輪の語義が無い、とは断定していない。
    expect(car.注意点, '10 が車輪の語義を否定している')
      .toContain('車輪の語義が存在しないとは判断していない');
    for (const phrase of ['くるまに車輪の意味はない', '車輪の意味は無い', '車輪を指す用法はない']) {
      expect(checklist, `台帳に「${phrase}」という断定がある`).not.toContain(phrase);
    }
    // 札の中身は動かしていない。
    expect(car.ja).toBe('くるま');
    expect(car.en).toBe('car');
    expect(car.状態).toBe('確認済み');
    expect(car.使用状況).toBe('使用中');
    expect(car.判定).toBe('採用');
    expect(car.確認日, '10 の確認日は採用した日のまま').toBe('2026-09-22');
  });

  it('10 の追加確認も、開いたのは依頼者側だと書いてある', () => {
    const car = byId.get(10)!;
    expect(car.追加確認経路, '10 の追加確認に依頼者側提供の記録が無い')
      .toContain('依頼者側から提供された追加の本文確認記録');
    expect(car.追加確認経路, '10 の追加確認に確認した環境が書かれていない')
      .toContain('別のChatGPT Web取得環境で直接確認');
    expect(car.追加確認経路, '10 の追加確認に開発環境から見ていないことが書かれていない')
      .toContain('Claude Codeの実行環境から閲覧したものではない');
    // 2026-09-22 の最初の確認記録も残っている。
    expect(car.確認経路, '10 の最初の確認記録が消えている')
      .toContain('本文は2026-09-22に別のWeb取得環境で直接確認された');
    expect(car.確認した内容, '10 の最初の確認内容が消えている')
      .toContain('「車」の読みが「クルマ」と示されていること');
    // 開発環境が開けたことにしていない。
    for (const phrase of [
      'Claude Code が本文を直接確認',
      'Claude Codeが本文を直接確認',
      'Claude Code が直接確認',
      'Claude Codeが直接確認',
      'Claude Codeの実行環境から本文を確認',
    ]) {
      expect(checklist, `台帳に「${phrase}」という偽りがある`).not.toContain(phrase);
    }
  });

  it('8・10 を旅行・学校・接客観光のセットへ入れていない', () => {
    // 確認が済んだことと、場面別セットに入れることは別の軸。
    for (const setId of [
      'travel-practice', 'school-practice', 'hospitality-practice', 'care-practice',
    ] as const) {
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
    expect(COMMON_SET_PAIR_IDS).toHaveLength(105);
    expect(VOCABULARY_SETS).toHaveLength(5);
  });

  it('ゲームで使っている語に、未確認のものは1件も残っていない', () => {
    expect(PENDING_IN_USE_IDS).toEqual([]);
    for (const entry of inGame(managed)) {
      expect(entry.状態, `${entry.pairId} の状態`).toBe('確認済み');
    }
    expect(SAMPLE_PAIRS).toHaveLength(105);
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

  it('5語は共通セットにだけ入り、場面別の4セットには入っていない', () => {
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
    // ゲーム内105語・5セット・24コース。
    expect(SAMPLE_PAIRS).toHaveLength(105);
    expect(VOCABULARY_SETS).toHaveLength(5);
    expect(COMMON_SET_PAIR_IDS).toHaveLength(105);
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

/**
 * 台帳が書いている、場面別3セットの重なりの説明。
 *
 * 一度「旅と接客・観光が15語を共有しているので3つ合わせて70語」と書いていた。
 * 70という数字は合っていたが、理由が違う。15語だけ引くと75語で、
 * 実際に70語になるのは学校との重なりと、3セットすべてに入る語があるため。
 *
 * この説明は第7-1節（コースとの関係）にある。セットの語数や共有語の表と
 * 並べて読む場所だから。第3-1-1節は「札の確認状態」と「未確認の論点」を
 * 分ける節で、集合の話は置いていない。
 *
 * ここでは数字と語を別々に確かめる。1つの長い文をそのまま照合すると、
 * 読点や全角記号を直しただけで落ちてしまい、直すのが面倒で消されやすいため。
 */
describe('台帳の、場面別3セットの重なりの説明', () => {
  /** 3セットの重なりを説明している範囲（第7-1節）だけを見る。 */
  const section = checklist.slice(
    checklist.indexOf('### 7-1.'),
    checklist.indexOf('## 8. '),
  );

  it('包除原理の計算が、順を追って書いてある', () => {
    expect(section.length, '第7-1節が見つからない').toBeGreaterThan(0);
    // 足す・引く・戻す の3手順が、式として読める形で残っている。
    expect(section, '3セットの語数を足す式が無い').toContain('30 + 30 + 30');
    expect(section, 'ペアの重なりを引く式が無い').toContain('− 15 − 5 − 3');
    expect(section, '3セット共通を戻して70にする式が無い').toContain('+ 3 = 70');
    expect(section, '式全体が無い').toContain('30 + 30 + 30 − 15 − 5 − 3 + 3 = 70');
    // 引きすぎた3語を戻す、という理由が書いてある。
    expect(section, '3回引いてしまうという説明が無い').toContain('3回引いてしまっている');
  });

  it('3種類の重なりと、3セット共通の3語が書いてある', () => {
    for (const phrase of ['旅 ∩ 接客・観光', '旅 ∩ 学校', '学校 ∩ 接客・観光', '3セットすべて']) {
      expect(section, `第7-1節に「${phrase}」が無い`).toContain(phrase);
    }
    // 3セットすべてに入る語は、番号まで書いてある。
    expect(section, '3セット共通が語つきで書かれていない').toContain('28（たべる）');
    expect(section, '旅 ∩ 学校 の5語が無い').toContain('28, 38, 39, 40, 43');
    expect(section, '学校 ∩ 接客・観光 の3語が無い').toContain('28, 38, 40');
  });

  it('和集合70語・未所属20語・指定7件・残り13件が書いてある', () => {
    expect(section, '3セットが30語ずつだと書かれていない').toContain('30語ずつ');
    expect(section, '和集合70語が無い').toContain('70語');
    expect(section, '未所属20語が無い').toContain('20語');
    expect(section, '90 − 70 の引き算が無い').toContain('90 − 70');
    expect(section, '指定7件が無い').toContain('8, 10, 12, 20, 22, 25, 27');
    expect(section, '残り13件が無い').toContain('13件');
  });

  it('もとからある2セット比較の説明を消さず、学校との重なりも足してある', () => {
    // もとからある2セット比較の説明は消さない。
    expect(section, '旅と接客・観光の15語共有が消えている').toContain('15語を共有しています');
    expect(section, '2セットの和集合45語が消えている').toContain('和集合は45語');
    // それが2セットだけの比較だと分かる断り書き。
    expect(section, '2セットだけの比較だという断りが無い').toContain('この2セットだけを見比べた差');
    expect(section, '3セットで見ると旅だけが13語になると書かれていない').toContain('13語');
    // 7区画の表がある。
    expect(section, '学校と接客・観光だけの区画が無い').toContain('学校と接客・観光だけ');
    expect(section, '7区画の合計70語が無い').toContain('（= 3セットの和集合）');
  });

  it('和集合70語の理由を、旅と接客・観光の15語だけに帰する説明が残っていない', () => {
    // 取り違えていた理由づけと、その言い換えが台帳へ戻っていないこと。
    // 否定文（「…だけではありません」）に引っかからないよう、言い切りの形で見る。
    const WRONG = [
      '15語を共有しているので、3つを合わせても',
      '15語を共有しているので、3つ合わせても',
      '重なりは旅と接客・観光の15語だけです',
      '重なっているのは、旅と接客・観光の15語だけです',
      '30語×3セットから15語を引くと70',
      '90 − 15 = 70',
      '90-15=70',
    ];
    for (const phrase of WRONG) {
      expect(checklist, `台帳に誤った理由づけ「${phrase}」がある`).not.toContain(phrase);
    }
    // 「15語だけ」と書くときは、必ず否定の形で打ち消していること。
    const claims = [...checklist.matchAll(/旅と接客・観光の15語だけ(.{0,8})/g)].map((m) => m[1]);
    for (const tail of claims) {
      expect(tail.startsWith('ではありません'), `「15語だけ」を打ち消していない（…${tail}）`).toBe(true);
    }
    // 数字の70そのものは正しい。75語へ書き換えられていないこと。
    expect(section, '和集合が75語に書き換えられている').not.toContain('75語');
  });
});

/**
 * 医療・介護の場面の候補（工程V-2M-2で登録、工程V-2M-3でレビュー、工程V-2N-1で整理）。
 *
 * いまの姿はこう。
 * - 有効な候補15語（pairId 91〜98・100〜106）。うち7語は `確認済み`、8語は `要確認（候補）`。
 * - 見送り1件（pairId 99「あし / foot」）。履歴として残すだけで、105語には数えない。
 *
 * ここで一番大事なのは4つ。
 * 1. 確認済みの7語が「確認が終わっただけ」で、ゲームへ入っていないこと。
 * 2. 要確認の8語が、確認済みのふりをしていないこと。
 * 3. 見送りの99が、確認済みでも採用でもなく、有効な候補にも数えられていないこと。
 * 4. 台帳が「医療・介護の技能を確かめた」と読める書き方をしていないこと。
 *
 * 外部サイトへはアクセスしない。台帳の記述と、コードの実データを読むだけ。
 */
describe('医療・介護の候補（有効15語・見送り1件）', () => {
  const entries = CARE_CANDIDATE_IDS.map((id) => byId.get(id)!);

  it('有効な候補15語と見送り1件で、pairId 91〜106 がそろっている', () => {
    expect(CARE_CANDIDATE_IDS).toEqual([91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 102, 103, 104, 105, 106]);
    expect([...CARE_CANDIDATE_IDS, ...DROPPED_IDS].sort((a, b) => a - b))
      .toEqual(Array.from({ length: 16 }, (_, i) => 91 + i));
    for (const entry of entries) {
      expect(entry, '候補の語が台帳に無い').toBeDefined();
    }
    // 基本語判断7語＋資料確認8語＝有効な候補15語。重なりも抜けも無い。
    expect([...CARE_CONFIRMED_IDS, ...CARE_SOURCE_IDS].sort((a, b) => a - b))
      .toEqual([...CARE_CANDIDATE_IDS]);
    expect(CARE_CONFIRMED_IDS).toHaveLength(7);
    expect(CARE_SOURCE_IDS).toHaveLength(8);
    // 工程V-2N-2で、確認をこれから行う候補は0語になった。
    expect(CARE_PENDING_IDS).toHaveLength(0);
    // 既存の90語の番号は、1つも動かしていない。
    expect(ENTRIES.slice(0, 90).map((e) => e.pairId))
      .toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
  });

  it('pairId・日本語候補・英語候補・種類・品詞・表記が、指定の表と完全に一致する', () => {
    for (const [pairId, ja, en, kind, pos, script] of CARE_CANDIDATES) {
      const entry = byId.get(pairId)!;
      expect(entry.ja, `${pairId} の日本語候補`).toBe(ja);
      expect(entry.en, `${pairId} の英語候補`).toBe(en);
      expect(entry.種類, `${pairId} の種類`).toBe(kind);
      expect(entry.品詞, `${pairId} の品詞`).toBe(pos);
      expect(entry.表記, `${pairId} の表記`).toBe(script);
    }
    expect(entries).toHaveLength(15);
  });

  it('15語とも、工程V-2O-1でゲームへ入って「使用中」になった', () => {
    for (const entry of entries) {
      expect(entry.使用状況, `${entry.pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${entry.pairId} の状態`).toBe('確認済み');
    }
  });

  it('品詞は 名詞11語・動詞4語', () => {
    expect(entries.filter((e) => e.品詞 === '名詞').map((e) => e.pairId))
      .toEqual([91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 106]);
    expect(entries.filter((e) => e.品詞 === '動詞').map((e) => e.pairId))
      .toEqual([102, 103, 104, 105]);
  });

  it('表記は カタカナ1語・ひらがな14語', () => {
    expect(entries.filter((e) => e.表記 === 'カタカナ').map((e) => e.pairId)).toEqual([97]);
    expect(entries.filter((e) => e.表記 === 'ひらがな')).toHaveLength(14);
  });

  it('15語の日本語・英語が、もとからの90語と重ならない', () => {
    const existingJa = new Set(SAMPLE_PAIRS.filter((p) => p.pairId <= 90).map((p) => p.ja));
    const existingEn = new Set(SAMPLE_PAIRS.filter((p) => p.pairId <= 90).map((p) => p.en));
    for (const entry of entries) {
      expect(existingJa.has(entry.ja), `「${entry.ja}」がもとからの90語と重なる`).toBe(false);
      expect(existingEn.has(entry.en), `「${entry.en}」がもとからの90語と重なる`).toBe(false);
    }
    // 15語どうしでも重ならない。
    expect(new Set(entries.map((e) => e.ja)).size).toBe(15);
    expect(new Set(entries.map((e) => e.en)).size).toBe(15);
  });

  it('部分一致は重複扱いにせず、注意点へ残してある', () => {
    // 95「くるまいす」は 10「くるま」・38「いす」と文字が一部重なる。
    const wheelchair = byId.get(95)!;
    expect(wheelchair.ja).toBe('くるまいす');
    expect(wheelchair.ja).toContain(byId.get(10)!.ja);
    expect(wheelchair.ja).toContain(byId.get(38)!.ja);
    // 完全一致ではないので、台帳の重複ではない。
    expect(ENTRIES.filter((e) => e.ja === 'くるまいす')).toHaveLength(1);
    expect(`${wheelchair.注意点}`, '95 に部分一致の注意が無い').toContain('くるま');
    expect(checklist, '部分一致が重複でないという説明が台帳に無い')
      .toContain('**部分一致は重複ではありません。**');
  });

  it('15語は SAMPLE_PAIRS に入り、見送りの99だけが入っていない', () => {
    for (const [pairId, ja, en] of CARE_CANDIDATES) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === pairId);
      expect(pair, `${pairId} がゲームデータに無い`).toBeDefined();
      expect(pair!.ja, `${pairId} の日本語`).toBe(ja);
      expect(pair!.en, `${pairId} の英語`).toBe(en);
    }
    // 見送りにした 99 は、番号も語も入れない。
    expect(SAMPLE_PAIRS.some((p) => p.pairId === 99), 'pairId 99 がゲームデータにある').toBe(false);
    expect(SAMPLE_PAIRS.some((p) => p.ja === 'あし')).toBe(false);
    expect(SAMPLE_PAIRS.some((p) => p.en === 'foot')).toBe(false);
    // 語数105と最大pairId 106は別の数。
    expect(SAMPLE_PAIRS).toHaveLength(105);
    expect(Math.max(...SAMPLE_PAIRS.map((p) => p.pairId)), 'ゲームデータの最大pairId').toBe(106);
    // 90語の後ろへ、この順番で足してある。
    expect(SAMPLE_PAIRS.slice(90).map((p) => p.pairId)).toEqual(CARE_CANDIDATE_IDS);
  });

  it('15語は共通セットと医療・介護セットにだけ入り、見送りの99はどこにも入らない', () => {
    const care = findVocabularySet('care-practice')!;
    const common = findVocabularySet('common-practice')!;
    for (const pairId of CARE_CANDIDATE_IDS) {
      expect(common.pairIds, `common-practice に ${pairId} が無い`).toContain(pairId);
      expect(care.pairIds, `care-practice に ${pairId} が無い`).toContain(pairId);
      for (const setId of ['travel-practice', 'school-practice', 'hospitality-practice'] as const) {
        expect(findVocabularySet(setId)!.pairIds, `${setId} に ${pairId} が入っている`)
          .not.toContain(pairId);
      }
    }
    // 見送りの 99 は、どのセットにも入らない。
    for (const set of VOCABULARY_SETS) {
      expect(set.pairIds, `${set.id} に 99 が入っている`).not.toContain(99);
    }
    expect(VOCABULARY_SETS).toHaveLength(5);
    expect(common.pairIds).toHaveLength(105);
    expect(findVocabularySet('travel-practice')!.pairIds).toHaveLength(30);
    expect(findVocabularySet('school-practice')!.pairIds).toHaveLength(30);
    expect(findVocabularySet('hospitality-practice')!.pairIds).toHaveLength(30);
    expect(care.pairIds).toHaveLength(30);
  });

  it('biz-care は care-practice の30語を使う', () => {
    const care = COURSES.find((c) => c.id === 'biz-care');
    expect(care, 'biz-care コースが無い').toBeDefined();
    expect(care!.vocabularySetId, 'biz-care の語彙セット').toBe('care-practice');
    expect(findVocabularySet(care!.vocabularySetId)!.pairIds).toHaveLength(30);
    // 切り替えたのは biz-care だけ。ほかの社会人コースは共通セットのまま。
    for (const id of ['biz-daily', 'biz-business', 'biz-it']) {
      expect(COURSES.find((c) => c.id === id)!.vocabularySetId, id).toBe('common-practice');
    }
  });

  it('24コースの割り当ては 19・1・2・1・1', () => {
    const count = (setId: string) => COURSES.filter((c) => c.vocabularySetId === setId).length;
    expect(COURSES).toHaveLength(24);
    expect(count('common-practice')).toBe(19);
    expect(count('travel-practice')).toBe(1);
    expect(count('school-practice')).toBe(2);
    expect(count('hospitality-practice')).toBe(1);
    expect(count('care-practice')).toBe(1);
    expect(count('common-practice') + count('travel-practice') + count('school-practice')
      + count('hospitality-practice') + count('care-practice')).toBe(24);
    // 保存形式は変えていない。既存pairIdの意味を変えず、番号を足しただけ。
    expect(RECORD_VERSION).toBe(3);
  });

  it('台帳の集計が 掲載記録106件・現在管理105語・見送り1件で書いてある', () => {
    for (const phrase of [
      '**掲載記録は106件**です。',
      '- 進み具合: **確認済み 105語 / 要確認 0語**',
      '| `要確認（候補）` | 0件 | — |',
      '| `見送り（候補）` | 1件 | 99 |',
      '| ゲームで使用中・確認済み | 105語 | 1〜98・100〜106 |',
      '| 台帳だけの候補 | 0語 | — |',
      'ゲームで使用中 105 + 台帳だけの候補 0 = 現在管理する 105 語',
      '現在管理する 105 語 + 見送り履歴 1 件 = 掲載記録 106 件',
      '**語数105と、最大 pairId 106 は別の数です。**',
    ]) {
      expect(checklist, `「${phrase}」が台帳に書かれていない`).toContain(phrase);
    }
  });

  it('台帳が、候補について確認済み・採用済みだと言い過ぎていない', () => {
    for (const phrase of [
      '15語は確認済み',
      '15語は採用済み',
      '15語を確認済み',
      '候補15語は確認済み',
      '候補15語の確認は終わ',
      '医療・介護に必要な語を網羅',
      '医療技能を確認済み',
      '介護技能を確認済み',
      '職業訓練に対応',
      '医療資格',
      '介護資格',
      '医療現場で安全に使える',
      '15語を覚えれば',
      '日本語と英語の対応は確定',
      '対応は確定済み',
      // 見送りにした札を、確認済み・採用と読める書き方にしない。
      '99 あし / foot は確認済み',
      'あし / foot を採用',
    ]) {
      expect(checklist, `台帳に「${phrase}」と書いてある`).not.toContain(phrase);
    }
  });

  it('台帳が、候補の位置づけを打ち消しつきで説明している', () => {
    for (const phrase of [
      '**医療・介護という場面で使うことばとして集めたもの**です。',
      '各語について、**この札で扱う意味と扱わない意味**を条件2と注意点へ書き分けてあります。',
      '`care-practice` は**場面**でまとめたセットで、医療・介護の技能や資格の基準を確かめたものではありません。',
      '**台帳と保存データを結ぶ固定の番号**です。pairId 99 は欠番のままで、別の語へ割り当て直しません。',
      '**技能、診断、治療、職業訓練、学習の難易度を確認したものではありません**。',
      '医療・介護の場面で必要になることばを、**すべて集めたものでもありません**。',
      '英語に別の意味が存在しないと言っているのではありません',
      '辞書の本文を写したものではありません。確認できた語義を独自の短い日本語で要約しています。',
      '**pairId 99 は欠番です。** そのため**語数105と、最大 pairId 106 は別の数**になります。',
    ]) {
      expect(checklist, `「${phrase}」が台帳に書かれていない`).toContain(phrase);
    }
  });

  it('候補の書き方の決まりが、第9節に足してある', () => {
    const rules = checklist.slice(checklist.indexOf('## 9. この台帳を変えるときの決まり'));
    for (const phrase of [
      '`要確認（候補）` の語には、「確認の方法」',
      '`基本語条件1〜5` も `資料確認条件1〜5` も書きません',
      '確認前に分かっている論点を「確認する論点」の行へ書きます',
      'pairId だけは、候補のときから採用後までそのまま使います',
      '「候補表記の変更日」と「候補表記を変えた理由」の行を残します',
      '状態を `見送り（候補）`、判定を `見送り` にし、「見送り日」と「見送りの理由」の行を残します',
      '`見送り（候補）` の語を**現在管理する語に数えません**',
    ]) {
      expect(rules, `「${phrase}」が第9節に無い`).toContain(phrase);
    }
  });
});

/**
 * 工程V-2N-2。`資料確認` で確認済みにした候補8語。
 *
 * この8語は、意味の範囲・数えかた・英語の見出し語の選び方に迷いがあるとして
 * `基本語判断` を避けていた。辞書の本文は、依頼者側の別のChatGPT Web取得環境で
 * 2026-09-26 に正本URLを直接開いて確認されたもので、その記録の提供を受けて反映した。
 *
 * ここで一番大事なのは4つ。
 * 1. 台帳が「誰が本文を開いたか」を偽っていないこと。
 * 2. 採用する意味と、扱わない意味の両方が記録されていること。
 * 3. 別義が存在しないと断定していないこと。
 * 4. 確認が済んでも、8語が勝手にゲームへ入っていないこと。
 *
 * 外部サイトへはアクセスしない。台帳の記述と、コードの実データを読むだけ。
 */
describe('工程V-2N-2で資料確認した候補8語', () => {
  const entries = CARE_SOURCE_IDS.map((id) => byId.get(id)!);
  /** 台帳が書いてはいけない、開発環境が本文を開けたかのような書き方。 */
  const FALSE_ROUTES = [
    'Claude Codeが本文を直接確認',
    'Claude Code が直接確認',
    'Claude Codeが直接確認',
    'Claude Code の実行環境から本文を確認',
    'Claude Codeの実行環境から本文を確認',
    'Claude Codeが辞書サイトを開いた',
    'Claude Codeで辞書本文を確認',
  ];

  it('8語の集合が 92, 93, 94, 96, 97, 100, 101, 104 と完全一致する', () => {
    expect(CARE_SOURCE_IDS).toEqual([92, 93, 94, 96, 97, 100, 101, 104]);
    expect(entries).toHaveLength(8);
    for (const entry of entries) {
      expect(entry, '候補の語が台帳に無い').toBeDefined();
    }
    // 基本語判断7語と資料確認8語で、有効な候補15語をちょうど分ける。
    expect([...CARE_CONFIRMED_IDS, ...CARE_SOURCE_IDS].sort((a, b) => a - b))
      .toEqual([...CARE_CANDIDATE_IDS]);
    // 見送りの 99 は入らない。
    expect(CARE_SOURCE_IDS, '99 が資料確認の集合に入っている').not.toContain(99);
  });

  it('8語とも 使用中・確認済み・資料確認・採用で、確認日は 2026-09-26', () => {
    for (const entry of entries) {
      // 工程V-2O-1でゲームへ入ったので使用中。資料確認の記録はそのまま。
      expect(entry.使用状況, `${entry.pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${entry.pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${entry.pairId} の確認の方法`).toBe('資料確認');
      expect(entry.判定, `${entry.pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${entry.pairId} の確認日`).toBe('2026-09-26');
    }
  });

  it('8語とも 資料名・発行元・URL・英語資料URL・確認内容 が空でない', () => {
    for (const entry of entries) {
      expect(entry.確認した資料.length, `${entry.pairId} の資料名が短すぎる`).toBeGreaterThan(40);
      expect(entry.発行元.length, `${entry.pairId} の発行元が空`).toBeGreaterThan(5);
      expect(entry.URL, `${entry.pairId} の日本語資料URL`).toMatch(/^https:\/\/kotobank\.jp\//);
      expect(entry.英語URL, `${entry.pairId} の英語資料URL`)
        .toMatch(/^https:\/\/www\.collinsdictionary\.com\/dictionary\/english\//);
      expect(entry.直接確認, `${entry.pairId} の正本URLを直接開いた`).toBe('はい');
      expect(entry.確認した内容.length, `${entry.pairId} の確認した内容が短すぎる`).toBeGreaterThan(100);
      expect(entry.注意点.length, `${entry.pairId} の注意点が短すぎる`).toBeGreaterThan(30);
    }
  });

  it('掲載サイトと辞書の発行元を書き分けている', () => {
    for (const entry of entries) {
      // コトバンクは掲載サイトで、辞書の発行元ではない。
      expect(entry.確認した資料, `${entry.pairId} がコトバンクを発行元にしている`)
        .toContain('コトバンクは掲載サイトであって辞書の発行元ではない');
      // Collins は HarperCollins Publishers の辞書。
      expect(entry.確認した資料, `${entry.pairId} に Collins の発行元が無い`)
        .toContain('HarperCollins Publishers');
      expect(entry.発行元, `${entry.pairId} の発行元に HarperCollins Publishers が無い`)
        .toContain('HarperCollins Publishers');
    }
  });

  it('本文を開いたのは依頼者側だと書いてあり、開発環境が開けたことにしていない', () => {
    for (const entry of entries) {
      expect(entry.本文確認日, `${entry.pairId} の本文確認日`).toBe('2026-09-26');
      expect(entry.確認経路, `${entry.pairId} に依頼者側の記録だと書かれていない`)
        .toContain('依頼者側から提供された本文確認記録に基づく');
      expect(entry.確認経路, `${entry.pairId} に取得環境が書かれていない`)
        .toContain('別のChatGPT Web取得環境で正本URLを直接開いて確認された');
      expect(entry.確認経路, `${entry.pairId} に開発環境からではないと書かれていない`)
        .toContain('Claude Codeの実行環境から閲覧したものではない');
      for (const phrase of FALSE_ROUTES) {
        expect(entry.確認経路, `${entry.pairId} の経路に「${phrase}」がある`).not.toContain(phrase);
      }
    }
    // 台帳全体としても、開発環境が本文を開けたようには書いていない。
    for (const phrase of FALSE_ROUTES) {
      expect(checklist, `台帳に「${phrase}」がある`).not.toContain(phrase);
    }
  });

  it('8語すべてに資料確認条件1〜5がそろい、どの行も中身がある', () => {
    for (const entry of entries) {
      expect([...entry.資料条件.keys()].sort((a, b) => a - b), `${entry.pairId} の資料確認条件の番号`)
        .toEqual([1, 2, 3, 4, 5]);
      // 2つの道を混ぜない。
      expect(entry.条件.size, `${entry.pairId} は資料確認なのに基本語条件がある`).toBe(0);
      for (const number of [1, 2, 3, 4, 5]) {
        const value = (entry.資料条件.get(number) ?? '').split('\t')[1] ?? '';
        expect(value.startsWith('適合：'), `${entry.pairId} の条件${number}の書き出し`).toBe(true);
        expect(
          value.replace('適合：', '').trim().length,
          `${entry.pairId} の条件${number}に理由が書かれていない`,
        ).toBeGreaterThan(15);
      }
    }
  });

  it('条件4は、いま管理している105語の範囲で書いてある', () => {
    for (const entry of entries) {
      expect(entry.資料条件.get(4), `${entry.pairId} の条件4が台帳の範囲で書かれていない`)
        .toContain(`いま管理している${MANAGED_WORD_COUNT}語`);
    }
  });

  it('8語から「確認する論点」の行が無くなっている', () => {
    for (const entry of entries) {
      expect(entry.論点, `${entry.pairId} に確認する論点が残っている`).toBe('');
      expect(entry.注意点, `${entry.pairId} の注意点に未確認の論点がある`)
        .not.toContain('未確認の論点');
    }
  });

  it('8語の条件と確認内容・注意点を使い回していない', () => {
    for (const number of [1, 2, 3, 4, 5]) {
      const rows = entries.map((e) => e.資料条件.get(number) ?? '');
      expect(new Set(rows).size, `条件${number} が使い回されている`).toBe(rows.length);
    }
    expect(new Set(entries.map((e) => e.確認した内容)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.注意点)).size).toBe(entries.length);
  });

  it('条件2は、採る意味と扱わない意味の両方を書き、別義を否定していない', () => {
    for (const entry of entries) {
      const row = entry.資料条件.get(2) ?? '';
      // 「この札では◯◯だけを扱い、△△は扱わない」という形で、両方を書く。
      expect(row, `${entry.pairId} の条件2に「この札では」が無い`).toContain('この札では');
      expect(row, `${entry.pairId} の条件2に「扱わない」が無い`).toContain('扱わない');
      for (const word of [...NEGATIONS, 'この意味しかない', '別義が存在しない', '他の語義はない']) {
        expect(row, `${entry.pairId} の条件2に「${word}」がある`).not.toContain(word);
      }
    }
  });

  /** 語ごとに、採用範囲と主な除外範囲が記録されていること。 */
  const RANGES: [number, string[], string[]][] = [
    [92, ['病気やけがを診て治療する人'], ['博士号を持つ人', '機械などを直す', '歯科医・獣医', '呼びかけや肩書']],
    [93, ['看護や世話をする職業の人'], ['動詞', '子どもの世話をする人', '乳母', '授乳', '幼虫を世話する個体', '抱き続ける']],
    [94, ['治療や症状の軽減'], ['学問としての医学', '医療という職業・分野', '農薬', '火薬', '釉薬', '違法薬物']],
    [96, ['歩くときに体を支える'], ['植物の茎', 'さとうきび', 'むち', '棒一般', '比喩的な支え', '古い単位']],
    [97, ['鼻と口を覆う'], ['仮面', '演劇用の面', 'スポーツ用防具', '潜水用マスク', 'ガスマスク', '美容用フェイスマスク', '動詞の mask', 'コンピューター用語']],
    [100, ['体の外側から指させる腹部'], ['臓器としての胃だけを厳密に指す意味', '食欲', '空腹や満腹', '度胸', '動詞の stomach', 'belly・tummy・abdomen']],
    [101, ['手の指'], ['足の指', 'toe', '名指しする用法', '指に似た形の物', '慣用表現', '親指だけを指す意味']],
    [104, ['足で体を支える姿勢'], ['建物が建つ', '時間が経つ', '発つ', '断つ', '名詞の stand', '我慢する・耐える', '立場を取る', '場所に位置する', '物を立てる']],
  ];

  it.each(RANGES)('pairId %i の採用範囲と除外範囲が記録されている', (pairId, adopted, excluded) => {
    const entry = byId.get(pairId as number)!;
    const row = entry.資料条件.get(2) ?? '';
    for (const word of adopted as string[]) {
      expect(row, `pairId ${pairId} の条件2に採用範囲「${word}」が無い`).toContain(word);
    }
    for (const word of excluded as string[]) {
      expect(row, `pairId ${pairId} の条件2に除外範囲「${word}」が無い`).toContain(word);
    }
  });

  it('92 は博士号などの意味を除外し、doctor を医師だけだと断定していない', () => {
    const e = byId.get(92)!;
    expect(e.資料条件.get(2), '92 が博士号の意味を除外していない').toContain('博士号を持つ人');
    expect(e.確認した内容, '92 が doctor の語義を1つに断定している')
      .toContain('doctor が医師だけを指すとは判断していない');
    expect(e.注意点, '92 の注意点に博士号の語義が無い').toContain('博士号');
  });

  it('93 は動詞用法などを除外し、nurse の語義を1つに断定していない', () => {
    const e = byId.get(93)!;
    expect(e.資料条件.get(2), '93 が動詞用法を除外していない').toContain('動詞');
    expect(e.確認した内容, '93 が nurse の語義を断定している')
      .toContain('nurse の語義を1つに断定していない');
    expect(e.資料条件.get(5), '93 が性別で呼び分けない表記の理由を書いていない')
      .toContain('性別で呼び分けない');
  });

  it('94 は医学という分野を除外し、可算性を断定していない', () => {
    const e = byId.get(94)!;
    expect(e.資料条件.get(2), '94 が学問としての医学を除外していない').toContain('学問としての医学');
    expect(e.資料条件.get(2), '94 が医療という分野を除外していない').toContain('医療という職業・分野');
    // 可算・不可算を決めつけない。
    expect(e.資料条件.get(3), '94 が medicine を常に不可算だと扱っている')
      .toContain('medicine が常に不可算だと扱うわけではない');
    expect(e.注意点, '94 の注意点に数えかたの断りが無い').toContain('常に不可算だとは決めていない');
    expect(checklist, '94 を常に不可算だと書いている').not.toContain('medicine は常に不可算');
  });

  it('96 は歩行補助具に限定し、植物やむちを除外している', () => {
    const e = byId.get(96)!;
    expect(e.資料条件.get(2), '96 が歩行補助具に限定していない').toContain('歩くときに体を支える');
    expect(e.資料条件.get(2), '96 が植物の茎を除外していない').toContain('植物の茎');
    expect(e.資料条件.get(2), '96 がむちを除外していない').toContain('むち');
    // 直接入力の答えが1つに決まることを注意点へ書いてある。
    expect(e.注意点, '96 の注意点に walking stick の扱いが無い')
      .toContain('walking stick や stick は正解にならない');
    expect(e.注意点, '96 の注意点に採用した答えが書かれていない').toContain('この札で採用した答えは cane');
  });

  it('97 は衛生用に限定し、仮面などを除外している', () => {
    const e = byId.get(97)!;
    expect(e.資料条件.get(2), '97 が衛生用に限定していない').toContain('鼻と口を覆う');
    expect(e.資料条件.get(2), '97 が仮面を除外していない').toContain('仮面');
    expect(e.表記, '97 の表記').toBe('カタカナ');
    expect(e.資料条件.get(5), '97 がカタカナ表記を維持する理由を書いていない').toContain('カタカナ');
  });

  it('100 は腹部を採り、胃だけへ限定していない', () => {
    const e = byId.get(100)!;
    expect(e.資料条件.get(2), '100 が腹部を採っていない').toContain('体の外側から指させる腹部');
    expect(e.確認した内容, '100 が stomach を臓器だけだと断定している')
      .toContain('stomach が臓器だけを指すとは判断していない');
    expect(e.注意点, '100 の注意点に胃の語義が無い').toContain('胃という臓器を指す語義も持つ');
    expect(e.注意点, '100 の注意点に採用範囲が無い').toContain('外から指させる腹部だけを扱い');
    expect(checklist, '100 を胃だけだと書いている').not.toContain('stomach は胃だけを指す');
  });

  it('101 は手の指に限定し、足の指を除外している', () => {
    const e = byId.get(101)!;
    expect(e.資料条件.get(2), '101 が手の指に限定していない').toContain('手の指だけを扱い');
    expect(e.資料条件.get(2), '101 が足の指を除外していない').toContain('足の指');
    expect(e.資料条件.get(2), '101 が toe を除外していない').toContain('toe');
    // 日本語の「ゆび」が足の指を含み得ることを否定していない。
    expect(e.確認した内容, '101 が日本語の範囲を否定している')
      .toContain('足の指を含み得ることは否定していない');
    expect(e.注意点, '101 の注意点に日本語の範囲が無い').toContain('足の指も含み得る');
  });

  it('104 は「立つ」に限定し、同音異義語と stand の別義を除外している', () => {
    const e = byId.get(104)!;
    const row = e.資料条件.get(2) ?? '';
    for (const word of ['建物が建つ', '時間が経つ', '発つ', '断つ', '名詞の stand', '我慢する・耐える']) {
      expect(row, `104 が「${word}」を除外していない`).toContain(word);
    }
    expect(e.確認した内容, '104 が語義を1つに断定している').toContain('語義を1つに断定せず');
    expect(e.注意点, '104 の注意点にひらがな表記の断りが無い')
      .toContain('ひらがなの「たつ」だけでは漢字の書き分けが見えない');
    expect(e.注意点, '104 の注意点に採用範囲が無い').toContain('「立つ」だけを扱う');
  });

  it('8語は工程V-2O-1でゲームへ入り、共通セットと医療・介護セットに入っている', () => {
    const common = findVocabularySet('common-practice')!;
    const care = findVocabularySet('care-practice')!;
    for (const pairId of CARE_SOURCE_IDS) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId), `${pairId} がゲームデータに無い`)
        .toBe(true);
      expect(common.pairIds, `common-practice に ${pairId} が無い`).toContain(pairId);
      expect(care.pairIds, `care-practice に ${pairId} が無い`).toContain(pairId);
    }
    expect(SAMPLE_PAIRS).toHaveLength(105);
    // 確認とゲーム追加が別の判断だという説明は残してある。
    expect(checklist, '確認とゲーム追加が別だと書かれていない')
      .toContain('確認が済んだからといって、語が自動的にゲームへ入ることはありません。');
  });

  it('見送りの99が、資料確認した8語にも確認済みにも混ざっていない', () => {
    expect(byId.get(99)!.状態, '99 の状態').toBe('見送り（候補）');
    expect(byId.get(99)!.確認の方法, '99 の確認の方法').toBe('');
    expect(verified.map((e) => e.pairId), '99 が確認済みに入っている').not.toContain(99);
    expect(VERIFIED_IDS, '99 が確認済みの一覧に入っている').not.toContain(99);
    expect(SOURCE_CHECKED_IDS, '99 が資料確認の一覧に入っている').not.toContain(99);
    expect(managed.map((e) => e.pairId), '99 が管理する105語に入っている').not.toContain(99);
  });

  it('辞書本文を長く写さず、訳語一覧や例文を持ち込んでいない', () => {
    // 英辞郎など、訳語を並べた資料の内容を持ち込まない。
    for (const phrase of ['英辞郎', 'アルク', 'EDP', '【名】', '【動】', '〔～を〕']) {
      expect(checklist, `台帳に「${phrase}」がある`).not.toContain(phrase);
    }
    // 台帳の決まりとしても書いてある。
    const rules = checklist.slice(checklist.indexOf('## 9. この台帳を変えるときの決まり'));
    expect(rules, '本文を写さない決まりが無い')
      .toContain('辞書本文を長く写しません。確認できた語義を独自の短い日本語で要約します。');
    expect(rules, '掲載サイトと発行元を書き分ける決まりが無い')
      .toContain('掲載サイトと辞書の発行元を書き分けます');
  });

  it('台帳が、105語すべての確認が終わったと正しく書いている', () => {
    for (const phrase of [
      '- 進み具合: **確認済み 105語 / 要確認 0語**',
      '| `要確認（候補）` | 0件 | — |',
      '| 確認済み | 105語（1〜98・100〜106） | 0語（—） |',
      '| 要確認 | 0語（—） | 0語（—） |',
      '| ゲームで使用中・確認済み | 105語 | 1〜98・100〜106 |',
      '| 台帳だけの候補 | 0語 | — |',
      '確認済み 105 + 要確認 0             = 現在管理する 105 語',
      '基本語判断 90 + 資料確認 15          = 確認済み 105 語',
      '現在管理する 105 語 + 見送り履歴 1 件 = 掲載記録 106 件',
      '**確認が終わったことと、ゲームへ入れたことは、いまも別の判断です。**',
    ]) {
      expect(checklist, `「${phrase}」が台帳に書かれていない`).toContain(phrase);
    }
  });
});

/**
 * 工程V-2N-1で候補92の表記を「おいしゃさん」から「いしゃ」へ変えた記録。
 *
 * 表記を変えた時点では資料確認も採用もしていない。
 * 資料確認を終えたのは工程V-2N-2で、そのとき「いしゃ」のまま採用した。
 * 変えた理由が台帳に残り続けていることと、古い表記が候補として残っていないことを見る。
 */
describe('工程V-2N-1で表記を変えた候補92', () => {
  const doctor = () => byId.get(92)!;

  it('92 は いしゃ / doctor になっている', () => {
    expect(doctor().ja, '92 の日本語候補').toBe('いしゃ');
    expect(doctor().en, '92 の英語候補').toBe('doctor');
    expect(checklist, '92 の見出しが変わっていない').toContain('### 92. いしゃ / doctor');
  });

  it('「おいしゃさん」は現在の候補として残っていない', () => {
    // 台帳のどの語の日本語候補にも「おいしゃさん」は無い。
    expect(ENTRIES.filter((e) => e.ja === 'おいしゃさん')).toHaveLength(0);
    expect(checklist, '古い見出しが残っている').not.toContain('### 92. おいしゃさん / doctor');
    expect(checklist, '日本語候補の行に古い表記が残っている')
      .not.toContain('| 日本語候補 | おいしゃさん |');
    // 変更の記録として言及するのはよい。理由の説明には出てくる。
    expect(doctor().表記変更理由, '変更理由に古い表記が書かれていない').toContain('おいしゃさん');
  });

  it('92 に候補表記を変えた日と理由が残っている', () => {
    expect(doctor().表記変更日, '92 の候補表記の変更日').toBe('2026-09-26');
    for (const phrase of ['敬称', '完全一致', '子どもから大人まで']) {
      expect(doctor().表記変更理由, `92 の変更理由に「${phrase}」が無い`).toContain(phrase);
    }
    // 表記を変えた時点では確認も採用もしていなかった、という経緯が残っている。
    expect(
      doctor().表記変更理由,
      '92 の変更理由に、表記を変えた時点では確認も採用もしていないと書かれていない',
    ).toContain('表記を変えた時点では資料確認も採用も行っていない');
    // 資料確認を終えたのは別の工程だと分かる。
    expect(doctor().表記変更理由, '92 の変更理由に、資料確認を終えた工程が書かれていない')
      .toContain('資料確認を終えたのは工程 V-2N-2');
  });

  it('92 は表記を変えたあと、工程V-2N-2で「いしゃ」のまま採用された', () => {
    // 表記変更（V-2N-1）と資料確認（V-2N-2）は別の判断。両方の記録が残っている。
    expect(doctor().状態, '92 の状態').toBe('確認済み');
    expect(doctor().確認の方法, '92 の確認の方法').toBe('資料確認');
    expect(doctor().判定, '92 の判定').toBe('採用');
    expect(doctor().確認日, '92 の確認日').toBe('2026-09-26');
    // 採用したのは変更後の表記。古い表記へ戻っていない。
    expect(doctor().ja, '92 の日本語候補').toBe('いしゃ');
    expect(doctor().資料条件.get(5), '92 の条件5に、改めた表記を採る理由が無い')
      .toContain('敬称を含まない形へ改めた');
    // 2つの道を混ぜない。
    expect(doctor().条件.size, '92 に基本語条件がある').toBe(0);
    expect(doctor().資料条件.size, '92 に資料確認条件が無い').toBe(5);
  });
});

/**
 * 工程V-2N-1。候補99「あし / foot」の見送り。
 *
 * 日本語の「あし」は足先と脚全体の両方に使われ、英語は foot と leg に分かれる。
 * 直接入力テストの正誤判定は文字列の完全一致なので、日本語から英語へ答えるときに
 * 答えを1つに決められない。資料確認で語義を記録しても、この曖昧さは消えない。
 *
 * 見送りは「確認済み」でも「採用」でもなく、「要確認」でもない。
 * pairId 99 は履歴として残し、別の語へ割り当て直さない。
 */
describe('工程V-2N-1で見送りにした候補99', () => {
  const foot = () => byId.get(99)!;

  it('99 は 見送り（候補）・判定 見送り', () => {
    expect(foot().状態, '99 の状態').toBe('見送り（候補）');
    expect(foot().判定, '99 の判定').toBe('見送り');
    expect(foot().見送り日, '99 の見送り日').toBe('2026-09-26');
    expect(dropped.map((e) => e.pairId)).toEqual([99]);
  });

  it('99 の見出しと候補語は履歴としてそのまま残っている', () => {
    expect(checklist, '99 の見出しが変わっている').toContain('### 99. あし / foot');
    expect(foot().ja, '99 の日本語候補').toBe('あし');
    expect(foot().en, '99 の英語候補').toBe('foot');
    expect(foot().種類, '99 の種類').toBe('体');
    expect(foot().品詞, '99 の品詞').toBe('名詞');
  });

  it('99 は確認済みでも採用でもない', () => {
    expect(foot().状態, '99 が確認済みになっている').not.toBe('確認済み');
    expect(foot().判定, '99 の判定に採用が入っている').not.toContain('採用');
    expect(foot().確認の方法, '99 の確認の方法').toBe('');
    expect(foot().確認日, '99 の確認日').toBe('');
    expect(foot().確認した資料, '99 の確認した資料').toBe('');
    expect(foot().URL, '99 のURL').toBe('');
    expect(foot().直接確認, '99 の正本URLを直接開いた').toBe('');
    expect(foot().確認経路, '99 の本文確認の経路').toBe('');
    expect(foot().確認した内容, '99 の確認した内容').toBe('');
    expect(foot().条件.size, '99 に基本語条件がある').toBe(0);
    expect(foot().資料条件.size, '99 に資料確認条件がある').toBe(0);
    expect(verified.map((e) => e.pairId), '99 が確認済みの集合に入っている').not.toContain(99);
  });

  it('99 は有効な候補15語に数えられていない', () => {
    expect(CARE_CANDIDATE_IDS, '99 が有効な候補に入っている').not.toContain(99);
    expect(CARE_CONFIRMED_IDS, '99 が確認済み7語に入っている').not.toContain(99);
    expect(CARE_PENDING_IDS, '99 が要確認8語に入っている').not.toContain(99);
    expect(managed.map((e) => e.pairId), '99 が現在管理する105語に入っている').not.toContain(99);
    expect(managed).toHaveLength(MANAGED_WORD_COUNT);
  });

  it('99 の見送り理由に、判定の曖昧さが記録されている', () => {
    for (const phrase of [
      '足先と脚全体',
      'foot と leg',
      '完全一致',
      '文字だけの直接入力',
      'leg」へ変えても',
      '資料確認で語義を記録しても',
    ]) {
      expect(foot().見送り理由, `99 の見送り理由に「${phrase}」が無い`).toContain(phrase);
    }
    expect(foot().見送り理由.length, '99 の見送り理由が短すぎる').toBeGreaterThan(100);
  });

  it('pairId 99 を別の語へ再利用していない', () => {
    // 台帳で 99 を持つ記録は1件だけで、その語は「あし / foot」のまま。
    expect(ENTRIES.filter((e) => e.pairId === 99)).toHaveLength(1);
    expect(byId.get(99)!.ja).toBe('あし');
    // 代わりの札は新しい番号（106）で入れてある。
    expect(byId.get(106)!.ja).toBe('ひざ');
    expect(byId.get(106)!.pairId).toBe(106);
    // ゲームデータにも 99 は無い。
    expect(SAMPLE_PAIRS.some((p) => p.pairId === 99)).toBe(false);
    // 欠番を詰め直さない決まりが台帳に書いてある。
    expect(checklist, '見送りのpairIdを残す決まりが書かれていない')
      .toContain('見送りになった pairId 99「あし / foot」も、この決まりのとおり**欠番として台帳に残し**');
  });
});

/**
 * 工程V-2N-1。`基本語判断` で確認済みにした候補7語。
 *
 * 外部の資料は使っていない。台帳 第3-2節の5条件だけで判断した語。
 * 確認が終わっただけで、ゲームへは入れていない。
 */
describe('工程V-2N-1で基本語判断した候補7語', () => {
  const entries = CARE_CONFIRMED_IDS.map((id) => byId.get(id)!);

  it('7語とも 使用中・確認済み・基本語判断・採用', () => {
    expect(entries).toHaveLength(7);
    for (const entry of entries) {
      // 工程V-2O-1でゲームへ入ったので使用中。基本語判断の記録はそのまま。
      expect(entry.使用状況, `${entry.pairId} の使用状況`).toBe('使用中');
      expect(entry.状態, `${entry.pairId} の状態`).toBe('確認済み');
      expect(entry.確認の方法, `${entry.pairId} の確認の方法`).toBe('基本語判断');
      expect(entry.判定, `${entry.pairId} の判定`).toBe('採用');
      expect(entry.確認日, `${entry.pairId} の確認日`).toBe('2026-09-26');
    }
  });

  it('7語とも 資料名・発行元・URL・本文確認欄 が空', () => {
    for (const entry of entries) {
      expect(entry.確認した資料, `${entry.pairId} の確認した資料`).toBe('');
      expect(entry.URL, `${entry.pairId} のURL`).toBe('');
      expect(entry.直接確認, `${entry.pairId} の正本URLを直接開いた`).toBe('');
      expect(entry.確認経路, `${entry.pairId} の本文確認の経路`).toBe('');
      expect(entry.追加確認日, `${entry.pairId} の追加確認日`).toBe('');
      expect(entry.追加確認内容, `${entry.pairId} の追加確認の内容`).toBe('');
    }
  });

  it('7語とも 基本語条件1〜5 がそろい、どの行も中身がある', () => {
    for (const entry of entries) {
      expect([...entry.条件.keys()].sort((a, b) => a - b), `${entry.pairId} の条件の番号`)
        .toEqual([1, 2, 3, 4, 5]);
      expect(entry.資料条件.size, `${entry.pairId} に資料確認条件がある`).toBe(0);
      for (const [number, name] of CONDITION_NAMES) {
        const [label, value] = (entry.条件.get(number) ?? '').split('\t');
        expect(label, `${entry.pairId} の条件${number}の見出し`).toBe(name);
        expect(value.startsWith('適合：'), `${entry.pairId} の条件${number}の書き出し`).toBe(true);
        expect(
          value.replace('適合：', '').trim().length,
          `${entry.pairId} の条件${number}に理由が書かれていない`,
        ).toBeGreaterThan(10);
      }
    }
  });

  it('条件4は、いま管理している105語の範囲で書いてある', () => {
    // 「日本語に同音語が無い」ではなく、台帳の範囲に限って書く。
    for (const entry of entries) {
      expect(entry.条件.get(4), `${entry.pairId} の条件4が台帳の範囲で書かれていない`)
        .toContain(`いま管理している${MANAGED_WORD_COUNT}語`);
    }
  });

  it('91・95・98・106は名詞の単数形、102・103・105は動詞の原形', () => {
    for (const pairId of [91, 95, 98, 106]) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('名詞の単数形');
    }
    for (const pairId of [102, 103, 105]) {
      expect(wordForm(byId.get(pairId)!), `${pairId} の語形`).toBe('動詞の原形');
    }
  });

  it('7語の条件と確認内容を使い回していない', () => {
    for (const number of [1, 2, 4, 5]) {
      const rows = entries.map((e) => e.条件.get(number) ?? '');
      expect(new Set(rows).size, `条件${number} が使い回されている`).toBe(rows.length);
    }
    expect(new Set(entries.map((e) => e.確認した内容)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.注意点)).size).toBe(entries.length);
  });

  it('条件2は、その語で採る意味を限定し、別の意味を否定していない', () => {
    for (const entry of entries) {
      const row = entry.条件.get(2) ?? '';
      expect(row, `${entry.pairId} の条件2に「この札では扱わない」が無い`)
        .toContain('この札では扱わない');
      for (const word of NEGATIONS) {
        expect(row, `${entry.pairId} の条件2に「${word}」がある`).not.toContain(word);
      }
    }
  });

  it('確認が終わった7語にも「確認する論点」の行を残していない', () => {
    // 「確認する論点」は、これから確かめることを書く行。
    // 確認が済んだ語は、採用範囲を 基本語条件 と 注意点 で書く。
    for (const entry of entries) {
      expect(entry.論点, `${entry.pairId} に確認する論点が残っている`).toBe('');
      expect(entry.注意点, `${entry.pairId} の注意点に未確認の論点がある`)
        .not.toContain('未確認の論点');
      expect(entry.注意点.length, `${entry.pairId} の注意点が短すぎる`).toBeGreaterThan(20);
    }
  });

  it.each(CARE_CONFIRMED_NOTES)('pairId %i の注意点に、扱わない意味が書いてある', (pairId, words) => {
    const entry = byId.get(pairId as number)!;
    for (const word of words as string[]) {
      expect(entry.注意点, `pairId ${pairId} の注意点に「${word}」が無い`).toContain(word);
    }
  });

  it('106 は ひざ / knee で、99 の代わりに置いた札だと書いてある', () => {
    const knee = byId.get(106)!;
    expect(knee.ja).toBe('ひざ');
    expect(knee.en).toBe('knee');
    expect(knee.種類).toBe('体');
    expect(knee.品詞).toBe('名詞');
    expect(knee.表記).toBe('ひらがな');
    expect(knee.注意点, '106 に 99 の代わりだと書かれていない').toContain('pairId 99');
    // どちらの向きから答えても決まる、という採用理由が書いてある。
    expect(knee.確認した内容, '106 の確認内容に、両方向で決まると書かれていない')
      .toContain('どちらの向きから答えても');
  });

  it('7語は工程V-2O-1でゲームへ入り、共通セットと医療・介護セットに入っている', () => {
    const common = findVocabularySet('common-practice')!;
    const care = findVocabularySet('care-practice')!;
    for (const pairId of CARE_CONFIRMED_IDS) {
      expect(SAMPLE_PAIRS.some((p) => p.pairId === pairId), `${pairId} がゲームデータに無い`)
        .toBe(true);
      expect(common.pairIds, `common-practice に ${pairId} が無い`).toContain(pairId);
      expect(care.pairIds, `care-practice に ${pairId} が無い`).toContain(pairId);
    }
    expect(SAMPLE_PAIRS).toHaveLength(105);
    // 台帳にも、確認とゲーム追加が別の判断だと書いてある。
    expect(checklist, '確認が札を増やす理由ではないと書かれていない')
      .toContain('確認が済んだからといって、語が自動的にゲームへ入ることはありません。');
  });
});
