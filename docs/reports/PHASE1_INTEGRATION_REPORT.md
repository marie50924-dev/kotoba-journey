# ことばトラベル / KOTOBA JOURNEY — Phase 1 統合工程 完了報告

対象リポジトリ: `https://github.com/marie50924-dev/kotoba-journey`
統合ブランチ: `claude/kotoba-journey-phase1-integration`
実施日: 2026-09-20

---

## 1. 開始条件

読み取り専用で照合し、**全項目が一致**したため作業を開始しました。

| 確認項目 | 期待値 | 実測値 | 判定 |
|---|---|---|---|
| origin | `marie50924-dev/kotoba-journey` | `https://github.com/marie50924-dev/kotoba-journey` | 一致 |
| `main` | `2eb33a5ebb0957c93a7676a25d71a5108a7edde8` | 同左 | 一致 |
| `origin/main` | 同上 | 同左 | 一致 |
| `claude/kotoba-journey-phase1-title-tour` | `ad86ca1` を先頭に含む | `ad86ca134ad2436d2f24f99ae29397849d3a7cd4` | 一致 |
| `claude/kotoba-journey-phase1c1-avatar-chat` | `29943cd9ed6f1d280bf6f5c361c6711d2b2ad14c` | 同左 | 一致 |
| 両作業ブランチの working tree | clean | clean（`git status --porcelain` 出力0行） | 一致 |
| origin とローカル | 一致 | 4ブランチすべて同一ハッシュ | 一致 |
| 統合ブランチ | 未作成 | `git ls-remote --heads origin` に該当なし | 一致 |
| title-tour の開始時 test/build | 成功 | test 191件 全通過 / build 成功（45 modules） | 一致 |
| avatar-chat の開始時 test/build | 成功 | test 202件 全通過 / build 成功（47 modules） | 一致 |

停止条件（§10）に該当する項目はありませんでした。

---

## 2. 両ブランチの開始HEAD

| ブランチ | HEAD | 先頭コミット |
|---|---|---|
| `claude/kotoba-journey-phase1-title-tour` | `ad86ca134ad2436d2f24f99ae29397849d3a7cd4` | feat(characters): 主人公をコース連動の年齢層別キャラクターへ変更 |
| `claude/kotoba-journey-phase1c1-avatar-chat` | `29943cd9ed6f1d280bf6f5c361c6711d2b2ad14c` | test: cover avatar selection and roster rotation |
| 共通の分岐点（merge-base） | `2eb33a5ebb0957c93a7676a25d71a5108a7edde8` | ci: enable GitHub Pages from the deploy workflow（= main） |

---

## 3. 統合ブランチ名

```text
claude/kotoba-journey-phase1-integration
```

`ad86ca1`（title-tour の HEAD）から作成しました。

---

## 4. マージ方法とマージコミット

```text
git checkout -b claude/kotoba-journey-phase1-integration ad86ca1
git merge --no-ff origin/claude/kotoba-journey-phase1c1-avatar-chat
```

マージコミット: `b20a64d3f31524f1917bb48246b84686b044da15`

- 第1親: `ad86ca134ad2436d2f24f99ae29397849d3a7cd4`（title-tour）
- 第2親: `29943cd9ed6f1d280bf6f5c361c6711d2b2ad14c`（avatar-chat）

両ブランチの全コミットが履歴として残っています。

```text
*   b20a64d Merge branch 'claude/kotoba-journey-phase1c1-avatar-chat' into ...
|\
| * 29943cd test: cover avatar selection and roster rotation
| * 4429aeb feat: add scripted character conversations
| * 43fe7f0 feat: add the official character roster and selection
* | ad86ca1 feat(characters): 主人公をコース連動の年齢層別キャラクターへ変更
* | f2a06a4 chore(assets): 年齢層別キャラクターの正式採用素材を追加
* | c17beee feat: Phase 1 正式表紙・主人公・旅演出・任意確認テスト
* | 0c61ec0 chore(assets): 表紙の正式採用素材3点を追加
|/
* 2eb33a5 ci: enable GitHub Pages from the deploy workflow
```

**実施していないこと**: rebase / squash / force push / cherry-pick による履歴の作り直し / 既存2ブランチの削除 / main への push / Pages 設定変更。

---

## 5. 競合ファイル一覧

競合は7件でした。`ours` / `theirs` の一括解決は行わず、1件ずつ解決しています。

1. `package.json`
2. `src/app/router.ts`
3. `src/app/state.ts`
4. `src/main.ts`
5. `src/screens/settingsScreen.ts`
6. `src/screens/titleScreen.ts`
7. `src/storage/learningRecord.ts`

自動マージされたファイル（競合なし）: `src/app/dom.ts`, `src/data/strings.ts`, `src/screens/courseScreens.ts`, `src/screens/kartaScreen.ts`, `src/screens/resultScreen.ts`, `src/screens/worldMapScreen.ts`, `src/styles/base.css`, `src/tests/visual/pronunciationPanel.visual.mjs`。

---

## 6. 各競合の解決内容

