/*
 * v23 のカード組み込み処理（七海の一時組み込み）。
 *
 * 受領物 kotoba-screen-reference-v23-compact.zip の attach-card.ts を写し、
 * 対象を七海（middle-f-01）だけに絞ったもの。大地の1行を外し、
 * それに伴って人物の区分を 'f' に固定した以外、処理は変えていない。
 * 一時確認用で、恒久の組み込みではない。
 */
/** List-only mount: adopted head stays in the foreground; inner rim is blurred. */
export function attachCardReferenceV23(card: HTMLElement, avatarId: string): void {
  // 一時組み込みの対象は七海（middle-f-01）だけ。大地の行は入れていない。
  const sources: Record<string, string> = {
    'middle-f-01': '/kotoba-journey/assets/avatars/reference-v23/body-f.png',
  };
  const src = sources[avatarId];
  if (!src || card.dataset.referenceV23 === 'true') return;
  const face = card.querySelector<HTMLElement>('.avatar-thumb__face');
  const head = face?.querySelector<HTMLImageElement>('.avatar-thumb__img');
  const thumb = card.querySelector<HTMLElement>('.avatar-thumb');
  if (!face || !head || !thumb) return;
  card.dataset.referenceV23 = 'true';
  card.dataset.referencePerson = 'f';
  head.classList.add('reference-v23-head');
  const body = document.createElement('img');
  body.className = 'reference-v23-body';
  body.src = src;
  body.alt = '';
  body.decoding = 'async';
  const sharp = document.createElement('span');
  sharp.className = 'reference-v23-scene reference-v23-sharp';
  sharp.append(body, head);
  const soft = document.createElement('span');
  soft.className = 'reference-v23-scene reference-v23-soft';
  soft.setAttribute('aria-hidden', 'true');
  const content = document.createElement('span');
  content.className = 'reference-v23-soft-content';
  content.append(body.cloneNode(true), head.cloneNode(true));
  soft.append(content);
  face.append(sharp, soft);
  const frost = document.createElement('span');
  frost.className = 'reference-v23-frost';
  frost.setAttribute('aria-hidden', 'true');
  thumb.append(frost);
  const rollback = (): void => {
    face.append(head);
    head.classList.remove('reference-v23-head');
    sharp.remove(); soft.remove(); frost.remove();
    delete card.dataset.referenceV23;
    delete card.dataset.referencePerson;
  };
  body.addEventListener('error', rollback, { once: true });
  head.addEventListener('error', rollback, { once: true });
}
