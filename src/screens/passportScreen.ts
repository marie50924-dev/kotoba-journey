import { el, button } from '../app/dom';
import { UI, COUNTRY_LABELS } from '../data/strings';
import { resolveCourseLabel } from '../data/courses';
import { findPair } from '../data/wordPairs';
import { formatDuration } from '../domain/scoring';
import { bestTimeOverall, computeStreak, lifetimeAccuracy, toDateKey } from '../storage/learningRecord';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/** マイパスポート。localStorage に保存した学習記録を表示する。 */
export function passportScreen(ctx: AppContext): HTMLElement {
  const record = ctx.records.get();
  const streak = computeStreak(record.playedDates, toDateKey(new Date()));
  const best = bestTimeOverall(record);
  // 保存された文字列をそのまま出さず、必ず現在の表示名へ解決する。
  const selectedCourseLabel = resolveCourseLabel(record.selectedCourseId);

  const stats = el('div', { class: 'stat-grid' }, [
    tile(UI.passport.totalPlays, `${record.totalPlays}${UI.units.times}`),
    tile(UI.passport.totalDays, `${record.playedDates.length}${UI.units.days}`),
    tile(UI.passport.streak, `${streak}${UI.units.days}`),
    tile(
      UI.passport.learnedCount,
      `${record.masteredPairIds.length}${UI.units.words}`,
      UI.passport.learnedCountNote,
    ),
    tile(UI.passport.lifetimeAccuracy, `${lifetimeAccuracy(record)}${UI.units.percent}`),
    tile(UI.passport.bestTime, best === null ? '—' : formatDuration(best)),
  ]);

  const countries =
    record.visitedCountryIds.length === 0
      ? el('p', { class: 'note', text: UI.passport.empty })
      : el(
          'div',
          { class: 'stamp-row' },
          record.visitedCountryIds.map((id) =>
            el('span', { class: 'stamp', text: COUNTRY_LABELS[id] ?? id }),
          ),
        );

  const history =
    record.history.length === 0
      ? el('p', { class: 'note', text: UI.passport.empty })
      : el(
          'ul',
          { class: 'history' },
          record.history.map((entry) =>
            el('li', { class: 'history__item' }, [
              el('span', { class: 'history__date', text: entry.date }),
              el('span', {
                class: 'history__course',
                // 旧保存データには当時の検定名が入っていることがある。
                // 画面へは内部IDから引き直した現在の名前だけを出す。
                text: resolveCourseLabel(entry.courseId, entry.courseLabel) || UI.passport.noCourse,
              }),
              el('span', {
                class: 'history__score',
                text: `${entry.cardCount}枚 ・ ${entry.accuracy}${UI.units.percent} ・ ${formatDuration(entry.elapsedMs)}`,
              }),
            ]),
          ),
        );

  return screenShell(
    { title: UI.passport.heading, onBack: () => ctx.back(), variant: 'screen--passport' },
    [
      stats,
      section(UI.passport.selectedCourse, el('p', { class: 'value-line', text: selectedCourseLabel || UI.passport.noCourse })),
      section(UI.passport.visitedCountries, countries),
      /*
       * 練習中と復習は別枠。並びは学習の進み方の順で、練習中を上に置く。
       * 区分の決まり方は2つの節に共通なので、説明は上の節の前に1度だけ出す。
       */
      el('p', { class: 'note', text: UI.passport.classificationNote }),
      wordSection('practicing', UI.passport.practicingWords, UI.passport.practicingWordsNote, record.practicingPairIds),
      wordSection('review', UI.passport.reviewWords, UI.passport.reviewWordsNote, record.reviewPairIds),
      section(UI.passport.recentPlays, history),
      el('p', { class: 'note', text: UI.passport.privacy }),
      el('div', { class: 'screen__footer' }, [
        button(UI.actions.settings, () => ctx.navigate({ name: 'settings' }), {
          class: 'btn btn--soft',
        }),
      ]),
    ],
  );
}

/**
 * 数値タイル。note を渡すと、数値の下に短い補足を出す。
 * 補足は見出しと同じ文字の大きさで、狭い画面では折り返して収める。
 */
function tile(label: string, value: string, note?: string): HTMLElement {
  return el('div', { class: 'stat-tile' }, [
    el('span', { class: 'stat-tile__label', text: label }),
    el('strong', { class: 'stat-tile__value', text: value }),
    note ? el('span', { class: 'stat-tile__note', text: note }) : null,
  ]);
}

/** 先頭から何語までを最初に見せるか。これを超えたぶんは開閉で出す。 */
const VISIBLE_WORDS = 10;

/** 1語ぶんの行。 */
function wordItem(pairId: number): HTMLElement {
  const pair = findPair(pairId);
  return el('li', { class: 'word-list__item' }, [
    el('span', { class: 'word-list__ja', text: pair?.ja ?? '?' }),
    el('span', { class: 'word-list__en', text: pair?.en ?? '?' }),
  ]);
}

/**
 * ことばの区分ひとつぶんの節。見出しに語数をそえる。
 *
 * ・0語のときは「該当することばはありません」。
 *   記録そのものが無いことを指す「まだ記録がありません」とは言い分ける。
 * ・10語まではそのまま並べる。11語以上のときは先頭10語だけ出し、
 *   残りは「すべて見る（○語）」で開く。「折りたたむ」で元へ戻せる。
 * ・一覧の中だけをスクロールさせる作りは使わない。画面ごと送って読む。
 * ・開閉は普通のボタンとパネルで作るので、キーボードでもそのまま操作できる。
 *   aria-expanded で開閉の状態を読み上げへ伝え、aria-controls でどこが
 *   開くのかを結びつける。フォーカスはボタンに残す。
 */
function wordSection(id: string, title: string, note: string, pairIds: readonly number[]): HTMLElement {
  const count = pairIds.length;
  const heading = `${title}（${count}${UI.units.words}）`;

  if (count === 0) {
    return el('section', { class: 'result-section' }, [
      el('h2', { class: 'result-section__title', text: heading }),
      el('p', { class: 'note', text: note }),
      el('p', { class: 'note', text: UI.passport.emptyWords }),
    ]);
  }

  const head = el('ul', { class: 'word-list' }, pairIds.slice(0, VISIBLE_WORDS).map(wordItem));
  if (count <= VISIBLE_WORDS) {
    return el('section', { class: 'result-section' }, [
      el('h2', { class: 'result-section__title', text: heading }),
      el('p', { class: 'note', text: note }),
      head,
    ]);
  }

  const panelId = `passport-words-${id}`;
  const rest = el('ul', { class: 'word-list', id: panelId }, pairIds.slice(VISIBLE_WORDS).map(wordItem));
  rest.hidden = true;

  const openLabel = `${UI.passport.showAllWords}（${count}${UI.units.words}）`;
  const toggle = el('button', {
    type: 'button',
    class: 'btn btn--soft word-list__toggle',
    'aria-expanded': 'false',
    'aria-controls': panelId,
    text: openLabel,
  });
  toggle.addEventListener('click', () => {
    const open = rest.hidden;
    rest.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? UI.passport.collapseWords : openLabel;
    // フォーカスはボタンに残す。開いた直後も同じ位置から続けて操作できる。
  });

  return el('section', { class: 'result-section' }, [
    el('h2', { class: 'result-section__title', text: heading }),
    el('p', { class: 'note', text: note }),
    head,
    rest,
    toggle,
  ]);
}

function section(title: string, body: HTMLElement): HTMLElement {
  return el('section', { class: 'result-section' }, [
    el('h2', { class: 'result-section__title', text: title }),
    body,
  ]);
}
