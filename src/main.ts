import './styles/base.css';
import './styles/screens.css';
import './styles/title.css';
import './styles/travel.css';
import './styles/quiz.css';
import './styles/avatar.css';
import './styles/chat.css';
import './styles/karta.css';
import { createApp } from './app/router';
import { createBrowserStore } from './storage/safeStorage';
import { LearningRecordStore } from './storage/learningRecord';
import { createAudioService } from './services/audioService';
import { createEntitlementService } from './services/entitlementService';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app が見つかりません');

// 保存データが壊れていても LearningRecordStore が初期値へ復旧するため、起動は止まらない。
const records = new LearningRecordStore(createBrowserStore());

const audio = createAudioService();
audio.setEnabled(records.get().audioEnabled);

createApp({
  root,
  records,
  audio,
  entitlements: createEntitlementService(),
});
