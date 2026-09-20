# ことばトラベル / KOTOBA JOURNEY — Phase 1-C3 完了報告（国紹介コンテンツ拡充）

対象リポジトリ: `https://github.com/marie50924-dev/kotoba-journey`
作業ブランチ: `claude/kotoba-journey-phase1c3-country-guide`
基準ブランチ: `claude/kotoba-journey-phase1c2-direct-input`（`60d0a29`）
実施日: 2026-09-20

---

## 1. 開始HEADと終了HEAD

| 区分 | 値 |
|---|---|
| 開始HEAD | `60d0a2961aac12d8ccca1494a2310cbd89feaa16` |
| 終了HEAD | 下記「13. コミットハッシュ」の最終行 |

開始条件の照合（読み取り専用）:

| 確認項目 | 実測値 | 判定 |
|---|---|---|
| ローカルとoriginの一致 | local `60d0a29` / origin `60d0a29` | 一致 |
| working tree | clean（`git status --porcelain` 出力0行） | 一致 |
| `npm test` | Test Files 16 passed / Tests 316 passed | 成功 |
| `npm run build` | 成功（TypeScriptエラー0件） | 成功 |

不一致はありませんでした。

---

## 2. 作業ブランチ名

```text
claude/kotoba-journey-phase1c3-country-guide
```

`60d0a29` から新規作成しました。

---

## 3. 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/data/countryIntros.ts` | データ構造の作り直しと日本の正式データ。表示カードの組み立て関数を追加 |
| `src/data/strings.ts` | 国紹介の文言（しゅと・有名なもの・もっと知る・情報源・確認日・開始ボタン） |
| `src/screens/countryIntroScreen.ts` | 二段階表示。開閉トグル、詳細カード、情報源ブロック |
| `src/styles/travel.css` | 到着直後の要点表示、もっと知る、カード内の並び、情報源のスタイル |
| `src/tests/countryIntro.test.ts` | 新規。国紹介データの単体テスト23件 |
| `src/tests/characters.test.ts` | 旧フィールド名（`destinationId` / `cards` / `nameJa`）の参照を更新 |
| `src/tests/visual/countryGuide.visual.mjs` | 新規。国紹介の表示・操作テスト |
| `src/tests/visual/titleAndFlow.visual.mjs` | 到着直後に詳細が開いていないことの確認へ更新 |
| `src/tests/visual/avatarAndChat.visual.mjs` | 開始ボタンの文言変更に追随 |
| `src/tests/visual/directInputQuiz.visual.mjs` | 同上 |
| `src/tests/visual/pronunciationPanel.visual.mjs` | 同上 |
| `package.json` | `test:visual` に国紹介テストを追加、`test:visual:country` を追加 |

---

## 4. CountryIntro の最終データ構造

```ts
export type CountryFlag = { kind: 'japan' } | { kind: 'placeholder' };

export interface InfoSource {
  id: string;
  sourceLabel: string;   // 機関名と資料名
  sourceUrl: string;     // https のURL
  checkedAt: string;     // YYYY-MM-DD
}

/** 都市・観光地・料理・特産物など、あとから追加・並べ替えする項目 */
export interface NamedItem {
  id: string;
  name: string;
  note?: string;
}

export interface HistoryNote {
  id: string;
  era: string;   // 年号に頼らない見出し
  body: string;
}

export interface LearningWord {
  pairId: number;   // 語彙データ（wordPairs）の pairId
}

export type DetailSectionId =
  | 'cities' | 'nature' | 'climate' | 'landmarks'
  | 'foods' | 'history' | 'culture' | 'words';

export interface CountryIntro {
  countryId: string;
  countryNameJa: string;
  countryNameEn: string;
  flag: CountryFlag;
  position: { x: number; y: number };

  capital: NamedItem;          // 首都
  majorCities: NamedItem[];    // 代表的な都市（首都は含めない）

  greeting: { ja: string; en: string };
  summary: string;             // 到着直後の短い紹介文
  highlight: NamedItem;        // 到着直後に1件だけ出す有名なもの

  geography: string[];         // 地形・自然
  climate: string[];           // 気候
  clothingTips: string[];      // 服装の目安

  landmarks: NamedItem[];      // 有名な建物・場所・観光地
  foods: NamedItem[];          // 名物料理
  specialties: NamedItem[];    // 特産物（料理とは別に持つ）
  specialtiesNote: string;     // 地域差の断り書き

  history: HistoryNote[];
  culture: string[];           // 文化・生活習慣
  manners: string[];           // 旅行マナー

  learningWords: LearningWord[];
  learning: string;

  sources: InfoSource[];
  sectionSources: Partial<Record<DetailSectionId, string[]>>;
}
```

