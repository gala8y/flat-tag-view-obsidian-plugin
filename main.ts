import { Plugin, WorkspaceLeaf } from "obsidian";
import { FlatTagView } from "./flatTagView";
import { VIEW_TYPE } from "./constants";
import { getStyles } from "./styles";
import { FlatTagPluginSettings, DEFAULT_SETTINGS, FlatTagSettingTab } from "./settings";

export default class FlatTagPlugin extends Plugin {
  settings: FlatTagPluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE,
      // Pass 'this' so the view can access settings and save data
      (leaf: WorkspaceLeaf) => new FlatTagView(leaf, this)
    );

    this.addRibbonIcon("tag", "Open Flat Tags", () => {
      this.activateView();
    });

    this.addSettingTab(new FlatTagSettingTab(this.app, this));

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
        if (view && typeof view.toggleSort === 'function') view.toggleSort();
      },
    });

    this.addCommand({
      id: "clear-flat-tag-selections",
      name: "Clear Flat Tag Selections",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.clearTagSelections === 'function') view.clearTagSelections();
      },
    });

    this.addCommand({
      id: "clear-flat-tag-search",
      name: "Clear Flat Tag Search Box",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.clearSearchBox === 'function') view.clearSearchBox();
      },
    });

    this.addCommand({
      id: "toggle-flat-tag-scope-mode",
      name: "Toggle Flat Tag Mode (Note/Line)",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.toggleScopeMode === 'function') view.toggleScopeMode();
      },
    });

    this.addCommand({
      id: "toggle-flat-tag-task-mode",
      name: "Cycle Flat Tag Task Mode (All/Todo/Done)",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
        if (view && typeof view.toggleTaskMode === 'function') view.toggleTaskMode();
      },
    });

    this.addStyle();
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
