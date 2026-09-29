/**
 * 表紙の正式採用素材。
 *
 * 原寸ファイルは assets-source/title/ に無改変で保管してある。
 * public/assets/title/ にあるのは配信用の WebP で、
 * 形・色・構図・文字には一切手を加えていない。
 *
 * 一枚絵の表紙（2026-09-28 採用）
 *   title-adopted-pilot-ca : 852x1846 原寸のまま WebP 化  2626KB -> 412KB
 *   ロゴ・パイロット・CA・旅行かばん・開始ボタンの絵が1枚に描かれている。
 *   縮小も切り抜きもしていない。再エンコードだけを行った。
 *
 * 旧・分離レイヤー素材（表紙では使っていない。案内キャラクターだけ移動画面で使う）
 *   title-background : 853x1844  原寸のまま WebP 化        2168KB -> 301KB
 *   title-logo       : 1997x787 -> 1200x473  WebP          1790KB -> 107KB
 *   suitcase-mascot  : 1402x1122 -> 760x608  WebP          1603KB ->  99KB
 */

/** Vite の base を反映した URL を作る。GitHub Pages のサブパス公開に対応する。 */
function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export const TITLE_ASSETS = {
  /** 一枚絵の表紙。ロゴ・人物・開始ボタンの絵をすべて含む。 */
  cover: assetUrl('assets/title/title-adopted-pilot-ca.webp'),
  background: assetUrl('assets/title/title-background.webp'),
  logo: assetUrl('assets/title/title-logo.webp'),
  mascot: assetUrl('assets/title/suitcase-mascot.webp'),
} as const;

/** 素材の原寸。レイアウト計算とテストで使う。 */
export const TITLE_ASSET_SIZES = {
  cover: { width: 852, height: 1846 },
  background: { width: 853, height: 1844 },
  logo: { width: 1200, height: 473 },
  mascot: { width: 760, height: 608 },
} as const;

/**
 * 表紙の絵に描かれている「旅をはじめる」ボタンの位置。
 *
 * 原寸 852x1846 の画素を測って求めた比率で、絵の左上を 0、右下を 1 とする。
 * 青く光る枠の外周が L=165px / T=1549px / R=679px / B=1678px にあたる。
 *
 * この値は CSS の配置とテストの両方から参照する。
 * 絵を差し替えるときは測り直すこと。絵を切り抜いて合わせてはいけない。
 */
export const TITLE_COVER_BUTTON = {
  left: 165 / 852,
  top: 1549 / 1846,
  right: 679 / 852,
  bottom: 1678 / 1846,
} as const;

/** 描かれたボタンの中心と大きさ（比率）。CSS の配置に使う。 */
export const TITLE_COVER_BUTTON_BOX = {
  left: TITLE_COVER_BUTTON.left,
  width: TITLE_COVER_BUTTON.right - TITLE_COVER_BUTTON.left,
  centerY: (TITLE_COVER_BUTTON.top + TITLE_COVER_BUTTON.bottom) / 2,
  height: TITLE_COVER_BUTTON.bottom - TITLE_COVER_BUTTON.top,
} as const;

/**
 * 表紙の分離素材（layered-v1）。
 *
 * 採用見本 approved-preview.png に合わせて個別に制作された3点。
 * 原寸は assets-source/title/layered-v1/ に無改変で保管し、
 * public/ にあるのは同じ画素数のまま WebP へ再エンコードしたもの。
 *
 *   background  : 852x1846  ロゴ・人物・かばん・ボタンを含まない全面背景
 *   logo        : 1997x788  透過。文字は「ことばトラベル」「KOTOBA JOURNEY」
 *   characters  : 1024x1536 透過。パイロット・CA・手荷物・旅行かばん
 *
 * ボタンは画像に描かれていない。操作はすべて本物の <button> で出す。
 */
/**
 * 背景の候補。
 *
 * v1 … 最初に受け取った背景。いま画面に出ているのはこちら。
 * v2 … 「強い光を二人のあいだから足元へ」「地球儀を大きく」の指示で
 *       作り直された候補（kotoba-title-background-v2）。
 *
 * v2 は地球儀が大きく、画像の上から 10.8% の高さまで来る。
 * そのぶんロゴを置ける空が狭く、iPhone 15 Pro の比率では
 * ロゴが成立しない（詳しくは TITLE_BACKGROUND_V2 の注記）。
 * 採用の可否がユーザーの確認待ちなので、
 * ここは v1 のままにし、v2 は測り直した値とともに置いてある。
 */
export const TITLE_BACKGROUND_VARIANT: 'v1' | 'v2' = 'v1';

export const TITLE_BACKGROUNDS = {
  v1: assetUrl('assets/title/layered-v1/background.webp'),
  v2: assetUrl('assets/title/background-v2/background-large-globe-center-light.webp'),
} as const;

export const TITLE_LAYERS = {
  background: TITLE_BACKGROUNDS[TITLE_BACKGROUND_VARIANT],
  logo: assetUrl('assets/title/layered-v1/logo.webp'),
  characters: assetUrl('assets/title/layered-v1/characters.webp'),
} as const;

