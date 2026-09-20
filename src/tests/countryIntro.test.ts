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
  displayDataClaims,
  needsSource,
  droppedInDisplayData,
  isDropped,
  showsDetails,
  uncheckedClaims,
  visibleClaims,
} from '../data/countryIntros';
import type {
  CountryIntro,
  DetailSectionId,
  FactClaim,
  Greeting,
  NamedItem,
} from '../data/countryIntros';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { UI } from '../data/strings';
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
 * あいさつを取り出す。
 *
 * greeting は任意（不採用にした国では項目ごと消える）なので、
 * 「日本にはある」という前提が崩れたらそこで止める。
 * 型アサーションは使わない。実際に有無を見て分岐する。
 */
function greetingOf(intro: CountryIntro): Greeting {
  const greeting = intro.greeting;
  if (greeting === undefined) throw new Error(`${intro.countryId} にあいさつが無い`);
  return greeting;
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
    greeting: intro.greeting
      ? { ...intro.greeting, claim: check(intro.greeting.claim) }
      : undefined,
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
    specialtiesNote: intro.specialtiesNote ? check(intro.specialtiesNote) : undefined,
    history: intro.history.map((h) => ({ ...h, claim: check(h.claim) })),
    culture: intro.culture.map(check),
    manners: intro.manners.map(check),
  };
}

/**
 * 画面へ渡す文字列をすべて集める。
 *
 * 画面（countryIntroScreen）が描くのは、ここに集めたものだけ。
 * 不採用にした文章がここに出てこなければ、DOM にも出ない。
 */
function renderedText(intro: CountryIntro): string {
  if (!showsDetails(intro)) return UI.countryIntro.preparing;

  const shown = (c: FactClaim | undefined): boolean =>
    c === undefined || c.verification !== 'rejected';

  const head = [
    intro.greeting && shown(intro.greeting.claim)
      ? `${intro.greeting.ja} ${intro.greeting.en}`
      : '',
    shown(intro.capital.claim) ? intro.capital.name : '',
    shown(intro.highlight.claim) ? `${intro.highlight.name}${intro.highlight.note ?? ''}` : '',
    shown(intro.summary) ? intro.summary.text : '',
  ];

  const body = buildDetailSections(intro).flatMap((section) => [
    section.heading,
    ...section.lines,
    ...section.items.map((i) => `${i.name}${i.note ?? ''}`),
    ...section.sources.map((src) => src.sourceLabel),
    section.sourceNote ?? '',
  ]);

  return [...head, ...body].join('\n');
}