| ファイル | 解決方針 | 具体的な内容 |
|---|---|---|
| `package.json` | 両方を残す | `test:visual` を「発音パネル → 表紙と通し操作 → キャラクターと会話」の3本直列に。`test:visual:flow` と `test:visual:avatar` の個別実行も両方残した。 |
| `src/screens/titleScreen.ts` | title-tour を採用 | 正式表紙（背景 / ロゴ / マスコット / スクリム / フォールバック）をそのまま保持。「旅をはじめる」は `ctx.startJourney()` を呼ぶため、80人方式の分岐がそのまま効く。 |
| `src/app/state.ts` | 両方を合流し、旧方式を除外 | `Route` に avatarSelect / avatarConfirm（avatar-chat）と travel / countryIntro（title-tour）を両立。`AppContext` に `wave` / `quiz`（title-tour）と `pendingAvatarId` / `castSeed` / `canGoBack()`（avatar-chat）を両立。旧 `courseCharacter` ルートと `savedAgeGroup()` は削除。 |
| `src/app/router.ts` | 同上 | 全画面を1つの `renderRoute` へ統合。`startJourney()` は avatar-chat 版（`selectedAvatarId` 未設定なら選択画面）を採用。`courseCharacterScreen` は導線から除外。 |
| `src/main.ts` | 両方を残す | `title.css` / `travel.css` / `quiz.css`（title-tour）と `avatar.css` / `chat.css`（avatar-chat）をすべて読み込む。 |
| `src/screens/settingsScreen.ts` | 両方を合流し、旧方式を除外 | 「旅するキャラクターを変更」（avatar-chat）と「移動の演出」（title-tour）を両立。旧「表示キャラクター（年齢層セレクト）」は廃止。 |
| `src/storage/learningRecord.ts` | 両方のフィールドを保持し version 3 へ | 双方の version 2 フィールドをすべて残し、`RECORD_VERSION = 3` に統一。移行判別 `detectRecordShape()` を追加。詳細は第11〜13項。 |

解決の順序は「競合解決だけのマージコミット → 導線と保存の一本化 → 文言修正 → テスト」に分け、巨大な1コミットにまとめていません（第20項）。

---

## 7. 最終画面遷移

```text
正式表紙
  └─「旅をはじめる」
      ├─ selectedAvatarId が未設定 → 80人からキャラクター選択 → キャラクター確認 →┐
      └─ selectedAvatarId が設定済み ───────────────────────────────────────────→┤
                                                                                  ↓
                                                                            コース入口（NPC）
                                                                                  ↓
                                                                            コース選択
                                                                                  ↓
                                                                            枚数選択（6 / 12 / 20）
                                                                                  ↓
                                                                            世界地図（NPC）
                                                                                  ↓
                                                                            旅の移動画面
                                                                                  ↓
                                                                            国紹介
                                                                                  ↓
                                                                            カルタ
                                                                                  ↓
                                                                            発音確認
                                                                                  ↓
                                                                            ウェーブ終了チャット
                                                                                  ↓
                                                                            結果・分析（NPC）
                                                                                  ↓
                                                                            マイパスポート
```

- キャラクター選択済みなら選択画面は省略されます（再読み込み後も省略されることを表示回帰テストで確認）。
- 設定画面から「旅するキャラクターを変更」でいつでも変更できます。
- 国紹介には、自分のキャラクターと同行 NPC を並べる `.intro__cast` 構造を用意しました。本番の透過立ち絵が納品されたら `avatarThumb.ts` の中だけを差し替えれば反映されます。

---

## 8. title-tour 側から保持した内容

- 正式表紙（背景 853×1844 / ロゴ 1200×473 / マスコット 760×608、WebP 変換済み・原寸 JPEG は `assets-source/` に無改変で保管）
- 表紙の「旅をはじめる」
- 旅の移動画面（出発地・到着地・経路・移動手段別の乗り物・進行アニメ・スキップ・既訪問による短縮）
- 国紹介（国旗・あいさつ・紹介カード2〜3枚・出典・この国で学ぶこと）
- 正式採用の年齢層別イラスト5点（`assets/characters/*.webp`）
- 設定の「移動の演出」ON/OFF
- 保存フィールド `quizHistory` / `seenTravelIntros` / `skipTravelAnimation` / `characterAgeGroup`
- ドメイン `src/domain/waveQuiz.ts` と確認テスト3画面（通常導線からは外し、Phase 1-C2 の差し替え境界として保持）
- テスト `migration.test.ts`（19件）/ `characters.test.ts`（20件）/ `waveQuiz.test.ts`（19件）

---

## 9. avatar-chat 側から保持した内容

