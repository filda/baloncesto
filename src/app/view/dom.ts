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

/**
 * Selects the existing text when the input gets focus so typing overwrites it. On touch devices
 * the tap's mouseup/click would collapse the selection again, so select once more after the tap
 * (next frame and next tick) and swallow the first mouseup following the focus.
 */
export function selectOnFocus(input: HTMLInputElement): void {
  let justFocused = false;
  input.addEventListener("focus", () => {
    justFocused = true;
    input.select();
    requestAnimationFrame(() => input.select());
    setTimeout(() => {
      input.select();
      justFocused = false;
    }, 0);
  });
  input.addEventListener("mouseup", (event) => {
    if (justFocused) event.preventDefault();
  });
  input.addEventListener("blur", () => {
    justFocused = false;
  });
}
