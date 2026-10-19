// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, el, selectOnFocus } from "../../src/app/view/dom";

describe("el and button", () => {
  it("creates elements with class and text", () => {
    const node = el("p", "a b", "hi");
    expect(node.tagName).toBe("P");
    expect(node.className).toBe("a b");
    expect(node.textContent).toBe("hi");
    expect(el("p").className).toBe("");
    expect(el("p", "", "").textContent).toBe("");
  });

  it("creates plain buttons with optional id and click handler", () => {
    const onClick = vi.fn();
    const node = button("x", "Go", onClick, "go");
    expect(node.type).toBe("button");
    expect(node.id).toBe("go");
    node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    const bare = button("x", "Go");
    expect(bare.id).toBe("");
    expect(() => bare.click()).not.toThrow();
  });
});

describe("selectOnFocus", () => {
  let input: HTMLInputElement;
  let select: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    input = document.createElement("input");
    input.value = "12:34";
    document.body.replaceChildren(input);
    selectOnFocus(input);
    select = vi.spyOn(input, "select");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mouseup = () => {
    const event = new MouseEvent("mouseup", { bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event;
  };

  it("selects the whole text on focus", () => {
    input.focus();
    expect(select).toHaveBeenCalledTimes(1);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it("selects again after the tap (next frame and next tick)", () => {
    input.focus();
    vi.runAllTimers();
    expect(select).toHaveBeenCalledTimes(3);
  });

  it("swallows the mouseup that follows the focus", () => {
    input.focus();
    expect(mouseup().defaultPrevented).toBe(true);
  });

  it("lets later mouseups through so the caret can be placed", () => {
    input.focus();
    vi.runAllTimers();
    expect(mouseup().defaultPrevented).toBe(false);
  });

  it("does not swallow a mouseup after blur", () => {
    input.focus();
    input.blur();
    expect(mouseup().defaultPrevented).toBe(false);
  });

  it("does not swallow a mouseup before the first focus", () => {
    expect(mouseup().defaultPrevented).toBe(false);
  });
});
