/**
 * 七海（middle-f-01）の肩の接合 head-seam-v1.1（採用）
 *
 * 原画 head の外側の制服だけを body の輪郭へなじませる。
 * 既存の head-blend マスクへ、ブラウザ内の Canvas で作った表示マスクを重ねて交差させる。
 * 右の外縁だけ、body 被覆率の参照位置を最大 0.9 CSS px 外側へずらす。
 * 原画・胴体・既存マスク PNG は変更しない。画像を加工して保存・差し替えもしない。
 * 顔の中央30〜70%と上60%、暖色（髪・肌・赤いリボン）は残す。
 * attachNanamiBodyExtensionV1 の直後に七海へ一度だけ呼ぶ。
 * 返る解除関数を、カードを作り直すときと画面を捨てるときに呼ぶ。
 * 解除時に head のインラインマスク指定を元へ戻す。
 */
export function attachNanamiHeadSeamV11(card: HTMLElement): () => void {
  if (card.dataset.avatarId !== 'middle-f-01' ||
      card.dataset.referenceV23 !== 'true' || card.dataset.headSeamV11 === 'true') return () => {};
  const face = card.querySelector<HTMLElement>('.avatar-thumb__face');
  const head = face?.querySelector<HTMLImageElement>('.reference-v23-sharp .reference-v23-head');
  const body = face?.querySelector<HTMLImageElement>('.reference-v23-sharp .reference-v23-body');
  if (!face || !head || !body) return () => {};
  const properties = ['mask-image', '-webkit-mask-image', 'mask-composite', '-webkit-mask-composite',
    'mask-size', '-webkit-mask-size', 'mask-repeat', '-webkit-mask-repeat'];
  const saved = properties.map(p => [p, head.style.getPropertyValue(p), head.style.getPropertyPriority(p)] as const);
  let disposed = false, busy = false, dirty = false, frame = 0;
  let originalMask = '';
  let bodyMask: HTMLImageElement | null = null;
  card.dataset.headSeamV11 = 'true';
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const canvas = (w: number, h: number) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    return { c, ctx };
  };
  const update = async () => {
    frame = 0;
    if (disposed) return;
    if (busy) { dirty = true; return; }
    if (!card.isConnected || card.dataset.referenceV23 !== 'true' ||
        !face.contains(head) || !face.contains(body) || !face.classList.contains('has-image') ||
        !head.complete || !head.naturalWidth || !body.complete || !body.naturalWidth) return;
    busy = true;
    try {
      if (!originalMask) {
        const hs = getComputedStyle(head);
        originalMask = hs.maskImage !== 'none' ? hs.maskImage : hs.getPropertyValue('-webkit-mask-image');
        if (!originalMask || originalMask === 'none') throw new Error('head-blend mask missing');
      }
      if (!bodyMask) {
        const bs = getComputedStyle(body);
        const value = bs.maskImage !== 'none' ? bs.maskImage : bs.getPropertyValue('-webkit-mask-image');
        const match = /url\(["']?([^"')]+)["']?\)/.exec(value);
        if (!match) throw new Error('body-mask URL missing');
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve(); img.onerror = () => reject(new Error('body-mask load failed'));
          img.src = match[1];
        });
        bodyMask = img;
      }
      if (disposed) return;
      const hr = head.getBoundingClientRect(), br = body.getBoundingClientRect();
      if (hr.width <= 0 || hr.height <= 0) return;
      const w = head.naturalWidth, h = head.naturalHeight;
      const sx = w / hr.width, sy = h / hr.height;
      const raw = canvas(w, h); raw.ctx.drawImage(head, 0, 0, w, h);
      const pixels = raw.ctx.getImageData(0, 0, w, h).data;
      /* v1 と同じ保護：暖色の髪・肌・リボンと近傍2素材pxの暗い縁を残す。 */
      const warmGuard = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        if (!pixels[i * 4 + 3] || pixels[i * 4] <= pixels[i * 4 + 2] + 8) continue;
        const x = i % w, y = Math.floor(i / w);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) warmGuard[ny * w + nx] = 1;
        }
      }
      const silhouette = canvas(w, h);
      const fit = Math.min(br.width / body.naturalWidth, br.height / body.naturalHeight);
      const rw = body.naturalWidth * fit, rh = body.naturalHeight * fit;
      const style = getComputedStyle(body);
      if (style.objectFit !== 'contain') throw new Error('unexpected body object-fit');
      silhouette.ctx.drawImage(body,
        (br.left - hr.left + (br.width - rw) / 2) * sx, (br.top - hr.top) * sy, rw * sx, rh * sy);
      silhouette.ctx.globalCompositeOperation = 'destination-in';
      silhouette.ctx.drawImage(bodyMask, (br.left - hr.left) * sx, (br.top - hr.top) * sy, br.width * sx, br.height * sy);
      const alpha = silhouette.ctx.getImageData(0, 0, w, h).data;
      const limit = canvas(w, h), image = limit.ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const a = Math.min(1, alpha[i * 4 + 3] / (255 * .08));
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
        image.data[i * 4 + 3] = Math.round(a * 255);
      }
      limit.ctx.putImageData(image, 0, 0);
      const feather = canvas(w, h);
      feather.ctx.filter = 'blur(' + (.6 * sx) + 'px)';
      feather.ctx.drawImage(limit.c, 0, 0);
      const coverage = feather.ctx.getImageData(0, 0, w, h).data;
      const output = canvas(w, h), mask = output.ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const px = i % w, py = Math.floor(i / w);
        const x = (px + .5) / w, y = (py + .5) / h;
        const outer = Math.max(1 - smooth(.22, .30, x), smooth(.70, .78, x));
        const lower = smooth(.60, .68, y);
        const clothing = !warmGuard[i] && pixels[i * 4 + 2] >= pixels[i * 4] - 8 ? 1 : 0;

        /*
         * v1.1 の唯一の見た目変更。
         * 右外側だけ、body被覆率の参照位置を外側へ最大0.9 CSS pxずらす。
         * その結果、表示されるhead制服の右縁を同量だけ内側へ寄せる。
         * x=.70から滑らかに開始し、左側・上60%・中央30〜70%・暖色保護はv1のまま。
         */
        const shift = smooth(.70, .78, x) * .9 * sx;
        const sampleX = Math.min(w - 1, px + shift);
        const x0 = Math.floor(sampleX), x1 = Math.min(w - 1, x0 + 1), mix = sampleX - x0;
        const a0 = coverage[(py * w + x0) * 4 + 3];
        const a1 = coverage[(py * w + x1) * 4 + 3];
        const coverageAlpha = (a0 + (a1 - a0) * mix) / 255;

        const weight = outer * lower * clothing;
        const keep = 1 - weight * (1 - coverageAlpha);
        mask.data[i * 4] = mask.data[i * 4 + 1] = mask.data[i * 4 + 2] = 255;
        mask.data[i * 4 + 3] = Math.round(255 * keep);
      }
      output.ctx.putImageData(mask, 0, 0);
      const value = originalMask + ', url("' + output.c.toDataURL('image/png') + '")';
      head.style.setProperty('-webkit-mask-image', value);
      head.style.setProperty('mask-image', value);
      head.style.setProperty('-webkit-mask-composite', 'source-in');
      head.style.setProperty('mask-composite', 'intersect');
      head.style.setProperty('-webkit-mask-size', '100% 100%, 100% 100%');
      head.style.setProperty('mask-size', '100% 100%, 100% 100%');
      head.style.setProperty('-webkit-mask-repeat', 'no-repeat, no-repeat');
      head.style.setProperty('mask-repeat', 'no-repeat, no-repeat');
      card.dataset.headSeamReady = 'true';
    } catch (error) {
      if (!disposed) {
        card.dataset.headSeamReady = 'error';
        console.error('[nanami-head-seam-v1.1]', error);
      }
    } finally {
      busy = false;
      if (dirty && !disposed) { dirty = false; schedule(); }
    }
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(() => { void update(); });
  };
  const resize = new ResizeObserver(schedule);
  [card, face, head, body].forEach(el => resize.observe(el));
  const mutation = new MutationObserver(schedule);
  mutation.observe(face, { attributes: true, attributeFilter: ['class'] });
  const images = [head, body];
  images.forEach(img => { img.addEventListener('load', schedule); img.addEventListener('error', schedule); });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    disposed = true; resize.disconnect(); mutation.disconnect();
    if (frame) cancelAnimationFrame(frame);
    images.forEach(img => { img.removeEventListener('load', schedule); img.removeEventListener('error', schedule); });
    window.removeEventListener('resize', schedule);
    for (const [p, value, priority] of saved) {
      if (value) head.style.setProperty(p, value, priority); else head.style.removeProperty(p);
    }
    delete card.dataset.headSeamV11; delete card.dataset.headSeamReady;
  };
}
