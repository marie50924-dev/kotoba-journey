# ことばトラベル — 日本の国紹介 出典確認チェックリスト

対象: `src/data/countryIntros.ts` の `countryId: 'japan'`
作成日: 2026-09-20
claim 件数: 45件
本文確認済み: **0件**（全件 unchecked）

---

## このチェックリストについて

国紹介の画面に出す事実を1文ずつ `FactClaim` にし、claimId を付けて並べたものです。
**全件がまだ本文未確認**のため、日本の `publicationStatus` は `'draft'` のままで、
「もっと知る」も事実カードも公開導線には出していません。

### なぜ Claude が確認済みにできないのか

この開発環境は外向き通信が遮断されており、公的機関のページを取得できません。
実測（2026-09-20）:

```text
www.maff.go.jp        -> 接続失敗
www.metro.tokyo.lg.jp -> 接続失敗
web-japan.org         -> 接続失敗
www.jma.go.jp         -> 接続失敗
www.gsi.go.jp         -> 接続失敗
www.rinya.maff.go.jp  -> 接続失敗
www.mlit.go.jp        -> 接続失敗
www.bunka.go.jp       -> EGRESS_BLOCKED
whc.unesco.org        -> EGRESS_BLOCKED
```

URLの所在は公的ドメイン限定の検索で特定しましたが、**本文は1件も読めていません**。
したがって、どの行も「確認済み」にしていません。

### body-checked にしてよい条件

次を**すべて**満たしたときだけ、`verification` を `'body-checked'` にしてください。

1. URL を開いた
2. ページ本文を読んだ
3. 該当する文章を本文の中に確認した
4. ゲーム内の文章が資料の範囲を超えていない
5. 確認日と、本文で確認した内容のメモをこの表に書いた

URL が存在する／ドメインが公的機関／資料名にそれらしい語が入っている——
これらはどれも確認済みの根拠になりません。

### 公開判定の正式仕様

`verification` の3つの状態と、国全体の公開可否の関係です。

| 状態 | 意味 | 画面表示 | 公開への影響 |
|---|---|---|---|
| `unchecked` | 未確認 | 表示不可 | 表示対象に1件でも残っていれば**公開不可** |
| `body-checked` | 本文確認済み | 表示可能 | 妨げない |
| `rejected` | 本文を読んだ結果の不採用 | **絶対に表示しない** | 表示対象から外してあれば妨げない |

公開できる条件:

- unchecked の表示対象 claim が残っていれば公開不可
- 実際に表示する claim がすべて body-checked なら公開可能
- rejected は不採用の監査記録としてチェックリストに残す
- rejected は画面表示対象から必ず除外する
- rejected が表示対象から除外されていれば国全体の公開を妨げない
- rejected が画面データから参照されていれば公開不可

判定は「すべての claim」ではなく「画面データから参照されている claim」で行います
（`canPublish()` / `displayDataClaims()`）。
不採用にした文章は `retiredClaims` へ移すことで、監査記録として残したまま
表示対象から外れ、国全体の公開を妨げなくなります。

### 確認後の作業

まずこの表の「本文確認状態」「本文中で確認した内容」「採用／修正／削除」「確認日」を埋め、
そのうえで `src/data/countryIntros.ts` の該当 claim を次のように更新してください。

**採用**

- `verification: 'body-checked'` にする
- `candidateSourceIds` を、確認済みの `sourceIds` へ移す
- 本文確認メモと確認日を記録する

**修正**

- 文章を修正する
- 修正後の文章が資料本文に収まることを再確認してから `body-checked` にする

**不採用**

- `verification: 'rejected'` にする
- 監査記録は残す（`retiredClaims` へ移して保持する）
- その claimId を画面表示対象データから外す

**公開**

- 表示対象の claim がすべて `body-checked` になったら `publicationStatus: 'verified'` にする
- rejected は表示対象から外れている限り、公開を妨げない

---

## 確認の進み具合

| 状態 | 件数 |
|---|---|
| unchecked（未確認） | 45 |
| body-checked（確認済み） | 0 |
| rejected（不採用） | 0 |


---

## まち（7件）

### 1. `jp-claim-capital-line`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 首都は東京です。 |
| カテゴリー | まち |
| 確認予定の資料 | 東京都「東京都プロフィール　都の概要」 |
| URL | https://www.metro.tokyo.lg.jp/tosei/tokyoto/profile/gaiyo |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 2. `jp-claim-capital-tokyo`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 東京（とうきょう） |
| カテゴリー | まち |
| 確認予定の資料 | 東京都「東京都プロフィール　都の概要」 |
| URL | https://www.metro.tokyo.lg.jp/tosei/tokyoto/profile/gaiyo |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 3. `jp-claim-city-sapporo`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 札幌（さっぽろ・北のまち） |
| カテゴリー | まち |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 4. `jp-claim-city-kyoto`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 京都（きょうと・古いまちなみが残る） |
| カテゴリー | まち |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 5. `jp-claim-city-osaka`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 大阪（おおさか・にぎやかなまち） |
| カテゴリー | まち |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 6. `jp-claim-city-fukuoka`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 福岡（ふくおか・海に近いまち） |
| カテゴリー | まち |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 7. `jp-claim-city-naha`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 那覇（なは・南のあたたかいまち） |
| カテゴリー | まち |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## 概要（到着直後）（2件）

