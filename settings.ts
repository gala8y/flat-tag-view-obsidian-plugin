import { App, PluginSettingTab, Setting } from "obsidian";
import FlatTagPlugin from "./main";

export interface FlatTagPluginSettings {
  pinnedTags: string[];
  frequencyCutoff: number;
}

export const DEFAULT_SETTINGS: FlatTagPluginSettings = {
  pinnedTags: [],
  frequencyCutoff: 0, // 0 means show all tags
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
      .setName("Frequency Cutoff")
      .setDesc("Hide tags that appear fewer times than this number in the vault. 0 means show all tags.")
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
      .setName("Clear Pinned Tags")
      .setDesc("Removes all pinned tags from the top of the flat tag list.")
      .addButton((btn) =>
        btn
          .setButtonText("Clear Pinned")
          .onClick(async () => {
            this.plugin.settings.pinnedTags = [];
            await this.plugin.saveSettings();
          })
      );
  }
}
