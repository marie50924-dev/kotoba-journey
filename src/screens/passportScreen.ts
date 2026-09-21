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
    tile(UI.passport.learnedCount, `${record.masteredPairIds.length}${UI.units.words}`),
    tile(UI.passport.lifetimeAccuracy, `${lifetimeAccuracy(record)}${UI.units.percent}`),
    tile(UI.passport.bestTime, best === null ? '—' : formatDuration(best)),
  ]);

  const reviewWords =
    record.reviewPairIds.length === 0
      ? el('p', { class: 'note', text: UI.passport.empty })
      : el(
          'ul',
          { class: 'word-list' },
          record.reviewPairIds.map((pairId) => {
            const pair = findPair(pairId);
            return el('li', { class: 'word-list__item' }, [
              el('span', { class: 'word-list__ja', text: pair?.ja ?? '?' }),
              el('span', { class: 'word-list__en', text: pair?.en ?? '?' }),
            ]);
          }),
        );

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
      section(UI.passport.reviewWords, reviewWords),
      section(UI.passport.recentPlays, history),
      el('p', { class: 'note', text: UI.passport.privacy }),
      el('div', { class: 'screen__footer' }, [
        button(UI.actions.settings, () => ctx.navigate({ name: 'settings' }), { class: 'btn' }),
      ]),
    ],
  );
}

function tile(label: string, value: string): HTMLElement {
  return el('div', { class: 'stat-tile' }, [
    el('span', { class: 'stat-tile__label', text: label }),
    el('strong', { class: 'stat-tile__value', text: value }),
  ]);
}

function section(title: string, body: HTMLElement): HTMLElement {
  return el('section', { class: 'result-section' }, [
    el('h2', { class: 'result-section__title', text: title }),
    body,
  ]);
}
