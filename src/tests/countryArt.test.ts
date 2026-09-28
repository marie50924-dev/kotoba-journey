import { describe, expect, it } from 'vitest';
import { COUNTRY_ART, findCountryArt } from '../data/countryArt';
import { DESTINATIONS } from '../data/destinations';
import { AGE_GROUPS } from '../data/characters';
import { TITLE_ASSETS } from '../data/titleAssets';

/**
 * 国別の正式イラストの検査。
 *
 * ここで確かめるのは「どの国にどのファイルが結び付いているか」と、
 * 受領物 README の表現ルールを画面の文字が破っていないか。
 * 実際の描画（切れていないか、他の絵と取りちがえていないか）は
 * 実ブラウザテストの役目で、ここでは扱わない。
 *
 * 画像の中身そのものは、この検査では確認できない。
 * ファイルの取りちがえは、受領時の SHA-256 照合でしか見つけられない。
 */

/** 配信用 WebP。存在の確認に使う。 */
const DELIVERY = import.meta.glob('../../public/assets/countries/*.webp');
/** 無改変で保管してある原寸。 */
const SOURCES = import.meta.glob('../../assets-source/countries/*');

function baseNames(map: Record<string, unknown>): string[] {
  return Object.keys(map)
    .map((p) => p.split('/').pop() as string)
    .sort();
}

/** 受領物 README が「採用済み」とした国と原寸ファイル名。 */
const ADOPTED: ReadonlyArray<readonly [string, string]> = [
  ['japan', 'japan-adopted.jpeg'],
  ['london', 'london-adopted.png'],
  ['paris', 'paris-adopted.png'],
];