### 8. `jp-claim-summary`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | ユーラシア大陸の東にある、海にかこまれた島の国です。北から南へ細長くつづいているので、地域によって気候も食べものもちがいます。 |
| カテゴリー | 概要（到着直後） |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 9. `jp-claim-highlight-fuji`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 富士山は高さ3776mで、日本でいちばん高い山です。 |
| カテゴリー | 概要（到着直後） |
| 確認予定の資料 | 国土地理院「日本の主な山岳標高（1003山）」 |
| URL | https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## しぜん（3件）

### 10. `jp-claim-geo-island`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 海にかこまれた島の国で、山が多いのが特ちょうです。 |
| カテゴリー | しぜん |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 11. `jp-claim-geo-forest`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 森林が国土のおよそ3分の2をしめています。 |
| カテゴリー | しぜん |
| 確認予定の資料 | 林野庁「都道府県別森林率・人工林率」 |
| URL | https://www.rinya.maff.go.jp/j/keikaku/genkyou/index2.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 12. `jp-claim-geo-rivers`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 川は短くて流れが急なものが多く、平地は海の近くに広がっています。 |
| カテゴリー | しぜん |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## きこう（4件）

### 13. `jp-claim-climate-range`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 南北に長いため、北と南で気候が大きくちがいます。同じ日でも、雪の地域と半そでの地域があります。 |
| カテゴリー | きこう |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 14. `jp-claim-climate-winter`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 冬は日本海側で雪やくもりの日が多く、太平洋側では晴れの日が多くなります。 |
| カテゴリー | きこう |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 15. `jp-claim-climate-baiu`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 春から夏へ変わるころに、雨の多い「梅雨（つゆ）」があります。沖縄や奄美では5月ごろにはじまります。 |
| カテゴリー | きこう |
| 確認予定の資料 | 気象庁「過去の梅雨入りと梅雨明け」 / 気象庁「日本の気候」 |
| URL | https://www.data.jma.go.jp/cpd/baiu/index.html  https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 16. `jp-claim-climate-seasons`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 四季があり、季節によって景色が変わります。 |
| カテゴリー | きこう |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## きこう（服装）（4件）

### 17. `jp-claim-clothes-summer`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 夏（6〜8月）は暑くてしめっぽいので、すずしい服と、ぼうし・水とうがあると安心です。 |
| カテゴリー | きこう（服装） |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 18. `jp-claim-clothes-winter`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 冬（12〜2月）は地域差が大きいので、行き先の気温を調べてから決めましょう。北の地方や日本海側では雪の用意がいります。 |
| カテゴリー | きこう（服装） |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 19. `jp-claim-clothes-spring-autumn`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 春と秋は朝晩がひえることがあるので、はおるものを1まい持っていくとよいです。 |
| カテゴリー | きこう（服装） |
| 確認予定の資料 | 気象庁「日本の気候」 |
| URL | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 20. `jp-claim-clothes-baiu`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 梅雨の時期は雨具があると助かります。 |
| カテゴリー | きこう（服装） |
| 確認予定の資料 | 気象庁「過去の梅雨入りと梅雨明け」 |
| URL | https://www.data.jma.go.jp/cpd/baiu/index.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## みどころ（4件）

### 21. `jp-claim-landmark-fuji`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 富士山は世界文化遺産。昔から信仰の対象になり、絵や物語にも多く出てきます。 |
| カテゴリー | みどころ |
| 確認予定の資料 | 文化庁「日本の世界遺産一覧」 |
| URL | https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/ |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 22. `jp-claim-landmark-horyuji`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 法隆寺（奈良県）は世界文化遺産。西院の金堂・五重塔などは、今ものこる木造の建物として世界でもっとも古いものと説明されています。 |
| カテゴリー | みどころ |
| 確認予定の資料 | 文化庁 文化遺産オンライン「法隆寺地域の仏教建造物　詳細解説」 / UNESCO 世界遺産センター「法隆寺地域の仏教建造物」 |
| URL | https://online.bunka.go.jp/docs/special_content/detailed_explanation/1_horyuji.pdf  https://whc.unesco.org/ja/list/660 |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 23. `jp-claim-landmark-himeji`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 姫路城（兵庫県）は世界文化遺産。白い天守閣で知られるお城です。 |
| カテゴリー | みどころ |
| 確認予定の資料 | 文化庁「日本の世界遺産一覧」 |
| URL | https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/ |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 24. `jp-claim-landmark-kyoto`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 古都京都の文化財（京都府・滋賀県）は世界文化遺産。お寺や神社、庭がまとまって登録されています。 |
| カテゴリー | みどころ |
| 確認予定の資料 | 文化庁「日本の世界遺産一覧」 |
| URL | https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/ |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## たべもの（料理）（4件）

