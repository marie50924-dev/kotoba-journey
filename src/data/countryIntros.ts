/**
 * 国紹介のデータ。
 *
 * 表示する文章はすべてここに置き、画面側には一切書かない。
 * 国を追加しても画面コードは変更せず、このファイルへ1件足すだけで済む。
 *
 * 事実の扱い：
 * - 公的機関・一次情報で確認できた範囲だけを書く。
 * - 出典と確認日を sources に残し、画面から開けるようにする。
 * - 本文をそのまま写さず、小学生が読める短さへ要約する。
 * - 「世界一」などの言い切りは、公的機関の資料で確認できた場合だけ使う。
 * - 気候は地域差があるので「国全体が同じ」と読めない書き方にする。
 * - 特産物（とれるもの）と名物料理（りょうり）を混ぜない。
 * - 戦争・宗教・領土・政治は、今回必要がないので深掘りしない。
 * - ステレオタイプ、国民性の断定、観光広告のような表現は書かない。
 *
 * 確認の方法について：
 * この開発環境からは各機関のページを直接取得できないため、
 * 公的ドメインに限定した検索で照合している。
 * 公開前に、sources のURLを人の目で最終確認すること。
 *
 * 日本以外の国は、確認できていない情報を推測で書かない。
 * データが無い国でも、ゲームの進行は止まらない設計にしてある。
 */

import { findPair } from './wordPairs';

/** 国旗の表現。正式な旗素材が入るまでは CSS で描く。 */
export type CountryFlag = { kind: 'japan' } | { kind: 'placeholder' };

/** 出典。1件ごとに確認日を持たせる。 */
export interface InfoSource {
  id: string;
  /** 機関名と資料名。 */
  sourceLabel: string;
  sourceUrl: string;
  /** 確認した日（YYYY-MM-DD）。 */
  checkedAt: string;
}

/** 都市・観光地・料理・特産物など、あとから足したり並べ替えたりする項目。 */
export interface NamedItem {
  id: string;
  name: string;
  /** ひとこと説明。無くてもよい。 */
  note?: string;
}

/** 歴史の1区切り。長い年表は作らず、流れだけを短く置く。 */
export interface HistoryNote {
  id: string;
  /** 「むかし」「武士の時代」など、年号に頼らない見出し。 */
  era: string;
  body: string;
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

export interface CountryIntro {
  countryId: string;
  countryNameJa: string;
  countryNameEn: string;
  flag: CountryFlag;
  /** 世界マップ上のおおよその位置 0〜1。 */
  position: { x: number; y: number };

  /** 首都。代表的な都市とは別に持つ。 */
  capital: NamedItem;
  /** 代表的な都市。首都は含めない。 */
  majorCities: NamedItem[];

  greeting: { ja: string; en: string };
  /** 到着直後に出す短い紹介文。 */
  summary: string;
  /** 到着直後に1件だけ出す「有名なもの」。 */
  highlight: NamedItem;

  /** 地形・自然の特徴。 */
  geography: string[];
  /** 気候。地域差があるならそれが分かるように書く。 */
  climate: string[];
  /** 旅行時の服装の目安。 */
  clothingTips: string[];

  /** 有名な建物・場所・観光地。 */
  landmarks: NamedItem[];
  /** 有名な食べもの（料理）。 */
  foods: NamedItem[];
  /** 特産物（とれるもの）。料理とは分けて持つ。 */
  specialties: NamedItem[];
  /** 特産物の地域差についての注意書き。 */
  specialtiesNote: string;

  history: HistoryNote[];
  /** 文化・生活習慣。 */
  culture: string[];
  /** 子どもにも分かる旅行マナー。 */
  manners: string[];

  /** この国で学ぶ英単語。語彙データの pairId で指す。 */
  learningWords: LearningWord[];
  /** 「この国で学ぶこと」の案内文。 */
  learning: string;