- 80人の正式名簿（`src/data/kotoba-journey-character-names-v1.json` を唯一の正本として読み込み）
- 初回起動時の80人からのキャラクター選択、年代タブ（5）× 表示フィルター（すべて / 男性 / 女性）
- キャラクター確認画面
- 選ばなかった79人が NPC（`castNpcs` は自分を必ず除外）
- 年代と学習コースは独立（どの年代を選んでも学習内容は変わらない）
- 設定からのキャラクター変更
- NPC 選出（`src/domain/npcCasting.ts`、`CAST_SIZE_BY_SCREEN`、直近12人の連続登場抑制）
- 台本式チャット（`src/data/dialogues/`、4場面・6台本、自由入力欄なし）
- 仮サムネイル `src/components/avatarThumb.ts`（本番立ち絵への唯一の差し替え箇所）
- 保存フィールド `selectedAvatarId` / `metAvatarIds` / `recentNpcAvatarIds`
- テスト `avatars.test.ts`（16件）/ `avatarStorage.test.ts`（21件）/ `npcCasting.test.ts`（17件）/ `dialogues.test.ts`（15件）

---

## 10. 廃止・無効化した旧仕様

### 廃止（最終導線から除外）

| 対象 | 措置 | 理由 |
|---|---|---|
| コース連動の5年代×男女2人を主人公とする方式 | 廃止 | 80人から1人を選ぶ方式へ一本化（正式判断） |
| `src/screens/courseCharacterScreen.ts` | ファイル削除 | 上記方式専用の画面で、他から参照されないため |
| ルート `courseCharacter` | 削除 | コース選択後は枚数選択へ直行 |
| `AppContext.savedAgeGroup()` | 削除 | 旧方式専用のアクセサ |
| 設定の「表示キャラクター（年齢層セレクト）」 | 削除 | 旧方式専用の設定 |

**失っていないもの**: 正式採用の年齢層別イラスト5点は残し、旅の移動画面と国紹介で引き続き表示します。ただし「コースに連動」ではなく「**選んだキャラクターの年代に連動**」へ変更しました（`ageGroupFromAvatarAgeGroup()` で名簿の `middle` ↔ イラストの `junior` を橋渡し）。キャプションも「◯◯の2人」から旅の情景としての表現へ改めています。

### 無効化（削除せず境界として保持）

**現在の方式**: title-tour で実装した確認テストは、4択から選ぶ**選択式**です。

**無効化の理由**: 最終決定はスマートフォンのキーボードから**アルファベット・ひらがなを直接入力する方式**です。選択式のまま公開すると、最終仕様と異なる遊び方が定着してしまいます。今回の統合工程では新しい直接入力テストを実装しない方針のため、未完成の方式を公開導線へ残さないことを優先しました。

**無効化の方法**: `src/app/features.ts` に機能スイッチを新設しました。

```ts
export const FEATURES = {
  waveQuiz: false,
} as const;
```

- `FEATURES.waveQuiz = false` のとき、結果画面の主ボタンは「もう一度」になり、`quizPrompt` へは遷移しません。
- 画面3枚（`quizPromptScreen` / `waveQuizScreen` / `waveQuizResultScreen`）、ドメイン `domain/waveQuiz.ts`、保存フィールド `quizHistory`、テスト `waveQuiz.test.ts`（19件）はすべて残しています。
- `true` に戻せば旧導線がそのまま復活します。Phase 1-C2 では、この境界の内側を直接入力テストへ差し替えてください。
- コードの大量削除は行っていません。

---

## 11. version 2 の両スキーマ比較表

### 共通（version 1 から引き継ぐ Phase 0 の学習記録）

| フィールド | 型 | 意味 | 使用画面 | 措置 |
|---|---|---|---|---|
| `version` | number | 保存形式の世代 | — | **移行**（3へ） |
| `totalPlays` | number | 通算プレイ回数 | 結果・パスポート | 保持 |
| `playedDates` | string[] | 学習日（YYYY-MM-DD、重複なし昇順） | パスポート（連続日数） | 保持 |
| `totalCorrect` | number | 通算の正しい選択数 | 結果・パスポート | 保持 |
| `totalIncorrect` | number | 通算の誤り数 | 結果・パスポート | 保持 |
| `masteredPairIds` | number[] | 習得したペアID | 結果・パスポート | 保持 |
| `reviewPairIds` | number[] | 復習対象のペアID | 結果・パスポート | 保持 |
| `bestTimeMs` | Partial&lt;Record&lt;6\|12\|20, number&gt;&gt; | 枚数ごとのベストタイム | 結果・パスポート | 保持 |
| `selectedCourseId` | string \| null | 選択中のコース | コース一覧・結果 | 保持 |
| `visitedCountryIds` | string[] | 訪問済みの国 | 世界地図・パスポート | 保持 |
| `history` | PlayHistoryEntry[]（上限10） | 直近のプレイ履歴 | パスポート | 保持 |
| `audioEnabled` | boolean | 音声ON/OFF | 設定・発音確認 | 保持 |

### title-tour 版 version 2 だけが持つフィールド

| フィールド | 型 | 意味 | 使用画面 | 措置 |
|---|---|---|---|---|
| `characterAgeGroup` | `'elementary'\|'junior'\|'high'\|'university'\|'adult'` \| null | 旧方式の任意年齢層設定 | （旧）設定・コース別キャラクター | **保持（画面では未使用）** |
| `quizHistory` | WaveQuizRecord[]（上限20） | 確認テストの履歴（受験・スキップ両方） | （無効化中）テスト結果 | **保持** |
| `seenTravelIntros` | string[] | 到着演出を見たことがある国 | 旅の移動画面（短縮判定） | **保持** |
| `skipTravelAnimation` | boolean | 移動演出を毎回スキップ | 設定・旅の移動画面 | **保持** |

