/** 画面に出す文字列はここへ集約し、ロジック側へ直接書かない。 */

export const UI = {
  app: {
    titleJa: 'ことばトラベル',
    titleEn: 'KOTOBA JOURNEY',
    tagline: 'ことばをあつめて、世界をめぐろう。',
    grayboxBadge: 'グレーボックス試作版',
    grayboxNote: '正式デザイン・正式音声・課金は未実装です。',
  },
  actions: {
    start: '旅をはじめる',
    skip: 'スキップ',
    depart2: '出発',
    depart: '出発する',
    back: 'もどる',
    next: 'つぎへ',
    retry: 'もう一度',
    continue: '旅をつづける',
    passport: 'マイパスポート',
    settings: '設定',
    close: 'とじる',
    listenAgain: 'もういちど聞く',
    clearRecord: '学習記録を消去',
    startKaruta: 'カルタをはじめる',
    takeQuiz: 'テストを受ける',
    skipQuiz: '今回はスキップ',
    practiceAgain: 'もう一度練習する',
    nextWave: '次のウェーブへ',
    changeCharacter: '表示キャラクターを変える',
  },

  characters: {
    heading: 'いっしょに旅する2人',
    guideAlt: '旅行かばんの案内役',
    guideLabel: '案内役',
    guideLine: 'ぼくが行き先を案内します。いっしょに行こう！',
    ageSettingNote:
      'このコースは年齢が決まっていないため、大人の2人を表示しています。設定画面の「表示キャラクター」で変えられます。',
    ageSetting: '表示キャラクター',
    ageAuto: 'コースに合わせる',
  },

  travel: {
    heading: 'いどう中',
    departure: 'しゅっぱつ',
    arrival: 'とうちゃく',
    arrived: 'とうちゃく！',
    skipHint: 'スキップできます',
  },

  countryIntro: {
    greeting: 'あいさつ',
    capital: 'しゅと',
    famous: '有名なもの',
    learning: 'この国で学ぶこと',
    source: '出典',
    sources: '情報源',
    sourcesOpen: '情報源を見る',
    checkedAt: '本文・映像確認日',
    more: 'もっと知る',
    moreClose: 'とじる',
    moreLead: '出発する前に、この国のことをもう少し見てみましょう。',
    collectWords: 'この国でことばを集める',
    preparing: 'この国の紹介は準備中です。',
    close: 'とじる',
  },

  quiz: {
    promptHeading: 'かくにんテスト',
    promptLead: 'いま出たことばだけの、みじかいテストです。',
    promptDetail: 'スキップしても、次のウェーブや記録で不利にはなりません。',
    promptTypeEn: 'えいごを じぶんで 入力します。',
    promptTypeJa: 'ひらがなを じぶんで 入力します。',
    heading: 'かくにんテスト',
    questionOf: '問',
    typeInEnglish: 'えいごで入力',
    typeInJapanese: 'ひらがなで入力',
    answer: 'こたえる',
    clear: '入力を消す',
    blankHint: 'ことばを入力してね',
    switchToEnglish: 'えいごのキーボードに切りかえてね',
    switchToJapanese: 'にほんごのキーボードに切りかえてね',
    correct: 'せいかい！',
    // 近似判定は行っていないため、惜しかったかのような文言にはしない。
    wrong: 'ちがうよ',
    answerWas: 'こたえは',
    resultHeading: 'テストおわり',
    correctCount: '正解数',
    mistaken: '間違えた単語',
    allCorrect: 'ぜんぶ正解でした',
    skipped: '今回はスキップしました',
    encourage: 'つづけていけば、きっと覚えられます。',
  },
  avatar: {
    selectHeading: '旅するあなたを選ぼう',
    /*
     * 見出しの下の一文。
     * 狭い画面（320px）でも1行に収まる長さにしてある。行数が増えると
     * 一覧に使える高さが減り、完全に見える人数が落ちるため。
     */
    selectLead: '年代とコースは別です。学習内容は変わりません。',
    // ゲーム内の案内文。開発状況（立ち絵が未納品であること）は画面に出さない。
    selectNote: '好きな人を選んで、世界の旅へ出発しよう！',
    tabsLabel: '年代',
    filterLabel: '表示',
    filterAll: 'すべて',
    filterM: '男性',
    filterF: '女性',
    empty: '該当する人がいません。',
    /** 選んだあとの呼び名。ここに本人の姓名を添える。 */
    chosen: '旅するあなた',
    notChosen: 'まだ選んでいません',
    confirm: 'この人を選ぶ',
    /*
     * 確認画面と設定画面の呼び名も「旅するあなた」にそろえる。
     * 画面の作りと操作は変えていない。文字だけを差し替えている。
     */
    /*
     * 見出しは短くする。320px の帯には「もどる」と釣り合い用の余白があり、
     * 17px では9文字ほどしか入らない。長い見出しは語の途中で折り返す
     * （「旅するあなたは、こ／の人ですか？」になっていた）。
     * 問いかけは、幅に余裕のある見出しの下の一文へ置く。
     */
    confirmHeading: '旅するあなた',
    /*
     * 選んだ人は「いっしょに旅する相手」ではなく、利用者が演じる本人。
     * 「この人と旅をする」と書くと同行者に読めるので、
     * 本人を選んでいることが分かる言い方にそろえる。
     * 実際の同行者（NPC）との会話文はこことは別で、変更していない。
     */
    confirmQuestion: '旅するあなたは、この人でよいですか？',
    change: '旅するあなたを変える',
    current: '旅するあなた',
    startWith: 'この人になって旅をはじめる',
    chooseAgain: 'えらび直す',
  },

  chat: {
    heading: 'おしゃべり',
    open: 'はなしかける',
    close: 'とじる',
    later: 'あとで',
    listen: 'きく',
    /*
     * 帯の一文。名前は顔ごとに添えるので、ここでは名前を繰り返さない。
     * 繰り返すと狭い画面で横に伸び、読み上げでも同じ名前を二度言うことになる。
     */
    npcHereOne: 'この人がいます',
    npcHereMany: 'この人たちがいます',
  },

  courseEntry: {
    heading: 'コースをえらぶ',
    lead: 'どのことばの旅に出ますか？',
  },
  courseList: {
    /**
     * ステップ別のコースを開いたときの案内。
     * いまはどのステップも同じ練習用のことばを使うので、それを先に伝える。
     */
    stepsPreparing: '各ステップのことばは準備中です。現在は共通の練習用ことばで遊べます。',
  },
  cardCount: {
    heading: 'まい数をえらぶ',
    lead: '今日はどれくらい挑戦しますか？',
    options: {
      6: { title: '6枚', detail: '3ペア', level: 'やさしい' },
      12: { title: '12枚', detail: '6ペア', level: 'ふつう' },
      20: { title: '20枚', detail: '10ペア', level: 'むずかしい' },
    },
  },
  worldMap: {
    heading: '世界マップ',
    lead: '行き先をえらんでください',
    lockedNote: 'ほかの国は後の工程で開放されます',
    locked: 'ロック',
    selectable: '選択できます',
  },
  karta: {
    heading: 'カルタ',
    pairsLabel: 'とったペア',
    mistakesLabel: 'まちがい',
    timeLabel: 'じかん',
    hint: '日本語と英語のペアをさがそう。札をかさねても、タップでもえらべます',
    quit: 'やめる',
    /** 札の言語を示す短いラベル。札の角に小さく置く。 */
    jaBadge: 'あ',
    enBadge: 'A',
    /** 不正解のときに短く出す案内。音だけで正誤を伝えないために文字でも示す。 */
    retry: 'もう一度',
    /** 同じ言語同士を重ねたとき。採点はしない。 */
    sameLanguage: 'ちがう言語とペアにしよう',
    /** 音の設定。発音と効果音は別のスイッチ。 */
    soundSettings: '音の設定',
    soundSettingsOpen: '音設定',
    soundSettingsClose: 'とじる',
    pronounceLabel: '発音',
    sfxLabel: '効果音',
    /** イラスト付きの体験（ローカル確認版だけの独立した入口）。 */
    trialBadge: '体験用',
    trialHeading: 'まず3ペアで試す',
    trialLead: 'りんご・ねこ・いぬの3ペアです。学習記録には残りません。',
    trialDone: '体験完了',
    trialDoneLead: '3ペアそろいました。通常のプレイでは全部のことばが出ます。',
    trialToNormal: '通常のプレイへ',
  },
  pronunciation: {
    heading: '発音をきいてみよう',
    /**
     * 自動再生が端末にことわられたときの案内。
     * 失敗を黙って成功扱いにはせず、手で聞ける場所を示す。
     */
    tapToPlay: '「もういちど聞く」でもう一度ならせます',
    unavailable: 'この端末では音声を再生できません',
    muted: '音声はオフになっています',
    failed: '音声を再生できませんでした',
  },
  result: {
    heading: 'ステージクリア',
    accuracy: '正解率',
    clearTime: 'クリア時間',
    bestTime: '自己ベスト',
    learnedWords: '覚えたことば',
    thisTimeWords: '今回のことば',
    mistakenWords: '間違えた単語',
    noMistakes: '間違いはありませんでした',
    newBest: '自己ベスト更新！',
  },
  mastery: {
    mastered: '習得',
    practicing: '練習中',
    review: '復習',
  },
  passport: {
    heading: 'マイパスポート',
    totalPlays: '総プレイ回数',
    totalDays: '総学習日数',
    streak: '連続学習日数',
    learnedCount: '覚えた単語数',
    lifetimeAccuracy: '通算正解率',
    bestTime: 'ベストタイム',
    reviewWords: '復習対象単語',
    selectedCourse: '選択中コース',
    visitedCountries: '訪れた国',
    recentPlays: '最近のプレイ履歴',
    empty: 'まだ記録がありません',
    noCourse: '未選択',
    privacy: '名前・年齢・学校名・メールアドレスは保存していません。',
  },
  settings: {
    heading: '設定',
    audio: '音声',
    /** 発音（英語の読み上げ）。効果音とは別のスイッチ。 */
    pronounce: '発音（英語の読み上げ）',
    /** 効果音（正解・不正解の短い音）。発音とは別のスイッチ。 */
    soundEffects: '効果音',
    unsupportedSfx: 'この端末は効果音を鳴らせません',
    travelAnimation: '移動の演出',
    character: '表示キャラクター',
    characterHint: 'ステップ別のコースで使います',
    audioOn: 'ON',
    audioOff: 'OFF',
    clearConfirm: '学習記録をすべて消去します。よろしいですか？',
    cleared: '学習記録を消去しました',
    unsupportedAudio: 'この端末は音声読み上げに対応していません',
  },
  units: {
    times: '回',
    days: '日',
    words: '語',
    pairs: 'ペア',
    percent: '%',
  },
} as const;

export const COUNTRY_LABELS: Record<string, string> = {
  japan: '日本',
  london: 'ロンドン',
  paris: 'パリ',
};