  sources: InfoSource[];
  /** セクションごとの出典。画面はこの対応表を見て出典を添える。 */
  sectionSources: Partial<Record<DetailSectionId, string[]>>;
}

/**
 * 出典。
 * 2026-09-20 に、公的ドメインに限定した検索で所在と内容を照合した。
 */
const JAPAN_SOURCES: InfoSource[] = [
  {
    id: 'jma-climate',
    sourceLabel: '気象庁「日本の気候」',
    sourceUrl:
      'https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html',
    checkedAt: '2026-09-20',
  },
  {
    id: 'gsi-mountains',
    sourceLabel: '国土地理院「日本の主な山岳標高」',
    sourceUrl: 'https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html',
    checkedAt: '2026-09-20',
  },
  {
    id: 'rinya-forest',
    sourceLabel: '林野庁「都道府県別森林率・人工林率」',
    sourceUrl: 'https://www.rinya.maff.go.jp/j/keikaku/genkyou/index2.html',
    checkedAt: '2026-09-20',
  },
  {
    id: 'bunka-heritage',
    sourceLabel: '文化庁「日本の世界遺産一覧」',
    sourceUrl: 'https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/',
    checkedAt: '2026-09-20',
  },
  {
    id: 'kankocho-manners',
    sourceLabel: '観光庁「日本のマナーを知ってもらおう！」',
    sourceUrl: 'https://www.mlit.go.jp/kankocho/news08_000304.html',
    checkedAt: '2026-09-20',
  },
];

export const COUNTRY_INTROS: readonly CountryIntro[] = [
  {
    countryId: 'japan',
    countryNameJa: '日本',
    countryNameEn: 'Japan',
    flag: { kind: 'japan' },
    position: { x: 0.78, y: 0.44 },

    capital: { id: 'jp-capital-tokyo', name: '東京', note: 'とうきょう' },
    majorCities: [
      { id: 'jp-city-sapporo', name: '札幌', note: 'さっぽろ・北のまち' },
      { id: 'jp-city-kyoto', name: '京都', note: 'きょうと・古いまちなみが残る' },
      { id: 'jp-city-osaka', name: '大阪', note: 'おおさか・にぎやかなまち' },
      { id: 'jp-city-fukuoka', name: '福岡', note: 'ふくおか・海に近いまち' },
      { id: 'jp-city-naha', name: '那覇', note: 'なは・南のあたたかいまち' },
    ],

    greeting: { ja: 'こんにちは', en: 'Hello' },
    summary:
      'ユーラシア大陸の東にある、海にかこまれた島の国です。北から南へ細長くつづいているので、地域によって気候も食べものもちがいます。',
    highlight: {
      id: 'jp-highlight-fuji',
      name: '富士山',
      note: '高さ3776mで、日本でいちばん高い山です。',
    },

    geography: [
      '海にかこまれた島の国で、山が多いのが特ちょうです。',
      '森林が国土のおよそ3分の2をしめています。',
      '川は短くて流れが急なものが多く、平地は海の近くに広がっています。',
    ],
    climate: [
      '南北に長いため、北と南で気候が大きくちがいます。同じ日でも、雪の地域と半そでの地域があります。',
      '冬は日本海側で雪やくもりの日が多く、太平洋側では晴れの日が多くなります。',
      '春から夏へ変わるころに、雨の多い「梅雨（つゆ）」があります。沖縄や奄美では5月ごろにはじまります。',
      '四季があり、季節によって景色が変わります。',
    ],
    clothingTips: [
      '夏（6〜8月）は暑くてしめっぽいので、すずしい服と、ぼうし・水とうがあると安心です。',
      '冬（12〜2月）は地域差が大きいので、行き先の気温を調べてから決めましょう。北の地方や日本海側では雪の用意がいります。',
      '春と秋は朝晩がひえることがあるので、はおるものを1まい持っていくとよいです。',
      '梅雨の時期は雨具があると助かります。',
    ],

    landmarks: [
      {
        id: 'jp-landmark-fuji',
        name: '富士山',
        note: '世界文化遺産。昔から信仰の対象になり、絵や物語にも多く出てきます。',
      },
      {
        id: 'jp-landmark-horyuji',
        name: '法隆寺（奈良県）',
        note: '世界文化遺産。今ものこる木造の建物として、世界でもっとも古いものと評価されています。',
      },
      {
        id: 'jp-landmark-himeji',
        name: '姫路城（兵庫県）',
        note: '世界文化遺産。白い天守閣で知られるお城です。',
      },
      {
        id: 'jp-landmark-kyoto',
        name: '古都京都の文化財（京都府・滋賀県）',
        note: '世界文化遺産。お寺や神社、庭がまとまって登録されています。',
      },
    ],
    foods: [
      { id: 'jp-food-sushi', name: 'すし', note: '酢をまぜたごはんに、魚などをあわせた料理。' },
      { id: 'jp-food-ramen', name: 'ラーメン', note: 'スープにめんを入れた料理。地域ごとに味がちがいます。' },
      { id: 'jp-food-misoshiru', name: 'みそしる', note: 'みそでつくる、毎日の食事によく出るしる物。' },
      { id: 'jp-food-wagashi', name: '和菓子', note: '季節の形や色にしたおかし。' },
    ],
    specialties: [
      { id: 'jp-spec-rice', name: 'こめ' },
      { id: 'jp-spec-tea', name: 'おちゃ' },
      { id: 'jp-spec-fruit', name: 'くだもの' },
      { id: 'jp-spec-fish', name: 'さかな' },
    ],
    specialtiesNote:
      '特産物は地域によって大きくちがいます。とれるものと、その土地の料理は別のものです。くわしい地域ごとの特産物は、これからの工程で足していきます。',

    history: [
      {
        id: 'jp-hist-ancient',
        era: 'むかしのくに',
        body: 'むらがまとまって国の形ができていきました。奈良や京都には、このころに建てられた古いお寺や神社がのこっています。',
      },
      {
        id: 'jp-hist-samurai',
        era: '武士（ぶし）の時代',
        body: '武士とよばれる人たちが力を持ち、各地にお城が建てられました。姫路城のように、今も見られるお城があります。',
      },
      {
        id: 'jp-hist-edo',
        era: '江戸（えど）の時代',
        body: '大きな戦いの少ない時代が長くつづき、まちに絵や芝居などの文化が広がりました。',
      },
      {
        id: 'jp-hist-modern',
        era: '近代から今へ',
        body: '外国との行き来がふえ、鉄道や工場ができて、くらしが大きく変わりました。そのまま今の日本につながっています。',
      },
    ],
    culture: [
      'あいさつのときに、おじぎをすることがあります。',
      '家や旅館では、玄関で靴をぬいで上がります。',
      '季節の行事が多く、春の花見や夏のお祭りなど、時期ごとの楽しみがあります。',
    ],
    manners: [
      '電車やバスの中では、大きな声で話さないようにしましょう。',
      'ごみは決められた場所へ。持ち帰ることもあります。',
      'お寺や神社では、書かれている決まりを見てから入りましょう。',
      '温泉やお風呂では、体を洗ってから湯ぶねに入ります。',
      '写真をとってよい場所かどうか、先に確かめましょう。',
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
    sectionSources: {
      nature: ['rinya-forest', 'gsi-mountains'],
      climate: ['jma-climate'],
      landmarks: ['bunka-heritage', 'gsi-mountains'],
      culture: ['kankocho-manners'],
    },
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

// ---- 表示用の組み立て -------------------------------------------------------

/**
 * 「もっと知る」に並べる1枚のカード。
 *
 * 画面はこの配列をそのまま描くだけにして、国ごとの画面を作らない。
 * 見出しも本文もデータ側で決まるので、国を足しても画面コードは変わらない。
 */
export interface DetailSection {
  id: DetailSectionId;
  heading: string;
  /** 段落。1カードにつき2〜4文におさめる。 */
  lines: string[];
  /** 名前つきの並び。都市・観光地・料理などに使う。 */
  items: NamedItem[];
  /** このカードの出典。 */
  sources: InfoSource[];
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

function sectionSources(intro: CountryIntro, id: DetailSectionId): InfoSource[] {
  const ids = intro.sectionSources[id] ?? [];
  return ids
    .map((sourceId) => findSource(intro, sourceId))
    .filter((s): s is InfoSource => s !== undefined);
}

/**
 * 「もっと知る」で見せるカードを組み立てる。
 * 中身が空のカードは作らないので、情報のそろっていない国でも破綻しない。
 */
export function buildDetailSections(intro: CountryIntro): DetailSection[] {
  const sections: DetailSection[] = [
    {
      id: 'cities',
      heading: SECTION_HEADING.cities,
      lines: [`首都は${intro.capital.name}です。`],
      items: [
        { ...intro.capital, note: intro.capital.note ? `首都・${intro.capital.note}` : '首都' },
        ...intro.majorCities,
      ],
      sources: sectionSources(intro, 'cities'),
    },
    {
      id: 'nature',
      heading: SECTION_HEADING.nature,
      lines: intro.geography,
      items: [],
      sources: sectionSources(intro, 'nature'),
    },
    {
      id: 'climate',
      heading: SECTION_HEADING.climate,
      lines: [...intro.climate, ...intro.clothingTips],
      items: [],
      sources: sectionSources(intro, 'climate'),
    },
    {
      id: 'landmarks',
      heading: SECTION_HEADING.landmarks,
      lines: [],
      items: intro.landmarks,
      sources: sectionSources(intro, 'landmarks'),
    },
    {
      id: 'foods',
      heading: SECTION_HEADING.foods,
      // 料理と特産物を混ぜない。並びも分けて出す。
      lines: [intro.specialtiesNote],
      items: [
        ...intro.foods,
        ...intro.specialties.map((s) => ({ ...s, note: s.note ?? 'とれるもの' })),
      ],
      sources: sectionSources(intro, 'foods'),
    },
    {
      id: 'history',
      heading: SECTION_HEADING.history,
      lines: [],
      items: intro.history.map((h) => ({ id: h.id, name: h.era, note: h.body })),
      sources: sectionSources(intro, 'history'),
    },
    {
      id: 'culture',
      heading: SECTION_HEADING.culture,
      lines: [...intro.culture, ...intro.manners],
      items: [],
      sources: sectionSources(intro, 'culture'),
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
      sources: sectionSources(intro, 'words'),
    },
  ];

  return sections.filter((s) => s.lines.length > 0 || s.items.length > 0);
}