表示の組み立ては同じファイルの `buildDetailSections(intro): DetailSection[]` が行います。

```ts
export interface DetailSection {
  id: DetailSectionId;
  heading: string;      // 「まち」「しぜん」など
  lines: string[];      // 段落
  items: NamedItem[];   // 名前つきの並び
  sources: InfoSource[];
}
```

- 画面はこの配列をそのまま描くだけで、国ごとの画面を作りません。
- 中身が空のカテゴリーはカードを作らないため、情報がそろっていない国でも崩れません。
- 学ぶ単語は `pairId` から語彙データを引くので、文言を二重に持ちません。

---

## 5. 日本に実装した全項目

指示書§1の18項目すべてを実装しました。

| # | 項目 | 実装内容 |
|---|---|---|
| 1 | 国名 | 日本 |
| 2 | 英語名 | Japan |
| 3 | 国旗 | CSS 描画（`.intro__flag--japan`）。正式な旗素材が入るまでの表現 |
| 4 | 首都 | 東京（とうきょう） |
| 5 | 代表的な都市 | 札幌・京都・大阪・福岡・那覇（首都とは別配列） |
| 6 | 地形・自然 | 海にかこまれた島国で山が多い／森林が国土のおよそ3分の2／川は短く流れが急で、平地は海の近く |
| 7 | 気候 | 南北で大きくちがう／冬は日本海側で雪、太平洋側は晴れが多い／梅雨（沖縄・奄美は5月ごろ）／四季がある |
| 8 | 服装の目安 | 夏はすずしい服とぼうし・水とう／冬は地域差が大きいので行き先の気温を確認、北や日本海側は雪の用意／春秋ははおるもの／梅雨は雨具 |
| 9 | 有名な場所 | 富士山、法隆寺（奈良県）、姫路城（兵庫県）、古都京都の文化財（京都府・滋賀県） |
| 10 | 有名な食べ物 | すし、ラーメン、みそしる、和菓子 |
| 11 | 特産物 | こめ、おちゃ、くだもの、さかな（＋地域差の断り書き） |
| 12 | 短い歴史 | むかしのくに／武士の時代／江戸の時代／近代から今へ の4区切り |
| 13 | 現地のあいさつ | こんにちは / Hello |
| 14 | 文化・生活習慣 | おじぎ／玄関で靴をぬぐ／季節の行事 |
| 15 | 旅行マナー | 電車やバスでは静かに／ごみは決められた場所へ／寺社では決まりを確認／温泉は体を洗ってから／写真はとってよい場所か確認 |
| 16 | この国で学ぶ英単語 | 語彙データの pairId 1〜10（りんご/apple 〜 くるま/car） |
| 17 | 情報源 | 5件（下記6項） |
| 18 | 情報確認日 | 2026-09-20（出典1件ごとに保持） |

文章の基準（§3）への対応:

- 小学生でも読める日本語にし、むずかしい語にはふりがなを添えました（例:「梅雨（つゆ）」「武士（ぶし）」）。
- 1カードは見出し＋数文におさめ、長い年表は作っていません。
- 歴史は流れだけを短く説明し、**戦争・宗教・領土・政治は深掘りしていません**。
- 「世界一」にあたる表現は2か所だけで、いずれも公的機関の資料で確認できたものです。
  - 富士山「日本でいちばん高い山」（国土地理院「日本の主な山岳標高」）
  - 法隆寺「今ものこる木造の建物として、世界でもっとも古いものと評価されています」
    （文化庁の説明にある評価であることが分かる書き方にしました）
- 気候は最初の文で「南北で大きくちがう」と書き、国全体が同じと読めないようにしました。
- 特産物（とれるもの）と名物料理を別の配列にし、名前が重ならないことをテストで固定しました。
- 観光広告のような表現は使っていません。
- 事実はデータ側、ゲームの演出（到着記念写真・NPC）は画面側で、はっきり分けています。

---

## 6. 使用した情報源と確認日

| 機関 | 資料 | URL | 確認日 |
|---|---|---|---|
| 気象庁 | 日本の気候 | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html | 2026-09-20 |
| 国土地理院 | 日本の主な山岳標高 | https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html | 2026-09-20 |
| 林野庁 | 都道府県別森林率・人工林率 | https://www.rinya.maff.go.jp/j/keikaku/genkyou/index2.html | 2026-09-20 |
| 文化庁 | 日本の世界遺産一覧 | https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/ | 2026-09-20 |
| 観光庁 | 日本のマナーを知ってもらおう！ | https://www.mlit.go.jp/kankocho/news08_000304.html | 2026-09-20 |

