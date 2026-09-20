import { describe, expect, it } from 'vitest';
import {
  COUNTRY_INTROS,
  INTERNAL_DATA_SECTIONS,
  allClaims,
  buildDetailSections,
  canPublish,
  findCountryIntro,
  findSource,
  hasCountryIntro,
  needsSource,
  showsDetails,
  uncheckedClaims,
} from '../data/countryIntros';
import type { CountryIntro, DetailSectionId, FactClaim, NamedItem } from '../data/countryIntros';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { DESTINATIONS } from '../data/destinations';
// チェックリストは配布物ではないので、テストからだけ生テキストとして読む。
import checklist from '../../docs/reports/COUNTRY_GUIDE_JAPAN_SOURCE_CHECKLIST.md?raw';

/**
 * 国紹介データの検査。
 *
 * 文章そのものの正しさは人が資料の本文を読んで確かめる。
 * ここで止めるのは、機械で分かる欠け——必須項目の抜け、IDのぶつかり、
 * 出典の形式不備、そして「確認が終わっていないのに公開してしまう」こと。
 */

const JAPAN = findCountryIntro('japan')!;

/** すべての NamedItem を集めて、IDの重複を調べるために使う。 */
function allItems(intro: CountryIntro): NamedItem[] {
  return [
    intro.capital,
    ...intro.majorCities,
    intro.highlight,
    ...intro.landmarks,
    ...intro.foods,
    ...intro.specialties,
  ];
}

/**
 * 本文確認が終わった状態の複製。公開できる形を試すのに使う。
 *
 * 確認済みの事実は必ず裏づけ資料を持つので、
 * 資料の決まっていない事実には代わりのIDを入れて形をそろえる。
 * これはテスト用の仮置きで、実際の割り当てではない。
 */
const PLACEHOLDER_SOURCE_ID = 'tokyo-profile';

function asVerified(intro: CountryIntro): CountryIntro {
  const check = (c: FactClaim): FactClaim => {
    const ids = c.sourceIds.length > 0 ? c.sourceIds : (c.candidateSourceIds ?? []);
    return {
      ...c,
      sourceIds: ids.length > 0 ? ids : [PLACEHOLDER_SOURCE_ID],
      verification: 'body-checked',
      verificationNote: '（テスト用）本文確認済みとみなす',
    };
  };
  const checkItem = (i: NamedItem): NamedItem =>
    i.claim ? { ...i, claim: check(i.claim) } : i;

  return {
    ...intro,
    publicationStatus: 'verified',
    summary: check(intro.summary),
    capitalLine: check(intro.capitalLine),
    capital: checkItem(intro.capital),
    highlight: checkItem(intro.highlight),
    majorCities: intro.majorCities.map(checkItem),
    geography: intro.geography.map(check),
    climate: intro.climate.map(check),
    clothingTips: intro.clothingTips.map(check),
    landmarks: intro.landmarks.map(checkItem),
    foods: intro.foods.map(checkItem),
    specialties: intro.specialties.map(checkItem),
    specialtiesNote: check(intro.specialtiesNote),
    history: intro.history.map((h) => ({ ...h, claim: check(h.claim) })),
    culture: intro.culture.map(check),
    manners: intro.manners.map(check),
  };
}

