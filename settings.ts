

import { App, PluginSettingTab, Setting, AbstractInputSuggest, TFolder, setIcon, Modal, ExtraButtonComponent } from "obsidian";
import FlatTagPlugin from "./main";

// --- New Data Models ---
export interface ScopeFolder {
    path: string;
    included: boolean;
}

export interface Scope {
    id: string;
    name: string;
    folders: ScopeFolder[];
}

export type AltClickTagMode = "start-line" | "in-place" | "end-line";
export type PopupSortMode = "newest" | "alpha";
export type PopupResultCount = 5 | 10 | 20 | "max";

export interface FlatTagPluginSettings {
    pinnedTags: string[];
    frequencyCutoff: number;
    frequencyCutoffEnabled: boolean;
    altClickTagMode: AltClickTagMode;
    showPlacementInStatusBar: boolean;
    mobileLongPressEnabled: boolean;
    mobileLongPressMs: number;
    popupSortMode: PopupSortMode;
    popupResultCount: PopupResultCount;
    scopes: Scope[];
    scopesOn: boolean;
    lastScopeId: string | null;
}

export const DEFAULT_SETTINGS: FlatTagPluginSettings = {
    pinnedTags: [],
    frequencyCutoff: 0,
    frequencyCutoffEnabled: false,
    altClickTagMode: "start-line",
    showPlacementInStatusBar: true,
    mobileLongPressEnabled: true,
    mobileLongPressMs: 1000,
    popupSortMode: "newest",
    popupResultCount: 5,
    scopes: [],
    scopesOn: false,
    lastScopeId: null,
};

class ScopeDeleteConfirmModal extends Modal {
    scopeName: string;
    onConfirm: () => void;

    constructor(app: App, scopeName: string, onConfirm: () => void) {
        super(app);
        this.scopeName = scopeName;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Delete Scope" });

        contentEl.createEl("p", { text: `Are you sure you want to delete the scope "${this.scopeName}"?` });
        contentEl.createEl("p", { text: `This action cannot be undone.` });

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText("Cancel")
                .onClick(() => this.close())
            )
            .addButton((btn) => btn
                .setButtonText(`Delete Scope`)
                .setWarning()
                .onClick(() => {
                    this.onConfirm();
                    this.close();
                })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Folder Autocomplete ---
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    inputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl;
    }