describe('国紹介の必須項目', () => {
  it('すべての国で、文字の項目が空でない', () => {
    for (const intro of COUNTRY_INTROS) {
      expect(intro.countryId.length).toBeGreaterThan(0);
      expect(intro.countryNameJa.length).toBeGreaterThan(0);
      expect(intro.countryNameEn.length).toBeGreaterThan(0);
      expect(intro.capital.name.length).toBeGreaterThan(0);
      // あいさつは任意。持っているなら中身が空であってはならない。
      if (intro.greeting) {
        expect(intro.greeting.ja.length).toBeGreaterThan(0);
        expect(intro.greeting.en.length).toBeGreaterThan(0);
      }
      expect(intro.summary.text.length).toBeGreaterThan(0);
      expect(intro.highlight.name.length).toBeGreaterThan(0);
      if (intro.specialtiesNote) {
        expect(intro.specialtiesNote.text.length).toBeGreaterThan(0);
      }
      expect(intro.clothingNote.length).toBeGreaterThan(0);
      expect(intro.learning.length).toBeGreaterThan(0);
    }
  });

  it('ゲームの進行に必要な並びは空でない', () => {
    // 事実の並びは、取り下げた結果からになることがある（カードごと出なくなるだけ）。
    // 一方、学ぶ語と出典が無いと画面が成り立たないので、ここは空にしない。
    for (const intro of COUNTRY_INTROS) {
      expect(intro.learningWords.length).toBeGreaterThan(0);
      expect(intro.sources.length).toBeGreaterThan(0);
    }
  });

  it('日本の表示対象は、確認しやすい18件まで絞ってある', () => {
    // 本文確認の負担を減らすため、公的資料に明記されていない文章は
    // 本文を読む前に取り下げた（withdrawn）。取り下げた分は監査記録に残る。
    expect(displayDataClaims(JAPAN)).toHaveLength(18);
    expect(JAPAN.retiredClaims).toHaveLength(28);
    expect(allClaims(JAPAN)).toHaveLength(46);
    expect(JAPAN.retiredClaims.every((c) => c.verification === 'withdrawn')).toBe(true);
  });

  it('取り下げた並びは空になっている', () => {
    expect(JAPAN.majorCities).toEqual([]);
    expect(JAPAN.clothingTips).toEqual([]);
    expect(JAPAN.foods).toEqual([]);
    expect(JAPAN.specialties).toEqual([]);
    expect(JAPAN.history).toEqual([]);
    expect(JAPAN.specialtiesNote).toBeUndefined();
  });

  it('残した並びは中身がある', () => {
    expect(JAPAN.geography).toHaveLength(1);
    expect(JAPAN.climate).toHaveLength(3);
    expect(JAPAN.landmarks).toHaveLength(4);
    expect(JAPAN.culture).toHaveLength(2);
    expect(JAPAN.manners).toHaveLength(3);
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

  it('確認状態は4種類のいずれか', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        expect(['unchecked', 'body-checked', 'rejected', 'withdrawn']).toContain(
          claim.verification,
        );
      }
    }
  });

  it('取り下げた文章は、画面に出さない状態として扱われる', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of intro.retiredClaims) {
        expect(isDropped(claim), `${claim.id} が画面に出る状態のまま`).toBe(true);
      }
    }
  });

  it('取り下げた文章には、取り下げの理由が書いてある', () => {
    for (const claim of JAPAN.retiredClaims) {
      expect(claim.verificationNote, `${claim.id} に理由が無い`).toBeTruthy();
      expect(claim.verificationNote).toContain('本文確認の前に取り下げた');
      // 読んでいない資料を根拠のように見せない。
      expect(claim.sourceIds).toEqual([]);
      expect(claim.candidateSourceIds ?? []).toEqual([]);
    }
  });

  it('取り下げた文章も、claimId と文章は元のまま残る', () => {
    const byId = new Map(JAPAN.retiredClaims.map((c) => [c.id, c]));
    expect(byId.get('jp-claim-city-osaka')?.text).toBe('大阪（おおさか・にぎやかなまち）');
    expect(byId.get('jp-claim-spec-rice')?.text).toBe('こめは日本の特産物。');
    expect(byId.get('jp-claim-hist-samurai')?.text).toContain('武士とよばれる人たちが力を持ち');
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

  it('表示対象は、本文確認済みか未確認のどちらかしかない', () => {
    // 人が資料の本文を読んだ分だけ進む。Claude の環境からは本文を取得できない。
    const checked = displayDataClaims(JAPAN).filter((c) => c.verification === 'body-checked');
    expect(checked.length + uncheckedClaims(JAPAN).length).toBe(displayDataClaims(JAPAN).length);
    // 取り下げた分は表示対象に入らない。
    expect(JAPAN.retiredClaims.every((c) => c.verification === 'withdrawn')).toBe(true);
  });

  it('みどころ4件は本文確認が済んでいる', () => {
    expect(JAPAN.landmarks).toHaveLength(4);
    for (const item of JAPAN.landmarks) {
      expect(item.claim?.verification, `${item.id} が未確認`).toBe('body-checked');
      expect(item.claim?.checkedAt, `${item.id} に確認日が無い`).toBe('2026-09-20');
    }
  });

  it('表示名と、確認した文章の内容がずれていない', () => {
    // 一覧に出す名前と説明は、確認済みの文章と同じことを言っていること。
    for (const item of JAPAN.landmarks) {
      expect(item.claim!.text).toContain(item.note!.replace('世界文化遺産。', ''));
    }
  });

  it('本文確認した事実は、確認日と確認メモと出典を持つ', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        if (claim.verification !== 'body-checked') continue;
        expect(claim.sourceIds.length, `${claim.id} に出典が無い`).toBeGreaterThan(0);
        expect(claim.checkedAt, `${claim.id} に確認日が無い`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(claim.verificationNote, `${claim.id} に確認メモが無い`).toBeTruthy();
      }
    }
  });

  it('本文確認していない事実は、確認日を持たない', () => {
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        if (claim.verification === 'body-checked') continue;
        expect(claim.checkedAt, `${claim.id} に確認日が入っている`).toBeUndefined();
      }
    }
  });

  it('資料の見つからなかった文章は、出典を持たないまま取り下げてある', () => {
    const withdrawnForNoSource = [
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
    for (const id of withdrawnForNoSource) {
      const claim = byId.get(id);
      expect(claim, `${id} が見つからない`).toBeDefined();
      expect(claim!.sourceIds, `${id} に出典が割り当たっている`).toEqual([]);
      expect(claim!.candidateSourceIds ?? [], `${id} に確認予定資料が入っている`).toEqual([]);
      expect(claim!.verification, `${id} が取り下げられていない`).toBe('withdrawn');
      expect(displayDataClaims(JAPAN).map((c) => c.id), `${id} が表示対象に残っている`).not.toContain(
        id,
      );
    }
  });

  it('歴史4区分は、要約度が高いので取り下げてある', () => {
    expect(JAPAN.history).toEqual([]);
    const historyIds = [
      'jp-claim-hist-ancient',
      'jp-claim-hist-samurai',
      'jp-claim-hist-edo',
      'jp-claim-hist-modern',
    ];
    const byId = new Map(JAPAN.retiredClaims.map((c) => [c.id, c]));
    for (const id of historyIds) {
      expect(byId.get(id), `${id} が監査記録に無い`).toBeDefined();
      expect(byId.get(id)!.verification).toBe('withdrawn');
    }
  });
});

