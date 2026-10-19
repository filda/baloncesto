export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(
  className: string,
  text: string,
  onClick?: () => void,
  id?: string,
): HTMLButtonElement {
  const node = el("button", className, text);
  node.type = "button";
  if (id) node.id = id;
  if (onClick) node.addEventListener("click", onClick);
  return node;
}