### 25. `jp-claim-food-sushi`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | すしは、酢をまぜたごはんに、魚などをあわせた料理。 |
| カテゴリー | たべもの（料理） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 26. `jp-claim-food-ramen`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | ラーメンは、スープにめんを入れた料理。地域ごとに味がちがいます。 |
| カテゴリー | たべもの（料理） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 27. `jp-claim-food-misoshiru`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | みそしるは、みそでつくる、毎日の食事によく出るしる物。 |
| カテゴリー | たべもの（料理） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 28. `jp-claim-food-wagashi`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 和菓子は、季節の形や色にしたおかし。 |
| カテゴリー | たべもの（料理） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## たべもの（特産物）（5件）

### 29. `jp-claim-spec-rice`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | こめは日本の特産物。 |
| カテゴリー | たべもの（特産物） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 30. `jp-claim-spec-tea`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | おちゃは日本の特産物。 |
| カテゴリー | たべもの（特産物） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 31. `jp-claim-spec-fruit`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | くだものは日本の特産物。 |
| カテゴリー | たべもの（特産物） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 32. `jp-claim-spec-fish`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | さかなは日本の特産物。 |
| カテゴリー | たべもの（特産物） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 33. `jp-claim-spec-note`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 特産物は地域によって大きくちがいます。とれるものと、その土地の料理は別のものです。くわしい地域ごとの特産物は、これからの工程で足していきます。 |
| カテゴリー | たべもの（特産物） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## れきし（4件）

### 34. `jp-claim-hist-ancient`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | むかしのくに：むらがまとまって国の形ができていきました。奈良や京都には、このころに建てられた古いお寺や神社がのこっています。 |
| カテゴリー | れきし |
| 確認予定の資料 | Web Japan（外務省）Kids Web Japan「歴史」 |
| URL | https://web-japan.org/kidsweb/explore/history/index.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 35. `jp-claim-hist-samurai`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 武士（ぶし）の時代：武士とよばれる人たちが力を持ち、各地にお城が建てられました。姫路城のように、今も見られるお城があります。 |
| カテゴリー | れきし |
| 確認予定の資料 | Web Japan（外務省）Kids Web Japan「歴史」 |
| URL | https://web-japan.org/kidsweb/explore/history/index.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 36. `jp-claim-hist-edo`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 江戸（えど）の時代：大きな戦いの少ない時代が長くつづき、まちに絵や芝居などの文化が広がりました。 |
| カテゴリー | れきし |
| 確認予定の資料 | Web Japan（外務省）Kids Web Japan「歴史」 |
| URL | https://web-japan.org/kidsweb/explore/history/index.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 37. `jp-claim-hist-modern`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 近代から今へ：外国との行き来がふえ、鉄道や工場ができて、くらしが大きく変わりました。そのまま今の日本につながっています。 |
| カテゴリー | れきし |
| 確認予定の資料 | Web Japan（外務省）Kids Web Japan「歴史」 |
| URL | https://web-japan.org/kidsweb/explore/history/index.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## ぶんか（3件）

### 38. `jp-claim-culture-bow`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | あいさつのときに、おじぎをすることがあります。 |
| カテゴリー | ぶんか |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 39. `jp-claim-culture-shoes`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 家や旅館では、玄関で靴をぬいで上がります。 |
| カテゴリー | ぶんか |
| 確認予定の資料 | 観光庁「日本のマナーを知ってもらおう！　訪日外国人旅行者向けマナー啓発動画」 |
| URL | https://www.mlit.go.jp/kankocho/news08_000304.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 40. `jp-claim-culture-events`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 季節の行事が多く、春の花見や夏のお祭りなど、時期ごとの楽しみがあります。 |
| カテゴリー | ぶんか |
| 確認予定の資料 | Web Japan（外務省）Japan Fact Sheet「年中行事」 |
| URL | https://web-japan.org/factsheet/archives/ja/pdf/J21_annual.pdf |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## ぶんか（マナー）（5件）

