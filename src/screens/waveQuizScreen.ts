import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { isCorrectAnswer, scoreQuiz } from '../domain/waveQuiz';
import type { QuizQuestion } from '../domain/waveQuiz';
import { isBlankAnswer, looksLikeWrongScript } from '../domain/answerCheck';
import { appendQuizRecord, toDateKey } from '../storage/learningRecord';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 確認テスト本体（直接入力方式）。
 *
 * 出題はそのウェーブの単語だけ。1回のテストの出題方向は固定で、
 * 英語を打つ回とひらがなを打つ回が途中で入れ替わらない。
 * iOS ではページ側からキーボードの入力言語を切り替えられないため、
 * 切り替え操作が発生しないこと自体を設計で担保している。
 *
 * 画面には答えを一切出さない。カルタ盤面も結果一覧もこの画面からは見えない。
 *
 * レイアウトは上から「進捗 → 出題 → 入力欄 → こたえるボタン」の縦並びにしてある。
 * 画面下部固定にすると、320×568 ではソフトウェアキーボードの裏に隠れてしまうため。
 */
export function waveQuizScreen(ctx: AppContext): HTMLElement {
  const active = ctx.quiz;
  if (!active || active.questions.length === 0) {
    return screenShell({ title: UI.quiz.heading }, [
      el('p', { class: 'note', text: UI.passport.empty }),
      el('div', { class: 'screen__footer' }, [
        button(UI.actions.next, () => ctx.navigate({ name: 'result' }), {
          class: 'btn btn--primary',
        }),
      ]),
    ]);
  }
  // 以降は必ず有効なテストがある状態で扱う。
  const quiz = active;

  let index = 0;
  /** 採点中は追加の送信を受け付けない。連打で2問飛ばすのを防ぐ。 */
  let locked = false;

  const progress = el('p', { class: 'quiz__progress' });
  const formatLabel = el('p', { class: 'quiz__format' });
  const prompt = el('p', { class: 'quiz__prompt' });

  const input = el('input', {
    class: 'quiz__input',
    type: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  }) as HTMLInputElement;

  const clearButton = el('button', {
    type: 'button',
    class: 'quiz__clear',
    'aria-label': UI.quiz.clear,
  });
  clearButton.textContent = '×';
  clearButton.addEventListener('click', () => {
    input.value = '';
    refreshInputState();
    input.focus();
  });

  const hint = el('p', { class: 'quiz__hint', role: 'status' });
  const feedback = el('div', { class: 'quiz__feedback', role: 'status' });

  const submitButton = button(UI.quiz.answer, () => submit(), {
    class: 'btn btn--primary btn--large quiz__submit',
  });
  submitButton.disabled = true;

  const nextButton = button(UI.actions.next, () => advance(), {
    class: 'btn btn--primary btn--large quiz__next',
  });

  const skipButton = button(UI.actions.skipQuiz, () => skipAll(), { class: 'btn quiz__skip' });

  // フォームにしておくと、iOS のキーボード右下のキーでそのまま回答できる。
  const form = el('form', { class: 'quiz__form' }, [
    el('div', { class: 'quiz__field' }, [input, clearButton]),
    hint,
    submitButton,
  ]) as HTMLFormElement;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  input.addEventListener('input', refreshInputState);

  const answerArea = el('div', { class: 'quiz__answer-area' }, [form]);
  // 「つぎへ」は正誤表示より下に置く。先に結果を読ませてから進ませたい。
  const advanceArea = el('div', { class: 'quiz__advance-area' });

  const root = screenShell({ title: UI.quiz.heading, variant: 'screen--quiz' }, [
    progress,
    el('div', { class: 'quiz__card' }, [formatLabel, prompt]),
    answerArea,
    feedback,
    advanceArea,
    el('div', { class: 'quiz__skip-row' }, [skipButton]),
  ]);

  /**
   * ソフトウェアキーボードが出ても入力欄と「こたえる」が隠れないようにする。
   * visualViewport は iOS Safari がキーボードの高さを反映して縮める。
   */
  const viewport = window.visualViewport;
  function keepInputVisible(): void {
    if (!viewport) return;
    root.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - viewport.height)}px`);
    // レイアウトが縮んだ直後に、入力欄を見える位置へ寄せる。
    window.requestAnimationFrame(() => {
      answerArea.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  viewport?.addEventListener('resize', keepInputVisible);
  root.addEventListener('screen:destroy', () => {
    viewport?.removeEventListener('resize', keepInputVisible);
  });

  function refreshInputState(): void {
    const blank = isBlankAnswer(input.value);
    submitButton.disabled = blank || locked;
    clearButton.hidden = input.value.length === 0;

    const question = quiz.questions[index];
    if (!blank && looksLikeWrongScript(input.value, question.answerLanguage)) {
      // 不正解にはしない。キーボードの切り替えに気づいてもらうための案内。
      hint.textContent =
        question.answerLanguage === 'en' ? UI.quiz.switchToEnglish : UI.quiz.switchToJapanese;
      hint.classList.add('is-shown');
    } else {
      hint.textContent = blank ? UI.quiz.blankHint : '';
      hint.classList.toggle('is-shown', blank);
    }
  }

  function render(): void {
    const question: QuizQuestion = quiz.questions[index];
    locked = false;

    progress.textContent = `${index + 1} / ${quiz.questions.length} ${UI.quiz.questionOf}`;
    formatLabel.textContent =
      question.answerLanguage === 'en' ? UI.quiz.typeInEnglish : UI.quiz.typeInJapanese;
    prompt.textContent = question.prompt;

    input.value = '';
    input.disabled = false;
    submitButton.hidden = false;
    input.lang = question.answerLanguage === 'en' ? 'en' : 'ja';
    input.setAttribute(
      'aria-label',
      question.answerLanguage === 'en' ? UI.quiz.typeInEnglish : UI.quiz.typeInJapanese,
    );
    input.setAttribute(
      'enterkeyhint',
      index + 1 >= quiz.questions.length ? 'done' : 'next',
    );

    feedback.replaceChildren();
    feedback.classList.remove('is-correct', 'is-wrong');
    answerArea.replaceChildren(form);
    advanceArea.replaceChildren();
    refreshInputState();
  }

  function submit(): void {
    if (locked) return;
    const question = quiz.questions[index];
    if (isBlankAnswer(input.value)) {
      // 未入力では進めない。責めずに、何をすればよいかだけ出す。
      hint.textContent = UI.quiz.blankHint;
      hint.classList.add('is-shown');
      input.focus();
      return;
    }

    locked = true;
    const typed = input.value;
    quiz.answers.set(question.id, typed);

    const correct = isCorrectAnswer(question, typed);
    input.disabled = true;
    // 回答後は「こたえる」と入力中の案内を引っ込め、「つぎへ」だけを残す。
    submitButton.disabled = true;
    submitButton.hidden = true;
    hint.textContent = '';
    hint.classList.remove('is-shown');

    feedback.classList.add(correct ? 'is-correct' : 'is-wrong');
    feedback.replaceChildren(
      el('p', { class: 'quiz__verdict', text: correct ? UI.quiz.correct : UI.quiz.wrong }),
    );
    if (!correct) {
      // 不正解のときだけ正解を見せる。ここで覚え直してもらう。
      feedback.append(
        el('p', { class: 'quiz__answer' }, [
          el('span', { class: 'quiz__answer-label', text: UI.quiz.answerWas }),
          el('strong', { class: 'quiz__answer-text', text: question.answer }),
        ]),
      );
    }

    // 正解を読む時間が要るので、自動では送らず「つぎへ」で進める。
    // 入力欄は答えを見比べられるよう残したまま、操作だけ止める。
    advanceArea.replaceChildren(nextButton);
    nextButton.focus();
  }

  function advance(): void {
    index += 1;
    if (index >= quiz.questions.length) finish();
    else render();
  }

  function finish(): void {
    const outcome = scoreQuiz(quiz.questions, quiz.answers);
    const elapsedMs = Math.round(Math.max(0, performance.now() - quiz.startedAtMs));
    quiz.outcome = outcome;
    quiz.elapsedMs = elapsedMs;

    const wave = ctx.wave;
    if (wave) {
      // テスト結果は通常カルタの集計とは別フィールドへ保存する。
      ctx.records.update((record) =>
        appendQuizRecord(record, {
          date: toDateKey(new Date()),
          courseId: ctx.selection.courseId ?? '',
          destinationId: ctx.selection.destinationId ?? '',
          waveId: wave.waveId,
          status: 'completed',
          questionCount: outcome.questionCount,
          correctCount: outcome.correctCount,
          incorrectPairIds: outcome.incorrectPairIds,
          elapsedMs,
        }),
      );
    }
    ctx.navigate({ name: 'quizResult' });
  }

  /** 途中でやめる。答えた分は捨て、スキップとして記録する。 */
  function skipAll(): void {
    if (locked && quiz.outcome) return;
    const wave = ctx.wave;
    if (wave) {
      ctx.records.update((record) =>
        appendQuizRecord(record, {
          date: toDateKey(new Date()),
          courseId: ctx.selection.courseId ?? '',
          destinationId: ctx.selection.destinationId ?? '',
          waveId: wave.waveId,
          status: 'skipped',
          questionCount: 0,
          correctCount: 0,
          incorrectPairIds: [],
          elapsedMs: 0,
        }),
      );
    }
    ctx.quiz = null;
    ctx.navigate({ name: 'result' });
  }

  render();
  return root;
}
