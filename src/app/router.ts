import type { AppContext, Route } from './state';
import { createSelection } from './state';
import { titleScreen } from '../screens/titleScreen';
import { courseEntryScreen, courseListScreen, cardCountScreen } from '../screens/courseScreens';
import { courseCharacterScreen } from '../screens/courseCharacterScreen';
import { worldMapScreen } from '../screens/worldMapScreen';
import { travelScreen } from '../screens/travelScreen';
import { countryIntroScreen } from '../screens/countryIntroScreen';
import { quizPromptScreen } from '../screens/quizPromptScreen';
import { waveQuizScreen } from '../screens/waveQuizScreen';
import { waveQuizResultScreen } from '../screens/waveQuizResultScreen';
import { kartaScreen } from '../screens/kartaScreen';
import { resultScreen } from '../screens/resultScreen';
import { passportScreen } from '../screens/passportScreen';
import { settingsScreen } from '../screens/settingsScreen';
import type { LearningRecordStore } from '../storage/learningRecord';
import type { AudioService } from '../services/audioService';
import type { EntitlementService } from '../services/entitlementService';

export interface AppDependencies {
  root: HTMLElement;
  records: LearningRecordStore;
  audio: AudioService;
  entitlements: EntitlementService;
}

/**
 * 画面を1枚ずつ差し替えるだけの最小ルーター。
 * 画面固有の後片付け（タイマー・ResizeObserver 等）は
 * 'screen:destroy' イベントで各画面に任せる。
 */
export function createApp(deps: AppDependencies): AppContext {
  const history: Route[] = [];
  let current: HTMLElement | null = null;

  const ctx: AppContext = {
    records: deps.records,
    audio: deps.audio,
    entitlements: deps.entitlements,
    selection: createSelection(),
    lastResult: null,
    lastResultWasBest: false,
    wave: null,
    quiz: null,
    navigate(route: Route) {
      history.push(route);
      render(route);
    },
    back() {
      history.pop();
      const previous = history[history.length - 1] ?? { name: 'title' as const };
      render(previous);
    },
    startJourney() {
      ctx.navigate({ name: 'courseEntry' });
    },
    savedAgeGroup() {
      return deps.records.get().characterAgeGroup;
    },
  };

  function render(route: Route): void {
    if (current) {
      current.dispatchEvent(new CustomEvent('screen:destroy'));
      current.remove();
    }
    current = renderRoute(ctx, route);
    deps.root.dataset.route = route.name;
    deps.root.append(current);
    window.scrollTo(0, 0);
  }

  ctx.navigate({ name: 'title' });
  return ctx;
}

function renderRoute(ctx: AppContext, route: Route): HTMLElement {
  switch (route.name) {
    case 'title':
      return titleScreen(ctx);
    case 'courseCharacter':
      return courseCharacterScreen(ctx);
    case 'courseEntry':
      return courseEntryScreen(ctx);
    case 'courseList':
      return courseListScreen(ctx, route.categoryId);
    case 'cardCount':
      return cardCountScreen(ctx);
    case 'worldMap':
      return worldMapScreen(ctx);
    case 'travel':
      return travelScreen(ctx);
    case 'countryIntro':
      return countryIntroScreen(ctx);
    case 'karta':
      return kartaScreen(ctx);
    case 'result':
      return resultScreen(ctx);
    case 'quizPrompt':
      return quizPromptScreen(ctx);
    case 'quiz':
      return waveQuizScreen(ctx);
    case 'quizResult':
      return waveQuizResultScreen(ctx);
    case 'passport':
      return passportScreen(ctx);
    case 'settings':
      return settingsScreen(ctx);
  }
}