セクションへの割り当て:

| カード | 出典 |
|---|---|
| しぜん | 林野庁、国土地理院 |
| きこう | 気象庁 |
| みどころ | 文化庁、国土地理院 |
| ぶんか | 観光庁 |

### 確認の方法について（重要）

**この開発環境からは各機関のページを直接取得できません**（ネットワークの外向き通信が
egress プロキシで遮断されており、`mofa.go.jp` / `stat.go.jp` / `whc.unesco.org` などへの
直接アクセスは拒否されました）。そのため照合は、**公的ドメインに限定した検索結果**で
行っています。URLは検索結果に出た一次情報のものです。

この事実は `src/data/countryIntros.ts` の冒頭コメントにも書いてあります。
**公開前に、上記5件のURLを人の目で最終確認してください。**

なお、出典が公的機関のドメイン（`.go.jp` / `.unesco.org`）であることは
単体テストで機械的に固定しています。

---

## 7. 通常紹介と詳細紹介の画面遷移

```text
旅の移動画面
   ↓
国紹介（1画面のまま。遷移はしない）
   │
   ├─ 最初に表示
   │    国名・英語名（見出し）
   │    国旗 ＋ あいさつ（こんにちは / Hello）
   │    しゅと: 東京
   │    有名なもの: 富士山（高さ3776mで、日本でいちばん高い山です。）
   │    短い紹介文
   │    到着記念の写真 ＋ 自分のキャラクターと同行NPC
   │    [ もっと知る ]        ← 任意。押さなくてよい
   │    [ この国でことばを集める ]
   │
   └─「もっと知る」を押すと、同じ画面の中に8カードが開く
        まち / しぜん / きこう / みどころ / たべもの / れきし / ぶんか / ことば
        ＋ 情報源（さらに開閉できる。URLと確認日）
        [ とじる ] で閉じる
   ↓
カルタ（「この国でことばを集める」）
```

- 詳細を開かなくてもカルタを開始できます。
- 開閉は同じ画面の中だけで起こり、**画面遷移をしないので進行状況は失われません**。
- 開閉してもフォーカスはトグルボタンに残ります。
- `aria-expanded` と `aria-controls` を設定してあり、キーボードだけで開閉できます。

---

## 8. 3サイズの確認結果

| 確認項目 | 320×568 | 393×852 | 430×932 |
|---|---|---|---|
| 国名・英語名が出る | OK | OK | OK |
| 国旗が出る | OK | OK | OK |
| あいさつが出る | OK | OK | OK |
| 首都が出る | OK | OK | OK |
| 有名なもの1件が出る | OK | OK | OK |
| 短い紹介文が出る | OK | OK | OK |
| 「もっと知る」が最初は閉じている | OK | OK | OK |
| キーボード（Enter）で開ける | OK | OK | OK |
| 開いたあともフォーカスが残る | OK | OK | OK |
| 8カードすべてへスクロールで到達 | OK | OK | OK |
| 情報源を開ける／確認日が出る | OK（5件） | OK（5件） | OK（5件） |
| 横スクロール | 0 | 0 | 0 |
| 画面外へ出る操作 | 0 | 0 | 0 |
| 44px未満のボタン | 0 | 0 | 0 |
| 見出し・本文の切れ | 0 | 0 | 0 |
| 閉じたあと開始ボタンへ到達 | OK | OK | OK |
| 開閉しても進行が失われない | OK | OK | OK |
| JavaScript エラー | 0 | 0 | 0 |

実測したカードの並び（3サイズとも同じ）:

```text
["まち","しぜん","きこう","みどころ","たべもの","れきし","ぶんか","ことば"]
```

`prefers-reduced-motion: reduce` でも、8カードすべてと紹介文が読めることを確認しました。

---

## 9. test 件数と結果

```text
Test Files  17 passed (17)
     Tests  338 passed (338)
```

| 区分 | 件数 |
|---|---|
| 開始時（Phase 1-C2） | 316件 |
| 今回の追加 | +23件（`countryIntro.test.ts`） |
| 既存テストの整理 | −1件（`characters.test.ts` のカード枚数チェックが構造変更で意味を失ったため削除） |
| **合計** | **338件** |

削除した1件（「カードは2〜3枚に収め、それぞれ出典を持つ」）は、
カードが固定2〜3枚から8カテゴリーの可変構成へ変わったため成立しなくなりました。
同等以上の保証を次で置き換えています。