describe('国別の正式イラスト', () => {
  it('採用済みの3国がそろっていて、IDが重複しない', () => {
    expect(COUNTRY_ART.map((a) => a.countryId)).toEqual(ADOPTED.map(([id]) => id));
    expect(new Set(COUNTRY_ART.map((a) => a.countryId)).size).toBe(COUNTRY_ART.length);
  });

  it('原寸ファイル名が受領物どおりで、勝手に改名されていない', () => {
    for (const [countryId, sourceFile] of ADOPTED) {
      expect(findCountryArt(countryId)?.sourceFile).toBe(sourceFile);
    }
    expect(baseNames(SOURCES)).toEqual(ADOPTED.map(([, f]) => f).sort());
  });

  it('配信用 WebP が国ごとに1枚ずつあり、過不足がない', () => {
    const expected = ADOPTED.map(([, f]) => `${f.replace(/\.[^.]+$/, '')}.webp`).sort();
    expect(baseNames(DELIVERY)).toEqual(expected);
  });

  it('画像URLが配信用の場所を指していて、国どうしで共有していない', () => {
    for (const art of COUNTRY_ART) {
      const stem = art.sourceFile.replace(/\.[^.]+$/, '');
      expect(art.image).toBe(`${import.meta.env.BASE_URL}assets/countries/${stem}.webp`);
      expect(art.image.match(/\.webp/g)).toHaveLength(1);
    }
    expect(new Set(COUNTRY_ART.map((a) => a.image)).size).toBe(COUNTRY_ART.length);
  });

  it('原寸の画素数を記録してあり、縦長のまま保っている', () => {
    for (const art of COUNTRY_ART) {
      expect(art.width).toBeGreaterThan(0);
      expect(art.height).toBeGreaterThan(0);
      // 受領物はどれも縦長（およそ 9:19.5）。横長に置き換わったら気付けるようにする。
      expect(art.height).toBeGreaterThan(art.width);
      expect(art.width / art.height).toBeGreaterThan(0.4);
      expect(art.width / art.height).toBeLessThan(0.52);
    }
  });

  it('横長の枠に収めるときの中心が、絵の上のほうに置かれている', () => {
    for (const art of COUNTRY_ART) {
      // 名所はどの絵でも上のほうに集まっている。中央（0.5）では写らない。
      expect(art.focusY, `${art.countryId} の focusY`).toBeGreaterThan(0);
      expect(art.focusY, `${art.countryId} の focusY`).toBeLessThan(0.5);
    }
  });

  it('読み上げ用の説明と一言が、国ごとに違う文で入っている', () => {
    for (const art of COUNTRY_ART) {
      expect(art.alt.length).toBeGreaterThan(8);
      expect(art.caption.length).toBeGreaterThan(4);
    }
    expect(new Set(COUNTRY_ART.map((a) => a.alt)).size).toBe(COUNTRY_ART.length);
    expect(new Set(COUNTRY_ART.map((a) => a.caption)).size).toBe(COUNTRY_ART.length);
  });

  it('「ここから全部が見える」と読める説明を付けていない', () => {
    // 受領物 README の表現ルール。絵は複数の場所の名所を集めた合成画で、
    // 実際の一地点から全部が見えるわけではない。
    const forbidden = ['一望', '見わたせ', '見渡せ', 'ここから見える', 'すべて見える', '全部見える'];
    for (const art of COUNTRY_ART) {
      for (const word of forbidden) {
        expect(`${art.alt} ${art.caption}`, `${art.countryId} に「${word}」が入っている`).not.toContain(word);
      }
    }
  });

  it('桜は日本の絵の説明にだけ出てくる', () => {
    // 受領物 README の表現ルール。ロンドンとパリに桜は使わない。
    for (const art of COUNTRY_ART) {
      const text = `${art.alt} ${art.caption}`;
      if (art.countryId === 'japan') expect(text).toContain('桜');
      else expect(text, `${art.countryId} の説明に桜が入っている`).not.toContain('桜');
    }
  });

  it('国の絵に、表紙の絵や年代別キャラクターの絵を使っていない', () => {
    // 表紙のパイロットと CA は表紙の中だけの存在で、旅をする本人ではない。
    // 年代別の2人組も本人ではないので、国の絵として出してはいけない。
    const others = [TITLE_ASSETS.cover, TITLE_ASSETS.background, TITLE_ASSETS.logo, TITLE_ASSETS.mascot]
      .concat(AGE_GROUPS.map((g) => g.image));
    for (const art of COUNTRY_ART) {
      expect(others).not.toContain(art.image);
      expect(art.image).toContain('assets/countries/');
    }
  });
});

describe('行き先の解放状態と絵の対応', () => {
  it('選べる行き先には必ず絵がある', () => {
    for (const destination of DESTINATIONS) {
      if (!destination.unlocked) continue;
      expect(findCountryArt(destination.id), `${destination.id} の絵が無い`).toBeDefined();
    }
  });

  it('いま選べるのは日本だけで、ロンドンとパリはロック中のまま', () => {
    // 絵を用意したことと、行き先を解放することは別の判断。
    // 絵の追加で解放されてしまっていないことをここで固定する。
    const unlocked = DESTINATIONS.filter((d) => d.unlocked).map((d) => d.id);
    expect(unlocked).toEqual(['japan']);
    for (const id of ['london', 'paris']) {
      expect(DESTINATIONS.find((d) => d.id === id)?.unlocked, `${id} が解放されている`).toBe(false);
    }
  });

  it('絵があるだけの国は、行き先としては選べない', () => {
    for (const art of COUNTRY_ART) {
      const destination = DESTINATIONS.find((d) => d.id === art.countryId);
      expect(destination, `${art.countryId} が行き先一覧に無い`).toBeDefined();
    }
    expect(COUNTRY_ART.length).toBeGreaterThan(DESTINATIONS.filter((d) => d.unlocked).length);
  });

  it('知らない国IDを渡しても落ちない', () => {
    expect(findCountryArt(undefined)).toBeUndefined();
    expect(findCountryArt(null)).toBeUndefined();
    expect(findCountryArt('')).toBeUndefined();
    expect(findCountryArt('atlantis')).toBeUndefined();
  });
});
