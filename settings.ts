import { App, PluginSettingTab, Setting } from "obsidian";
import FlatTagPlugin from "./main";

export type AltClickTagMode = "start-line" | "in-place" | "end-line";

export interface FlatTagPluginSettings {
	pinnedTags: string[];
	frequencyCutoff: number;
	frequencyCutoffEnabled: boolean;

	altClickTagMode: AltClickTagMode;
	
	showPlacementInStatusBar: boolean;
	
	mobileLongPressEnabled: boolean;
	mobileLongPressMs: number;
}

export const DEFAULT_SETTINGS: FlatTagPluginSettings = {
	pinnedTags: [],
	frequencyCutoff: 0,
	frequencyCutoffEnabled: false,

	altClickTagMode: "start-line",

	showPlacementInStatusBar: true,

	mobileLongPressEnabled: true,
	mobileLongPressMs: 1000,
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
			.setName("Alt-click tag placement")
			.setDesc("When creating a tag, where it should go.")
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
			.setName("Show placement of newly created tags in status bar")
			.setDesc("Displays SOL / INP / EOL in the Obsidian status bar.")
			.addToggle(t => t
				.setValue(this.plugin.settings.showPlacementInStatusBar)
				.onChange(async (val) => {
					this.plugin.settings.showPlacementInStatusBar = val;
					await this.plugin.saveSettings();
				})
			);
		// TODO: re-enable when mobile touch handling is stable	
		// new Setting(containerEl)
		// 	.setName("Mobile long-press")
		// 	.setDesc("On mobile, a long-press can trigger the same action as Alt-click (works best when text is selected).")
		// 	.addToggle((toggle) =>
		// 		toggle.setValue(this.plugin.settings.mobileLongPressEnabled).onChange(async (value) => {
		// 			this.plugin.settings.mobileLongPressEnabled = value;
		// 			await this.plugin.saveSettings();
		// 		})
		// 	);

		// new Setting(containerEl)
		// 	.setName("Mobile long-press duration (ms)")
		// 	.setDesc("Range: 250–5000. Default: 1000.")
		// 	.addText((text) =>
		// 		text
		// 			.setPlaceholder("1000")
		// 			.setValue(String(this.plugin.settings.mobileLongPressMs ?? 1000))
		// 			.onChange(async (value) => {
		// 				const parsed = parseInt(value, 10);
		// 				if (!isNaN(parsed)) {
		// 					this.plugin.settings.mobileLongPressMs = Math.max(250, Math.min(5000, parsed));
		// 					await this.plugin.saveSettings();
		// 				}
		// 			})
		// 	);

		new Setting(containerEl)
			.setName("Frequency cutoff")
			.setDesc("Hide tags that appear fewer times than this number in the vault.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.frequencyCutoffEnabled).onChange(async (value) => {
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
