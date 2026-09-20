import { describe, expect, it } from 'vitest';
import {
  COUNTRY_INTROS,
  buildDetailSections,
  findCountryIntro,
  findSource,
  hasCountryIntro,
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
  it('すべての出典が名前・URL・確認日を持つ', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const source of intro.sources) {
        expect(source.sourceLabel.length).toBeGreaterThan(0);
        expect(source.sourceUrl).toMatch(/^https:\/\//);
        expect(source.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('日本の出典は公的機関のドメイン', () => {
    // 一次情報・公的情報を優先する方針を、ドメインで機械的に担保する。
    const officialHost = /\.go\.jp$|\.unesco\.org$/;
    for (const source of JAPAN.sources) {
      const host = new URL(source.sourceUrl).hostname;
      expect(host).toMatch(officialHost);
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
