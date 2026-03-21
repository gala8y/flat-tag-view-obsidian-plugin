


import { App, Modal } from "obsidian";

export class HelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Flat Tags Interactions" });

        const list = contentEl.createEl("ul", { cls: "flat-tag-help-list" });
        list.createEl("li", { text: "Left-Click: Filter by tag" });
        list.createEl("li", { text: "Ctrl/Cmd + Click: Multi-select tags" });
        list.createEl("li", { text: "Shift + Click: Exclude tag" });
        list.createEl("li", { text: "Alt + Click: Pin tag to top" });
        list.createEl("li", { text: "Right-Click: Global Mute/Unmute (with confirmation)" });
        list.createEl("li", { text: "Shift + Hover (or CapsLock): Preview matching files" });

        contentEl.createEl("h3", { text: "Scope Filtering" });
        contentEl.createEl("p", { text: "Click the Shapes icon to turn scope filtering On/Off. Click the scope name text next to it to switch between scopes or manage them." });
    }

    onClose() {
        this.contentEl.empty();
    }
}





