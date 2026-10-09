/* fit-v3: 人物の下部フェードとfrostの表示範囲を独立させる未採用候補。 */
export function fitNanamiV3(card: HTMLElement): () => void {
 const name = card.querySelector<HTMLElement>('.avatar-thumb__name');
 const thumb = card.querySelector<HTMLElement>('.avatar-thumb');
 if (!name || !thumb || card.dataset.avatarId !== 'middle-f-01') return () => {};
 const update = () => {
  const t = thumb.getBoundingClientRect();
  const n = name.getBoundingClientRect();
  const available = n.top - t.top - 5;
  if (t.width <= 0 || available <= 0) return;
  const width = Math.min(t.width, available / 1.1);
  const height = width * 1.3;
  const end = Math.max(1, Math.min(available, height) - 1);
  const figureStart = Math.max(0, end - Math.min(18, width * 0.18));
  const frostHeight = Math.min(available, height);
  // head上端=stage高さの2%、測定対象の顔中央の下端=head高さの75%。
  // 0.80wはこの中央領域より下。髪全体・顎の無変化を保証する数値ではない。
  const frostTopStart = Math.min(end - 2, width * 0.80);
  const frostTopEnd = Math.min(end - 1, width * 0.88);
  const frostBottomStart = Math.max(frostTopEnd, end - Math.min(12, width * 0.12));
  const values = {
   '--nanami-stage-w':width, '--nanami-stage-h':height,
   '--nanami-figure-fade-start':figureStart, '--nanami-figure-fade-end':end,
   '--nanami-frost-h':frostHeight,
   '--nanami-frost-top-start':Math.max(0, frostTopStart),
   '--nanami-frost-top-end':Math.max(0, frostTopEnd),
   '--nanami-frost-bottom-start':Math.max(0, frostBottomStart),
   '--nanami-frost-bottom-end':end
  };
  for (const [key,value] of Object.entries(values)) card.style.setProperty(key,value + 'px');
 };
 const observer = new ResizeObserver(update);
 observer.observe(card);observer.observe(name);observer.observe(thumb);update();
 return () => observer.disconnect();
}