`WaveQuizRecord` = `{ date, courseId, destinationId, waveId, status: 'completed'|'skipped', questionCount, correctCount, incorrectPairIds, elapsedMs }`

### avatar-chat 版 version 2 だけが持つフィールド

| フィールド | 型 | 意味 | 使用画面 | 措置 |
|---|---|---|---|---|
| `selectedAvatarId` | string \| null | 自分が選んだキャラクターのID（名前ではなく不変ID） | 表紙の分岐・選択・確認・設定・全NPC画面 | **保持** |
| `metAvatarIds` | string[]（上限80） | 会話したことのある相手のID | パスポート（将来）・NPC 選出 | **保持** |
| `recentNpcAvatarIds` | string[]（上限12） | 直近に登場した NPC のID（新しい順） | NPC 選出の連続登場抑制 | **保持** |

### 判別上の注意

両ブランチとも `version: 2` を書き込んでいたため、**version 番号では区別できません**。フィールドの「形」で判別します。

| 判定 | 条件 |
|---|---|
| `v3` | `version === 3` |
| `v2-mixed` | title-tour 側4キーのいずれか **かつ** avatar-chat 側3キーのいずれかを持つ |
| `v2-title-tour` | title-tour 側4キーのいずれかだけを持つ |
| `v2-avatar-chat` | avatar-chat 側3キーのいずれかだけを持つ |
| `v1` | `version === 1`、または `totalPlays` が number |
| `empty` / `unknown` | 保存なし / JSON が壊れている・オブジェクトでない |

---

## 12. version 3 の最終スキーマ

保存キーは**変更していません**（`kotoba-journey/learning-record/v1`）。キーを変えると既存プレイヤーの記録が読めなくなるため、世代はレコード内の `version` で管理します。

```ts
export const STORAGE_KEY = 'kotoba-journey/learning-record/v1';
export const RECORD_VERSION = 3;

export interface LearningRecord {
  version: number;                 // 常に 3 を書き込む

  // ---- Phase 0（version 1）から継続 ----
  totalPlays: number;
  playedDates: string[];
  totalCorrect: number;
  totalIncorrect: number;
  masteredPairIds: number[];
  reviewPairIds: number[];
  bestTimeMs: Partial<Record<CardCount, number>>;
  selectedCourseId: string | null;
  visitedCountryIds: string[];
  history: PlayHistoryEntry[];     // 上限 10
  audioEnabled: boolean;

  // ---- title-tour 版 version 2 由来 ----
  characterAgeGroup: SelectedAgeGroup;  // 旧方式。読み書きのみ維持、画面では未使用
  quizHistory: WaveQuizRecord[];        // 上限 20
  seenTravelIntros: string[];
  skipTravelAnimation: boolean;

  // ---- avatar-chat 版 version 2 由来 ----
  selectedAvatarId: string | null;
  metAvatarIds: string[];               // 上限 80
  recentNpcAvatarIds: string[];         // 上限 12（RECENT_WINDOW）
}
```

実測の保存内容（393×852 で1プレイ通した直後）:

```json
{"version":3,"totalPlays":1,"playedDates":["2026-09-20"],"totalCorrect":10,"totalIncorrect":0,
"masteredPairIds":[1,2,3,4,5,6,7,8,9,10],"reviewPairIds":[],"bestTimeMs":{"20":8982},
"selectedCourseId":"grade-elementary","visitedCountryIds":["japan"],
"history":[{"date":"2026-09-20","courseId":"grade-elementary","courseLabel":"小学生","cardCount":20,"accuracy":100,"elapsedMs":8982}],
"audioEnabled":true,"characterAgeGroup":null,"quizHistory":[],"seenTravelIntros":["japan"],
"skipTravelAnimation":false,"selectedAvatarId":"high-f-01",
"metAvatarIds":["middle-f-08","adult-m-06"],"recentNpcAvatarIds":["adult-m-06","middle-f-08"]}
```

### 移行の設計

- **旧キャラクター選択値の扱い**: `characterAgeGroup` は「年代」であり、その年代には16人が該当します。したがって1人のキャラクターへ一意に対応させられません。推測は行わず `selectedAvatarId: null` のままにして、**再選択へ誘導**します。値そのものは記録として残します。
- **混在の保持**: 両方の version 2 フィールドが混ざっていても、存在する値はすべて引き継ぎます。
- **壊れた入力**: JSON 破損・型不正・名簿に無いID・無効化されたIDのいずれでも例外を投げず、該当フィールドだけ安全な初期値へ落として**起動を止めません**。
- **書き込み**: 移行後は `version: 3` だけを書き込みます。
- **キー変更**: 不要だったため行っていません（旧キーをそのまま使用）。

---

## 13. 4種類の移行テスト結果

新規テストファイル `src/tests/integrationMigration.test.ts`（17件）で、固定 fixture を使って検証しました。**全件成功**です。

