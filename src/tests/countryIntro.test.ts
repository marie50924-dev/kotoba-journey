import { describe, expect, it } from 'vitest';
import {
  COUNTRY_INTROS,
  INTERNAL_DATA_SECTIONS,
  buildDetailSections,
  findCountryIntro,
  findSource,
  hasCountryIntro,
  hasUnverifiedSource,
  needsSource,
} from '../data/countryIntros';
import type { CountryIntro, DetailSectionId, NamedItem } from '../data/countryIntros';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { DESTINATIONS } from '../data/destinations';

/**
 * 国紹介データの検査。
 *
 * 文章そのものの正しさは人の確認に任せるが、
 * 「必須項目が抜けている」「IDがぶつかる」「出典が無い」といった
 * 機械で分かる欠けはここで止める。
 */

const JAPAN = findCountryIntro('japan')!;

/** すべての NamedItem 配列を集めて、IDの重複を調べるために使う。 */
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

describe('国紹介の必須項目', () => {
  it('すべての国で、文字の項目が空でない', () => {
    for (const intro of COUNTRY_INTROS) {
      expect(intro.countryId.length).toBeGreaterThan(0);
      expect(intro.countryNameJa.length).toBeGreaterThan(0);
      expect(intro.countryNameEn.length).toBeGreaterThan(0);
      expect(intro.capital.name.length).toBeGreaterThan(0);
      expect(intro.greeting.ja.length).toBeGreaterThan(0);
      expect(intro.greeting.en.length).toBeGreaterThan(0);
      expect(intro.summary.length).toBeGreaterThan(0);
      expect(intro.highlight.name.length).toBeGreaterThan(0);
      expect(intro.specialtiesNote.length).toBeGreaterThan(0);
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

  it('空文字の行を持たない', () => {
    for (const intro of COUNTRY_INTROS) {
      const lines = [
        ...intro.geography,
        ...intro.climate,
        ...intro.clothingTips,
        ...intro.culture,
        ...intro.manners,
      ];
      for (const line of lines) expect(line.trim().length).toBeGreaterThan(0);
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

describe('情報源', () => {
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
    // 「文化庁」だけでは、どの資料を見ればよいのか分からない。
    for (const intro of COUNTRY_INTROS) {
      for (const source of intro.sources) {
        expect(source.sourceLabel).toMatch(/「.+」/);
        const organization = source.sourceLabel.split('「')[0];
        expect(organization.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('出典IDが重複しない', () => {
    for (const intro of COUNTRY_INTROS) {
      const ids = intro.sources.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('同じ出典を同じセクションへ二重に割り当てない', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const [section, ids] of Object.entries(intro.sectionSources)) {
        expect(new Set(ids ?? []).size, `${section} に重複した出典がある`).toBe(
          (ids ?? []).length,
        );
      }
    }
  });

  it('セクションに割り当てた出典IDが実在する', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const ids of Object.values(intro.sectionSources)) {
        for (const id of ids ?? []) {
          expect(findSource(intro, id)).toBeDefined();
        }
      }
    }
  });

  it('事実説明を含むカードには出典が1件以上ある', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const section of buildDetailSections(intro)) {
        if (!needsSource(section.id)) continue;
        expect(section.sources.length, `${section.id} に出典が無い`).toBeGreaterThan(0);
      }
    }
  });

  it('ゲーム内データが正本のカードは、外部出典を引かずに正本を示す', () => {
    const words = buildDetailSections(JAPAN).find((s) => s.id === 'words')!;
    expect(INTERNAL_DATA_SECTIONS).toContain('words');
    expect(words.sources).toEqual([]);
    expect(words.sourceNote).toBeTruthy();
    expect(words.sourceNote).toContain('語彙データ');
  });

  // ここから先は「ドメインが公的機関だから正しい」で済ませないための確認。
  // 各カードに、その内容を直接あつかう資料が割り当たっているかを見る。

  it('まちのカードに、その都市を所管する自治体の資料が割り当たっている', () => {
    const cities = buildDetailSections(JAPAN).find((s) => s.id === 'cities')!;
    const labels = cities.sources.map((s) => s.sourceLabel).join(' ');
    const urls = cities.sources.map((s) => s.sourceUrl).join(' ');
    expect(labels).toContain('東京都');
    expect(urls).toContain('metro.tokyo.lg.jp');
  });

  it('みどころの法隆寺の説明に、法隆寺を直接あつかう資料が割り当たっている', () => {
    const landmarks = buildDetailSections(JAPAN).find((s) => s.id === 'landmarks')!;
    const mentionsHoryuji = landmarks.items.some((i) => i.name.includes('法隆寺'));
    expect(mentionsHoryuji).toBe(true);

    const direct = landmarks.sources.filter(
      (s) => s.sourceLabel.includes('法隆寺') || /horyuji|list\/660/.test(s.sourceUrl),
    );
    expect(direct.length, '法隆寺を直接あつかう資料が無い').toBeGreaterThan(0);
  });

  it('れきしのカードに、歴史を直接あつかう資料が割り当たっている', () => {
    const history = buildDetailSections(JAPAN).find((s) => s.id === 'history')!;
    const direct = history.sources.filter(
      (s) => s.sourceLabel.includes('歴史') || /history/.test(s.sourceUrl),
    );
    expect(direct.length, '歴史を直接あつかう資料が無い').toBeGreaterThan(0);
  });

  it('たべもの・特産物のカードに、農林水産省の該当資料が割り当たっている', () => {
    const foods = buildDetailSections(JAPAN).find((s) => s.id === 'foods')!;
    const maff = foods.sources.filter((s) => /maff\.go\.jp/.test(s.sourceUrl));
    expect(maff.length, '農林水産省の資料が無い').toBeGreaterThan(0);
    const labels = maff.map((s) => s.sourceLabel).join(' ');
    expect(labels).toMatch(/食|料理/);
  });

  it('きこうのカードに、気象機関の資料が割り当たっている', () => {
    const climate = buildDetailSections(JAPAN).find((s) => s.id === 'climate')!;
    const jma = climate.sources.filter((s) => s.sourceLabel.includes('気象庁'));
    expect(jma.length, '気象庁の資料が無い').toBeGreaterThan(0);
  });

  it('しぜんのカードに、森林と山岳の資料が割り当たっている', () => {
    const nature = buildDetailSections(JAPAN).find((s) => s.id === 'nature')!;
    const labels = nature.sources.map((s) => s.sourceLabel).join(' ');
    expect(labels).toMatch(/森林/);
    expect(labels).toMatch(/山岳|標高/);
  });

  it('ぶんかのカードに、年中行事とマナーの資料が割り当たっている', () => {
    const culture = buildDetailSections(JAPAN).find((s) => s.id === 'culture')!;
    const labels = culture.sources.map((s) => s.sourceLabel).join(' ');
    expect(labels).toMatch(/年中行事/);
    expect(labels).toMatch(/マナー/);
  });

  it('出典は公的機関・公的機関が運営する媒体のドメインに限る', () => {
    // ドメインだけで正しさは決まらないが、出所の最低条件としては確認する。
    const allowedHost = /\.go\.jp$|\.lg\.jp$|\.unesco\.org$|^web-japan\.org$/;
    for (const source of JAPAN.sources) {
      const host = new URL(source.sourceUrl).hostname;
      expect(host, `${source.sourceLabel} のドメイン`).toMatch(allowedHost);
    }
  });
});

describe('出典の確認状態', () => {
  it('本文を確認できていない出典が残っていることを、データ側で分かるようにする', () => {
    // この開発環境からは公的機関のページ本文を取得できない。
    // 確認済みとして扱わないため、状態をデータに持たせている。
    const unverified = JAPAN.sources.filter((s) => s.verification !== 'body-checked');
    expect(unverified.length).toBeGreaterThan(0);
    expect(hasUnverifiedSource(JAPAN)).toBe(true);
  });

  it('本文をすべて確認できたら、未確認の印は消える', () => {
    const verified: CountryIntro = {
      ...JAPAN,
      sources: JAPAN.sources.map((s) => ({ ...s, verification: 'body-checked' as const })),
    };
    expect(hasUnverifiedSource(verified)).toBe(false);
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

  it('中身の無いカテゴリーはカードを作らない', () => {
    // 情報がそろっていない国でも、空のカードで画面が崩れないようにする。
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
    // 首都と食べものは残っているので、その2つは出る。
    expect(ids).toContain('cities');
    expect(ids).toContain('foods');
  });

  it('料理と特産物を混同しない', () => {
    // 料理の名前と特産物の名前が重ならないこと。
    const foods = JAPAN.foods.map((f) => f.name);
    const specialties = JAPAN.specialties.map((s) => s.name);
    for (const name of specialties) expect(foods).not.toContain(name);
    // 地域差があることを本文で断っている。
    const section = buildDetailSections(JAPAN).find((s) => s.id === 'foods')!;
    expect(section.lines.join('')).toContain('地域');
  });

  it('気候の説明が地域差にふれている', () => {
    // 「国全体が同じ」と誤解させないための最低限の確認。
    const section = buildDetailSections(JAPAN).find((s) => s.id === 'climate')!;
    expect(section.lines.join('')).toMatch(/地域|北と南/);
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
