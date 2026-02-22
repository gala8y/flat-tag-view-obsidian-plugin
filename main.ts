import { Plugin, WorkspaceLeaf, MarkdownView, Editor, EditorPosition } from "obsidian";
import { FlatTagView } from "./flatTagView";
import { VIEW_TYPE } from "./constants";
import { getStyles } from "./styles";
import {
  FlatTagPluginSettings,
  DEFAULT_SETTINGS,
  FlatTagSettingTab,
  AltClickTagMode,
} from "./settings";

export default class FlatTagPlugin extends Plugin {
  settings: FlatTagPluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new FlatTagView(leaf, this));

    this.addRibbonIcon("tag", "Open Flat Tags", () => {
      this.activateView();
    });

    this.addSettingTab(new FlatTagSettingTab(this.app, this));

    this.addCommand({
      id: "open-flat-tags",
      name: "Open Flat Tags",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "toggle-flat-tag-sort",
      name: "Toggle Flat Tag Sort (A-Z/Usage)",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.toggleSort === "function") view.toggleSort();
      },
    });

    this.addCommand({
      id: "clear-flat-tag-selections",
      name: "Clear Flat Tag Selections",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.clearTagSelections === "function") view.clearTagSelections();
      },
    });

    this.addCommand({
      id: "clear-flat-tag-search",
      name: "Clear Flat Tag Search Box",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.clearSearchBox === "function") view.clearSearchBox();
      },
    });

    this.addCommand({
      id: "toggle-flat-tag-scope-mode",
      name: "Toggle Flat Tag Mode (Note/Line)",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.toggleScopeMode === "function") view.toggleScopeMode();
      },
    });

    this.addCommand({
      id: "toggle-flat-tag-task-mode",
      name: "Cycle Flat Tag Task Mode (All/Todo/Done)",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.toggleTaskMode === "function") view.toggleTaskMode();
      },
    });

    this.addStyle();

    // Alt-click in editor => create tag from selection/word
    this.registerDomEvent(document, "click", (evt: MouseEvent) => {
      if (!evt.altKey) return;
      void this.handleEditorAltClick(evt);
    });
  }

  private async handleEditorAltClick(evt: MouseEvent) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    // Only in source/editor mode (avoid preview)
    const anyView = view as any;
    if (typeof anyView.getMode === "function" && anyView.getMode() !== "source") return;

    const target = evt.target as Node | null;
    if (!target || !view.containerEl.contains(target)) return;

    const editor = view.editor;
    if (!editor) return;

    const candidate = this.getTagCandidate(editor);
    if (!candidate) return;

    await this.applyAltClickTagMode(editor, this.settings.altClickTagMode, candidate);
  }

  private getTagCandidate(
    editor: Editor
  ): { text: string; range?: { from: EditorPosition; to: EditorPosition } } | null {
    const sel = editor.getSelection();
    if (sel && sel.trim() && !/\r|\n/.test(sel)) {
      return { text: sel.trim() };
    }

    const cursor = editor.getCursor();
    const wordAt = (editor as any).wordAt?.(cursor);
    if (!wordAt) return null;

    const word = editor.getRange(wordAt.from, wordAt.to);
    if (!word || !word.trim()) return null;

    return { text: word.trim(), range: { from: wordAt.from, to: wordAt.to } };
  }

  private normalizeTagText(raw: string): string | null {
    let t = raw.trim();
    if (!t) return null;

    // Strip leading '#'
    t = t.replace(/^#+/, "");

    // Trim common surrounding punctuation
    t = t
      .replace(/^[\s\.,;:!\?\)\]\}\"\']+/, "")
      .replace(/[\s\.,;:!\?\(\[\{\"']+$/, "");
    if (!t) return null;

    // Disallow whitespace or internal '#'
    if (/\s/.test(t)) return null;
    if (t.includes("#")) return null;

    return t;
  }

  private async applyAltClickTagMode(
    editor: Editor,
    mode: AltClickTagMode,
    candidate: { text: string; range?: { from: EditorPosition; to: EditorPosition } }
  ) {
    const normalized = this.normalizeTagText(candidate.text);
    if (!normalized) return;

    const tagToken = `#${normalized}`;

    if (mode === "in-place") {
      if (editor.getSelection() && editor.getSelection().trim()) {
        editor.replaceSelection(tagToken);
        return;
      }
      if (candidate.range) {
        editor.replaceRange(tagToken, candidate.range.from, candidate.range.to);
      }
      return;
    }

    const line = editor.getCursor().line;
    const lineText = editor.getLine(line);

    if (mode === "start-line") {
      const { indent, tags, after } = this.parseLeadingTags(lineText);
      if (tags.includes(tagToken)) return;

      const nextTags = [...tags, tagToken].sort((a, b) => a.localeCompare(b, "pl"));
      const prefix = nextTags.length ? nextTags.join(" ") + (after.length ? " " : "") : "";

      editor.replaceRange(indent + prefix + after, { line, ch: 0 }, { line, ch: lineText.length });
      return;
    }

    if (mode === "end-line") {
      const { before, tags, trailingWs } = this.parseTrailingTags(lineText);
      if (tags.includes(tagToken)) return;

      const nextTags = [...tags, tagToken].sort((a, b) => a.localeCompare(b, "pl"));
      const joiner = before.length ? " " : "";
      const suffix = nextTags.length ? joiner + nextTags.join(" ") : "";

      editor.replaceRange(before + suffix + trailingWs, { line, ch: 0 }, { line, ch: lineText.length });
      return;
    }
  }

  private parseLeadingTags(lineText: string): { indent: string; tags: string[]; after: string } {
    const indent = (lineText.match(/^\s*/) ?? [""])[0];
    const rest = lineText.slice(indent.length);

    const m = rest.match(/^((?:#[^\s#]+\s+)*)/);
    const tagBlock = m?.[1] ?? "";
    const tags = tagBlock.match(/#[^\s#]+/g) ?? [];
    const after = rest.slice(tagBlock.length);

    return { indent, tags, after };
  }

  private parseTrailingTags(lineText: string): { before: string; tags: string[]; trailingWs: string } {
    const trimmedEnd = lineText.replace(/\s+$/, "");
    const trailingWs = lineText.slice(trimmedEnd.length);

    const m = trimmedEnd.match(/(\s+(?:#[^\s#]+\s*)+)$/);
    if (!m) return { before: trimmedEnd, tags: [], trailingWs };

    const tagBlock = m[1];
    const tags = tagBlock.match(/#[^\s#]+/g) ?? [];
    const before = trimmedEnd.slice(0, trimmedEnd.length - tagBlock.length);

    return { before, tags, trailingWs };
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.app.workspace.trigger("flat-tag-view:settings-updated");
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE });
      }
    }

    if (leaf) workspace.revealLeaf(leaf);
  }

  addStyle() {
    const styleEl = document.createElement("style");
    styleEl.innerHTML = getStyles();
    document.head.appendChild(styleEl);
  }
}
