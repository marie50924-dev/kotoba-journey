import { describe, expect, it } from 'vitest';
import {
  COURSES,
  COURSE_CATEGORIES,
  coursesInCategory,
  findCourse,
  groupedCourses,
} from '../data/courses';
import { DESTINATIONS } from '../data/destinations';
import { UI } from '../data/strings';

describe('コース定義', () => {
  it('コースIDは重複しない', () => {
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
  });

  it('学年別は4コース', () => {
    expect(coursesInCategory('grade').map((c) => c.label)).toEqual([
      '小学生',
      '中学生',
      '高校生',
      '大学生',
    ]);
  });

  it('ステップ別は、ことばチャレンジ8段階としごとチャレンジ6段階に分かれる', () => {
    const groups = groupedCourses('exam');
    expect(groups.map((g) => g.group)).toEqual(['ことばチャレンジ', 'しごとチャレンジ']);
    expect(groups[0].courses.map((c) => c.label)).toEqual([
      'ステップ1',
      'ステップ2',
      'ステップ3',
      'ステップ4',
      'ステップ5',
      'ステップ6',
      'ステップ7',
      'ステップ8',
    ]);
    expect(groups[1].courses.map((c) => c.label)).toEqual([
      'ステップ1',
      'ステップ2',
      'ステップ3',
      'ステップ4',
      'ステップ5',
      'ステップ6',
    ]);
  });

  it('画面に出す名前へ、検定名や試験名を残していない', () => {
    // 語彙はことばトラベルが独自に選ぶので、公式試験に準拠しているとは書かない。
    const shown = [
      ...COURSE_CATEGORIES.map((c) => `${c.label} ${c.description}`),
      ...COURSES.map((c) => `${c.label} ${c.group ?? ''}`),
    ].join(' ');
    for (const word of ['英検', 'TOEIC', '資格', '級', '点']) {
      expect(shown, `「${word}」が画面名に残っている`).not.toContain(word);
    }
  });

  it('ステップ別の案内文は、開発者向けの言葉を含まない', () => {
    const notice = UI.courseList.stepsPreparing;
    expect(notice).toBe('各ステップのことばは準備中です。現在は共通の練習用ことばで遊べます。');
    for (const word of ['仮データ', '未実装', 'ID', 'seed', '語彙セット', 'プール']) {
      expect(notice, `「${word}」が案内に出ている`).not.toContain(word);
    }
  });

  it('内部IDは互換のためそのまま残す', () => {
    // 保存データや画面遷移が参照するので、id は変えない。画面には出ない。
    const ids = COURSES.map((c) => c.id);
    expect(ids).toContain('eiken-5');
    expect(ids).toContain('eiken-1');
    expect(ids).toContain('toeic-400');
    expect(ids).toContain('toeic-900');
    expect(ids).toHaveLength(24);
  });

  it('社会人は6コース', () => {
    expect(coursesInCategory('business').map((c) => c.label)).toEqual([
      '日常英会話',
      '海外旅行',
      'ビジネス',
      '接客・観光',
      '医療・介護',
      'IT・仕事',
    ]);
  });

  it('未知のコースIDは undefined', () => {
    expect(findCourse('存在しない')).toBeUndefined();
    expect(findCourse(null)).toBeUndefined();
    expect(findCourse('eiken-3')?.label).toBe('ステップ3');
  });
});

