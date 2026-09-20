import { describe, expect, it } from 'vitest';
import { CHARACTERS, findCharacter, isCharacterId } from '../data/characters';
import { COUNTRY_INTROS, findCountryIntro, hasCountryIntro } from '../data/countryIntros';
import { DESTINATIONS, findDestination, TRAVEL_MODE_LABEL } from '../data/destinations';
import { TITLE_ASSET_SIZES } from '../data/titleAssets';

describe('主人公', () => {
  it('男女2人を定義している', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['girl', 'boy']);
  });

  it('IDは重複せず、判定関数が既定値を守る', () => {
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    expect(isCharacterId('girl')).toBe(true);
    expect(isCharacterId('boy')).toBe(true);
    expect(isCharacterId('other')).toBe(false);
    expect(isCharacterId(null)).toBe(false);
  });

  it('未選択なら主人公は取得できない（案内役中心で進む）', () => {
    expect(findCharacter(null)).toBeUndefined();
    expect(findCharacter('girl')?.label).toBe('女の子の主人公');
  });

  it('それぞれ役割の説明を持つ', () => {
    for (const character of CHARACTERS) {
      expect(character.label.length).toBeGreaterThan(0);
      expect(character.tagline.length).toBeGreaterThan(0);
      expect(character.role.length).toBeGreaterThan(0);
    }
  });
});

describe('国紹介データ', () => {
  it('Phase 1 では日本だけ本文を持つ', () => {
    expect(COUNTRY_INTROS.map((c) => c.destinationId)).toEqual(['japan']);
    expect(hasCountryIntro('japan')).toBe(true);
    expect(hasCountryIntro('london')).toBe(false);
    expect(hasCountryIntro('paris')).toBe(false);
  });

  it('カードは2〜3枚に収める', () => {
    for (const intro of COUNTRY_INTROS) {
      expect(intro.cards.length).toBeGreaterThanOrEqual(2);
      expect(intro.cards.length).toBeLessThanOrEqual(3);
    }
  });

  it('各カードは出典を保持できる', () => {
    const japan = findCountryIntro('japan')!;
    for (const card of japan.cards) {
      expect(card.source).toBeTruthy();
    }
  });

  it('国名・あいさつ・学ぶことを持つ', () => {
    const japan = findCountryIntro('japan')!;
    expect(japan.nameJa).toBe('日本');
    expect(japan.nameEn).toBe('Japan');
    expect(japan.greeting.ja.length).toBeGreaterThan(0);
    expect(japan.greeting.en.length).toBeGreaterThan(0);
    expect(japan.learning.length).toBeGreaterThan(0);
  });

  it('未整備の国は undefined を返し、画面側で開始を妨げない', () => {
    expect(findCountryIntro('london')).toBeUndefined();
  });
});

describe('行き先', () => {
  it('日本だけ選択可能で、ロンドンとパリはロックのまま', () => {
    expect(DESTINATIONS.filter((d) => d.unlocked).map((d) => d.id)).toEqual(['japan']);
    expect(DESTINATIONS.filter((d) => !d.unlocked).map((d) => d.label)).toEqual(['ロンドン', 'パリ']);
  });

  it('移動表現と出発地の表示名を持つ', () => {
    for (const destination of DESTINATIONS) {
      expect(TRAVEL_MODE_LABEL[destination.travelMode]).toBeTruthy();
      expect(destination.departureLabel.length).toBeGreaterThan(0);
    }
  });

  it('未知のIDでは undefined を返す', () => {
    expect(findDestination('mars')).toBeUndefined();
    expect(findDestination(null)).toBeUndefined();
    expect(findDestination('japan')?.label).toBe('日本');
  });
});

describe('表紙素材', () => {
  it('縦横比を保った配信サイズを記録している', () => {
    // 引き伸ばし防止のため、幅と高さの両方を <img> へ渡している。
    expect(TITLE_ASSET_SIZES.background.width / TITLE_ASSET_SIZES.background.height)
      .toBeCloseTo(853 / 1844, 3);
    expect(TITLE_ASSET_SIZES.logo.width / TITLE_ASSET_SIZES.logo.height)
      .toBeCloseTo(1997 / 787, 2);
    expect(TITLE_ASSET_SIZES.mascot.width / TITLE_ASSET_SIZES.mascot.height)
      .toBeCloseTo(1402 / 1122, 2);
  });
});
