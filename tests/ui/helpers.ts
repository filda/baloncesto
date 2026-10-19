import { vi } from "vitest";
import { newGame } from "../../src/app/match";
import type { Game } from "../../src/app/match";
import type { Snapshot } from "../../src/domain/predict";

/** Replaces the document body content with the given nodes and returns their container. */
export function attach(...nodes: HTMLElement[]): HTMLElement {
  const root = document.createElement("div");
  root.append(...nodes);
  document.body.replaceChildren(root);
  return root;
}

export function gameWith(snapshots: Snapshot[], id = "g1", extra: Partial<Game> = {}): Game {
  return { ...newGame(id, new Date("2026-01-01T10:00:00Z")), snapshots, ...extra };
}

export function $<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

export function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function submit(form: Element): Event {
  const event = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

export function click(node: Element): void {
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

export function spies() {
  return {
    onSubmit: vi.fn(),
    onRemoveEntry: vi.fn(),
    onNew: vi.fn(),
    onAddPlace: vi.fn(),
    onTeamName: vi.fn(),
    onStart: vi.fn(),
    onCancel: vi.fn(),
    onHistory: vi.fn(),
    onBack: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
  };
}