describe('国紹介の必須項目', () => {
  it('すべての国で、文字の項目が空でない', () => {
    for (const intro of COUNTRY_INTROS) {
      expect(intro.countryId.length).toBeGreaterThan(0);
      expect(intro.countryNameJa.length).toBeGreaterThan(0);
      expect(intro.countryNameEn.length).toBeGreaterThan(0);
      expect(intro.capital.name.length).toBeGreaterThan(0);
      expect(intro.greeting.ja.length).toBeGreaterThan(0);
      expect(intro.greeting.en.length).toBeGreaterThan(0);
      expect(intro.summary.text.length).toBeGreaterThan(0);
      expect(intro.highlight.name.length).toBeGreaterThan(0);
      expect(intro.specialtiesNote.text.length).toBeGreaterThan(0);
      expect(intro.clothingNote.length).toBeGreaterThan(0);
      expect(intro.learning.length).toBeGreaterThan(0);
    }
  });

  it('すべての国で、並びの項目が空でない', () => {
    for (const intro of COUNTRY_INTROS) {
      expect(intro.majorCities.length).toBeGreaterThan(0);
      expect(intro.geography.length).toBeGreaterThan(0);
      expect(intro.climate.length).toBeGreaterThan(0);
      expect(intro.clothingTips.length).toBeGreaterThan(0);
      expect(intro.landmarks.length).toBeGreaterThan(0);
      expect(intro.foods.length).toBeGreaterThan(0);
      expect(intro.specialties.length).toBeGreaterThan(0);
      expect(intro.history.length).toBeGreaterThan(0);
      expect(intro.culture.length).toBeGreaterThan(0);
      expect(intro.manners.length).toBeGreaterThan(0);
      expect(intro.learningWords.length).toBeGreaterThan(0);
      expect(intro.sources.length).toBeGreaterThan(0);
    }
  });

  it('空文字の事実を持たない', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        expect(claim.text.trim().length).toBeGreaterThan(0);
      }
      for (const item of allItems(intro)) expect(item.name.trim().length).toBeGreaterThan(0);
      for (const note of intro.history) {
        expect(note.era.trim().length).toBeGreaterThan(0);
        expect(note.body.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('首都と代表的な都市の区別', () => {
  it('首都は majorCities に含めない', () => {
    for (const intro of COUNTRY_INTROS) {
      expect(intro.majorCities.map((c) => c.name)).not.toContain(intro.capital.name);
      expect(intro.majorCities.map((c) => c.id)).not.toContain(intro.capital.id);
    }
  });

  it('日本の首都は東京', () => {
    expect(JAPAN.capital.name).toBe('東京');
  });

  it('「まち」のカードでは首都だと分かる', () => {
    const cities = buildDetailSections(JAPAN).find((s) => s.id === 'cities')!;
    expect(cities.lines.join('')).toContain('東京');
    expect(cities.items[0].note).toContain('首都');
  });
});

describe('IDの重複', () => {
  it('国IDが重複しない', () => {
    const ids = COUNTRY_INTROS.map((c) => c.countryId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('国の中で項目IDが重複しない', () => {
    for (const intro of COUNTRY_INTROS) {
      const ids = allItems(intro).map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('歴史のIDが重複しない', () => {
    for (const intro of COUNTRY_INTROS) {
      const ids = intro.history.map((h) => h.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('出典のIDが重複しない', () => {
    for (const intro of COUNTRY_INTROS) {
      const ids = intro.sources.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('事実（FactClaim）', () => {
  it('すべての事実に一意な claimId がある', () => {
    for (const intro of COUNTRY_INTROS) {
      const ids = allClaims(intro).map((c) => c.id);
      expect(ids.every((id) => id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('claimId は国をまたいでも重複しない', () => {
    const ids = COUNTRY_INTROS.flatMap((intro) => allClaims(intro).map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sourceIds と candidateSourceIds が実在する出典を指す', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        for (const id of claim.sourceIds) {
          expect(findSource(intro, id), `${claim.id} の出典 ${id}`).toBeDefined();
        }
        for (const id of claim.candidateSourceIds ?? []) {
          expect(findSource(intro, id), `${claim.id} の確認予定資料 ${id}`).toBeDefined();
        }
      }
    }
  });

  it('確認状態は3種類のいずれか', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        expect(['unchecked', 'body-checked', 'rejected']).toContain(claim.verification);
      }
    }
  });

  it('本文未確認の事実は、裏づけ済みの出典を持たない', () => {
    // 「割り当てたから確認済み」と読み違えないよう、
    // 確認できるまで sourceIds は空にしておく。
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        if (claim.verification === 'body-checked') continue;
        expect(claim.sourceIds, `${claim.id} に未確認のまま出典が入っている`).toEqual([]);
      }
    }
  });

  it('未確認の事実には、理由か確認予定が書いてある', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of uncheckedClaims(intro)) {
        expect(claim.verificationNote, `${claim.id} に理由が無い`).toBeTruthy();
      }
    }
  });

  it('日本の事実はまだ1件も本文確認できていない', () => {
    // この開発環境からは公的機関のページ本文を取得できないため。
    expect(allClaims(JAPAN).length).toBeGreaterThan(0);
    expect(uncheckedClaims(JAPAN).length).toBe(allClaims(JAPAN).length);
  });

  it('根拠が不確かな項目に、無理な出典を割り当てていない', () => {
    const shouldHaveNoSource = [
      'jp-claim-city-sapporo',
      'jp-claim-city-kyoto',
      'jp-claim-city-osaka',
      'jp-claim-city-fukuoka',
      'jp-claim-city-naha',
      'jp-claim-geo-island',
      'jp-claim-geo-rivers',
      'jp-claim-food-sushi',
      'jp-claim-food-ramen',
      'jp-claim-food-misoshiru',
      'jp-claim-food-wagashi',
      'jp-claim-spec-rice',
      'jp-claim-spec-tea',
      'jp-claim-spec-fruit',
      'jp-claim-spec-fish',
      'jp-claim-spec-note',
      'jp-claim-culture-bow',
      'jp-claim-manner-trash',
      'jp-claim-manner-photo',
    ];
    const byId = new Map(allClaims(JAPAN).map((c) => [c.id, c]));
    for (const id of shouldHaveNoSource) {
      const claim = byId.get(id);
      expect(claim, `${id} が見つからない`).toBeDefined();
      expect(claim!.sourceIds, `${id} に出典が割り当たっている`).toEqual([]);
      expect(claim!.candidateSourceIds ?? [], `${id} に確認予定資料が入っている`).toEqual([]);
      expect(claim!.verification).toBe('unchecked');
    }
  });

  it('歴史4区分は Kids Web Japan の本文と照合するまで未確認', () => {
    for (const note of JAPAN.history) {
      expect(note.claim.verification).toBe('unchecked');
      expect(note.claim.sourceIds).toEqual([]);
      expect(note.claim.candidateSourceIds).toContain('webjapan-history');
    }
  });
});

describe('公開の可否', () => {
  it('日本は下書きのまま', () => {
    expect(JAPAN.publicationStatus).toBe('draft');
  });

  it('未確認が1件でもあれば公開できない', () => {
    expect(canPublish(JAPAN)).toBe(false);
    expect(showsDetails(JAPAN)).toBe(false);
  });

  it('すべて本文確認できたときだけ公開できる', () => {
    const verified = asVerified(JAPAN);
    expect(canPublish(verified)).toBe(true);
    expect(showsDetails(verified)).toBe(true);
  });

  it('1件でも rejected が残れば公開できない', () => {
    const verified = asVerified(JAPAN);
    const withRejected: CountryIntro = {
      ...verified,
      culture: [
        { ...verified.culture[0], verification: 'rejected', sourceIds: [] },
        ...verified.culture.slice(1),
      ],
    };
    expect(canPublish(withRejected)).toBe(false);
    expect(showsDetails(withRejected)).toBe(false);
  });

  it('1件でも unchecked が残れば公開できない', () => {
    const verified = asVerified(JAPAN);
    const withUnchecked: CountryIntro = {
      ...verified,
      manners: [
        { ...verified.manners[0], verification: 'unchecked', sourceIds: [] },
        ...verified.manners.slice(1),
      ],
    };
    expect(canPublish(withUnchecked)).toBe(false);
    expect(showsDetails(withUnchecked)).toBe(false);
  });

  it('publicationStatus を verified にしても、未確認があれば表示しない', () => {
    // 宣言だけで公開できてしまわないようにする二重の歯止め。
    const declaredOnly: CountryIntro = { ...JAPAN, publicationStatus: 'verified' };
    expect(canPublish(declaredOnly)).toBe(false);
    expect(showsDetails(declaredOnly)).toBe(false);
  });
});

describe('出典メタデータの形式確認', () => {
  // ここは事実が正しいことの保証ではない。出典の「書き方」がそろっているかだけを見る。
  // 内容が正しいかどうかは、人が本文を読んで FactClaim を body-checked にしたときに決まる。

  it('すべての出典が名前・https のURL・確認日・確認状態を持つ', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const source of intro.sources) {
        expect(source.sourceLabel.length).toBeGreaterThan(0);
        expect(source.sourceUrl).toMatch(/^https:\/\//);
        expect(source.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(['body-checked', 'url-only']).toContain(source.verification);
      }
    }
  });

  it('出典名が機関名だけでなく資料名まで含む', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const source of intro.sources) {
        expect(source.sourceLabel).toMatch(/「.+」/);
        expect(source.sourceLabel.split('「')[0].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('出典は公的機関・公的機関が運営する媒体のドメインに限る', () => {
    const allowedHost = /\.go\.jp$|\.lg\.jp$|\.unesco\.org$|^web-japan\.org$/;
    for (const source of JAPAN.sources) {
      const host = new URL(source.sourceUrl).hostname;
      expect(host, `${source.sourceLabel} のドメイン`).toMatch(allowedHost);
    }
  });

  it('日本の出典はまだ1件も本文確認できていない', () => {
    expect(JAPAN.sources.every((s) => s.verification === 'url-only')).toBe(true);
  });
});

describe('学ぶ単語と語彙データの対応', () => {
  it('learningWords の pairId がすべて語彙データに存在する', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const word of intro.learningWords) {
        expect(findPair(word.pairId)).toBeDefined();
      }
    }
  });

  it('同じ単語を二重に並べない', () => {
    for (const intro of COUNTRY_INTROS) {
      const ids = intro.learningWords.map((w) => w.pairId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('「ことば」のカードに語彙データの語が並ぶ', () => {
    const words = buildDetailSections(JAPAN).find((s) => s.id === 'words')!;
    expect(words.items.length).toBe(JAPAN.learningWords.length);
    const first = SAMPLE_PAIRS.find((p) => p.pairId === JAPAN.learningWords[0].pairId)!;
    expect(words.items[0].name).toBe(first.ja);
    expect(words.items[0].note).toBe(first.en);
  });

  it('ことばのカードは外部の FactClaim を要求しない', () => {
    const words = buildDetailSections(JAPAN).find((s) => s.id === 'words')!;
    expect(INTERNAL_DATA_SECTIONS).toContain('words');
    expect(needsSource('words')).toBe(false);
    expect(words.sources).toEqual([]);
    expect(words.sourceNote).toContain('語彙データ');
    // ことばの並びは事実の主張ではないので、claim を持たない。
    expect(words.items.every((i) => i.claim === undefined)).toBe(true);
  });
});

describe('詳細カードの組み立て', () => {
  const EXPECTED: DetailSectionId[] = [
    'cities',
    'nature',
    'climate',
    'landmarks',
    'foods',
    'history',
    'culture',
    'words',
  ];

  it('日本は8つのカテゴリーをすべて持つ', () => {
    const ids = buildDetailSections(JAPAN).map((s) => s.id);
    expect(ids).toEqual(EXPECTED);
  });

  it('どのカードも見出しがあり、中身が空でない', () => {
    for (const section of buildDetailSections(JAPAN)) {
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.lines.length + section.items.length).toBeGreaterThan(0);
    }
  });

  it('カードに出るのは確認できた事実の出典だけ', () => {
    // まだ1件も本文確認できていないので、どのカードにも出典が出ない。
    for (const section of buildDetailSections(JAPAN)) {
      expect(section.sources, `${section.id} に未確認の出典が出ている`).toEqual([]);
    }
  });

  it('本文確認が終われば、事実のカードに出典が出る', () => {
    const verified = asVerified(JAPAN);
    for (const section of buildDetailSections(verified)) {
      if (!needsSource(section.id)) continue;
      expect(section.sources.length, `${section.id} に出典が無い`).toBeGreaterThan(0);
    }
  });

  it('中身の無いカテゴリーはカードを作らない', () => {
    const sparse: CountryIntro = {
      ...JAPAN,
      countryId: 'test-sparse',
      majorCities: [],
      geography: [],
      climate: [],
      clothingTips: [],
      clothingNote: '',
      landmarks: [],
      history: [],
      culture: [],
      manners: [],
    };
    const ids = buildDetailSections(sparse).map((s) => s.id);
    expect(ids).not.toContain('nature');
    expect(ids).not.toContain('climate');
    expect(ids).not.toContain('landmarks');
    expect(ids).not.toContain('history');
    expect(ids).not.toContain('culture');
    expect(ids).toContain('cities');
    expect(ids).toContain('foods');
  });

  it('料理と特産物を混同しない', () => {
    const foods = JAPAN.foods.map((f) => f.name);
    const specialties = JAPAN.specialties.map((s) => s.name);
    for (const name of specialties) expect(foods).not.toContain(name);
    const section = buildDetailSections(JAPAN).find((s) => s.id === 'foods')!;
    expect(section.lines.join('')).toContain('地域');
  });

  it('気候の説明が地域差にふれている', () => {
    const section = buildDetailSections(JAPAN).find((s) => s.id === 'climate')!;
    expect(section.lines.join('')).toMatch(/地域|北と南/);
  });
});

describe('服装の目安', () => {
  it('天気予報ではないことを断っている', () => {
    const climate = buildDetailSections(JAPAN).find((s) => s.id === 'climate')!;
    expect(climate.lines.join('')).toContain('天気予報ではありません');
  });

  it('断り書きは気候の説明の最後に置く', () => {
    const climate = buildDetailSections(JAPAN).find((s) => s.id === 'climate')!;
    expect(climate.lines[climate.lines.length - 1]).toBe(JAPAN.clothingNote);
  });
});

describe('未実装の国', () => {
  it('紹介データが無い行き先でも例外にならない', () => {
    expect(() => findCountryIntro('london')).not.toThrow();
    expect(findCountryIntro('london')).toBeUndefined();
    expect(findCountryIntro('')).toBeUndefined();
    expect(hasCountryIntro('mars')).toBe(false);
  });

  it('推測で国を足していない（紹介があるのは解放済みの行き先だけ）', () => {
    const unlocked = DESTINATIONS.filter((d) => d.unlocked).map((d) => d.id);
    for (const intro of COUNTRY_INTROS) {
      expect(unlocked).toContain(intro.countryId);
    }
  });
});

describe('人間確認用チェックリスト', () => {
  it('画面に出るすべての事実が、チェックリストに載っている', () => {
    // 表に無い文章がこっそり増えないようにする歯止め。
    for (const claim of allClaims(JAPAN)) {
      expect(checklist, `${claim.id} がチェックリストに無い`).toContain(claim.id);
      expect(checklist, `${claim.id} の文章がチェックリストと違う`).toContain(claim.text);
    }
  });

  it('チェックリストの claimId が実在する', () => {
    const ids = new Set(allClaims(JAPAN).map((c) => c.id));
    const listed = [...checklist.matchAll(/^### \d+\. `([^`]+)`$/gm)].map((m) => m[1]);
    expect(listed.length).toBe(ids.size);
    for (const id of listed) expect(ids.has(id), `${id} はデータに無い`).toBe(true);
  });

  it('最初はすべて unchecked として並んでいる', () => {
    const states = [...checklist.matchAll(/\| 本文確認状態 \| \*\*(\w[\w-]*)\*\* \|/g)].map(
      (m) => m[1],
    );
    expect(states.length).toBe(allClaims(JAPAN).length);
    expect(states.every((s) => s === 'unchecked')).toBe(true);
  });

  it('本文を読めていない資料を確認済みとして書いていない', () => {
    expect(checklist).toContain('本文確認済み: **0件**');
  });
});