describe('コースと語彙セットの割り当て', () => {
  it('共通19・旅行1・学校2・接客1・医療介護1に分かれる', () => {
    expect(COURSES).toHaveLength(24);
    const bySet = (id: string) =>
      COURSES.filter((c) => c.vocabularySetId === id).map((c) => c.id);
    expect(bySet('school-practice')).toEqual(['grade-elementary', 'grade-junior']);
    expect(bySet('travel-practice')).toEqual(['biz-travel']);
    expect(bySet('hospitality-practice')).toEqual(['biz-hospitality']);
    // 工程V-2O-1で、医療・介護だけが共通セットから専用セットへ移った。
    expect(bySet('care-practice')).toEqual(['biz-care']);
    expect(bySet('common-practice')).toHaveLength(19);
  });

  it('5つの集合を合わせて24コースになり、重なりがない', () => {
    const sets = [
      'common-practice',
      'travel-practice',
      'school-practice',
      'hospitality-practice',
      'care-practice',
    ];
    const ids = sets.flatMap((id) =>
      COURSES.filter((c) => c.vocabularySetId === id).map((c) => c.id),
    );
    expect(ids).toHaveLength(24);
    // 同じコースが2つの集合へ入っていない。
    expect(new Set(ids).size).toBe(24);
    expect([...ids].sort()).toEqual([...COURSES.map((c) => c.id)].sort());
  });

  it('接客・観光の画面名・内部ID・分類・表示順は変わっていない', () => {
    const course = findCourse('biz-hospitality')!;
    expect(course.label).toBe('接客・観光');
    expect(course.categoryId).toBe('business');
    expect(course.group).toBeUndefined();
    // 社会人の4番目のまま。
    expect(coursesInCategory('business').map((c) => c.id)[3]).toBe('biz-hospitality');
  });

  it('海外旅行の画面名・内部ID・分類は変わっていない', () => {
    const course = findCourse('biz-travel')!;
    expect(course.label).toBe('海外旅行');
    expect(course.categoryId).toBe('business');
    expect(course.group).toBeUndefined();
    // 表示順も変えない（社会人の2番目）。
    expect(coursesInCategory('business').map((c) => c.id)[1]).toBe('biz-travel');
  });

  it('学年別は、小学生・中学生だけが学校のことば', () => {
    // 学校という場面との対応で分けたもので、学年別の難易度ではない。
    // 高校生・大学生は、学校30語がその学年に合うかを示せるデータが無いので動かさない。
    expect(coursesInCategory('grade').map((c) => [c.label, c.vocabularySetId])).toEqual([
      ['小学生', 'school-practice'],
      ['中学生', 'school-practice'],
      ['高校生', 'common-practice'],
      ['大学生', 'common-practice'],
    ]);
  });

  it('社会人6コースのうち、海外旅行・接客観光・医療介護が場面別セット', () => {
    const business = coursesInCategory('business');
    expect(business.map((c) => c.vocabularySetId)).toEqual([
      'common-practice',        // 日常英会話
      'travel-practice',        // 海外旅行
      'common-practice',        // ビジネス
      'hospitality-practice',   // 接客・観光
      'care-practice',          // 医療・介護（工程V-2O-1で専用セットへ）
      'common-practice',        // IT・仕事
    ]);
  });

  it('ステップ別の案内文と、その14コースの語彙セットが食い違っていない', () => {
    // 案内文は「現在は共通の練習用ことばで遊べます」と言っている。
    // 将来ステップ別を別セットへ変えたとき、文言の更新を忘れたらここで落ちる。
    const notice = UI.courseList.stepsPreparing;
    expect(notice).toContain('共通の練習用ことば');
    const steps = coursesInCategory('exam');
    expect(steps).toHaveLength(14);
    for (const course of steps) {
      expect(course.vocabularySetId, `${course.id} が案内文と食い違っている`)
        .toBe('common-practice');
    }
  });
});

