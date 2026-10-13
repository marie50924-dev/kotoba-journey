/**
 * 七海（middle-f-01）の胴体表示 body-extension-v1（採用）
 *
 * attachCardReferenceV23 の直後に七海へ一度だけ呼ぶ。既存の顔・sharp は無改変。
 * v23 の body と body-mask を同じ座標で複製し、center／footprint の外へ胴体を見せる。
 * 追加した層にだけ下端フェードを掛ける。原画や既存の PNG は変更しない。
 * 返る解除関数を、カードを作り直すときと画面を捨てるときに呼ぶ。
 */
export function attachNanamiBodyExtensionV1(card: HTMLElement): () => void {
  if (card.dataset.avatarId !== 'middle-f-01' ||
      card.dataset.referenceV23 !== 'true' ||
      card.dataset.bodyExtensionV1 === 'true') return () => {};
  const face = card.querySelector<HTMLElement>('.avatar-thumb__face');
  const sharp = face?.querySelector<HTMLElement>('.reference-v23-sharp');
  const head = sharp?.querySelector<HTMLImageElement>('.reference-v23-head');
  const body = sharp?.querySelector<HTMLImageElement>('.reference-v23-body');
  const name = card.querySelector<HTMLElement>('.avatar-thumb__name');
  if (!face || !sharp || !head || !body || !name) return () => {};
  const layer = document.createElement('span');
  layer.className = 'nanami-body-extension-v1';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  const copy = body.cloneNode(true) as HTMLImageElement;
  copy.removeAttribute('id');
  copy.alt = '';
  layer.append(copy);
  card.append(layer);
  card.dataset.bodyExtensionV1 = 'true';
  let frame = 0;
  let disposed = false;
  const update = () => {
    frame = 0;
    if (disposed) return;
    if (!card.isConnected || !face.classList.contains('has-image') ||
        card.dataset.referenceV23 !== 'true' || !face.contains(head) ||
        !body.complete || body.naturalWidth === 0) {
      layer.hidden = true;
      return;
    }
    const c = card.getBoundingClientRect();
    const f = face.getBoundingClientRect();
    const n = name.getBoundingClientRect();
    const end = Math.max(0, Math.min(f.height * .98, n.top - f.top - 3));
    layer.style.setProperty('--body-ext-left', (f.left - c.left - card.clientLeft) + 'px');
    layer.style.setProperty('--body-ext-top', (f.top - c.top - card.clientTop) + 'px');
    layer.style.setProperty('--body-ext-width', f.width + 'px');
    layer.style.setProperty('--body-ext-height', f.height + 'px');
    layer.style.setProperty('--body-ext-fade-start', Math.min(f.height * .84, Math.max(0, end - 6)) + 'px');
    layer.style.setProperty('--body-ext-fade-end', end + 'px');
    layer.hidden = false;
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(update);
  };
  const resizeObserver = new ResizeObserver(schedule);
  [card, face, name].forEach(el => resizeObserver.observe(el));
  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(face, { attributes: true, attributeFilter: ['class'], childList: true });
  mutationObserver.observe(card, { attributes: true, attributeFilter: ['data-reference-v23'] });
  const images = [head, body, copy];
  images.forEach(img => {
    img.addEventListener('load', schedule);
    img.addEventListener('error', schedule);
  });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    disposed = true;
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    images.forEach(img => {
      img.removeEventListener('load', schedule);
      img.removeEventListener('error', schedule);
    });
    window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
    layer.remove();
    delete card.dataset.bodyExtensionV1;
  };
}
