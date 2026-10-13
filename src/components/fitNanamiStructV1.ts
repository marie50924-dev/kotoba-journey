/*
 * 七海（middle-f-01）のカードの構成 struct-v1（採用）
 *
 * 指定の式で「必要なカード高さ」を出し、一覧へ渡すだけ。
 *   必要高さ = thumb幅 × 1.3 ＋ 名前の高さ ＋ 上下の境界幅 ＋ 5px
 * 現在より低くしないため、行は minmax(必要高さ, 1fr) で伸びる側だけ許す。
 * カード幅・列数・横の間隔には触れない。
 *
 * 当てるのは中学生の一覧だけ。他の年代へ切り替えたら規則を外す。
 * 行の高さがそろうため、中学生16枚のカード高さは同じになる。幅・列数・横の間隔は変えない。
 * 年代の切替・男女の絞り込み・カードの作り直し・画面寸法の変更のあとも
 * 計算し直すため、次の3つを見張る。
 *   ResizeObserver   … 一覧の寸法が変わったとき（画面の回転・寸法変更）
 *   MutationObserver … カードが作り直されたとき（年代切替・絞り込み）
 *   MutationObserver … 画面の data-age-group が変わったとき（年代切替）
 */
const TARGET_AGE = 'middle';

export function applyStructV1(grid: HTMLElement): () => void {
  // 呼ばれた時点では一覧がまだ画面へ入っていないことがある。
  // 画面は毎回さがし直し、見つかってから年代を見る。
  let watched: HTMLElement | null = null;
  const age = new MutationObserver(() => update());
  const findScreen = (): HTMLElement | null => {
    const found = grid.closest<HTMLElement>('.screen--avatar-select');
    if (found && found !== watched) {
      age.disconnect();
      age.observe(found, { attributes: true, attributeFilter: ['data-age-group'] });
      watched = found;
    }
    return found;
  };
  const update = (): void => {
    const screen = findScreen();
    if (!screen || screen.dataset.ageGroup !== TARGET_AGE) {
      delete grid.dataset.structV1;
      grid.style.removeProperty('--struct-card-h');
      return;
    }
    const card = grid.querySelector<HTMLElement>('.avatar-card');
    const thumb = card?.querySelector<HTMLElement>('.avatar-thumb');
    const name = card?.querySelector<HTMLElement>('.avatar-thumb__name');
    if (!card || !thumb || !name) {
      delete grid.dataset.structV1;
      grid.style.removeProperty('--struct-card-h');
      return;
    }
    const t = thumb.getBoundingClientRect();
    const n = name.getBoundingClientRect();
    if (t.width <= 0) return;
    const cs = getComputedStyle(card);
    const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const needed = t.width * 1.3 + n.height + border + 5;
    grid.dataset.structV1 = 'true';
    grid.style.setProperty('--struct-card-h', `${needed}px`);
  };
  const size = new ResizeObserver(update);
  size.observe(grid);
  const children = new MutationObserver(update);
  children.observe(grid, { childList: true });
  update();
  return () => { size.disconnect(); children.disconnect(); age.disconnect(); };
}