| 削除した検証 | 置き換えた検証 |
|---|---|
| カードが2〜3枚である | 日本が8カテゴリーをすべて持つ／中身の無いカテゴリーはカードを作らない |
| 各カードが出典を持つ | すべての出典が名前・https のURL・確認日を持つ／公的ドメインである／セクションへの割り当てが実在する |

ファイル別:

| ファイル | 件数 |
|---|---|
| `layout.test.ts` | 52 |
| `answerCheck.test.ts` | 26 |
| `waveQuiz.test.ts` | 27 |
| `storage.test.ts` | 24 |
| **`countryIntro.test.ts`** | **23（新規）** |
| `avatarStorage.test.ts` | 21 |
| `avatars.test.ts` | 20 |
| `migration.test.ts` | 19 |
| `characters.test.ts` | 19 |
| `deck.test.ts` | 18 |
| `integrationMigration.test.ts` | 17 |
| `npcCasting.test.ts` | 17 |
| `dialogues.test.ts` | 16 |
| `matching.test.ts` | 15 |
| `scoring.test.ts` | 10 |
| `courses.test.ts` | 7 |
| `services.test.ts` | 7 |

指示書§8の単体テスト項目:

| 必須項目 | 実装 | 結果 |
|---|---|---|
| 必須項目が空でない | 文字の項目・並びの項目・空行の3件で検査 | 成功 |
| 首都と都市が区別されている | 首都が `majorCities` に含まれない／「まち」カードで首都と分かる | 成功 |
| 配列IDが重複しない | 国ID・項目ID・歴史ID・出典IDの4件 | 成功 |
| 情報源URLと確認日が存在する | https 形式・YYYY-MM-DD 形式・公的ドメイン・割り当ての実在 | 成功 |
| 未実装国でもアプリが停止しない | `findCountryIntro` が例外を投げず undefined を返す | 成功 |
| 学習単語が既存語彙IDと対応する | `pairId` が語彙データに存在／重複しない／カードに並ぶ | 成功 |
| 日本の全カテゴリーが存在する | 8カテゴリーが期待どおりの順で並ぶ | 成功 |

---

## 10. build 結果

```text
> tsc --noEmit && vite build
✓ 65 modules transformed.
dist/index.html                  0.67 kB │ gzip:  0.51 kB
dist/assets/index-DborzzaY.css  30.31 kB │ gzip:  6.51 kB
dist/assets/index-BSgFf1pH.js   81.39 kB │ gzip: 28.23 kB
✓ built in 442ms
```

TypeScript エラー0件（strict）。依存パッケージの追加は0件です。

---

## 11. visual test 結果

`npm run test:visual` で5本すべて成功。

```text
表示回帰テスト 成功（5サイズ × 6項目）

Phase 1 表示・操作テスト 成功
  ✓ 通し操作（表紙→選択→旅→国紹介→カルタ→確認テスト→結果）
  ✓ prefers-reduced-motion で必須情報が残る

Phase 1 統合 キャラクター・会話テスト 成功
  ✓ 320x568 / 393x852 / 430x932  13地点で横スクロール0・画面外0・44px充足

Phase 1-C2 直接入力テスト 成功
  ✓ 3サイズ通し操作／キーボード表示時の可視／スキップ／置換記号

Phase 1-C3 国紹介テスト 成功
  ✓ 320x568 国紹介（8カード・情報源5件・横スクロール0）
  ✓ 393x852 国紹介（8カード・情報源5件・横スクロール0）
  ✓ 430x932 国紹介（8カード・情報源5件・横スクロール0）
  ✓ 「もっと知る」を開かなくてもカルタを開始できる
  ✓ prefers-reduced-motion でも全カードが読める
```

---

## 12. スクリーンショット

3サイズ × 6場面を取得しました。

| 場面 | ファイル名 |
|---|---|
| 到着直後（国名・国旗・あいさつ・首都・有名なもの・紹介文） | `01-intro-top-{size}.png` |
| もっと知る「まち」 | `02-more-cities-{size}.png` |
| もっと知る「きこう」 | `03-more-climate-{size}.png` |
| もっと知る「みどころ」 | `04-more-landmarks-{size}.png` |
| もっと知る「ことば」 | `05-more-words-{size}.png` |
| 情報源（URLと確認日） | `06-sources-{size}.png` |

---

## 13. コミットハッシュ

| # | ハッシュ | 件名 |
|---|---|---|
| 1 | `4cea945` | feat(data): expand the country guide data for japan |
| 2 | `e50c680` | feat: show the country guide in two stages |
| 3 | `1577485` | test: cover the country guide data and screen |
| 4 | （この報告のコミット） | docs: add the phase 1-C3 report |

