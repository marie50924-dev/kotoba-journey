import { el } from '../app/dom';
import { UI } from '../data/strings';
import { COURSE_CATEGORIES, categoryLabel, groupedCourses } from '../data/courses';
import type { CourseCategoryId } from '../data/courses';
import { screenShell } from '../components/screenShell';
import { npcBar } from '../components/npcBar';
import type { AppContext } from '../app/state';

/** コース入口。学年別 / 資格・試験 / 社会人 の3分類。 */
export function courseEntryScreen(ctx: AppContext): HTMLElement {
  const cards = COURSE_CATEGORIES.map((category) =>
    el(
      'button',
      { type: 'button', class: 'option-card option-card--category' },
      [
        el('span', { class: 'option-card__label', text: category.label }),
        el('span', { class: 'option-card__detail', text: category.description }),
      ],
    ),
  );

  cards.forEach((card, index) => {
    const category = COURSE_CATEGORIES[index];
    card.addEventListener('click', () => {
      ctx.selection.categoryId = category.id;
      ctx.navigate({ name: 'courseList', categoryId: category.id });
    });
  });

  return screenShell(
    {
      title: UI.courseEntry.heading,
      lead: UI.courseEntry.lead,
      onBack: () => ctx.back(),
    },
    [
      el('div', { class: 'option-grid' }, cards),
      // NPC はここで挨拶する。会話は「はなしかける」で開く。
      npcBar(ctx, { screen: 'course', trigger: 'course' }),
    ],
  );
}

/**
 * 分類内のコース一覧。
 * 資格名やロゴを模した画像は作らず、文字だけでコースを選ばせる。
 */
export function courseListScreen(ctx: AppContext, categoryId: CourseCategoryId): HTMLElement {
  const selectedId = ctx.records.get().selectedCourseId;
  const groups = groupedCourses(categoryId).map((group) => {
    const buttons = group.courses.map((course) => {
      const node = el(
        'button',
        {
          type: 'button',
          class: `option-chip${course.id === selectedId ? ' is-selected' : ''}`,
          'aria-pressed': course.id === selectedId,
        },
        [el('span', { text: course.label })],
      );
      node.addEventListener('click', () => {
        ctx.selection.categoryId = categoryId;
        ctx.selection.courseId = course.id;
        ctx.records.update((record) => ({ ...record, selectedCourseId: course.id }));
        // 主人公は80人から選んだキャラクターに固定なので、
        // コース決定後はそのまま枚数選択へ進む。
        ctx.navigate({ name: 'cardCount' });
      });
      return node;
    });

    return el('div', { class: 'course-group' }, [
      group.group ? el('h2', { class: 'course-group__title', text: group.group }) : null,
      el('div', { class: 'chip-grid' }, buttons),
    ]);
  });

  return screenShell(
    {
      title: categoryLabel(categoryId),
      onBack: () => ctx.back(),
    },
    groups,
  );
}

/** 枚数選択。選択中の項目がひと目で分かるようにする。 */
export function cardCountScreen(ctx: AppContext): HTMLElement {
  const counts = [6, 12, 20] as const;
  const options = counts.map((count) => {
    const text = UI.cardCount.options[count];
    const node = el(
      'button',
      {
        type: 'button',
        class: `option-card option-card--count${ctx.selection.cardCount === count ? ' is-selected' : ''}`,
        'aria-pressed': ctx.selection.cardCount === count,
      },
      [
        el('span', { class: 'option-card__label', text: text.title }),
        el('span', { class: 'option-card__detail', text: text.detail }),
        el('span', { class: 'option-card__level', text: text.level }),
      ],
    );
    node.addEventListener('click', () => {
      ctx.selection.cardCount = count;
      ctx.navigate({ name: 'worldMap' });
    });
    return node;
  });

  return screenShell(
    {
      title: UI.cardCount.heading,
      lead: UI.cardCount.lead,
      onBack: () => ctx.back(),
    },
    [
      el('div', { class: 'option-grid option-grid--counts' }, options),
      el('p', { class: 'note', text: UI.app.grayboxNote }),
    ],
  );
}

