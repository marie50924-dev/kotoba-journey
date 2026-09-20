/**
 * 国紹介のデータ。
 *
 * 表示する文章はすべてここに置き、画面側には一切書かない。
 * 国を追加しても画面コードは変更せず、このファイルへ1件足すだけで済む。
 *
 * 事実の扱い：
 * - 公的機関・一次情報で確認できた範囲だけを書く。
 * - 画面に出す事実は1文ずつ FactClaim にし、出典と確認状態を持たせる。
 * - 本文をそのまま写さず、小学生が読める短さへ要約する。
 * - 「世界一」などの言い切りは、資料の本文で確認できた場合だけ使う。
 * - 気候は地域差があるので「国全体が同じ」と読めない書き方にする。
 * - 特産物（とれるもの）と名物料理（りょうり）を混ぜない。
 * - 戦争・宗教・領土・政治は、今回必要がないので深掘りしない。
 * - ステレオタイプ、国民性の断定、観光広告のような表現は書かない。
 *
 * 公開の扱い：
 * publicationStatus が 'verified' の国だけ、詳細（もっと知る）を公開導線へ出す。
 * 'draft' の国は「準備中」とだけ案内し、事実の文章は画面に出さない。
 * ゲームの進行（カルタ）は draft でも妨げない。
 *
 * 確認の方法について：
 * この開発環境は外向き通信が遮断されており、公的機関のページ本文を取得できない。
 * そのため、どの FactClaim もまだ本文確認ができておらず、すべて 'unchecked'。
 * 人が本文を読んで確認したら 'body-checked' へ変える。
 * 手順と対象一覧は docs/reports/COUNTRY_GUIDE_JAPAN_SOURCE_CHECKLIST.md にある。
 *
 * 日本以外の国は、確認できていない情報を推測で書かない。
 * データが無い国でも、ゲームの進行は止まらない設計にしてある。
 */

import { findPair } from './wordPairs';

/** 国旗の表現。正式な旗素材が入るまでは CSS で描く。 */
export type CountryFlag = { kind: 'japan' } | { kind: 'placeholder' };

/**
 * 出典の確認状態。
 *
 * - 'body-checked': 資料の本文を実際に読んで内容を確認した。
 * - 'url-only'    : 所在は特定したが、本文は読めていない。
 */
export type SourceVerification = 'body-checked' | 'url-only';

/** 出典。1件ごとに確認日と確認状態を持たせる。 */
export interface InfoSource {
  id: string;
  /** 機関名と資料名。機関名だけでは資料を特定できないので、資料名まで書く。 */
  sourceLabel: string;
  sourceUrl: string;
  /** 所在を確かめた日（YYYY-MM-DD）。本文を読んだ日ではない。 */
  checkedAt: string;
  verification: SourceVerification;
}

/**
 * 事実1件の確認状態。
 *
 * - 'unchecked'   : まだ本文で確認していない。公開してはいけない。
 * - 'body-checked': 下の条件をすべて満たして確認した。
 * - 'rejected'    : 確認した結果、資料と合わないので出さないと決めた。
 *
 * 'body-checked' にしてよいのは、次をすべて満たしたときだけ。
 *   1. URL を開いた
 *   2. ページ本文を読んだ
 *   3. 該当する文章を本文の中に確認した
 *   4. ゲーム内の文章が資料の範囲を超えていない
 *   5. 確認日と、本文で確認した内容のメモを残した
 *
 * URL が存在する、ドメインが公的機関、資料名にそれらしい語が入っている —
 * これらはどれも 'body-checked' の根拠にならない。
 */
export type ClaimVerification = 'unchecked' | 'body-checked' | 'rejected' | 'withdrawn';

/**
 * 画面に出さない状態。
 *
 * 'rejected'  … 資料の本文を読んだ結果、使わないと判断した文章。
 * 'withdrawn' … 本文を読む前に、書き方や資料の有無を理由に取り下げた文章。
 *               資料に書いてあるかどうかは判定していない。
 *
 * 画面での扱いは同じ（絶対に出さない・監査記録として残す・
 * 表示対象から外れていれば公開を妨げない）。
 * 分けてあるのは、あとから見た人が
 * 「読んでからだめだったのか」「読む前に下げたのか」を取りちがえないため。
 */
export const DROPPED_VERIFICATIONS: readonly ClaimVerification[] = ['rejected', 'withdrawn'];

/** 画面に出してはいけない文章か。 */
export function isDropped(claim: FactClaim): boolean {
  return DROPPED_VERIFICATIONS.includes(claim.verification);
}