| 入力形式 | 判別結果 | 検証内容 | 結果 |
|---|---|---|---|
| version 1 | `v1` | Phase 0 の12項目すべて引き継ぎ。追加フィールドは安全な初期値。 | 成功 |
| title-tour 版 version 2 | `v2-title-tour` | Phase 0 の12項目 ＋ `quizHistory`（1件、waveId・correctCount 一致）・`seenTravelIntros: ["japan"]`・`skipTravelAnimation: true`・`characterAgeGroup: "junior"` を保持。`selectedAvatarId` は `null`（再選択へ誘導）。 | 成功 |
| avatar-chat 版 version 2 | `v2-avatar-chat` | Phase 0 の12項目 ＋ `selectedAvatarId: "high-m-01"`・`metAvatarIds`（2件）・`recentNpcAvatarIds`（1件）を保持。旅・テスト側は初期値。 | 成功 |
| 混在 version 2 | `v2-mixed` | Phase 0 の12項目 ＋ **両ブランチの7フィールドすべて**を同時に保持。 | 成功 |

追加で検証した項目:

- 4種類のどれから読んでも、書き戻しは必ず `version: 3` になる
- 保存キーが `kotoba-journey/learning-record/v1` のまま変わらない
- 混在 version 2 を書き戻しても値が消えない（`totalPlays`・`bestTimeMs`・`quizHistory`・`seenTravelIntros`・`selectedAvatarId`・`metAvatarIds` を再読込で確認）
- 壊れた JSON（`{"version":2,"quizHistory":`）で例外を投げず初期値へ復旧
- 名簿に無いID `ghost-x-99` → `null`、配列内の数値・null・重複を除去、`recentNpcAvatarIds: "こわれている"` → `[]`、`characterAgeGroup: "senior"` → `null`、`quizHistory: {nope:true}` → `[]`、`skipTravelAnimation: "yes"` → `false`。**この間も学習記録そのものは失われない**
- 80人名簿が統合後も欠けていない（80人・5年代×16人・ID一意・姓名そろい・`imageKey` はすべて `null`）

---

## 14. UI文言修正

| # | 画面 | 変更前 | 変更後 |
|---|---|---|---|
| A | キャラクター選択 | 「いまはキャラクターの絵が仮表示です。名前と年代の色、下の名前の1文字で見分けてください。正式な立ち絵は後の工程で入ります。」 | **「好きなキャラクターを選んで、世界の旅へ出発しよう！」** |
| B | キャラクター選択 | 「この絞り込みは人をさがすためのものです。あなた自身のことは聞いていません。」 | **「表示するキャラクターを絞り込めます。」** |
| C | キャラクター選択 | 「このキャラクターで旅する」（320px で2行） | **「この人を選ぶ」**（1行） |
| C | キャラクター確認 | 「この人と旅をはじめる」 | **変更なし**（1行を維持） |
| D | 会話パネル | 「この会話は、あらかじめ用意された台本です。」 | **削除** |
| 追加 | キャラクター確認 | 「高校生・仮表示」 | **「高校生」**（「・仮表示」を削除） |
| 追加 | サムネイル読み上げ | 「朝倉莉奈（高校生・仮表示）」 | **「朝倉莉奈（高校生）」** |
| 追加 | 設定 | 「旅するキャラクター朝倉莉奈」が1語に見える | 見出しと現在値を縦に積む CSS 修正 |

- A / B / C / D の3種類の技術説明が画面に存在しないことを、表示回帰テストで3サイズ × 3画面（選択・確認・会話）にわたり自動検証しています。
- 個人情報を尋ねない方針は、仕様・プライバシー説明（設定画面の「名前・年齢・学校名・メールアドレスは保存していません。」）・テストで維持しています。
- 自由入力欄は追加していません（会話パネルに `input` / `textarea` が0個であることをテストで確認）。
- 仮サムネイル（年代色・イニシャル・名前）はそのまま維持。コンセプトシートの切り抜きは行っていません。`avatarThumb.ts` の集約も維持し、`imageKey` は全80人 `null` のままです。本番立ち絵が未納品である事実は、UI ではなくコードコメント（`avatarThumb.ts` / `countryIntroScreen.ts` / `travelScreen.ts`）と本報告にのみ記載しています。

---

## 15. test 総件数と結果

```text
Test Files  15 passed (15)
     Tests  277 passed (277)
```

| 区分 | 件数 |
|---|---|
| 統合前 title-tour | 191件 |
| 統合前 avatar-chat | 202件 |
| 重複する Phase 0 の共通テスト | 133件（storage 24 / matching 15 / layout 52 / services 7 / deck 18 / courses 7 / scoring 10） |
| 統合後の合計（191 + 202 − 133） | **260件** |
| 今回の追加（`integrationMigration.test.ts`） | **+17件** |
| **統合後 合計** | **277件** |

**削除したテストは0件**です。両ブランチ由来のテストはすべて残っています。