describe('公開の可否', () => {
  // 正式仕様
  //   unchecked      未確認。表示不可。表示対象に残っていれば公開を止める。
  //   body-checked   本文確認済み。表示してよい。
  //   rejected       本文を読んだ結果の不採用。画面には絶対に出さない。
  //                  監査記録として残すが、表示対象から外れていれば公開は妨げない。

  /** 表示対象の claim を1件だけ差し替えた複製を作る。 */
  function withCultureClaim(intro: CountryIntro, patch: Partial<FactClaim>): CountryIntro {
    return {
      ...intro,
      culture: [{ ...intro.culture[0], ...patch }, ...intro.culture.slice(1)],
    };
  }

  /** 不採用にした文章を、表示対象から外して監査記録へ移す。 */
  function retireFirstCulture(intro: CountryIntro): { intro: CountryIntro; retired: FactClaim } {
    const retired: FactClaim = {
      ...intro.culture[0],
      verification: 'rejected',
      sourceIds: [],
      verificationNote: '（テスト用）本文を読んだ結果、不採用にした',
    };
    return {
      intro: {
        ...intro,
        culture: intro.culture.slice(1),
        retiredClaims: [...intro.retiredClaims, retired],
      },
      retired,
    };
  }

  it('日本は下書きのまま', () => {
    expect(JAPAN.publicationStatus).toBe('draft');
  });

  it('未確認の表示対象claimが1件あれば公開できない', () => {
    const verified = asVerified(JAPAN);
    const withUnchecked = withCultureClaim(verified, {
      verification: 'unchecked',
      sourceIds: [],
    });
    expect(uncheckedClaims(withUnchecked)).toHaveLength(1);
    expect(canPublish(withUnchecked)).toBe(false);
    expect(showsDetails(withUnchecked)).toBe(false);
  });

  it('今の日本も、未確認の表示対象claimが残っているので公開できない', () => {
    expect(uncheckedClaims(JAPAN).length).toBeGreaterThan(0);
    expect(canPublish(JAPAN)).toBe(false);
    expect(showsDetails(JAPAN)).toBe(false);
  });

  it('body-checkedの表示対象claimだけなら公開できる', () => {
    const verified = asVerified(JAPAN);
    expect(uncheckedClaims(verified)).toHaveLength(0);
    expect(droppedInDisplayData(verified)).toHaveLength(0);
    expect(canPublish(verified)).toBe(true);
    expect(showsDetails(verified)).toBe(true);
  });

  it('rejectedが監査記録に残っていても、表示対象から外れていれば公開できる', () => {
    const { intro, retired } = retireFirstCulture(asVerified(JAPAN));

    // 監査記録には残る。
    expect(allClaims(intro).map((c) => c.id)).toContain(retired.id);
    // 画面データからは参照されていない。
    expect(displayDataClaims(intro).map((c) => c.id)).not.toContain(retired.id);
    expect(droppedInDisplayData(intro)).toHaveLength(0);

    expect(canPublish(intro)).toBe(true);
    expect(showsDetails(intro)).toBe(true);
  });

  it('rejectedが画面データから参照されていれば公開できない', () => {
    const verified = asVerified(JAPAN);
    const stillReferenced = withCultureClaim(verified, {
      verification: 'rejected',
      sourceIds: [],
    });
    expect(droppedInDisplayData(stillReferenced)).toHaveLength(1);
    expect(canPublish(stillReferenced)).toBe(false);
    expect(showsDetails(stillReferenced)).toBe(false);
  });

  it('rejectedのtextが画面へ渡す文字列に出ない', () => {
    // 画面はここで組み立てた文字列しか描かないので、
    // これに出ていなければ DOM にも出ない。

    // 1. 監査記録へ移した場合（公開できる状態）
    const { intro, retired } = retireFirstCulture(asVerified(JAPAN));
    expect(canPublish(intro)).toBe(true);
    expect(renderedText(intro)).not.toContain(retired.text);

    // 2. 画面データに残したまま不採用にした場合（公開は止まるが、文章も出さない）
    const verified = asVerified(JAPAN);
    const stillReferenced = withCultureClaim(verified, {
      verification: 'rejected',
      sourceIds: [],
    });
    expect(renderedText(stillReferenced)).not.toContain(verified.culture[0].text);
    // 公開判定を通さず、カードの組み立てだけを見ても出てこない。
    const culture = buildDetailSections(stillReferenced).find((s) => s.id === 'culture')!;
    expect(culture.lines.join('\n')).not.toContain(verified.culture[0].text);
  });

  it('rejectedにした並びの項目も、名前ごと画面へ渡さない', () => {
    const verified = asVerified(JAPAN);
    const dropped = verified.landmarks[0];
    const claim = dropped.claim;
    expect(claim).toBeDefined();
    const withRejectedLandmark: CountryIntro = {
      ...verified,
      landmarks: [
        { ...dropped, claim: { ...claim!, verification: 'rejected', sourceIds: [] } },
        ...verified.landmarks.slice(1),
      ],
    };
    const landmarks = buildDetailSections(withRejectedLandmark).find((s) => s.id === 'landmarks')!;
    expect(landmarks.items.map((i) => i.id)).not.toContain(dropped.id);
    expect(renderedText(withRejectedLandmark)).not.toContain(dropped.name);
  });

  it('rejectedの出典は、確認済みの文章の裏づけとして残っていなければ出さない', () => {
    // 不採用の文章だけが引いていた資料が、カードの出典欄に残らないようにする。
    const verified = asVerified(JAPAN);
    const lone = verified.culture[0];
    const withLoneSource: CountryIntro = {
      ...verified,
      culture: [
        { ...lone, sourceIds: ['gsi-mountains'], verification: 'rejected' },
        ...verified.culture.slice(1).map((c) => ({ ...c, sourceIds: [PLACEHOLDER_SOURCE_ID] })),
      ],
    };
    const culture = buildDetailSections(withLoneSource).find((s) => s.id === 'culture')!;
    expect(culture.sources.map((src) => src.id)).not.toContain('gsi-mountains');
  });

  it('取り下げた文章が画面データに残っていれば公開できない', () => {
    // 表示対象から外し忘れた場合。rejected と同じく公開を止める。
    const verified = asVerified(JAPAN);
    const stillReferenced = withCultureClaim(verified, {
      verification: 'withdrawn',
      sourceIds: [],
    });
    expect(droppedInDisplayData(stillReferenced).map((c) => c.id)).toEqual([
      verified.culture[0].id,
    ]);
    expect(canPublish(stillReferenced)).toBe(false);
    expect(showsDetails(stillReferenced)).toBe(false);
  });

  it('取り下げた文章のtextが画面へ渡す文字列に出ない', () => {
    const verified = asVerified(JAPAN);
    const stillReferenced = withCultureClaim(verified, {
      verification: 'withdrawn',
      sourceIds: [],
    });
    // 公開判定を通さず、カードの組み立てだけを見ても出てこない。
    const culture = buildDetailSections(stillReferenced).find((s) => s.id === 'culture')!;
    expect(culture.lines.join('\n')).not.toContain(verified.culture[0].text);
    expect(visibleClaims(stillReferenced).map((c) => c.id)).not.toContain(verified.culture[0].id);
  });

  it('取り下げた並びの項目も、名前ごと画面へ渡さない', () => {
    const verified = asVerified(JAPAN);
    const dropped = verified.landmarks[0];
    const claim = dropped.claim;
    expect(claim).toBeDefined();
    const withWithdrawn: CountryIntro = {
      ...verified,
      landmarks: [
        { ...dropped, claim: { ...claim!, verification: 'withdrawn', sourceIds: [] } },
        ...verified.landmarks.slice(1),
      ],
    };
    const landmarks = buildDetailSections(withWithdrawn).find((s) => s.id === 'landmarks')!;
    expect(landmarks.items.map((i) => i.id)).not.toContain(dropped.id);
  });

  it('日本の取り下げ28件は、画面データから1件も参照されていない', () => {
    const displayIds = new Set(displayDataClaims(JAPAN).map((c) => c.id));
    for (const claim of JAPAN.retiredClaims) {
      expect(displayIds.has(claim.id), `${claim.id} が表示対象に残っている`).toBe(false);
    }
    expect(droppedInDisplayData(JAPAN)).toHaveLength(0);
  });

  it('publicationStatusだけverifiedに変えても、未確認の事実は出ない', () => {
    // 宣言だけで公開できてしまわないようにする二重の歯止め。
    const declaredOnly: CountryIntro = { ...JAPAN, publicationStatus: 'verified' };
    expect(canPublish(declaredOnly)).toBe(false);
    expect(showsDetails(declaredOnly)).toBe(false);
  });

  it('下書きの日本では、準備中の案内だけが出る', () => {
    // 画面は showsDetails が false のとき、事実を1つも組み立てずに
    // UI.countryIntro.preparing だけを出す。
    expect(showsDetails(JAPAN)).toBe(false);
    expect(UI.countryIntro.preparing).toBe('この国の紹介は準備中です。');
    // 子ども向けの画面に、技術的な説明を混ぜない。
    expect(UI.countryIntro.preparing).not.toMatch(/未確認|確認中|draft|通信/);
  });

  it('表示対象の事実は、不採用のものを含まない', () => {
    const { intro, retired } = retireFirstCulture(asVerified(JAPAN));
    expect(visibleClaims(intro).map((c) => c.id)).not.toContain(retired.id);
    expect(visibleClaims(intro).every((c) => c.verification === 'body-checked')).toBe(true);
  });
});

