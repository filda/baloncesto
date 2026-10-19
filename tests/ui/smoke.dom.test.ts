// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountView } from "../../src/app/view";
import { newGame } from "../../src/app/match";

const handlers = () => ({
  onSubmit() {},
  onRemoveEntry() {},
  onNew() {},
  onAddPlace() {},
  onTeamName() {},
  onStart() {},
  onCancel() {},
  onHistory() {},
  onBack() {},
  onOpen() {},
  onDelete() {},
});

describe("DOM environment smoke test", () => {
  it("mounts the view and renders an empty game", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const view = mountView(root, handlers());
    view.render(newGame("g1", new Date("2026-01-01T10:00:00Z")), []);
    expect(root.querySelector("#estimate")).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>("#f-home-name")?.value).toBe("Home");
  });
});