| ファイル | 件数 | 由来 |
|---|---|---|
| `layout.test.ts` | 52 | Phase 0 |
| `storage.test.ts` | 24 | Phase 0 |
| `avatarStorage.test.ts` | 21 | avatar-chat |
| `characters.test.ts` | 20 | title-tour |
| `migration.test.ts` | 19 | title-tour |
| `waveQuiz.test.ts` | 19 | title-tour |
| `deck.test.ts` | 18 | Phase 0 |
| `npcCasting.test.ts` | 17 | avatar-chat |
| `integrationMigration.test.ts` | **17** | **今回追加** |
| `avatars.test.ts` | 16 | avatar-chat |
| `matching.test.ts` | 15 | Phase 0 |
| `dialogues.test.ts` | 15 | avatar-chat |
| `scoring.test.ts` | 10 | Phase 0 |
| `courses.test.ts` | 7 | Phase 0 |
| `services.test.ts` | 7 | Phase 0 |

各コミットの前後で `npm test` と `npm run build` を実行し、すべて成功しています。

---

## 16. build 結果

```text
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 61 modules transformed.
dist/index.html                  0.67 kB │ gzip:  0.51 kB
dist/assets/index-Da0_R8Oy.css  26.94 kB │ gzip:  5.95 kB
dist/assets/index-D7_FUUMl.js   71.54 kB │ gzip: 23.61 kB
✓ built in 454ms
```

TypeScript エラー0件（strict）。依存パッケージの追加は0件です（typescript / vite / vitest / playwright のみ、統合前と同一）。

---

## 17. visual test 結果

```text
npm run test:visual
```

**3本すべて成功**しました。

```text
✓ 320x568  もういちど聞く=149.5px(1行)  つぎへ=96.5px(1行)
✓ 375x667  もういちど聞く=158.5px(1行)  つぎへ=105.5px(1行)
✓ 393x852  もういちど聞く=158.5px(1行)  つぎへ=105.5px(1行)
✓ 402x874  もういちど聞く=158.5px(1行)  つぎへ=105.5px(1行)
✓ 430x932  もういちど聞く=158.5px(1行)  つぎへ=105.5px(1行)
表示回帰テスト 成功（5サイズ × 6項目）

✓ 320x568 表紙  ロゴ 234px / キャラ 99px
✓ 375x667 表紙  ロゴ 305px / キャラ 141px
✓ 393x852 表紙  ロゴ 321px / キャラ 148px
✓ 402x874 表紙  ロゴ 329px / キャラ 152px
✓ 430x932 表紙  ロゴ 354px / キャラ 164px
✓ 通し操作（表紙→選択→旅→国紹介→カルタ→結果）
✓ prefers-reduced-motion で必須情報が残る
Phase 1 表示・操作テスト 成功

✓ 320x568  12地点で横スクロール0・画面外0・44px充足
✓ 393x852  12地点で横スクロール0・画面外0・44px充足
✓ 430x932  12地点で横スクロール0・画面外0・44px充足
✓ prefers-reduced-motion で会話が読める
Phase 1 統合 キャラクター・会話テスト 成功
```

§7 で追加必須とされた項目の対応:

| 必須項目 | 実施箇所 | 結果 |
|---|---|---|
| version 1 → 3 | `integrationMigration.test.ts` | 成功 |
| title-tour version 2 → 3 | 同上 | 成功 |
| avatar-chat version 2 → 3 | 同上 | 成功 |
| 混在 version 2 → 3 | 同上 | 成功 |
| 80人・ID・姓名・年代件数 | 同上 ＋ `avatars.test.ts` | 成功（80人 / ID一意 / 5年代×16人） |
| 表紙から選択またはコース入口への分岐 | `avatarAndChat.visual.mjs` | 成功（初回=選択、再読込後=コース入口） |
| 選択→旅移動→国紹介→カルタ→結果の通し操作 | `titleAndFlow.visual.mjs` | 成功 |
| NPC が自分を選ばない | `npcCasting.test.ts` ＋ `avatarAndChat.visual.mjs` | 成功（`metAvatarIds` に自分が入らないことも確認） |
| 320px で「この人を選ぶ」が1行 | `avatarAndChat.visual.mjs` | 成功（3サイズすべて1行・44px以上・横あふれなし） |
| 320px で「この人と旅をはじめる」が1行 | 同上 | 成功（同上） |
| 技術説明3種類が画面に存在しない | 同上（選択・確認・会話の3画面） | 成功 |
| 20枚カルタの重なり0・画面外0 | 同上 | 成功（20枚 / 重なり0 / 画面外0 / 縦スクロールなし） |
| 横スクロール0、JSエラー0 | 全3本 | 成功 |

---

## 18. 3サイズの実操作結果

ビルド済み `dist/` を実ブラウザ（Chromium）で 320×568 / 393×852 / 430×932 の3サイズで通し操作しました。