describe('あいさつ', () => {
  // 「日本では『こんにちは』、英語では『Hello』」という対応そのものが学習情報。
  // UI の飾りではないので、他の事実と同じく本文確認の対象にする。

  /** あいさつの claim だけを差し替えた複製。 */
  function withGreeting(intro: CountryIntro, patch: Partial<FactClaim>): CountryIntro {
    const greeting = greetingOf(intro);
    return { ...intro, greeting: { ...greeting, claim: { ...greeting.claim, ...patch } } };
  }

  it('claimId が固定されている', () => {
    expect(greetingOf(JAPAN).claim.id).toBe('jp-claim-greeting-hello');
  });

  it('claimId が他の事実と重複しない', () => {
    const ids = COUNTRY_INTROS.flatMap((intro) => allClaims(intro)).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === 'jp-claim-greeting-hello')).toHaveLength(1);
  });

  it('画面に出す語と、確認する文章が食い違わない', () => {
    // 文章は ja / en から組み立てるので、二重に書いてずれることがない。
    const { ja, en, claim } = greetingOf(JAPAN);
    expect(claim.text).toContain(ja);
    expect(claim.text).toContain(en);
  });

  it('本文未確認のまま、出典を割り当てていない', () => {
    const claim = greetingOf(JAPAN).claim;
    expect(claim.verification).toBe('unchecked');
    expect(claim.sourceIds).toEqual([]);
    expect(claim.candidateSourceIds).toEqual([]);
    expect(claim.verificationNote).toBeTruthy();
  });

  it('公開判定の表示対象に入っている', () => {
    expect(displayDataClaims(JAPAN).map((c) => c.id)).toContain('jp-claim-greeting-hello');
  });

  it('あいさつが未確認なら公開できない', () => {
    // 他の45件をすべて確認済みにしても、あいさつ1件で止まる。
    const onlyGreetingLeft = withGreeting(asVerified(JAPAN), {
      verification: 'unchecked',
      sourceIds: [],
    });
    expect(uncheckedClaims(onlyGreetingLeft).map((c) => c.id)).toEqual(['jp-claim-greeting-hello']);
    expect(canPublish(onlyGreetingLeft)).toBe(false);
    expect(showsDetails(onlyGreetingLeft)).toBe(false);
  });

  it('下書きの画面に「こんにちは」「Hello」が出ない', () => {
    const drawn = renderedText(JAPAN);
    expect(drawn).not.toContain('こんにちは');
    expect(drawn).not.toContain('Hello');
    expect(drawn).toBe(UI.countryIntro.preparing);
  });

  it('publicationStatus だけ verified にしても、未確認のあいさつは出ない', () => {
    const declaredOnly: CountryIntro = { ...JAPAN, publicationStatus: 'verified' };
    expect(showsDetails(declaredOnly)).toBe(false);
    expect(renderedText(declaredOnly)).not.toContain('こんにちは');
    expect(renderedText(declaredOnly)).not.toContain('Hello');
  });

  it('本文確認が済んで公開条件を満たしたときだけ表示対象になる', () => {
    const verified = asVerified(JAPAN);
    expect(greetingOf(verified).claim.verification).toBe('body-checked');
    expect(showsDetails(verified)).toBe(true);
    expect(visibleClaims(verified).map((c) => c.id)).toContain('jp-claim-greeting-hello');
    expect(renderedText(verified)).toContain('こんにちは');
    expect(renderedText(verified)).toContain('Hello');
  });

  it('不採用にしたあいさつは表示されない', () => {
    const rejected = withGreeting(asVerified(JAPAN), {
      verification: 'rejected',
      sourceIds: [],
    });
    expect(renderedText(rejected)).not.toContain('こんにちは');
    expect(renderedText(rejected)).not.toContain('Hello');
  });

  it('不採用のあいさつが表示対象データに残っていれば公開できない', () => {
    const rejected = withGreeting(asVerified(JAPAN), {
      verification: 'rejected',
      sourceIds: [],
    });
    expect(droppedInDisplayData(rejected).map((c) => c.id)).toEqual(['jp-claim-greeting-hello']);
    expect(canPublish(rejected)).toBe(false);
    expect(showsDetails(rejected)).toBe(false);
  });

  it('不採用にして retiredClaims へ移せば、表示対象から完全に消え、公開を妨げない', () => {
    // あいさつを出さない国にする場合の形。
    // greeting の項目ごと外し、元の claim を監査記録として1件だけ残す。
    // ダミーのあいさつも、ダミーの claim も作らない。
    const verified = asVerified(JAPAN);
    const original = greetingOf(verified).claim;

    // 1〜3. greeting を外し、元の claim を rejected にして retiredClaims へ入れる。
    const retired: FactClaim = {
      ...original,
      verification: 'rejected',
      sourceIds: [],
      verificationNote: '（テスト用）本文を読んだ結果、あいさつを不採用にした',
    };
    const withoutGreeting: CountryIntro = {
      ...verified,
      greeting: undefined,
      retiredClaims: [...verified.retiredClaims, retired],
    };

    // 4. 表示対象に元の claimId が無い。
    expect(displayDataClaims(withoutGreeting).map((c) => c.id)).not.toContain(original.id);
    // 5. 描かれる事実にも無い。
    expect(visibleClaims(withoutGreeting).map((c) => c.id)).not.toContain(original.id);
    // 6. 監査記録には1件だけ残る。
    expect(allClaims(withoutGreeting).filter((c) => c.id === original.id)).toHaveLength(1);
    // 7. 二重保持していない（allClaims の中で claimId が重複しない）。
    const ids = allClaims(withoutGreeting).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    // あいさつの分だけ表示対象が減り、総数は変わらない。
    expect(displayDataClaims(withoutGreeting)).toHaveLength(
      displayDataClaims(verified).length - 1,
    );
    expect(allClaims(withoutGreeting)).toHaveLength(allClaims(verified).length);

    // 8. 他の表示対象がすべて body-checked なので公開できる。
    expect(droppedInDisplayData(withoutGreeting)).toHaveLength(0);
    expect(uncheckedClaims(withoutGreeting)).toHaveLength(0);
    expect(canPublish(withoutGreeting)).toBe(true);
    // 9. verified なので詳細は出る。
    expect(withoutGreeting.publicationStatus).toBe('verified');
    expect(showsDetails(withoutGreeting)).toBe(true);
    // 10. それでも、あいさつの語も文章も画面へは出ない。
    const drawn = renderedText(withoutGreeting);
    expect(drawn).not.toContain(greetingOf(verified).ja);
    expect(drawn).not.toContain(greetingOf(verified).en);
    expect(drawn).not.toContain(original.text);
    // 他の事実は変わらず出ている（あいさつだけを外したことの確認）。
    expect(drawn).toContain(verified.summary.text);
  });

  it('不採用にしても、監査記録の文章はチェックリストと同じまま', () => {
    // claimId と文章を書き換えずに移すので、人が表で追える。
    const original = greetingOf(JAPAN).claim;
    expect(checklist).toContain(original.id);
    expect(checklist).toContain(original.text);
  });

  it('下書きのままでもカルタへ進める（あいさつを隠しても進行は止まらない）', () => {
    // 画面はデータの有無に関わらず開始ボタンを出す。ここではデータ側の前提だけ固定する。
    expect(JAPAN.publicationStatus).toBe('draft');
    expect(showsDetails(JAPAN)).toBe(false);
    expect(JAPAN.learningWords.length).toBeGreaterThan(0);
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

  it('body-checked の出典は、確認済みの事実から引かれている', () => {
    // 読んだ印だけ付いて、どの文章も支えていない出典が残らないようにする。
    const used = new Set(
      allClaims(JAPAN)
        .filter((c) => c.verification === 'body-checked')
        .flatMap((c) => c.sourceIds),
    );
    const marked = JAPAN.sources.filter((s) => s.verification === 'body-checked').map((s) => s.id);
    expect(marked.sort()).toEqual([...used].sort());
  });

  it('body-checked の事実は、本文を読んだ出典だけを引いている', () => {
    // 「一覧に名前があった」だけの資料を根拠として付けない。
    for (const intro of COUNTRY_INTROS) {
      for (const claim of allClaims(intro)) {
        if (claim.verification !== 'body-checked') continue;
        for (const id of claim.sourceIds) {
          const source = findSource(intro, id);
          expect(source?.verification, `${claim.id} が未確認の出典 ${id} を引いている`).toBe(
            'body-checked',
          );
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
  // たべもの・れきしは文章を取り下げたため、カードごと出なくなっている。
  const EXPECTED: DetailSectionId[] = [
    'cities',
    'nature',
    'climate',
    'landmarks',
    'culture',
    'words',
  ];

  it('日本は、文章の残っている6つのカードを持つ', () => {
    const ids = buildDetailSections(JAPAN).map((s) => s.id);
    expect(ids).toEqual(EXPECTED);
  });

  it('取り下げたカテゴリーはカードごと出ない', () => {
    const ids = buildDetailSections(JAPAN).map((s) => s.id);
    expect(ids).not.toContain('foods');
    expect(ids).not.toContain('history');
  });

  it('どのカードも見出しがあり、中身が空でない', () => {
    for (const section of buildDetailSections(JAPAN)) {
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.lines.length + section.items.length).toBeGreaterThan(0);
    }
  });

  it('カードに出るのは確認できた事実の出典だけ', () => {
    // 本文確認が済んだ事実のぶんだけ出典が出る。未確認の事実の出典は出ない。
    const checkedSourceIds = new Set(
      displayDataClaims(JAPAN)
        .filter((c) => c.verification === 'body-checked')
        .flatMap((c) => c.sourceIds),
    );
    for (const section of buildDetailSections(JAPAN)) {
      for (const source of section.sources) {
        expect(checkedSourceIds.has(source.id), `${section.id} に未確認の出典が出ている`).toBe(true);
      }
    }
    // みどころだけ、法隆寺の確認が済んでいるので出典が出る。
    const withSources = buildDetailSections(JAPAN)
      .filter((s) => s.sources.length > 0)
      .map((s) => s.id);
    expect(withSources).toEqual(['landmarks']);
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
    expect(ids).not.toContain('foods');
    // 首都の1文と学ぶ語は残るので、この2枚だけになる。
    expect(ids).toEqual(['cities', 'words']);
  });

  it('料理と特産物を混同しない', () => {
    // どちらも取り下げたが、データの持ち方としては分かれたままにしておく。
    // 将来また足すとき、料理と「とれるもの」を混ぜないため。
    const foods = JAPAN.foods.map((f) => f.name);
    const specialties = JAPAN.specialties.map((s) => s.name);
    for (const name of specialties) expect(foods).not.toContain(name);
    expect(buildDetailSections(JAPAN).map((s) => s.id)).not.toContain('foods');
  });

  it('気候のカードは、残した3文と断り書きでできている', () => {
    const section = buildDetailSections(JAPAN).find((s) => s.id === 'climate')!;
    expect(section.lines).toHaveLength(4);
    expect(section.lines.join('')).toMatch(/日本海側|太平洋側/);
    expect(section.lines[section.lines.length - 1]).toBe(JAPAN.clothingNote);
  });

  it('まちのカードは首都だけになっている', () => {
    const section = buildDetailSections(JAPAN).find((s) => s.id === 'cities')!;
    expect(section.items.map((i) => i.name)).toEqual(['東京']);
    expect(section.lines).toEqual(['首都は東京です。']);
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

  it('表の確認状態が、データの確認状態と一致している', () => {
    const states = [...checklist.matchAll(/\| 本文確認状態 \| \*\*([\w-]+)\*\* \|/g)].map(
      (m) => m[1],
    );
    expect(states.length).toBe(allClaims(JAPAN).length);
    // 確認対象は全件が未確認、取り下げた分は withdrawn として並ぶ。
    const counted = (state: string): number => states.filter((s) => s === state).length;
    const inData = (state: string): number =>
      allClaims(JAPAN).filter((c) => c.verification === state).length;
    for (const state of ['unchecked', 'body-checked', 'rejected', 'withdrawn']) {
      expect(counted(state), `表の ${state} の件数がデータと違う`).toBe(inData(state));
    }
  });

  it('確認済みの件数が、データと一致している', () => {
    const done = allClaims(JAPAN).filter((c) => c.verification === 'body-checked').length;
    const todo = allClaims(JAPAN).filter((c) => c.verification === 'unchecked').length;
    expect(checklist).toContain(`本文確認済み: **${done}件** / 未確認: ${todo}件`);
  });

  it('確認済みの行には、本文を読んだ資料と確認日が書いてある', () => {
    for (const claim of allClaims(JAPAN)) {
      if (claim.verification !== 'body-checked') continue;
      const section = checklist.slice(checklist.indexOf(`\`${claim.id}\``));
      const row = section.slice(0, section.indexOf('###', 10));
      expect(row, `${claim.id} の行に確認日が無い`).toContain(`| 確認日 | ${claim.checkedAt} |`);
      expect(row, `${claim.id} の行が確認済みになっていない`).toContain('**body-checked**');
      for (const id of claim.sourceIds) {
        const label = findSource(JAPAN, id)!.sourceLabel;
        expect(row, `${claim.id} の行に資料 ${label} が無い`).toContain(label);
      }
    }
  });

  it('チェックリストの公開判定が、コードの公開判定と一致している', () => {
    const verified = asVerified(JAPAN);
    const unchecked: CountryIntro = {
      ...verified,
      culture: [
        { ...verified.culture[0], verification: 'unchecked', sourceIds: [] },
        ...verified.culture.slice(1),
      ],
    };
    const retired: CountryIntro = {
      ...verified,
      culture: verified.culture.slice(1),
      retiredClaims: [{ ...verified.culture[0], verification: 'rejected', sourceIds: [] }],
    };
    const referenced: CountryIntro = {
      ...verified,
      culture: [
        { ...verified.culture[0], verification: 'rejected', sourceIds: [] },
        ...verified.culture.slice(1),
      ],
    };

    // 書いてある規則と、実際の判定を1行ずつ突き合わせる。
    const rules: { line: string; holds: boolean }[] = [
      {
        line: '- unchecked の表示対象 claim が残っていれば公開不可',
        holds: canPublish(unchecked) === false,
      },
      {
        line: '- 実際に表示する claim がすべて body-checked なら公開可能',
        holds: canPublish(verified) === true,
      },
      {
        line: '- rejected は不採用の監査記録としてチェックリストに残す',
        holds: allClaims(retired).some((c) => c.verification === 'rejected'),
      },
      {
        line: '- rejected は画面表示対象から必ず除外する',
        holds: !renderedText(retired).includes(verified.culture[0].text),
      },
      {
        line: '- rejected が表示対象から除外されていれば国全体の公開を妨げない',
        holds: canPublish(retired) === true,
      },
      {
        line: '- rejected が画面データから参照されていれば公開不可',
        holds: canPublish(referenced) === false,
      },
      {
        line: '- withdrawn も rejected と同じく、表示対象から除外されていれば公開を妨げない',
        holds:
          JAPAN.retiredClaims.every((c) => c.verification === 'withdrawn') &&
          droppedInDisplayData(JAPAN).length === 0,
      },
    ];

    for (const rule of rules) {
      expect(checklist, `チェックリストに「${rule.line}」が無い`).toContain(rule.line);
      expect(rule.holds, `コードが「${rule.line}」を満たしていない`).toBe(true);
    }
  });

  it('46件すべての claimId が載っている', () => {
    const ids = allClaims(JAPAN).map((c) => c.id);
    expect(ids).toHaveLength(46);
    for (const id of ids) expect(checklist, `${id} がチェックリストに無い`).toContain(id);
    expect(checklist).toContain('claim 件数: 46件');
    const count = (state: string): number =>
      allClaims(JAPAN).filter((c) => c.verification === state).length;
    expect(checklist).toContain(`| unchecked（未確認） | ${count('unchecked')} |`);
    expect(checklist).toContain(`| body-checked（確認済み） | ${count('body-checked')} |`);
    expect(checklist).toContain(`| withdrawn（本文確認前の取り下げ） | ${count('withdrawn')} |`);
  });

  it('古い件数と、あいさつを確認対象外とする記述が残っていない', () => {
    expect(checklist).not.toContain('claim 件数: 45件');
    expect(checklist).not.toContain('| unchecked（未確認） | 45 |');
    expect(checklist).not.toContain('こんにちは / Hello | あいさつ | ゲーム内の表現');
    // 「claim にしていないもの」の表に、あいさつが残っていない。
    const notClaimed = checklist.slice(checklist.indexOf('## 画面に出るが claim にしていないもの'));
    expect(notClaimed).not.toContain('こんにちは');
    expect(notClaimed).not.toContain('Hello');
  });

  it('チェックリストに古い公開判定が残っていない', () => {
    expect(checklist).not.toContain('全件が `body-checked` になったら');
    expect(checklist).not.toContain('1件でも未確認や rejected が残っていると');
  });

  it('確認後の作業が、採用・修正・不採用・公開の4つに分かれている', () => {
    for (const heading of ['**採用**', '**修正**', '**不採用**', '**公開**']) {
      expect(checklist).toContain(heading);
    }
    expect(checklist).toContain('`candidateSourceIds` を、確認済みの `sourceIds` へ移す');
    expect(checklist).toContain('その claimId を画面表示対象データから外す');
  });
});
