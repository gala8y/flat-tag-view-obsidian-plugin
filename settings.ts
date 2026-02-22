import { App, PluginSettingTab, Setting } from "obsidian";
import FlatTagPlugin from "./main";

export type AltClickTagMode = "start-line" | "in-place" | "end-line";

export interface FlatTagPluginSettings {
  pinnedTags: string[];
  frequencyCutoff: number;
  frequencyCutoffEnabled: boolean;
  altClickTagMode: AltClickTagMode;
}

export const DEFAULT_SETTINGS: FlatTagPluginSettings = {
  pinnedTags: [],
  frequencyCutoff: 0, // 0 means show all tags
  frequencyCutoffEnabled: false,
  altClickTagMode: "start-line",
};

export class FlatTagSettingTab extends PluginSettingTab {
  plugin: FlatTagPlugin;

  constructor(app: App, plugin: FlatTagPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Alt-click creates tag")
      .setDesc(
        "When you Alt-click in the editor, create a tag from the current selection (or the word at cursor) using the chosen mode."
      )
      .addDropdown((dd) =>
        dd
          .addOption("start-line", "Put tag at start of line")
          .addOption("in-place", "Turn word into tag in place")
          .addOption("end-line", "Put tag at end of line")
          .setValue(this.plugin.settings.altClickTagMode)
          .onChange(async (value) => {
            this.plugin.settings.altClickTagMode = value as AltClickTagMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Frequency cutoff")
      .setDesc("Hide tags that appear fewer times than this number in the vault.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.frequencyCutoffEnabled)
          .onChange(async (value) => {
            this.plugin.settings.frequencyCutoffEnabled = value;
            await this.plugin.saveSettings();
          })
      )
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(this.plugin.settings.frequencyCutoff.toString())
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed >= 0) {
              this.plugin.settings.frequencyCutoff = parsed;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Clear pinned tags")
      .setDesc("Removes all pinned tags from the top of the flat tag list.")
      .addButton((btn) =>
        btn.setButtonText("Clear pinned").onClick(async () => {
          this.plugin.settings.pinnedTags = [];
          await this.plugin.saveSettings();
        })
      );
  }
}