| 確認項目 | 320×568 | 393×852 | 430×932 |
|---|---|---|---|
| 表紙 → キャラクター選択（初回） | OK | OK | OK |
| 年代タブ・表示フィルター | OK | OK | OK |
| 「この人を選ぶ」→ 確認 → 「この人と旅をはじめる」 | OK（1行） | OK（1行） | OK（1行） |
| コース入口の NPC と会話 | OK | OK | OK |
| コース → 枚数（20枚） → 世界地図 | OK | OK | OK |
| 旅の移動画面（自分のキャラクター表示・スキップ） | OK | OK | OK |
| 国紹介（自分＋NPC の並び） | OK | OK | OK |
| 20枚カルタ 枚数 / 重なり / 画面外 | 20 / 0 / 0 | 20 / 0 / 0 | 20 / 0 / 0 |
| 発音確認 | OK | OK | OK |
| ウェーブ終了チャット | OK | OK | OK |
| 結果 → マイパスポート → 設定 | OK | OK | OK |
| 横スクロール | なし | なし | なし |
| 技術説明3種類 | なし | なし | なし |
| JavaScript エラー | 0件 | 0件 | 0件 |
| 保存 version | 3 | 3 | 3 |
| 保存 selectedAvatarId | `high-f-01` | `high-f-01` | `high-f-01` |
| 保存 quizHistory（無効化中） | 0件 | 0件 | 0件 |
| 保存 seenTravelIntros | `["japan"]` | `["japan"]` | `["japan"]` |

---

## 19. 正式ビルドのスクリーンショット

3サイズ × 14場面 = 42枚を取得しました（`01-title` 〜 `14-settings`）。

| 場面 | ファイル名 |
|---|---|
| 正式表紙 | `01-title-{size}.png` |
| キャラクター選択 | `02-select-{size}.png` |
| 選択中（高校生×女性） | `03-select-chosen-{size}.png` |
| キャラクター確認 | `04-confirm-{size}.png` |
| コース入口（NPC） | `05-course-{size}.png` |
| 会話パネル | `06-chat-{size}.png` |
| 世界地図 | `07-map-{size}.png` |
| 旅の移動画面 | `08-travel-{size}.png` |
| 国紹介 | `09-intro-{size}.png` |
| 20枚カルタ | `10-karta20-{size}.png` |
| ウェーブ終了チャット | `11-waveend-{size}.png` |
| 結果・分析 | `12-result-{size}.png` |
| マイパスポート | `13-passport-{size}.png` |
| 設定 | `14-settings-{size}.png` |

画面で確認できる主な点:

- キャラクター選択（320px）: 「表示するキャラクターを絞り込めます。」「好きなキャラクターを選んで、世界の旅へ出発しよう！」「この人を選ぶ」がすべて1行で収まる
- キャラクター確認（320px）: 「朝倉莉奈 / あさくら りな / Rina Asakura / 高校生」、「この人と旅をはじめる」が1行
- 旅の移動画面: 高校生を選んだので高校生の正式イラストが搭乗券として出て、その横に自分のキャラクターの仮サムネイルとマスコットが並ぶ
- 国紹介: 国旗・あいさつ・正式イラスト・自分のキャラクター＋同行NPC2人・紹介カード
- 会話: 「この会話は、あらかじめ用意された台本です。」が消えている

---

## 20. 各コミットハッシュ

| # | ハッシュ | 件名 |
|---|---|---|
| 1 | `b20a64d3f31524f1917bb48246b84686b044da15` | Merge branch 'claude/kotoba-journey-phase1c1-avatar-chat' into claude/kotoba-journey-phase1-integration |
| 2 | `af86ead4a2e7beee94619999e7e063e3998cb3ae` | fix: unify phase 1 routes and storage migrations |
| 3 | `ecce53ef494f7aed8ccd0132c1809c7e6622f232` | fix: polish avatar and chat copy on narrow screens |
| 4 | `7080f0a2e6a37e91be33bfd52fd352b6379ce226` | test: cover phase 1 integration paths |
| 5 | `d298a23ed44166ff4e3823b018e07e49096d0c8f` | fix: stack the setting row label and its current value |

競合解決（1）と保存移行（2）は別コミットに分けています。各コミットの前後で test / build を実行しました。

---

## 21. push 先

```text
origin/claude/kotoba-journey-phase1-integration
```

```text
* [new branch]  claude/kotoba-journey-phase1-integration -> claude/kotoba-journey-phase1-integration
branch 'claude/kotoba-journey-phase1-integration' set up to track ...
```

main への push は行っていません。プルリクエストも作成していません（ご指示があれば作成します）。

---

## 22. 終了時 git status

```text
On branch claude/kotoba-journey-phase1-integration
Your branch is up to date with 'origin/claude/kotoba-journey-phase1-integration'.

nothing to commit, working tree clean
```

---

## 23. main・既存2ブランチを変更していないこと

| ブランチ | ローカル | origin | 開始時からの変化 |
|---|---|---|---|
| `main` | `2eb33a5` | `2eb33a5` | **なし** |
| `claude/kotoba-journey-phase1-title-tour` | `ad86ca1` | `ad86ca1` | **なし** |
| `claude/kotoba-journey-phase1c1-avatar-chat` | `29943cd` | `29943cd` | **なし** |
| `claude/kotoba-journey-phase0-rdkskt` | `2eb33a5` | `2eb33a5` | **なし** |
| `claude/kotoba-journey-phase1-integration` | `d298a23` | `d298a23` | 新規作成 |