/** 画面に出す事実1件。 */
export interface FactClaim {
  /** 安定したID。文章を直してもIDは変えない。 */
  id: string;
  /** 画面に出す文章そのもの。 */
  text: string;
  /** 本文で確認できて、この文章を裏づける資料。確認できるまで空。 */
  sourceIds: string[];
  verification: ClaimVerification;
  /** 本文を確認した日（body-checked のときだけ入る）。 */
  checkedAt?: string;
  /** 本文で確認した内容のメモ、または確認待ちの理由。 */
  verificationNote?: string;
  /** これから本文を確認する予定の資料。確認できたら sourceIds へ移す。 */
  candidateSourceIds?: string[];
}

/** 都市・観光地・料理・特産物など、あとから足したり並べ替えたりする項目。 */
export interface NamedItem {
  id: string;
  name: string;
  /** ひとこと説明。無くてもよい。 */
  note?: string;
  /** 名前や説明が事実にあたる項目は、確認状態を持つ。 */
  claim?: FactClaim;
}

/** 歴史の1区切り。長い年表は作らず、流れだけを短く置く。 */
export interface HistoryNote {
  id: string;
  /** 「むかし」「武士の時代」など、年号に頼らない見出し。 */
  era: string;
  body: string;
  claim: FactClaim;
}

/** その国で学ぶ英単語。語彙データの pairId と対応させる。 */
export interface LearningWord {
  pairId: number;
}

/** 詳細セクションの種類。画面の並び順もこの順にする。 */
export type DetailSectionId =
  | 'cities'
  | 'nature'
  | 'climate'
  | 'landmarks'
  | 'foods'
  | 'history'
  | 'culture'
  | 'words';

/** 公開状態。verified の国だけ詳細を公開導線へ出す。 */
export type PublicationStatus = 'draft' | 'verified';

/**
 * あいさつ。
 *
 * 「この国では『こんにちは』、英語では『Hello』」という対応そのものが、
 * 子どもへ教える学習情報なので、事実として本文確認の対象にする。
 * UI の飾りではないため、確認が終わるまで画面には出さない。
 *
 * 表示する語（ja / en）と確認する文章（claim.text）がずれないよう、
 * claim.text は greetingOf() が ja / en から組み立てる。
 */
export interface Greeting {
  /** 画面に出す現地のあいさつ。 */
  ja: string;
  /** 画面に出す英語のあいさつ。 */
  en: string;
  /** 「◯◯のあいさつ『…』は、英語では『…』と表します。」という事実。 */
  claim: FactClaim;
}

export interface CountryIntro {
  countryId: string;
  countryNameJa: string;
  countryNameEn: string;
  flag: CountryFlag;
  /** 世界マップ上のおおよその位置 0〜1。 */
  position: { x: number; y: number };

  /** 公開状態。draft のあいだ、事実の文章は画面に出さない。 */
  publicationStatus: PublicationStatus;

  /** 首都。代表的な都市とは別に持つ。 */
  capital: NamedItem;
  /** 代表的な都市。首都は含めない。 */
  majorCities: NamedItem[];
  /** 「首都は◯◯です。」の1文。 */
  capitalLine: FactClaim;

  /**
   * あいさつ。日本語と英語の対応そのものを学習情報として確認する。
   *
   * 任意にしてある。人が本文を確認した結果あいさつを不採用にしたときは、
   * この項目ごと外し、元の claim を retiredClaims へ1件だけ残す。
   * ダミーのあいさつを置かずに表示対象から完全に外すための形。
   */
  greeting?: Greeting;
  /** 到着直後に出す短い紹介文。 */
  summary: FactClaim;
  /** 到着直後に1件だけ出す「有名なもの」。 */
  highlight: NamedItem;

  /** 地形・自然の特徴。 */
  geography: FactClaim[];
  /** 気候。地域差があるならそれが分かるように書く。 */
  climate: FactClaim[];
  /** 旅行時の服装の目安。 */
  clothingTips: FactClaim[];
  /**
   * 服装の目安についての断り書き。
   * 事実の主張ではなくゲーム内の注意書きなので、FactClaim にはしない。
   */
  clothingNote: string;

  /** 有名な建物・場所・観光地。 */
  landmarks: NamedItem[];
  /** 有名な食べもの（料理）。 */
  foods: NamedItem[];
  /** 特産物（とれるもの）。料理とは分けて持つ。 */
  specialties: NamedItem[];
  /**
   * 特産物の地域差についての説明。
   * 取り下げた国では項目ごと無くなるので任意にしてある。
   */
  specialtiesNote?: FactClaim;

  history: HistoryNote[];
  /** 文化・生活習慣。 */
  culture: FactClaim[];
  /** 子どもにも分かる旅行マナー。 */
  manners: FactClaim[];

  /** この国で学ぶ英単語。語彙データの pairId で指す。 */
  learningWords: LearningWord[];
  /** 「この国で学ぶこと」の案内文。ゲーム内の説明なので FactClaim にしない。 */
  learning: string;

  sources: InfoSource[];

  /**
   * 表示から外した事実。本文を読んだ結果の不採用（rejected）と、
   * 本文を読む前の取り下げ（withdrawn）の両方が入る。
   *
   * 監査記録として残すためのもので、画面には一切出ない。
   * 表示対象から外れているので、国全体の公開は妨げない。
   */
  retiredClaims: FactClaim[];
}

