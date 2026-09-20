/** 最小限のDOMヘルパー。UIフレームワークは使わない方針のため自前で用意する。 */

type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  options: { class?: string; disabled?: boolean; ariaLabel?: string } = {},
): HTMLButtonElement {
  const node = el('button', {
    type: 'button',
    class: options.class ?? 'btn',
    disabled: options.disabled,
    'aria-label': options.ariaLabel,
  });
  node.textContent = label;
  // disabled は属性で無効化されるので、ハンドラは常に付けておく。
  // こうしないと、あとから disabled を外しても反応しないボタンになる。
  node.addEventListener('click', onClick);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