---

## 14. push 先

```text
origin/claude/kotoba-journey-phase1c3-country-guide
```

main への push、force push、rebase、squash、Pages 設定変更はいずれも行っていません。

---

## 15. git status

```text
On branch claude/kotoba-journey-phase1c3-country-guide
Your branch is up to date with 'origin/claude/kotoba-journey-phase1c3-country-guide'.

nothing to commit, working tree clean
```

---

## 16. main・既存ブランチ・Pages を変更していないこと

| ブランチ | ローカル | origin | 変化 |
|---|---|---|---|
| `main` | `2eb33a5` | `2eb33a5` | なし |
| `claude/kotoba-journey-phase0-rdkskt` | `2eb33a5` | `2eb33a5` | なし |
| `claude/kotoba-journey-phase1-title-tour` | `ad86ca1` | `ad86ca1` | なし |
| `claude/kotoba-journey-phase1c1-avatar-chat` | `29943cd` | `29943cd` | なし |
| `claude/kotoba-journey-phase1-integration` | `838a558` | `838a558` | なし |
| `claude/kotoba-journey-phase1c2-direct-input` | `60d0a29` | `60d0a29` | なし |
| `claude/kotoba-journey-phase1c3-country-guide` | 下記 | 同左 | 新規作成 |

- GitHub Pages の設定は未変更。公開中の `https://marie50924-dev.github.io/kotoba-journey/` は
  main の Phase 0 のままです。
- 実装しなかったもの（§9）: 日本以外の未確認データの大量生成、国の自動解放、
  サーバー通信、地図API、GPS、SNS共有、対戦、課金、AI自由会話、本番立ち絵の仮生成。
  いずれも一切着手していません。

---

## 17. 日本以外の国を推測で実装していないこと

- `COUNTRY_INTROS` に入っているのは日本1件だけです。
- ロンドンとパリは `DESTINATIONS` にロック表示のまま残っており、紹介データはありません。
- 紹介データが無い行き先では、`findCountryIntro` が `undefined` を返し、
  画面は「—」の見出しと開始ボタンだけを出してゲームの進行を妨げません。
- 「紹介があるのは解放済みの行き先だけ」であることを単体テストで固定しています。
  未確認の国を足すと、このテストが落ちます。

---

## 18. 次の国を追加する際の差し替え方法

画面コードは一切変更しません。`src/data/countryIntros.ts` に1件足すだけです。

1. **情報を確認する**
   その国の政府・政府観光局・外務省・気象機関・UNESCO などの公的情報で確認し、
   URLと確認日を控える。本文はそのまま写さず、子ども向けに短く要約する。

2. **出典を作る**

```ts
const FRANCE_SOURCES: InfoSource[] = [
  {
    id: 'fr-meteo',
    sourceLabel: '（機関名）「（資料名）」',
    sourceUrl: 'https://…',
    checkedAt: '2026-xx-xx',
  },
];
```

3. **`COUNTRY_INTROS` へ1件追加する**
   `countryId` は `DESTINATIONS` の `id` と同じ文字列にする。
   項目IDは国ごとに接頭辞を付ける（例: `fr-city-…`）。
   `learningWords` は語彙データに実在する `pairId` だけを書く。
   `sectionSources` でカードごとに出典IDを割り当てる。

4. **行き先を解放する**
   `src/data/destinations.ts` の該当行を `unlocked: true` にする。
   （解放しないまま紹介だけ足すと、単体テスト
   「紹介があるのは解放済みの行き先だけ」が落ちます。これは意図した歯止めです。）

5. **確認する**
   `npm test` → `npm run build` → `npm run test:visual`。
   単体テストが必須項目・ID重複・出典・語彙対応を、
   表示テストが3サイズの表示と開閉を見ます。

### 知っておくと役に立つ点

- 情報がそろっていないカテゴリーは、配列を空にしておけばカード自体が出ません。
  部分的なデータでも画面は崩れません。
- カードの並び順は `buildDetailSections()` の中の配列順で決まります。
  国ごとに変えたい場合は、ここを国別に切り替える形へ広げてください。
- 見出しの文字（「まち」「しぜん」など）は `SECTION_HEADING` にまとまっています。
- 国旗は現在 CSS 描画です。`CountryFlag` に種類を足し、
  `src/styles/travel.css` の `.intro__flag--*` を増やしてください。
  正式な旗素材を使う場合は `flagNode()` の1か所だけを差し替えます。