/**
 * 日本の出典。
 *
 * 2026-09-20 に、公的ドメインに限定した検索で所在を特定した。
 * ただし、この開発環境からは各機関のページ本文を取得できないため、
 * すべて verification: 'url-only'（本文未確認）である。
 * 本文を確認したら 'body-checked' へ変えること。
 */
const JAPAN_SOURCES: InfoSource[] = [
  {
    id: 'tokyo-profile',
    sourceLabel: '東京都「東京都プロフィール　都の概要」',
    sourceUrl: 'https://www.metro.tokyo.lg.jp/tosei/tokyoto/profile/gaiyo',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'tokyo-municipalities',
    sourceLabel: '東京都「都内区市町村マップ」',
    sourceUrl: 'https://www.metro.tokyo.lg.jp/tosei/tokyoto/profile/gaiyo/kushichoson',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'rinya-forest',
    sourceLabel: '林野庁「都道府県別森林率・人工林率」',
    sourceUrl: 'https://www.rinya.maff.go.jp/j/keikaku/genkyou/index2.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'gsi-mountains',
    sourceLabel: '国土地理院「日本の主な山岳標高（1003山）」',
    sourceUrl: 'https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'jma-climate',
    sourceLabel: '気象庁「日本の気候」',
    sourceUrl:
      'https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'jma-baiu',
    sourceLabel: '気象庁「過去の梅雨入りと梅雨明け」',
    sourceUrl: 'https://www.data.jma.go.jp/cpd/baiu/index.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'bunka-heritage',
    sourceLabel: '文化庁「日本の世界遺産一覧」',
    sourceUrl: 'https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/',
    checkedAt: '2026-09-20',
    verification: 'body-checked',
  },
  {
    id: 'bunka-horyuji',
    sourceLabel: '文化庁 文化遺産オンライン「法隆寺地域の仏教建造物　詳細解説」',
    sourceUrl:
      'https://online.bunka.go.jp/docs/special_content/detailed_explanation/1_horyuji.pdf',
    checkedAt: '2026-09-20',
    verification: 'body-checked',
  },
  {
    id: 'unesco-horyuji',
    sourceLabel: 'UNESCO 世界遺産センター「法隆寺地域の仏教建造物」',
    sourceUrl: 'https://whc.unesco.org/ja/list/660',
    checkedAt: '2026-09-20',
    verification: 'body-checked',
  },
  {
    id: 'maff-washoku',
    sourceLabel: '農林水産省「『和食』がユネスコ無形文化遺産に登録されています」',
    sourceUrl: 'https://www.maff.go.jp/j/keikaku/syokubunka/ich/',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'maff-local-food',
    sourceLabel: '農林水産省「うちの郷土料理　次世代に伝えたい大切な味」',
    sourceUrl: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/index.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'maff-traditional-foods',
    sourceLabel: '農林水産省「にっぽん伝統食図鑑」',
    sourceUrl: 'https://www.maff.go.jp/j/keikaku/syokubunka/traditional-foods/index.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'webjapan-history',
    sourceLabel: 'Web Japan（外務省）Kids Web Japan「歴史」',
    sourceUrl: 'https://web-japan.org/kidsweb/explore/history/index.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'webjapan-annual-events',
    sourceLabel: 'Web Japan（外務省）Japan Fact Sheet「年中行事」',
    sourceUrl: 'https://web-japan.org/factsheet/archives/ja/pdf/J21_annual.pdf',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
  {
    id: 'kankocho-manners',
    sourceLabel: '観光庁「日本のマナーを知ってもらおう！　訪日外国人旅行者向けマナー啓発動画」',
    sourceUrl: 'https://www.mlit.go.jp/kankocho/news08_000304.html',
    checkedAt: '2026-09-20',
    verification: 'url-only',
  },
];

/**
 * 確認待ちの事実を作る補助。
 *
 * 本文を読めていないあいだは sourceIds を空にし、
 * これから確かめる資料を candidateSourceIds に置く。
 * これで「割り当てたから確認済み」と取り違えることがなくなる。
 */
function pending(
  id: string,
  text: string,
  candidateSourceIds: string[],
  verificationNote: string,
): FactClaim {
  return {
    id,
    text,
    sourceIds: [],
    verification: 'unchecked',
    verificationNote,
    candidateSourceIds,
  };
}

/**
 * 人が資料の本文を読んで確認できた事実。
 *
 * sourceIds には、本文で該当記述まで確認できた資料だけを入れる。
 * 「一覧に名前があった」だけの資料は、その文章を支えていないなら入れない。
 */
function confirmed(
  id: string,
  text: string,
  sourceIds: string[],
  checkedNote: string,
  checkedAt: string,
): FactClaim {
  return {
    id,
    text,
    sourceIds,
    verification: 'body-checked',
    verificationNote: checkedNote,
    checkedAt,
  };
}

/** 本文を読む前に取り下げた理由。どれも「資料に書いてあるか」は判定していない。 */
const WITHDRAWN_NO_SOURCE =
  '本文確認の前に取り下げた。この文章を直接あつかう資料が見つからなかったため。資料に書いてあるかどうかは判定していない。';
const WITHDRAWN_TOO_BROAD =
  '本文確認の前に取り下げた。文章が、割り当てた資料であつかう範囲を超えているため。資料に書いてあるかどうかは判定していない。';
const WITHDRAWN_ADVICE =
  '本文確認の前に取り下げた。資料に書かれた事実ではなく、ゲーム内の助言だったため。';
const WITHDRAWN_SUMMARIZED =
  '本文確認の前に取り下げた。文章の要約度が高く、資料の本文と1対1で対応づけられないため。資料に書いてあるかどうかは判定していない。';

/**
 * 取り下げた事実を作る補助。
 *
 * 文章も claimId も元のまま残す。監査記録として、あとから
 * 「どの文章を、どういう理由で下げたか」を追えるようにするため。
 * 出典は割り当てない。読んでいない資料を根拠のように見せないため。
 */
function withdrawnClaim(id: string, text: string, reason: string): FactClaim {
  return {
    id,
    text,
    sourceIds: [],
    verification: 'withdrawn',
    verificationNote: reason,
    candidateSourceIds: [],
  };
}

/**
 * あいさつを作る補助。
 *
 * 画面に出す語と、確認する文章を二重に書かない。
 * 文章は ja / en から組み立てるので、語を直せば文章も一緒に直り、
 * 表示とチェックリストの記述が食い違わない。
 * claimId は引数で固定する。文章を直しても claimId は変えない。
 */
function greetingOf(
  claimId: string,
  countryNameJa: string,
  ja: string,
  en: string,
  verificationNote: string,
): Greeting {
  return {
    ja,
    en,
    claim: {
      id: claimId,
      text: `${countryNameJa}のあいさつ「${ja}」は、英語では「${en}」と表します。`,
      sourceIds: [],
      verification: 'unchecked',
      verificationNote,
      candidateSourceIds: [],
    },
  };
}

const NOTE_NEED_BODY = '資料の本文をまだ読めていない。本文で該当箇所を確認すること。';

export const COUNTRY_INTROS: readonly CountryIntro[] = [
  {
    countryId: 'japan',
    countryNameJa: '日本',
    countryNameEn: 'Japan',
    flag: { kind: 'japan' },
    position: { x: 0.78, y: 0.44 },

    // 事実の本文確認が1件も終わっていないため、公開しない。
    publicationStatus: 'draft',

    capitalLine: pending(
      'jp-claim-capital-line',
      '首都は東京です。',
      ['tokyo-profile'],
      NOTE_NEED_BODY,
    ),
    capital: {
      id: 'jp-capital-tokyo',
      name: '東京',
      note: 'とうきょう',
      claim: pending('jp-claim-capital-tokyo', '東京（とうきょう）', ['tokyo-profile'], NOTE_NEED_BODY),
    },
    // 都市の説明は、資料が見つからないうえに主観的だったので取り下げた（retiredClaims）。
    majorCities: [],

    greeting: greetingOf(
      'jp-claim-greeting-hello',
      '日本',
      'こんにちは',
      'Hello',
      '日本語のあいさつと英語表現の対応を直接確認できる資料を探すこと。',
    ),
    // 気候の資料で確認できる範囲まで短くした。
    // 地理（大陸の東・島国）と食べものの部分は、この資料では裏づけられないので外した。
    summary: pending(
      'jp-claim-summary',
      '北から南へ細長くつづく国なので、地域によって気候がちがいます。',
      ['jma-climate'],
      NOTE_NEED_BODY,
    ),
    highlight: {
      id: 'jp-highlight-fuji',
      name: '富士山',
      note: '高さ3776mで、日本でいちばん高い山です。',
      claim: pending(
        'jp-claim-highlight-fuji',
        '富士山は高さ3776mで、日本でいちばん高い山です。',
        ['gsi-mountains'],
        NOTE_NEED_BODY,
      ),
    },

    geography: [
      pending(
        'jp-claim-geo-forest',
        '森林が国土のおよそ3分の2をしめています。',
        ['rinya-forest'],
        NOTE_NEED_BODY,
      ),
    ],
    climate: [
      pending(
        'jp-claim-climate-winter',
        '冬は日本海側で雪やくもりの日が多く、太平洋側では晴れの日が多くなります。',
        ['jma-climate'],
        NOTE_NEED_BODY,
      ),
      pending(
        'jp-claim-climate-baiu',
        '春から夏へ変わるころに、雨の多い「梅雨（つゆ）」があります。沖縄や奄美では5月ごろにはじまります。',
        ['jma-baiu', 'jma-climate'],
        NOTE_NEED_BODY,
      ),
      pending(
        'jp-claim-climate-seasons',
        '四季があり、季節によって景色が変わります。',
        ['jma-climate'],
        NOTE_NEED_BODY,
      ),
    ],
    // 服装の目安は資料に書かれた事実ではなく助言だったので取り下げた（retiredClaims）。
    clothingTips: [],
    // 気候の資料をもとにしたゲーム内の案内。事実の主張ではないので claim にしない。
    clothingNote:
      '服装の目安は、公的な気候情報をもとにした一般的な案内です。天気予報ではありません。出かける前に、その日の予報をたしかめてください。',

    landmarks: [
      {
        id: 'jp-landmark-fuji',
        name: '富士山',
        note: '世界文化遺産。昔から信仰の対象になり、絵や物語にも多く出てきます。',
        claim: pending(
          'jp-claim-landmark-fuji',
          '富士山は世界文化遺産。昔から信仰の対象になり、絵や物語にも多く出てきます。',
          ['bunka-heritage'],
          NOTE_NEED_BODY,
        ),
      },
      {
        id: 'jp-landmark-horyuji',
        // 登録名は法隆寺だけでなく法起寺も含むので、一覧の名前に合わせた。
        name: '法隆寺地域の仏教建造物（奈良県）',
        note: '世界文化遺産。法隆寺や法起寺には、今ものこる世界最古級の木造建築があります。',
        claim: confirmed(
          'jp-claim-landmark-horyuji',
          '奈良県の「法隆寺地域の仏教建造物」は世界文化遺産です。法隆寺や法起寺には、今ものこる世界最古級の木造建築があります。',
          ['bunka-heritage', 'bunka-horyuji', 'unesco-horyuji'],
          '文化庁の一覧に奈良県の文化遺産として掲載。詳細解説では法隆寺と法起寺の48棟から構成され、うち11棟が7世紀後半から8世紀の「現存する世界最古級の木造建築」と説明されている。UNESCO も金堂・五重塔・中門・回廊を含む建造物群を世界最古の木造建造物群と説明。元の「世界でもっとも古いもの」は断定が強いため「世界最古級」へ直し、登録名に法起寺を含めた。',
          '2026-09-20',
        ),
      },
      {
        id: 'jp-landmark-himeji',
        name: '姫路城（兵庫県）',
        note: '世界文化遺産。白い天守閣で知られるお城です。',
        claim: pending(
          'jp-claim-landmark-himeji',
          '姫路城（兵庫県）は世界文化遺産。白い天守閣で知られるお城です。',
          ['bunka-heritage'],
          NOTE_NEED_BODY,
        ),
      },
      {
        id: 'jp-landmark-kyoto',
        name: '古都京都の文化財（京都府・滋賀県）',
        note: '世界文化遺産。お寺や神社、庭がまとまって登録されています。',
        claim: pending(
          'jp-claim-landmark-kyoto',
          '古都京都の文化財（京都府・滋賀県）は世界文化遺産。お寺や神社、庭がまとまって登録されています。',
          ['bunka-heritage'],
          NOTE_NEED_BODY,
        ),
      },
    ],
    // 料理の説明は資料が見つからなかったので取り下げた（retiredClaims）。
    foods: [],
    // 「国全体の特産物」という書き方は資料と合わない見込みなので取り下げた（retiredClaims）。
    specialties: [],

    // れきしの4件は要約度が高く、本文と対応づけにくいので取り下げた（retiredClaims）。
    history: [],
    culture: [
      pending(
        'jp-claim-culture-shoes',
        '家や旅館では、玄関で靴をぬいで上がります。',
        ['kankocho-manners'],
        NOTE_NEED_BODY,
      ),
      pending(
        'jp-claim-culture-events',
        '季節の行事が多く、春の花見や夏のお祭りなど、時期ごとの楽しみがあります。',
        ['webjapan-annual-events'],
        NOTE_NEED_BODY,
      ),
    ],
    manners: [
      pending(
        'jp-claim-manner-train',
        '電車やバスの中では、大きな声で話さないようにしましょう。',
        ['kankocho-manners'],
        NOTE_NEED_BODY,
      ),
      pending(
        'jp-claim-manner-temple',
        'お寺や神社では、書かれている決まりを見てから入りましょう。',
        ['kankocho-manners'],
        NOTE_NEED_BODY,
      ),
      pending(
        'jp-claim-manner-onsen',
        '温泉やお風呂では、体を洗ってから湯ぶねに入ります。',
        ['kankocho-manners'],
        NOTE_NEED_BODY,
      ),
    ],

    learningWords: [
      { pairId: 1 },
      { pairId: 2 },
      { pairId: 3 },
      { pairId: 4 },
      { pairId: 5 },
      { pairId: 6 },
      { pairId: 7 },
      { pairId: 8 },
      { pairId: 9 },
      { pairId: 10 },
    ],
    learning: '身のまわりのことばを、日本語と英語のカルタで集めます。',

    sources: JAPAN_SOURCES,
    // 本文確認の前に取り下げた文章。画面には出ないが、監査記録として残す。
    // 取り下げの理由は verificationNote にある。資料の可否は判定していない。
    retiredClaims: [
      withdrawnClaim(
        'jp-claim-city-sapporo',
        '札幌（さっぽろ・北のまち）',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-city-kyoto',
        '京都（きょうと・古いまちなみが残る）',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-city-osaka',
        '大阪（おおさか・にぎやかなまち）',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-city-fukuoka',
        '福岡（ふくおか・海に近いまち）',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-city-naha',
        '那覇（なは・南のあたたかいまち）',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-geo-island',
        '海にかこまれた島の国で、山が多いのが特ちょうです。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-geo-rivers',
        '川は短くて流れが急なものが多く、平地は海の近くに広がっています。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-climate-range',
        '南北に長いため、北と南で気候が大きくちがいます。同じ日でも、雪の地域と半そでの地域があります。',
        WITHDRAWN_TOO_BROAD,
      ),
      withdrawnClaim(
        'jp-claim-clothes-summer',
        '夏（6〜8月）は暑くてしめっぽいので、すずしい服と、ぼうし・水とうがあると安心です。',
        WITHDRAWN_ADVICE,
      ),
      withdrawnClaim(
        'jp-claim-clothes-winter',
        '冬（12〜2月）は地域差が大きいので、行き先の気温を調べてから決めましょう。北の地方や日本海側では雪の用意がいります。',
        WITHDRAWN_ADVICE,
      ),
      withdrawnClaim(
        'jp-claim-clothes-spring-autumn',
        '春と秋は朝晩がひえることがあるので、はおるものを1まい持っていくとよいです。',
        WITHDRAWN_ADVICE,
      ),
      withdrawnClaim(
        'jp-claim-clothes-baiu',
        '梅雨の時期は雨具があると助かります。',
        WITHDRAWN_ADVICE,
      ),
      withdrawnClaim(
        'jp-claim-food-sushi',
        'すしは、酢をまぜたごはんに、魚などをあわせた料理。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-food-ramen',
        'ラーメンは、スープにめんを入れた料理。地域ごとに味がちがいます。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-food-misoshiru',
        'みそしるは、みそでつくる、毎日の食事によく出るしる物。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-food-wagashi',
        '和菓子は、季節の形や色にしたおかし。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-spec-rice',
        'こめは日本の特産物。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-spec-tea',
        'おちゃは日本の特産物。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-spec-fruit',
        'くだものは日本の特産物。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-spec-fish',
        'さかなは日本の特産物。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-spec-note',
        '特産物は地域によって大きくちがいます。とれるものと、その土地の料理は別のものです。くわしい地域ごとの特産物は、これからの工程で足していきます。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-hist-ancient',
        'むかしのくに：むらがまとまって国の形ができていきました。奈良や京都には、このころに建てられた古いお寺や神社がのこっています。',
        WITHDRAWN_SUMMARIZED,
      ),
      withdrawnClaim(
        'jp-claim-hist-samurai',
        '武士（ぶし）の時代：武士とよばれる人たちが力を持ち、各地にお城が建てられました。姫路城のように、今も見られるお城があります。',
        WITHDRAWN_SUMMARIZED,
      ),
      withdrawnClaim(
        'jp-claim-hist-edo',
        '江戸（えど）の時代：大きな戦いの少ない時代が長くつづき、まちに絵や芝居などの文化が広がりました。',
        WITHDRAWN_SUMMARIZED,
      ),
      withdrawnClaim(
        'jp-claim-hist-modern',
        '近代から今へ：外国との行き来がふえ、鉄道や工場ができて、くらしが大きく変わりました。そのまま今の日本につながっています。',
        WITHDRAWN_SUMMARIZED,
      ),
      withdrawnClaim(
        'jp-claim-culture-bow',
        'あいさつのときに、おじぎをすることがあります。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-manner-trash',
        'ごみは決められた場所へ。持ち帰ることもあります。',
        WITHDRAWN_NO_SOURCE,
      ),
      withdrawnClaim(
        'jp-claim-manner-photo',
        '写真をとってよい場所かどうか、先に確かめましょう。',
        WITHDRAWN_NO_SOURCE,
      ),
    ],
  },
];

export function findCountryIntro(countryId: string): CountryIntro | undefined {
  return COUNTRY_INTROS.find((c) => c.countryId === countryId);
}

export function hasCountryIntro(countryId: string): boolean {
  return COUNTRY_INTROS.some((c) => c.countryId === countryId);
}

export function findSource(intro: CountryIntro, sourceId: string): InfoSource | undefined {
  return intro.sources.find((s) => s.id === sourceId);
}

// ---- 公開判定 ---------------------------------------------------------------

/**
 * 画面データから参照されている事実。
 *
 * 「画面に出す並びに入っているか」で決まる。
 * 不採用（rejected）にした文章をここから外せば、公開を妨げなくなる。
 */
export function displayDataClaims(intro: CountryIntro): FactClaim[] {
  return [
    // 画面に出る順に並べる。あいさつが最初。
    // あいさつを不採用にした国では greeting ごと無くなるので、ここにも入らない。
    ...(intro.greeting ? [intro.greeting.claim] : []),
    intro.summary,
    intro.capitalLine,
    ...claimsOf([intro.capital, intro.highlight]),
    ...claimsOf(intro.majorCities),
    ...intro.geography,
    ...intro.climate,
    ...intro.clothingTips,
    ...claimsOf(intro.landmarks),
    ...claimsOf(intro.foods),
    ...claimsOf(intro.specialties),
    ...(intro.specialtiesNote ? [intro.specialtiesNote] : []),
    ...intro.history.map((h) => h.claim),
    ...intro.culture,
    ...intro.manners,
  ];
}

/**
 * 監査記録も含めた、その国のすべての事実。
 * 不採用にして表示から外した文章（retiredClaims）もここには残る。
 */
export function allClaims(intro: CountryIntro): FactClaim[] {
  return [...displayDataClaims(intro), ...intro.retiredClaims];
}

/**
 * 実際に画面へ描かれる事実。
 * 不採用の文章は、画面データに残っていても描かない。
 */
export function visibleClaims(intro: CountryIntro): FactClaim[] {
  return displayDataClaims(intro).filter((c) => !isDropped(c));
}

/**
 * 画面データに残ったままの、出してはいけない文章。
 * 不採用（rejected）も取り下げ（withdrawn）も含む。1件でもあれば公開しない。
 */
export function droppedInDisplayData(intro: CountryIntro): FactClaim[] {
  return displayDataClaims(intro).filter(isDropped);
}

/**
 * まだ本文で確認していない表示対象の事実。
 * 監査記録として残した不採用の文章は数えない。
 */
export function uncheckedClaims(intro: CountryIntro): FactClaim[] {
  return displayDataClaims(intro).filter((c) => c.verification === 'unchecked');
}

/**
 * 詳細を公開してよいか。
 *
 * 判定は「すべての事実」ではなく「画面データから参照されている事実」で行う。
 * - 表示対象に 'unchecked' が1件でもあれば公開しない。
 * - 表示対象に 'rejected' / 'withdrawn' が残っていれば公開しない
 *   （表示から外し忘れている）。
 * - 表示から外した文章（retiredClaims）は、公開を妨げない。
 *   監査記録として残しておくためのもので、画面には出ない。
 */
export function canPublish(intro: CountryIntro): boolean {
  return displayDataClaims(intro).every((c) => c.verification === 'body-checked');
}

/** 実際に詳細を出すか。データの宣言と、事実の確認状態の両方を満たすときだけ。 */
export function showsDetails(intro: CountryIntro): boolean {
  return intro.publicationStatus === 'verified' && canPublish(intro);
}

// ---- 表示用の組み立て -------------------------------------------------------

/**
 * 「もっと知る」に並べる1枚のカード。
 *
 * 画面はこの配列をそのまま描くだけにして、国ごとの画面を作らない。
 * publicationStatus が 'verified' の国でだけ組み立てる。
 */
export interface DetailSection {
  id: DetailSectionId;
  heading: string;
  /** 段落。1カードにつき2〜4文におさめる。 */
  lines: string[];
  /** 名前つきの並び。都市・観光地・料理などに使う。 */
  items: NamedItem[];
  /** このカードの出典。確認できた事実の出典だけが入る。 */
  sources: InfoSource[];
  /**
   * 出典欄に添える補足。
   * 外部資料を使わないカード（ことば）で、何が正本なのかを示すのに使う。
   */
  sourceNote?: string;
}

const SECTION_HEADING: Record<DetailSectionId, string> = {
  cities: 'まち',
  nature: 'しぜん',
  climate: 'きこう',
  landmarks: 'みどころ',
  foods: 'たべもの',
  history: 'れきし',
  culture: 'ぶんか',
  words: 'ことば',
};

/**
 * 外部出典を持たないセクション。
 * ここに挙げたものは、ゲーム内のデータ自体が正本なので外部資料を引かない。
 */
export const INTERNAL_DATA_SECTIONS: readonly DetailSectionId[] = ['words'];

/** 事実説明を含む＝出典が必要なセクションか。 */
export function needsSource(id: DetailSectionId): boolean {
  return !INTERNAL_DATA_SECTIONS.includes(id);
}

/**
 * 不採用にした文章を落とす。
 * 監査記録としてデータに残っていても、画面へは絶対に出さない。
 */
function shown(claims: FactClaim[]): FactClaim[] {
  return claims.filter((c) => !isDropped(c));
}

/** 名前つきの並びからも、不採用にした項目を落とす。 */
function shownItems(items: NamedItem[]): NamedItem[] {
  return items.filter((i) => i.claim === undefined || !isDropped(i.claim));
}

/** 名前つきの並びが持っている事実だけを取り出す。 */
function claimsOf(items: NamedItem[]): FactClaim[] {
  return items.map((i) => i.claim).filter((c): c is FactClaim => c !== undefined);
}

function text(claims: FactClaim[]): string[] {
  return shown(claims).map((c) => c.text);
}

/** 事実の出典を、確認できたものだけ集める。 */
function sourcesOf(intro: CountryIntro, claims: FactClaim[]): InfoSource[] {
  const ids = new Set(shown(claims).flatMap((c) => c.sourceIds));
  return [...ids]
    .map((id) => findSource(intro, id))
    .filter((s): s is InfoSource => s !== undefined);
}

/**
 * 「もっと知る」で見せるカードを組み立てる。
 * 中身が空のカードは作らないので、情報のそろっていない国でも破綻しない。
 */
export function buildDetailSections(intro: CountryIntro): DetailSection[] {
  // 不採用にした文章は、ここで並びから落とす。
  // 監査記録には残るが、カードの行にも一覧にも出典にも入らない。
  const cityItems = shownItems([
    {
      ...intro.capital,
      note: intro.capital.note ? `首都・${intro.capital.note}` : '首都',
    },
    ...intro.majorCities,
  ]);

  const foodItems = shownItems([
    ...intro.foods,
    ...intro.specialties.map((s) => ({ ...s, note: s.note ?? 'とれるもの' })),
  ]);

  const landmarkItems = shownItems(intro.landmarks);
  const historyNotes = intro.history.filter((h) => !isDropped(h.claim));

  const sections: DetailSection[] = [
    {
      id: 'cities',
      heading: SECTION_HEADING.cities,
      lines: text([intro.capitalLine]),
      items: cityItems,
      sources: sourcesOf(intro, [intro.capitalLine, ...claimsOf(cityItems)]),
    },
    {
      id: 'nature',
      heading: SECTION_HEADING.nature,
      lines: text(intro.geography),
      items: [],
      sources: sourcesOf(intro, intro.geography),
    },
    {
      id: 'climate',
      heading: SECTION_HEADING.climate,
      // 服装の目安はゲーム内の案内。最後に「天気予報ではない」と断る。
      lines: [...text(intro.climate), ...text(intro.clothingTips), intro.clothingNote],
      items: [],
      sources: sourcesOf(intro, [...intro.climate, ...intro.clothingTips]),
    },
    {
      id: 'landmarks',
      heading: SECTION_HEADING.landmarks,
      lines: [],
      items: landmarkItems,
      sources: sourcesOf(intro, claimsOf(landmarkItems)),
    },
    {
      id: 'foods',
      heading: SECTION_HEADING.foods,
      // 料理と特産物を混ぜない。並びも分けて出す。
      lines: intro.specialtiesNote ? text([intro.specialtiesNote]) : [],
      items: foodItems,
      sources: sourcesOf(intro, [
        ...(intro.specialtiesNote ? [intro.specialtiesNote] : []),
        ...claimsOf(foodItems),
      ]),
    },
    {
      id: 'history',
      heading: SECTION_HEADING.history,
      lines: [],
      items: historyNotes.map((h) => ({
        id: h.id,
        name: h.era,
        note: h.body,
        claim: h.claim,
      })),
      sources: sourcesOf(
        intro,
        historyNotes.map((h) => h.claim),
      ),
    },
    {
      id: 'culture',
      heading: SECTION_HEADING.culture,
      lines: [...text(intro.culture), ...text(intro.manners)],
      items: [],
      sources: sourcesOf(intro, [...intro.culture, ...intro.manners]),
    },
    {
      id: 'words',
      heading: SECTION_HEADING.words,
      lines: [intro.learning],
      // 学ぶ単語は語彙データから引く。単語を足しても画面は変わらない。
      items: intro.learningWords
        .map((w) => findPair(w.pairId))
        .filter((pair): pair is NonNullable<ReturnType<typeof findPair>> => pair !== undefined)
        .map((pair) => ({ id: `word-${pair.pairId}`, name: pair.ja, note: pair.en })),
      // 外部資料は引かない。ゲーム内の語彙データが正本。
      sources: [],
      sourceNote: 'このカードの内容は、ゲーム内の語彙データがもとになっています。',
    },
  ];

  // 空の行を落としてから、中身の無いカードを取り除く。
  return sections
    .map((section) => ({ ...section, lines: section.lines.filter((l) => l.trim().length > 0) }))
    .filter((s) => s.lines.length > 0 || s.items.length > 0);
}