    getSuggestions(inputStr: string): TFolder[] {
        const folders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
        const lowerCaseInputStr = inputStr.toLowerCase();
        return folders.filter((folder) => folder.path.toLowerCase().includes(lowerCaseInputStr));
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path);
    }

    selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
        this.inputEl.value = folder.path;
        this.inputEl.dispatchEvent(new Event("input"));
        this.close();
    }
}

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
            .onChange((value) => {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                    this.plugin.settings.frequencyCutoff = parsed;
                    this.plugin.requestSaveSettings();
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
        
        new Setting(containerEl)
            .setName("Editor tag operations")
            .setHeading();

        new Setting(containerEl)
            .setName("Alt-click tag placement/removal")
            .setDesc("When creating a tag, where it should go. (This impacts tag removal/deletion, too.")
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

        // --- Scopes UI ---
        new Setting(containerEl)
            .setName("Scopes")
            .setDesc("Create custom sets of included/excluded folders to dynamically filter the Flat Tag View. Use '/' to target files in root. First two scopes have direct hotkeys.")
            .setHeading();

        new Setting(containerEl)
            .setName("Add new scope")
            .addButton(btn => btn
                .setButtonText("Add scope")
                .setCta()
                .onClick(async () => {
                    const id = Date.now().toString();
                    this.plugin.settings.scopes = this.plugin.settings.scopes || [];
                    this.plugin.settings.scopes.push({ id, name: "New scope", folders: [] });
                    this.plugin.settings.lastScopeId = id;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        const scopes = this.plugin.settings.scopes || [];
        for (let i = 0; i < scopes.length; i++) {
            const scope = scopes[i];
            const scopeEl = containerEl.createDiv({ cls: "ftv-scope-container" });
            scopeEl.style.border = "1px solid var(--background-modifier-border)";
            scopeEl.style.padding = "10px";
            scopeEl.style.marginBottom = "10px";
            scopeEl.style.borderRadius = "5px";
            scopeEl.style.background = "var(--background-secondary)";

            new Setting(scopeEl)
                .setName("Scope name")
                .addText(text => text
                    .setValue(scope.name)
                    .onChange((val) => {
                        scope.name = val;
                        this.plugin.requestSaveSettings();
                    })
                )
                .addExtraButton(btn => btn
                    .setIcon("arrow-up")
                    .setTooltip("Move scope up")
                    .setDisabled(i === 0)
                    .onClick(async () => {
                        if (i > 0) {
                            [scopes[i], scopes[i - 1]] = [scopes[i - 1], scopes[i]];
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    })
                )
                .addExtraButton(btn => {
                    btn.setIcon("arrow-down")
                       .setTooltip("Move scope down")
                       .setDisabled(i === scopes.length - 1)
                       .onClick(async () => {
                           if (i < scopes.length - 1) {
                               [scopes[i], scopes[i + 1]] = [scopes[i + 1], scopes[i]];
                               await this.plugin.saveSettings();
                               this.display();
                           }
                       });
                    btn.extraSettingsEl.style.marginRight = "12px"; // Space before delete
                    return btn;
                })
                .addExtraButton(btn => btn
                    .setIcon("trash")
                    .setTooltip("Delete scope")
                    .onClick(() => {
                        new ScopeDeleteConfirmModal(this.app, scope.name, async () => {
                            scopes.splice(i, 1);
                            if (this.plugin.settings.lastScopeId === scope.id) {
                                this.plugin.settings.lastScopeId = scopes.length > 0 ? scopes[0].id : null;
                                this.plugin.settings.scopesOn = false;
                            }
                            await this.plugin.saveSettings();
                            this.display();
                        }).open();
                    })
                );

            const foldersContainer = scopeEl.createDiv();

            for (let j = 0; j < scope.folders.length; j++) {
                const folder = scope.folders[j];
                
                // Using valid property mapping, assign styles directly to the element instance
                const folderRow = foldersContainer.createDiv();
                folderRow.style.display = "flex";
                folderRow.style.alignItems = "center";
                folderRow.style.marginBottom = "6px";

                const input = folderRow.createEl("input", { type: "text", value: folder.path, placeholder: "Folder path (e.g. 'Notes' or '/')" });
                input.style.flex = "1";
                input.style.marginRight = "12px"; // Space after input
                
                new FolderSuggest(this.app, input);
                input.addEventListener("input", () => {
                    folder.path = input.value;
                    this.plugin.requestSaveSettings();
                });

                const toggleBtn = new ExtraButtonComponent(folderRow)
                    .setIcon(folder.included ? "folder-plus" : "folder-minus")
                    .setTooltip(folder.included ? "Included (Click to exclude)" : "Excluded (Click to include)")
                    .onClick(async () => {
                        folder.included = !folder.included;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                toggleBtn.extraSettingsEl.style.color = folder.included ? "var(--color-green)" : "var(--color-red)";
                toggleBtn.extraSettingsEl.style.marginRight = "12px"; // Space after incl/excl icon

                new ExtraButtonComponent(folderRow)
                    .setIcon("arrow-up")
                    .setTooltip("Move rule up")
                    .setDisabled(j === 0)
                    .onClick(async () => {
                        if (j > 0) {
                            [scope.folders[j], scope.folders[j - 1]] = [scope.folders[j - 1], scope.folders[j]];
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    });

                const downBtn = new ExtraButtonComponent(folderRow)
                    .setIcon("arrow-down")
                    .setTooltip("Move rule down")
                    .setDisabled(j === scope.folders.length - 1)
                    .onClick(async () => {
                        if (j < scope.folders.length - 1) {
                            [scope.folders[j], scope.folders[j + 1]] = [scope.folders[j + 1], scope.folders[j]];
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    });
                downBtn.extraSettingsEl.style.marginRight = "12px"; // Space after up/down arrows

                new ExtraButtonComponent(folderRow)
                    .setIcon("folder-x")
                    .setTooltip("Delete folder rule")
                    .onClick(async () => {
                        scope.folders.splice(j, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    });
            }

            new Setting(scopeEl)
                .addButton(btn => btn
                    .setButtonText("Add Folder Rule")
                    .onClick(async () => {
                        scope.folders.push({ path: "", included: true });
                        await this.plugin.saveSettings();
                        this.display();
                    })
                );
        }
    }
}