export const TITLE_LAYER_SIZES = {
  background: { width: 852, height: 1846 },
  logo: { width: 1997, height: 788 },
  characters: { width: 1024, height: 1536 },
} as const;

/**
 * 背景の中で、ロゴや人物で隠してはいけないもの。
 * 背景画像の左上を 0、右下を 1 とする比率で、目盛りを重ねて実測した。
 */
export const TITLE_BACKGROUND_LANDMARKS = {
  /**
   * 光る地球儀。円周を隠さない。
   *
   * background.png に目盛りを重ね、青い円が見えている範囲を読み取ると
   * 横 37%〜59%、縦 21%〜32% だった。どの辺も外側へ少し広げて持つ。
   * （右は以前 0.58 としていたが、実測 0.59 より内側で、円の右端を
   *   守れていなかった。実測に合わせて広げた。）
   */
  globe: { left: 0.36, top: 0.205, right: 0.6, bottom: 0.33 },
  /**
   * 富士山。山頂と山体を見せる。
   * 目盛りで読むと山頂は横 15.6% / 縦 34.2% にあり、この枠の左半分に入る。
   */
  fuji: { left: 0.05, top: 0.33, right: 0.30, bottom: 0.41 },
} as const;

/**
 * 背景を cover で敷くときの縦の見せ方（object-position の Y）。
 *
 * 0.27 にすると、対応する全画面サイズで地球儀の中心が
 * 画面の高さの約26%へ来る。画面ごとに切り取り量が変わっても、
 * 地球儀とロゴ・人物の位置関係が保たれる。
 */
export const TITLE_BACKGROUND_POSITION_Y = 0.27;

/**
 * ロゴ素材の中で、実際に絵が描かれている範囲（画像の高さ・幅に対する比）。
 *
 * logo.png は透過で、文字のまわりに淡い光の余白がある。
 * 透明度が 32 を超える画素の範囲を測ると、
 *   横 1.80%〜100%、縦 13.58%〜93.78%
 * だった。CSS で「ロゴの下端を地球儀より上に収める」計算をするとき、
 * 画像の箱ではなくこの範囲で考える必要がある。
 */
export const TITLE_LOGO_ART = {
  left: 0.018,
  top: 0.1358,
  right: 1,
  bottom: 0.9378,
} as const;

/**
 * 画面の高さに対して、地球儀の上端がいちばん高く来る位置。
 *
 * 背景は cover で切り取られるので、画面の縦横比によって地球儀の位置が動く。
 * 6つの対象サイズで計算すると 19.07%〜20.5% の幅に収まり、
 * いちばん高いのは 19.07%（320x568）だった。
 * ロゴはこの値より上に収める。CSS では 19dvh として使う。
 */
export const TITLE_GLOBE_TOP_MIN = 0.19;

/**
 * 候補の背景 v2（background-large-globe-center-light.png）の実測値。
 *
 * v1 の数値は流用できないので、目盛りを重ねて測り直した。
 *   地球儀   横 25.3%〜73.0%、縦 10.8%〜33.7%
 *   富士山   山頂は横 17.0% / 縦 34.6%。山体は横 4%〜40%、縦 34.5%〜42%
 *   強い光   いちばん明るいところは 横 50.0% / 縦 43.0%
 *            （地球儀からではなく、街路の奥＝二人が立つあたりから出ている）
 * 枠はどれも実測の外側へ少し広げて持つ。
 *
 * この地球儀は v1 より大きく、上へ伸びている（v1 は上端 20.5%）。
 * 参考として受け取った当初画像では地球儀の上端は 19.5% で、
 * その上の 9.5%〜18.0% にロゴが置かれていた。
 * v2 では上端が 10.8% なので、ロゴを地球儀より上へ収めると
 * 置ける高さがほとんど残らない。
 */
export const TITLE_BACKGROUND_V2 = {
  size: { width: 852, height: 1846 },
  landmarks: {
    globe: { left: 0.24, top: 0.10, right: 0.74, bottom: 0.345 },
    fuji: { left: 0.04, top: 0.34, right: 0.40, bottom: 0.42 },
  },
  /** 強い光の中心（画像に対する比率）。 */
  lightCenter: { x: 0.5, y: 0.43 },
} as const;

/**
 * 参考として受け取った当初画像（original-light-reference.jpeg）の実測値。
 *
 * 1179x2556（縦横比 0.4613）で、iPhone 15 Pro とほぼ同じ比率。
 * この配置が成り立っているのは、地球儀の上に十分な空があるため。
 */
export const TITLE_REFERENCE_LAYOUT = {
  logo: { top: 0.095, bottom: 0.18, left: 0.14, right: 0.79 },
  globe: { top: 0.195, bottom: 0.344, left: 0.212, right: 0.711 },
  /** 男性の髪の上端。参考画像では人物の頭が地球儀の下部に重なっている。 */
  castTop: 0.284,
} as const;
