/**
 * 旅のページデザイン（第1組）の装飾背景。
 *
 * 対象は主人公確認・コース入口・枚数選択の3画面だけ。
 * 画像のURLは Vite の base を通して組み立てる（他の画像と同じやり方）。
 *
 * 背景は装飾の層で、操作には関わらない。
 * 画面要素の背景として敷くので、文字や人物の画像にフィルタは掛からない。
 */

/**
 * Vite の base を反映した URL を作る。
 *
 * ここだけは、ページの場所を基準にした絶対URLまで解決しておく。
 * CSS の url() は「読み込んだCSSファイルの場所」を基準に解釈されるため、
 * `./assets/...` のまま渡すと assets/ の中をもう一度たどってしまい、
 * 画像が見つからなくなる（実測で 404 になった）。
 */
function assetUrl(path: string): string {
  const relative = `${import.meta.env.BASE_URL}${path}`;
  const base = typeof document === 'undefined' ? undefined : document.baseURI;
  if (base === undefined) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/** 旅のUI背景（ChatGPT制作・無改変）。 */
export function travelUiBackgroundUrl(): string {
  return assetUrl('assets/ui/travel-ui-background-v1.webp');
}

/**
 * 画面に背景を割り当てる。
 *
 * CSS 変数で渡すのは、CSS 側からは base の付いたURLを書けないため。
 * 画面の作り・操作・文言には触れない。
 */
export function withTravelBackdrop(screen: HTMLElement): HTMLElement {
  screen.style.setProperty('--travel-bg', `url("${travelUiBackgroundUrl()}")`);
  return screen;
}
