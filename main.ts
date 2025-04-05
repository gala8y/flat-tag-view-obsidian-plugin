import { Plugin, WorkspaceLeaf } from "obsidian";
import { FlatTagView } from "./flatTagView";
import { VIEW_TYPE } from "./constants";
import { getStyles } from "./styles";

export default class FlatTagPlugin extends Plugin {
  async onload() {
    this.registerView(
      VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new FlatTagView(leaf)
    );

    this.addRibbonIcon("tag", "Open Flat Tags", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-flat-tags",
      name: "Open Flat Tags",
      callback: () => {
        this.activateView();
      },
    });

    // Add commands for hotkeys
    this.addCommand({
      id: "toggle-flat-tag-sort",
      name: "Toggle Flat Tag Sort (A-Z/Usage)",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view) view.toggleSort();
      },
    });

    this.addCommand({
      id: "clear-flat-tag-selections",
      name: "Clear Flat Tag Selections",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view) view.clearTagSelections();
      },
    });

    this.addCommand({
      id: "toggle-flat-tag-single-use",
      name: "Toggle Flat Tag Single Use",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view) view.toggleSingleUseTags();
      },
    });

    this.addCommand({
      id: "toggle-flat-tag-alphabet",
      name: "Toggle Flat Tag Alphabet Letters",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view) view.toggleAlphabetLetters();
      },
    });

    this.addCommand({
      id: "clear-flat-tag-search",
      name: "Clear Flat Tag Search Box",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view) view.clearSearchBox();
      },
    });

    this.addStyle();
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
    
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  addStyle() {
    const styleEl = document.createElement("style");
    styleEl.innerHTML = getStyles();
    document.head.appendChild(styleEl);
  }
}

