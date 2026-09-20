import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findCourse, categoryLabel } from '../data/courses';
import { ageGroupForCourse, findAgeGroup, usesSavedAgeGroup } from '../data/characters';
import { characterCard } from '../components/characterCard';
import { TITLE_ASSETS } from '../data/titleAssets';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * コースに応じた男女キャラクターの紹介。
 *
 * 年齢層はコース選択から自動で決まる。プレイヤーに性別を尋ねることも、
 * 個人情報を入力させることもない。
 * 英検・TOEIC のように年齢が決まらないコースでは、任意の年齢設定を
 * 使い、未設定なら大人へ安全に落とす（設定画面から変更できる）。
 */
export function courseCharacterScreen(ctx: AppContext): HTMLElement {
  const course = findCourse(ctx.selection.courseId);
  const saved = ctx.records.get().characterAgeGroup;
  const group = findAgeGroup(ageGroupForCourse(course, saved))!;
  const fromSetting = usesSavedAgeGroup(course);

  return screenShell(
    {
      title: UI.characters.heading,
      onBack: () => ctx.back(),
      variant: 'screen--characters',
    },
    [
      el('p', { class: 'chara-intro__course' }, [
        el('span', { class: 'chara-intro__category', text: course ? categoryLabel(course.categoryId) : '' }),
        el('strong', { text: course?.label ?? '' }),
      ]),
      characterCard(group, { variant: 'album', caption: `${group.label}の2人` }),
      el('p', { class: 'chara-intro__desc', text: group.description }),
      el('div', { class: 'chara-intro__guide' }, [
        el('img', {
          class: 'chara-intro__guide-img',
          src: TITLE_ASSETS.mascot,
          alt: UI.characters.guideAlt,
          decoding: 'async',
        }),
        el('p', { class: 'chara-intro__guide-text', text: UI.characters.guideLine }),
      ]),
      fromSetting
        ? el('p', { class: 'note', text: UI.characters.ageSettingNote })
        : null,
      el('div', { class: 'screen__footer' }, [
        button(UI.actions.next, () => ctx.navigate({ name: 'cardCount' }), {
          class: 'btn btn--primary btn--large',
        }),
      ]),
    ],
  );
}