- force push / rebase / squash / cherry-pick / ブランチ削除は一切行っていません。
- GitHub Pages の設定は変更していません（公開中の `https://marie50924-dev.github.io/kotoba-journey/` は main の Phase 0 のままです）。
- 他リポジトリ（`yumera-games` 配下等）への push・複製・移動は行っていません。

---

## 24. 未納品の本番素材

| 素材 | 状態 | 現在の代替 | 差し替え箇所 |
|---|---|---|---|
| 80人分の個別透過立ち絵 | **未納品** | 年代色 + 下の名前の1文字 + 名前の仮サムネイル（破線の縁取り） | `src/components/avatarThumb.ts` の1箇所のみ。`AvatarDefinition.imageKey` に値を入れ、この関数の中を `<img>` にすれば全画面に反映されます（呼び出し側は無変更） |
| 国旗の正式素材 | 未納品 | CSS で描画（`.intro__flag--japan`） | `src/screens/countryIntroScreen.ts` の `flagNode()` |
| 正式音声 | 未実装 | `AudioService`（Web Speech API のフォールバック） | `src/services/audioService.ts` |
| 日本以外の国紹介データ | 未整備 | 日本のみ。未整備の国でも開始は妨げない作り | `src/data/countryIntros.ts` |

**守った制約**:

- キャラクター確認シート（16人シート）を切り抜いて本番立ち絵として使うことは**していません**。
- 未納品の透過立ち絵を存在するものとして扱っていません。`imageKey` は全80人 `null` のままです。
- 採用済みの人物イラスト3点・表紙素材3点は**再生成・描き直し・顔の変更を一切行っていません**。原寸 JPEG は `assets-source/` に無改変で保管されています。
- 仮表示であることを UI で技術的に説明していません（コードコメントと本報告にのみ記載）。

---

## 25. 次工程 Phase 1-C2 へ渡す事項

### 最優先：直接入力式の確認テスト

- 差し替え境界は `src/app/features.ts` の `FEATURES.waveQuiz` です。
- 残してあるもの: `src/domain/waveQuiz.ts`（出題生成・採点）、`quizPromptScreen` / `waveQuizScreen` / `waveQuizResultScreen`、保存フィールド `quizHistory`（`WaveQuizRecord`）、テスト `waveQuiz.test.ts`（19件）。
- 実装方針: 選択肢UIを、スマートフォンのキーボードからアルファベット・ひらがなを直接入力する入力欄へ置き換え、結果画面の主ボタンを `quizPrompt` へ戻して `FEATURES.waveQuiz = true` にしてください。
- `WaveQuizRecord` の `incorrectPairIds` / `questionCount` / `correctCount` は直接入力方式でもそのまま使えます。採点方法（表記ゆれの許容範囲）が決まったら別途ご判断ください。

### 本番立ち絵が納品されたとき

1. `src/data/kotoba-journey-character-names-v1.json` または `src/data/avatars.ts` の `buildRoster()` で `imageKey` に値を入れる
2. `src/components/avatarThumb.ts` の `face` を `<img>` へ差し替える
3. 以上だけで、選択・確認・NPCバー・会話・旅の移動・国紹介・設定のすべてに反映されます
4. 国紹介の `.intro__cast` と旅の移動画面の `.travel__me` は、立ち絵を並べる前提のレイアウトになっています

### 判断が必要な事項（今回は据え置き）

- **旅の情景イラストの扱い**: 正式採用の年齢層別イラスト5点は、今回「選んだキャラクターの年代」に合わせて出す形にしました。本番立ち絵が入ったあと、このイラストを背景として残すか、自分のキャラクターの立ち絵に置き換えるかはご判断ください。
- **`characterAgeGroup` の最終処分**: 旧方式の設定値です。データを失わない方針で読み書きだけ残していますが、画面では未使用です。不要と判断された時点で version 4 として削除できます。
- **台本の一人称**: 現在の台本は全 NPC 共通テンプレートのため、女性キャラクターも「ぼく」と話します（例: 中学生女子の美空が「ぼくは美空」）。80人の個別台本、または性別・年代別の一人称差し替えが必要です。差し替え口は `src/data/dialogues/index.ts` の `pickScript()` で、`speakerAvatarId` ごとの台本を足せば選択側だけの変更で済みます。
- **日本以外の国**: 国紹介データ・語彙・世界地図のピン解放条件が未整備です。

### 実装しなかったもの（正式判断どおり）

直接入力テスト（新規実装）・追加カードゲーム・SNS共有・対戦・自由文AIチャット・課金。いずれも今回は一切着手していません。外部分析SDK・広告SDKも導入していません。依存パッケージの追加は0件です。

---

## 停止条件の該当

§10 の停止条件に該当する事象はありませんでした。

- 3ブランチの HEAD は申告値どおり
- working tree は clean
- origin とローカルは一致
- 統合ブランチは未作成だった
- 両ブランチとも開始時の test / build が成功
- version 2 のフィールド意味はすべて判別でき、記録を失う可能性はなし
- 本番画像を必要とせず、コンセプトシートの切り抜きは不要だった
- マージ競合7件は、いただいた正式判断だけで一意に解決できた