describe('世界マップ', () => {
  it('日本だけが選択可能で、ロンドンとパリはロック', () => {
    expect(DESTINATIONS.filter((d) => d.unlocked).map((d) => d.id)).toEqual(['japan']);
    expect(DESTINATIONS.filter((d) => !d.unlocked).map((d) => d.label)).toEqual(['ロンドン', 'パリ']);
  });

  it('ピンの位置はマップ枠内に収まる', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.position.x).toBeGreaterThan(0);
      expect(destination.position.x).toBeLessThan(1);
      expect(destination.position.y).toBeGreaterThan(0);
      expect(destination.position.y).toBeLessThan(1);
    }
  });

  /*
   * 印どうしが重ならないこと。
   *
   * 位置は枠に対する割合、印の箱は固定の px なので、枠が小さいほど
   * 印の間隔だけが詰まる。いちばん不利なのは 320x568 のときで、
   * そこでの実測値を使って確かめる。
   *
   *   枠の幅            296px（320x568・実測）
   *   ロンドンの箱の幅    64px（実測）
   *   パリの箱の幅        46px（実測）
   *   → 中心どうしが (64 + 46) / 2 = 55px 以上 離れていれば、横で重ならない
   *
   * 縦の間隔は枠の高さに左右され、低い画面では足りなくなるため当てにしない。
   * 横だけで離れていることを見る。
   */
  /*
   * 印の札が、どの画面でも「はみ出さない・重ならない・輪を隠さない」ことを、
   * 座標とずれ量の数値だけで確かめる。
   *
   * 盤面は縦横比 3:2 に固定してあるので、枠の高さは幅から決まる。
   * 札の大きさは画面サイズによらず同じ px なので、
   * いちばん狭い画面がいちばん不利になる。全5サイズを見る。
   *
   * 札の大きさは実ブラウザ（Chromium）で測った値。
   *   日本     44 x 44（国名だけ）
   *   ロンドン  64 x 59（国名＋ロック表示）
   *   パリ     46 x 59（国名＋ロック表示）
   */
  const MAP_WIDTHS = [296, 347, 365, 374, 402];
  const MAP_RATIO = 3 / 2;
  const PIN_BOX: Record<string, { w: number; h: number }> = {
    japan: { w: 44, h: 44 },
    london: { w: 64, h: 59 },
    paris: { w: 46, h: 59 },
  };
  /*
   * 札の外へ出る光の最大。
   * 通常は 8px だが、選択中（--glass-glow-on）は 11px 届く。
   * ロンドンとパリはいまロック中で選べないものの、解放されたときに
   * 光が切れないよう、はじめから 11px の余裕で確かめる。
   */
  const GLOW = 11;
  const PIN_GAP = 16; // 札どうしのすきま（光どうしが触れない）
  const ANCHOR_RADIUS = 5; // 元の位置を示す輪

  function find(id: string): (typeof DESTINATIONS)[number] {
    const d = DESTINATIONS.find((x) => x.id === id);
    expect(d, `${id} が無い`).toBeTruthy();
    return d as (typeof DESTINATIONS)[number];
  }

  /** ある画面幅での、札の箱と、元の位置。 */
  function placed(id: string, frameWidth: number) {
    const d = find(id);
    const fh = frameWidth / MAP_RATIO;
    const px = d.position.x * frameWidth;
    const py = d.position.y * fh;
    const dx = d.displayOffset?.x ?? 0;
    const dy = d.displayOffset?.y ?? 0;
    const { w, h } = PIN_BOX[id];
    return {
      point: { x: px, y: py },
      shifted: dx !== 0 || dy !== 0,
      box: { x0: px + dx - w / 2, y0: py + dy - h / 2, x1: px + dx + w / 2, y1: py + dy + h / 2 },
      frame: { w: frameWidth, h: fh },
    };
  }

  const IDS = ['japan', 'london', 'paris'];

  it('どの画面でも、札と外側の光が盤面に収まる', () => {
    for (const fw of MAP_WIDTHS) {
      for (const id of IDS) {
        const p = placed(id, fw);
        const margin = Math.min(p.box.x0, p.box.y0, p.frame.w - p.box.x1, p.frame.h - p.box.y1);
        expect(
          margin,
          `枠幅 ${fw} の ${id}：盤面のふちまで ${margin.toFixed(1)}px しかない`,
        ).toBeGreaterThanOrEqual(GLOW);
      }
    }
  });

  it('どの画面でも、札どうしが重ならない', () => {
    for (const fw of MAP_WIDTHS) {
      for (let i = 0; i < IDS.length; i += 1) {
        for (let j = i + 1; j < IDS.length; j += 1) {
          const a = placed(IDS[i], fw).box;
          const b = placed(IDS[j], fw).box;
          // 横か縦の、どちらかで離れていればよい。
          const gapX = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
          const gapY = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
          const gap = Math.max(gapX, gapY);
          expect(
            gap,
            `枠幅 ${fw} の ${IDS[i]}×${IDS[j]}：すきまが ${gap.toFixed(1)}px しかない`,
          ).toBeGreaterThanOrEqual(PIN_GAP);
        }
      }
    }
  });

  it('どの画面でも、元の位置を示す輪がどの札にも隠れない', () => {
    for (const fw of MAP_WIDTHS) {
      for (const id of IDS) {
        const p = placed(id, fw);
        if (!p.shifted) continue; // ずらしていない都市は輪を出さない
        const r = {
          x0: p.point.x - ANCHOR_RADIUS,
          y0: p.point.y - ANCHOR_RADIUS,
          x1: p.point.x + ANCHOR_RADIUS,
          y1: p.point.y + ANCHOR_RADIUS,
        };
        for (const other of IDS) {
          const b = placed(other, fw).box;
          const hit =
            Math.min(r.x1, b.x1) - Math.max(r.x0, b.x0) > 0 &&
            Math.min(r.y1, b.y1) - Math.max(r.y0, b.y0) > 0;
          expect(hit, `枠幅 ${fw}：${id} の輪が ${other} の札に隠れている`).toBe(false);
        }
      }
    }
  });

  it('引出線が長くなりすぎない（元の位置が分かる範囲にとどめる）', () => {
    for (const destination of DESTINATIONS) {
      if (!destination.displayOffset) continue;
      const { x, y } = destination.displayOffset;
      const length = Math.hypot(x, y);
      expect(length, `${destination.label} のずれが 0`).toBeGreaterThan(0);
      expect(length, `${destination.label} の引出線が ${length.toFixed(1)}px と長い`).toBeLessThanOrEqual(80);
    }
  });

  it('ずらしても、位置関係は地理のまま（ロンドンは西かつ北、日本はいちばん東）', () => {
    for (const fw of MAP_WIDTHS) {
      const l = placed('london', fw).box;
      const p = placed('paris', fw).box;
      const j = placed('japan', fw).box;
      const cx = (b: typeof l) => (b.x0 + b.x1) / 2;
      const cy = (b: typeof l) => (b.y0 + b.y1) / 2;
      expect(cx(l), `枠幅 ${fw}：ロンドンの札がパリより東にある`).toBeLessThan(cx(p));
      expect(cy(l), `枠幅 ${fw}：ロンドンの札がパリより南にある`).toBeLessThan(cy(p));
      expect(cx(j), `枠幅 ${fw}：日本の札がいちばん東にない`).toBeGreaterThan(cx(p));
    }
    // 元の位置そのものでも、ロンドンはパリより西かつ北。
    expect(find('london').position.x).toBeLessThan(find('paris').position.x);
    expect(find('london').position.y).toBeLessThan(find('paris').position.y);
  });

  it('座標は、採用した地図の絵から読み取った値', () => {
    /*
     * 盤面に敷く絵（world-map-v2）の上で、海岸線を手がかりに読み取った推定位置。
     * 絵を差し替えたら、この値も読み直す必要がある。
     * 地理的な正確さを確かめたものではない。
     */
    expect(find('london').position).toEqual({ x: 0.225, y: 0.323 });
    expect(find('paris').position).toEqual({ x: 0.234, y: 0.356 });
    expect(find('japan').position).toEqual({ x: 0.822, y: 0.476 });
  });
});