### 41. `jp-claim-manner-train`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 電車やバスの中では、大きな声で話さないようにしましょう。 |
| カテゴリー | ぶんか（マナー） |
| 確認予定の資料 | 観光庁「日本のマナーを知ってもらおう！　訪日外国人旅行者向けマナー啓発動画」 |
| URL | https://www.mlit.go.jp/kankocho/news08_000304.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 42. `jp-claim-manner-trash`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | ごみは決められた場所へ。持ち帰ることもあります。 |
| カテゴリー | ぶんか（マナー） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 43. `jp-claim-manner-temple`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | お寺や神社では、書かれている決まりを見てから入りましょう。 |
| カテゴリー | ぶんか（マナー） |
| 確認予定の資料 | 観光庁「日本のマナーを知ってもらおう！　訪日外国人旅行者向けマナー啓発動画」 |
| URL | https://www.mlit.go.jp/kankocho/news08_000304.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 44. `jp-claim-manner-onsen`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 温泉やお風呂では、体を洗ってから湯ぶねに入ります。 |
| カテゴリー | ぶんか（マナー） |
| 確認予定の資料 | 観光庁「日本のマナーを知ってもらおう！　訪日外国人旅行者向けマナー啓発動画」 |
| URL | https://www.mlit.go.jp/kankocho/news08_000304.html |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |

### 45. `jp-claim-manner-photo`

| 項目 | 内容 |
|---|---|
| ゲーム内の文章 | 写真をとってよい場所かどうか、先に確かめましょう。 |
| カテゴリー | ぶんか（マナー） |
| 確認予定の資料 | （未定：資料探しから） |
| URL | — |
| 本文確認状態 | **unchecked** |
| 本文中で確認した内容 | （未記入） |
| 採用／修正／削除 | （未記入） |
| 確認日 | （未記入） |


---

## 参照した出典の一覧（15件・すべて本文未確認）

| id | 機関と資料名 | URL |
|---|---|---|
| `tokyo-profile` | 東京都「東京都プロフィール　都の概要」 | https://www.metro.tokyo.lg.jp/tosei/tokyoto/profile/gaiyo |
| `tokyo-municipalities` | 東京都「都内区市町村マップ」 | https://www.metro.tokyo.lg.jp/tosei/tokyoto/profile/gaiyo/kushichoson |
| `rinya-forest` | 林野庁「都道府県別森林率・人工林率」 | https://www.rinya.maff.go.jp/j/keikaku/genkyou/index2.html |
| `gsi-mountains` | 国土地理院「日本の主な山岳標高（1003山）」 | https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html |
| `jma-climate` | 気象庁「日本の気候」 | https://www.jma.go.jp/jma/kishou/know/kisetsu_riyou/tenkou/Average_Climate_Japan.html |
| `jma-baiu` | 気象庁「過去の梅雨入りと梅雨明け」 | https://www.data.jma.go.jp/cpd/baiu/index.html |
| `bunka-heritage` | 文化庁「日本の世界遺産一覧」 | https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/ |
| `bunka-horyuji` | 文化庁 文化遺産オンライン「法隆寺地域の仏教建造物　詳細解説」 | https://online.bunka.go.jp/docs/special_content/detailed_explanation/1_horyuji.pdf |
| `unesco-horyuji` | UNESCO 世界遺産センター「法隆寺地域の仏教建造物」 | https://whc.unesco.org/ja/list/660 |
| `maff-washoku` | 農林水産省「『和食』がユネスコ無形文化遺産に登録されています」 | https://www.maff.go.jp/j/keikaku/syokubunka/ich/ |
| `maff-local-food` | 農林水産省「うちの郷土料理　次世代に伝えたい大切な味」 | https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/index.html |
| `maff-traditional-foods` | 農林水産省「にっぽん伝統食図鑑」 | https://www.maff.go.jp/j/keikaku/syokubunka/traditional-foods/index.html |
| `webjapan-history` | Web Japan（外務省）Kids Web Japan「歴史」 | https://web-japan.org/kidsweb/explore/history/index.html |
| `webjapan-annual-events` | Web Japan（外務省）Japan Fact Sheet「年中行事」 | https://web-japan.org/factsheet/archives/ja/pdf/J21_annual.pdf |
| `kankocho-manners` | 観光庁「日本のマナーを知ってもらおう！　訪日外国人旅行者向けマナー啓発動画」 | https://www.mlit.go.jp/kankocho/news08_000304.html |

---

## 画面に出るが claim にしていないもの

事実の主張ではないため、確認の対象外にしています。

| 文章 | 種類 | 理由 |
|---|---|---|
| こんにちは / Hello | あいさつ | ゲーム内の表現。事実の主張ではない |
| 服装の目安は、公的な気候情報をもとにした一般的な案内です。天気予報ではありません。… | 注意書き | 事実ではなく、読み手への断り書き |
| 身のまわりのことばを、日本語と英語のカルタで集めます。 | ゲーム説明 | ゲームの遊び方の説明 |
| ことばカードの語（りんご/apple など） | ゲーム内データ | 語彙データ（src/data/wordPairs.ts）が正本。外部出典を要さない |
| この国の紹介は準備中です。 | 下書きの案内 | 下書き状態の案内 |
