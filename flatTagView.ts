import {
	ItemView,
	Platform,
	setIcon,
	TFile,
	WorkspaceLeaf,
	Notice,
	Modal,
	App,
	Setting,
	ButtonComponent,
	Menu,
	MarkdownView,
} from "obsidian";
import { VIEW_TYPE } from "./constants";
import FlatTagPlugin from "./main";
import { PopupSortMode, PopupResultCount } from "./settings";
import { TagIndex } from "./TagIndex";

type SortMode = "az" | "count";
type SearchMode = "note" | "line" | "task" | "task-todo" | "task-done";

type HoverPreviewMode = "files" | "tasks";
type TaskState = "todo" | "done" | "other";

type PopupFileResult = { file: TFile; folder: string };
type PopupTaskResult = { file: TFile; lineNumber: number; taskText: string };

class GlobalMuteConfirmModal extends Modal {
	tagToMute: string;
	onConfirm: () => void;

	constructor(app: App, tagToMute: string, onConfirm: () => void) {
		super(app);
		this.tagToMute = tagToMute;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Global Mute Tag" });

		const isCurrentlyMuted = this.tagToMute.startsWith("%");
		const targetState = isCurrentlyMuted ? "UN-MUTE" : "MUTE";
		const resultingTag = isCurrentlyMuted ? this.tagToMute.slice(1) : `%${this.tagToMute}`;

		contentEl.createEl("p", {
			text: `Are you sure you want to globally ${targetState} the tag #${this.tagToMute}?`,
		});
		contentEl.createEl("p", {
			text: `This will search your entire vault and change every instance of #${this.tagToMute} to #${resultingTag}. This action modifies your files and cannot be easily undone.`,
		});

		new Setting(contentEl)
			.addButton((btn: ButtonComponent) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn: ButtonComponent) =>
				btn
					.setButtonText(`Yes, ${targetState} Globally`)
					.setCta()
					.onClick(() => {
						this.onConfirm();
						this.close();
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class FlatTagView extends ItemView {
	public plugin: FlatTagPlugin;
	public tagIndex: TagIndex;

	private container!: HTMLElement;
	private tagContainer!: HTMLElement;

	private sortContainer!: HTMLElement;
	private sortAzBtn!: HTMLElement;
	private sortCountBtn!: HTMLElement;
	private notelineBtn!: HTMLElement;
	private taskBtn!: HTMLElement;
	private cutoffToggleBtn!: HTMLElement;
	private cutoffInput!: HTMLInputElement;

	private selectedTags: Set<string> = new Set();
	private excludedTags: Set<string> = new Set();

	private currentSort: SortMode = "az";
	private searchMode: SearchMode = "note";
	private tagSearchText = "";

	private scopesOn = false;
	private activeScopeId: string | null = null;

	private touchTimer: number | null = null;
	private lastInteractionWasTouch = false;
	private renderId = 0;

	private touchHandled = false;
	private touchStartX = 0;
	private touchStartY = 0;
	private isSwiping = false;
	private longPressTriggered = false;
	private activeTouchTagEl: HTMLElement | null = null;

	private hoverFocusPrevLeaf: WorkspaceLeaf | null = null;
	private hoverFocusArmed = false;

	private hoverPreviewEl: HTMLElement | null = null;
	private hoverPreviewTimer: number | null = null;
	private hoverPreviewHovered = false;
	private hoverPreviewAnchorEl: HTMLElement | null = null;
	private hoverLeaveTimer: number | null = null;

	private shiftHeld = false;
	private capsLockOn = false;
	private altHeld = false;
	private hoveredTag: { el: HTMLElement; tag: string } | null = null;
	private lastPreviewKey: string | null = null;
	private resizeListener: (() => void) | null = null;
	private skipNextSettingsRender = false;

	private helpPopupEl: HTMLElement | null = null;
	private helpCleanup: (() => void) | null = null;

	private scopesToggleBtn!: HTMLElement;
	private scopesText!: HTMLElement;

	private renderTagsCallback = () => this.renderTags();

    private taskPressTimer: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FlatTagPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.tagIndex = TagIndex.getInstance(plugin.app);
		this.containerEl.addClass("flat-tag-view");
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Flat Tags";
	}

	getIcon(): string {
		return "tag";
	}

	async onOpen() {
		this.tagIndex.onUpdate.add(this.renderTagsCallback);

		this.container = this.contentEl.createDiv({ cls: "flat-tag-container" });

		this.containerEl.addEventListener(
			"touchstart",
			() => {
				this.lastInteractionWasTouch = true;
			},
			{ passive: true }
		);

		this.containerEl.addEventListener(
			"pointerdown",
			(e: PointerEvent) => {
				if (e.pointerType && e.pointerType !== "touch") this.lastInteractionWasTouch = false;
			},
			{ passive: true }
		);

		this.sortContainer = this.container.createDiv({ cls: "flat-tag-sort-container" });
		const buttonSection = this.sortContainer.createDiv({ cls: "flat-tag-buttons-section" });

		this.sortAzBtn = buttonSection.createDiv({
			cls: "flat-tag-sort-button",
			title: "Sort A-Z",
		});
		setIcon(this.sortAzBtn, "lucide-sort-asc");

		this.sortCountBtn = buttonSection.createDiv({
			cls: "flat-tag-sort-button",
			title: "Sort by usage",
		});
		setIcon(this.sortCountBtn, "lucide-bar-chart-2");

		const clearButton = buttonSection.createDiv({
			cls: "flat-tag-clear-button",
			title: "Clear tag selections",
		});
		setIcon(clearButton, "x");
		clearButton.addEventListener("click", () => this.clearTagSelections());

		this.notelineBtn = buttonSection.createDiv({
			cls: "flat-tag-mode-button",
			text: "NOTE",
			title: "Click to cycle: Note -> Line",
		});

		this.taskBtn = buttonSection.createDiv({ 
			cls: "flat-tag-mode-button", 
			text: "TASK-ALL", 
			title: "Click: Toggle ALL / TODO | Long Press (1s): DONE" 
		});


		let taskLongPressed = false;

		this.taskBtn.addEventListener("pointerdown", (e) => {
			// Only react to primary (left) mouse clicks
			if (e.pointerType === "mouse" && e.button !== 0) return; 
			
			taskLongPressed = false;
			if (this.taskPressTimer) window.clearTimeout(this.taskPressTimer);
			
			// Start the 1000ms long-press timer
			this.taskPressTimer = window.setTimeout(() => {
				taskLongPressed = true;
				this.searchMode = "task-done";
				this.updateModeUI(); // Automatically triggers render and search!
				new Notice("Task Mode: DONE"); // Gives visual feedback that the long press worked
			}, 1000); 
		});

		this.taskBtn.addEventListener("pointerup", (e) => {
			if (e.pointerType === "mouse" && e.button !== 0) return;
			if (this.taskPressTimer) window.clearTimeout(this.taskPressTimer);
			
			// If released BEFORE 1000ms, do the normal ALL <-> TODO toggle
			if (!taskLongPressed) {
				if (this.searchMode === "task" || this.searchMode === "task-done") {
					this.searchMode = "task-todo";
				} else {
					this.searchMode = "task";
				}
				this.updateModeUI();
			}
		});

		// Cancel the long press if the user clicks but drags the mouse off the button
		this.taskBtn.addEventListener("pointerleave", () => {
			if (this.taskPressTimer) window.clearTimeout(this.taskPressTimer);
		});

		this.taskBtn.addEventListener("pointercancel", () => {
	    	if (this.taskPressTimer) window.clearTimeout(this.taskPressTimer);
		});


		// Optional: Prevent the browser context menu from popping up if held too long on touch devices
		this.taskBtn.addEventListener("contextmenu", (e) => {
			e.preventDefault();
		});


		const scopeSection = buttonSection.createDiv({ cls: "flat-tag-scope-section" });
		this.scopesToggleBtn = scopeSection.createDiv({
			cls: "flat-tag-scope-toggle",
			title: "Toggle scopes On/Off",
		});
		setIcon(this.scopesToggleBtn, "shapes");
		this.scopesText = scopeSection.createDiv({ cls: "flat-tag-scope-text" });

		this.scopesToggleBtn.addEventListener("click", () => {
			this.scopesOn = !this.scopesOn;
			this.syncScopesUI();
			void this.renderTags();
			void this.updateSearch();
		});

		this.scopesText.addEventListener("click", (e) => {
			const menu = new Menu();

			menu.addItem((item) =>
				item.setTitle("Entire vault").setIcon("globe").onClick(() => {
					this.scopesOn = false;
					this.syncScopesUI();
					void this.renderTags();
					void this.updateSearch();
				})
			);

			menu.addSeparator();

			const customSortedScopes = this.plugin.settings.scopes || [];
			customSortedScopes.forEach((scope, index) => {
				let displayTitle = scope.name;
				if (index === 0) displayTitle = `1. ${scope.name}`;
				else if (index === 1) displayTitle = `2. ${scope.name}`;

				menu.addItem((item) =>
					item
						.setTitle(displayTitle)
						.setIcon("shapes")
						.onClick(() => {
							this.scopesOn = true;
							this.activeScopeId = scope.id;
							this.syncScopesUI();
							void this.renderTags();
							void this.updateSearch();
						})
				);
			});

			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle("Manage scopes...").setIcon("settings").onClick(() => {
					(this.app as any).setting.open();
					(this.app as any).setting.openTabById(this.plugin.manifest.id);
				})
			);

			menu.showAtMouseEvent(e);
		});

		const cutoffSpacer = buttonSection.createDiv({ cls: "flat-tag-cutoff-spacer" });
		cutoffSpacer.ariaHidden = "true";

		const cutoffSection = buttonSection.createDiv({ cls: "flat-tag-cutoff-section" });
		this.cutoffToggleBtn = cutoffSection.createDiv({
			cls: "flat-tag-cutoff-toggle",
			title: "Toggle frequency cutoff",
		});
		this.cutoffInput = cutoffSection.createEl("input", {
			cls: "flat-tag-cutoff-input",
			attr: {
				type: "number",
				min: "0",
				step: "1",
				inputmode: "numeric",
				placeholder: "0",
			},
		});

		this.cutoffToggleBtn.addEventListener("click", async () => {
			this.plugin.settings.frequencyCutoffEnabled = !this.plugin.settings.frequencyCutoffEnabled;
			await this.plugin.saveSettings();
			this.syncCutoffControlsFromSettings();
			void this.renderTags();
		});

		this.cutoffInput.addEventListener("input", () => {
			const parsed = parseInt(this.cutoffInput.value, 10);
			if (!isNaN(parsed) && parsed >= 0) {
				this.plugin.settings.frequencyCutoff = parsed;
				this.plugin.requestSaveSettings();
				void this.renderTags();
			}
		});

		this.sortAzBtn.addEventListener("click", () => {
			if (this.currentSort === "az") {
				const vaultName = this.app.vault.getName();
				const count = Object.keys((this.app.metadataCache as any).getTags()).length;
				new Notice(`${vaultName}: ${count} unique tags`);
			} else {
				this.currentSort = "az";
				this.updateModeUI(true);
			}
		});

		this.sortCountBtn.addEventListener("click", () => {
			if (this.currentSort === "count") {
				const vaultName = this.app.vault.getName();
				const count = Object.keys((this.app.metadataCache as any).getTags()).length;
				new Notice(`${vaultName}: ${count} unique tags`);
			} else {
				this.currentSort = "count";
				this.updateModeUI(true);
			}
		});

		this.notelineBtn.addEventListener("click", () => this.toggleNoteLineMode());

		this.tagContainer = this.container.createDiv({ cls: "flat-tag-list" });
		this.initDelegatedListeners();

		const bottomContainer = this.container.createDiv({ cls: "flat-tag-bottom-container" });

		const searchSection = bottomContainer.createDiv({ cls: "flat-tag-search-section" });
		const searchBox = searchSection.createEl("input", {
			cls: "flat-tag-search-input",
			attr: { type: "text", placeholder: "Search tags..." },
		});
		const clearSearchButton = searchSection.createDiv({
			cls: "flat-tag-search-clear-button",
			title: "Clear search",
		});
		setIcon(clearSearchButton, "square-x");

		clearSearchButton.addEventListener("click", () => this.clearSearchBox());
		searchBox.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			this.tagSearchText = target.value ?? "";
			void this.renderTags();
		});

		searchBox.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				this.clearSearchBox();
				searchBox.blur();
				this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
			}
		});

		const actionsSection = bottomContainer.createDiv({ cls: "flat-tag-bottom-actions" });

		const settingsButton = actionsSection.createDiv({
			cls: "flat-tag-bottom-button",
			title: "Settings",
		});
		setIcon(settingsButton, "settings");
		settingsButton.addEventListener("click", () => {
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById(this.plugin.manifest.id);
		});

		const helpButton = actionsSection.createDiv({
			cls: "flat-tag-bottom-button",
			title: "Help",
		});
		setIcon(helpButton, "help-circle");
		helpButton.addEventListener("click", () => {
			this.showHelpPopup(helpButton);
		});

		this.registerDomEvent(this.containerEl, "mouseenter", (evt: MouseEvent) => {
			if (Platform.isMobile) return;
			if ((evt as any).buttons > 0) return;

			const ws = this.app.workspace;
			const cur = ws.activeLeaf;
			if (cur?.view === this) return;

			this.hoverFocusPrevLeaf = cur ?? null;
			this.hoverFocusArmed = true;
			ws.setActiveLeaf(this.leaf, { focus: true });
		});

		this.registerDomEvent(
			this.containerEl,
			"pointerdown",
			() => {
				this.hoverFocusArmed = false;
			},
			{ passive: true }
		);

		this.registerDomEvent(this.containerEl, "mouseleave", () => {
			if (Platform.isMobile) return;

			this.beginLeaveTimer();

			if (!this.hoverFocusArmed) return;

			const ws = this.app.workspace;
			if (ws.activeLeaf?.view !== this) return;

			const prev = this.hoverFocusPrevLeaf;
			this.hoverFocusArmed = false;
			this.hoverFocusPrevLeaf = null;

			if (prev) ws.setActiveLeaf(prev, { focus: true });
		});

		this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
			if (this.app.workspace.activeLeaf?.view !== this) return;

			const t = evt.target as HTMLElement;
			if (t && t.closest("input, textarea, [contenteditable='true']")) return;
			if (evt.ctrlKey || evt.metaKey || evt.altKey) return;

			if (evt.shiftKey && (evt.code === "Digit1" || evt.code === "Numpad1")) {
				evt.preventDefault();
				this.tagContainer?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
				return;
			}

			if (evt.shiftKey && (evt.code === "Digit0" || evt.code === "Numpad0")) {
				evt.preventDefault();
				const c = this.tagContainer;
				if (!c) return;
				c.scrollTo({
					top: Math.max(0, c.scrollHeight - c.clientHeight),
					behavior: "instant" as ScrollBehavior,
				});
				return;
			}

			const caps = evt.getModifierState?.("CapsLock") ?? false;

			if (evt.shiftKey || caps) {
				if (evt.key.length !== 1) return;
				const ch = evt.key.toUpperCase();
				if (!/^\p{L}$/u.test(ch)) return;

				evt.preventDefault();
				this.scrollHeaderToOneThird(ch);
				return;
			}

			if (evt.key === "Backspace") {
				evt.preventDefault();
				if (this.tagSearchText.length > 0) {
					this.tagSearchText = this.tagSearchText.slice(0, -1);
					const searchInput = this.container.querySelector(
						".flat-tag-search-input"
					) as HTMLInputElement | null;
					if (searchInput) searchInput.value = this.tagSearchText;
					void this.renderTags();
				}
				return;
			}

			if (evt.key === "Escape") {
				if (this.tagSearchText.length > 0) {
					evt.preventDefault();
					evt.stopPropagation();
					this.clearSearchBox();
					this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
				}
				return;
			}

			if (evt.key.length === 1) {
				if (/[^\\s"'`\]\[{}()=+\\|,<.>!?:;*&^@#%]/.test(evt.key)) {
					evt.preventDefault();
					this.tagSearchText += evt.key;

					const searchInput = this.container.querySelector(
						".flat-tag-search-input"
					) as HTMLInputElement | null;

					if (searchInput) {
						searchInput.value = this.tagSearchText;
						searchInput.classList.remove("ftv-pulse");
						void searchInput.offsetWidth;
						searchInput.classList.add("ftv-pulse");
					}

					void this.renderTags();
				}
			}
		});

		this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
			if (this.app.workspace.activeLeaf?.view !== this) return;

			this.altHeld = evt.altKey;

			if (evt.key === "CapsLock") {
				this.capsLockOn = !this.capsLockOn;
			} else {
				this.capsLockOn = evt.getModifierState?.("CapsLock") ?? false;
			}

			if (evt.key === "Shift") this.shiftHeld = true;

			if (evt.ctrlKey || evt.metaKey) {
				this.clearHoverPreview();
				this.lastPreviewKey = null;
				return;
			}

			const armed = this.shiftHeld || this.capsLockOn;

			if (!armed) {
				this.lastPreviewKey = null;
				const isHoveringTag = this.hoveredTag?.el.matches(":hover");
				if (!this.hoverPreviewHovered && (isHoveringTag || evt.key === "CapsLock")) {
					this.clearHoverPreview();
				}
				return;
			}

			if (!this.hoveredTag) return;
			this.scheduleHoverPreview(this.hoveredTag.el, this.hoveredTag.tag);
		});
		this.registerDomEvent(document, "keyup", (evt: KeyboardEvent) => {
			if (this.app.workspace.activeLeaf?.view !== this) return;

			this.altHeld = evt.altKey;

			if (evt.key !== "CapsLock") {
				this.capsLockOn = evt.getModifierState?.("CapsLock") ?? false;
			}

			if (evt.key === "Shift") this.shiftHeld = false;

			const armed = this.shiftHeld || this.capsLockOn;
			if (!armed) {
				this.lastPreviewKey = null;
				const isHoveringTag = this.hoveredTag?.el.matches(":hover");
				if (!this.hoverPreviewHovered && isHoveringTag) {
					this.clearHoverPreview();
				}
				return;
			}

			if (!this.hoveredTag) return;
			this.scheduleHoverPreview(this.hoveredTag.el, this.hoveredTag.tag);
		});
		this.registerDomEvent(window, "blur", () => {
			this.shiftHeld = false;
			this.capsLockOn = false;
			this.altHeld = false;
			this.lastPreviewKey = null;
			this.clearHoverPreview();
		});

		this.syncCutoffControlsFromSettings();
		this.updateModeUI(true);
		this.syncScopesUI();

		this.app.workspace.onLayoutReady(() => {
			if (this.tagIndex.allTags.size > 0) {
				void this.renderTags();
			}
		});

		this.registerEvent(
			this.app.workspace.on("flat-tag-view:settings-updated" as any, () => {
				if (this.skipNextSettingsRender) {
					this.skipNextSettingsRender = false;
					return;
				}

				this.syncCutoffControlsFromSettings();
				this.syncScopesUI();
				void this.renderTags();
			})
		);
	}

	async onClose() {
		this.tagIndex.onUpdate.delete(this.renderTagsCallback);
		this.clearHoverPreview();
		this.closeHelpPopup();
		if (this.touchTimer) window.clearTimeout(this.touchTimer);
		this.contentEl.empty();
		if (this.taskPressTimer) window.clearTimeout(this.taskPressTimer);
	}

	async renderTags() {
		this.sortAzBtn.toggleClass("is-active", this.currentSort === "az");
		this.sortCountBtn.toggleClass("is-active", this.currentSort === "count");

		const currentRenderId = ++this.renderId;
		const filteredTags = await this.getFilteredTagsAsync();
		if (currentRenderId !== this.renderId) return;

		this.tagContainer.empty();

		const pinned = new Map<string, number>();
		const normal = new Map<string, number>();
		const pinnedSet = new Set(this.plugin.settings.pinnedTags ?? []);

		filteredTags.forEach((count, tag) => {
			if (pinnedSet.has(tag)) pinned.set(tag, count);
			else normal.set(tag, count);
		});

		if (pinned.size > 0) {
			const pinContainer = this.tagContainer.createDiv({ cls: "flat-tag-pinned-section" });
			const pinnedIcon = pinContainer.createSpan({ cls: "flat-tag-letter" });
			setIcon(pinnedIcon, "pin");

			let sortedPinned = Array.from(pinned.entries());

			if (this.currentSort === "az") {
				const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });
				sortedPinned.sort((a, b) => {
					const charA = Array.from(a[0])[0] || "";
					const charB = Array.from(b[0])[0] || "";
					const isLetterA = /^\p{L}$/u.test(charA);
					const isLetterB = /^\p{L}$/u.test(charB);
					if (!isLetterA && isLetterB) return -1;
					if (isLetterA && !isLetterB) return 1;
					return collator.compare(a[0], b[0]);
				});
			} else {
				sortedPinned.sort((a, b) => {
					if (b[1] !== a[1]) return b[1] - a[1];
					return a[0].localeCompare(b[0], "pl");
				});
			}

			sortedPinned.forEach(([tag, count]) => {
				this.createTagElement(tag, count, pinContainer);
			});

			this.tagContainer.createDiv({ cls: "flat-tag-separator" });
		}

		let sortedTags = Array.from(normal.entries());

		if (this.currentSort === "az") {
			const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

			sortedTags.sort((a, b) => {
				const charA = Array.from(a[0])[0] || "";
				const charB = Array.from(b[0])[0] || "";
				const isLetterA = /^\p{L}$/u.test(charA);
				const isLetterB = /^\p{L}$/u.test(charB);

				if (!isLetterA && isLetterB) return -1;
				if (isLetterA && !isLetterB) return 1;

				return collator.compare(a[0], b[0]);
			});

			let currentHeader = "";

			for (const [tag, count] of sortedTags) {
				const firstChar = (Array.from(tag)[0] || "").toUpperCase();
				const isLetter = /^\p{L}$/u.test(firstChar);
				const headerToUse = isLetter ? firstChar : "OTHER";

				if (headerToUse !== currentHeader) {
					currentHeader = headerToUse;
					if (currentHeader !== "OTHER") {
						const letterEl = this.tagContainer.createSpan({ cls: "flat-tag-letter" });
						letterEl.setText(currentHeader);
					}
				}

				this.createTagElement(tag, count, this.tagContainer);
			}
		} else {
			sortedTags.sort((a, b) => {
				if (b[1] !== a[1]) return b[1] - a[1];
				return a[0].localeCompare(b[0], "pl");
			});

			sortedTags.forEach(([tag, count]) => {
				this.createTagElement(tag, count, this.tagContainer);
			});
		}
	}

	private scrollHeaderToOneThird(letter: string) {
		const container = this.tagContainer;
		if (!container) return;

		const wanted = letter.trim().toUpperCase();
		if (!wanted) return;

		const headers = Array.from(container.querySelectorAll(".flat-tag-letter"));
		const target = headers.find((h) => (h.textContent ?? "").trim().toUpperCase() === wanted);
		if (!target) return;

		const cRect = container.getBoundingClientRect();
		const tRect = target.getBoundingClientRect();

		const delta = tRect.top - cRect.top;
		const desired = container.scrollTop + delta - container.clientHeight / 3;

		container.scrollTo({
			top: Math.max(0, desired),
			behavior: "instant" as ScrollBehavior,
		});
	}

	private createTagElement(tag: string, count: number, parentEl: HTMLElement) {
		const tagEl = parentEl.createSpan({ cls: "flat-tag" });

		if (this.selectedTags.has(tag)) {
			tagEl.addClass("flat-tag-selected");
		} else if (this.excludedTags.has(tag)) {
			tagEl.addClass("flat-tag-excluded");
		}

		if (this.plugin.settings.pinnedTags?.includes(tag)) {
			tagEl.addClass("flat-tag-pinned");
		}

        let symbol = "";
        if (this.searchMode === "line") symbol = "ℓ";
        else if (this.searchMode === "task") symbol = "τ";
        else if (this.searchMode === "task-todo") symbol = "☐";
        else if (this.searchMode === "task-done") symbol = "✓";

        // 1. Clear the element just in case
        tagEl.empty();
        
        // 2. Add the tag name safely
        tagEl.appendText(tag + " ");

        // 3. Create the count span safely
        const countSpan = tagEl.createSpan({ cls: "ftv-count" });

        if (symbol) {
            countSpan.appendText(`(${count}`);
            countSpan.createSpan({ cls: "ftv-mode-mark", text: symbol });
            countSpan.appendText(`)`);
        } else {
            countSpan.appendText(`(${count})`);
        }

        tagEl.style.userSelect = "none";
        tagEl.style.webkitUserSelect = "none";
        tagEl.dataset.tag = tag;

	}

	private getTagElFromTarget(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		return target.closest(".flat-tag") as HTMLElement | null;
	}

	private resetTouchTagStyle(el: HTMLElement | null) {
		if (!el) return;

		el.style.transition = "transform 0.2s ease, opacity 0.2s ease";
		el.style.transform = "";
		el.style.opacity = "";

		window.setTimeout(() => {
			if (el.isConnected) el.style.transition = "";
		}, 220);
	}

	private async handleTagInteraction(
		tag: string,
		tagEl: HTMLElement,
		isMultiSelect: boolean,
		isExclude: boolean,
		isPin: boolean
	) {
		this.clearHoverPreview();

		if (isPin) {
			const list = this.plugin.settings.pinnedTags ?? [];
			this.plugin.settings.pinnedTags = list.includes(tag)
				? list.filter((t) => t !== tag)
				: [...list, tag];
			await this.plugin.saveSettings();
			void this.renderTags();
			return;
		}

		if (isExclude) {
			if (this.excludedTags.has(tag)) this.excludedTags.delete(tag);
			else {
				this.excludedTags.add(tag);
				this.selectedTags.delete(tag);
			}
		} else if (isMultiSelect) {
			if (this.selectedTags.has(tag)) this.selectedTags.delete(tag);
			else {
				this.selectedTags.add(tag);
				this.excludedTags.delete(tag);
			}
		} else {
			if (this.selectedTags.size === 1 && this.selectedTags.has(tag)) {
				this.selectedTags.clear();
			} else {
				this.selectedTags.clear();
				this.excludedTags.clear();
				this.selectedTags.add(tag);
			}
		}

		if (this.selectedTags.has(tag)) {
			tagEl.addClass("flat-tag-selected");
			tagEl.removeClass("flat-tag-excluded");
		} else if (this.excludedTags.has(tag)) {
			tagEl.addClass("flat-tag-excluded");
			tagEl.removeClass("flat-tag-selected");
		} else {
			tagEl.removeClass("flat-tag-selected");
			tagEl.removeClass("flat-tag-excluded");
		}

		void this.renderTags();
		void this.updateSearch();
	}

	private initDelegatedListeners() {
		if (!this.tagContainer) return;

		this.tagContainer.addEventListener("mouseover", (e: MouseEvent) => {
			if (Platform.isMobile) return;

			const tagEl = this.getTagElFromTarget(e.target);
			if (!tagEl) return;

			const fromTagEl = this.getTagElFromTarget(e.relatedTarget);
			if (fromTagEl === tagEl) return;

			const tag = tagEl.dataset.tag;
			if (!tag) return;

			this.capsLockOn = (e as any).getModifierState?.("CapsLock") ?? this.capsLockOn;
			this.altHeld = e.altKey;
			this.hoveredTag = { el: tagEl, tag };
			this.cancelLeaveTimer();

			if (e.ctrlKey || e.metaKey) return;

			const armed = this.shiftHeld || this.capsLockOn || e.shiftKey;
			if (!armed) return;

			this.scheduleHoverPreview(tagEl, tag);
		});

		this.tagContainer.addEventListener("mouseout", (e: MouseEvent) => {
			const tagEl = this.getTagElFromTarget(e.target);
			if (!tagEl) return;

			const toTagEl = this.getTagElFromTarget(e.relatedTarget);
			if (toTagEl === tagEl) return;

			if (this.hoveredTag?.el === tagEl) {
				this.hoveredTag = null;
			}

			if (!this.shiftHeld && !this.capsLockOn) {
				this.clearHoverPreview();
				this.lastPreviewKey = null;
			} else {
				this.beginLeaveTimer();
			}
		});

		this.tagContainer.addEventListener("click", (e: MouseEvent) => {
			const tagEl = this.getTagElFromTarget(e.target);
			if (!tagEl) return;

			if (this.touchHandled) {
				this.touchHandled = false;
				return;
			}

			e.preventDefault();

			const tag = tagEl.dataset.tag;
			if (!tag) return;

			if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey) {
				this.insertTagIntoActiveEditor(tag);
				return;
			}

			void this.handleTagInteraction(
				tag,
				tagEl,
				!!(e.ctrlKey || e.metaKey),
				!!e.shiftKey,
				!!e.altKey
			);
		});

		this.tagContainer.addEventListener("contextmenu", (e: MouseEvent) => {
			const tagEl = this.getTagElFromTarget(e.target);
			if (!tagEl) return;

			if (Platform.isMobile) {
				e.preventDefault();
				return;
			}

			e.preventDefault();

			const tag = tagEl.dataset.tag;
			if (!tag) return;

			const menu = new Menu();
			const isMuted = tag.startsWith("%");
			const actionName = isMuted ? "Global Un-Mute" : "Global Mute";
			const targetTag = isMuted ? tag.slice(1) : `%${tag}`;

			menu.addItem((item) => {
				item
					.setTitle(`${actionName} to #${targetTag}`)
					.setIcon("alert-triangle")
					.onClick(() => {
						new GlobalMuteConfirmModal(this.app, tag, async () => {
							await this.executeGlobalMute(tag);
						}).open();
					});
			});

			menu.showAtMouseEvent(e);
		});

		this.tagContainer.addEventListener(
			"touchstart",
			(e: TouchEvent) => {
				const tagEl = this.getTagElFromTarget(e.target);
				if (!tagEl) return;

				this.lastInteractionWasTouch = true;
				this.activeTouchTagEl = tagEl;

				const touch = e.touches[0];
				this.touchStartX = touch.clientX;
				this.touchStartY = touch.clientY;
				this.isSwiping = false;
				this.longPressTriggered = false;
				this.touchHandled = false;

				if (this.touchTimer) window.clearTimeout(this.touchTimer);
				this.touchTimer = window.setTimeout(() => {
					this.touchTimer = null;

					if (!this.isSwiping && this.activeTouchTagEl) {
						const tag = this.activeTouchTagEl.dataset.tag;
						if (!tag) return;

						this.longPressTriggered = true;
						this.touchHandled = true;
						void this.handleTagInteraction(tag, this.activeTouchTagEl, true, false, false);
					}
				}, 500);
			},
			{ passive: true }
		);

		this.tagContainer.addEventListener(
			"touchmove",
			(e: TouchEvent) => {
				if (!this.activeTouchTagEl) return;

				const touch = e.touches[0];
				const dx = touch.clientX - this.touchStartX;
				const dy = touch.clientY - this.touchStartY;

				if (!this.isSwiping) {
					if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
						if (this.touchTimer) {
							window.clearTimeout(this.touchTimer);
							this.touchTimer = null;
						}
						this.isSwiping = true;
					} else if (Math.abs(dy) > 10) {
						if (this.touchTimer) {
							window.clearTimeout(this.touchTimer);
							this.touchTimer = null;
						}
						return;
					}
				}

				if (this.isSwiping && dx < 0) {
					if (e.cancelable) e.preventDefault();

					const capped = Math.max(dx, -90);
					this.activeTouchTagEl.style.transform = `translateX(${capped}px)`;
					this.activeTouchTagEl.style.opacity = String(
						0.5 + (Math.abs(capped) / 90) * 0.5
					);
				}
			},
			{ passive: false }
		);

		this.tagContainer.addEventListener(
			"touchend",
			(e: TouchEvent) => {
				if (!this.activeTouchTagEl) return;

				const el = this.activeTouchTagEl;
				const tag = el.dataset.tag;
				const touch = e.changedTouches[0];
				const dx = touch.clientX - this.touchStartX;

				this.resetTouchTagStyle(el);

				if (this.isSwiping) {
					this.isSwiping = false;
					this.touchHandled = true;

					if (dx <= -60 && tag) {
						void this.handleTagInteraction(tag, el, false, false, true);
					}
				}

				if (this.touchTimer) {
					window.clearTimeout(this.touchTimer);
					this.touchTimer = null;
				}

				this.longPressTriggered = false;
				this.activeTouchTagEl = null;
			},
			{ passive: true }
		);

		this.tagContainer.addEventListener(
			"touchcancel",
			() => {
				if (this.touchTimer) {
					window.clearTimeout(this.touchTimer);
					this.touchTimer = null;
				}

				this.resetTouchTagStyle(this.activeTouchTagEl);

				this.isSwiping = false;
				this.longPressTriggered = false;
				this.touchHandled = false;
				this.activeTouchTagEl = null;
			},
			{ passive: true }
		);
	}

	private insertTagIntoActiveEditor(tag: string) {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (!view) {
			const mdLeaves = this.app.workspace.getLeavesOfType("markdown");
			if (mdLeaves.length > 0) {
				const activeFile = this.app.workspace.getActiveFile();
				const targetLeaf =
					mdLeaves.find((leaf) => (leaf.view as MarkdownView).file === activeFile) ||
					mdLeaves[0];
				view = targetLeaf.view as MarkdownView;
			}
		}

		if (!view) {
			new Notice("No active markdown file to insert tag into.");
			return;
		}

		const isSourceMode =
			(view as any).getMode &&
			typeof (view as any).getMode === "function" &&
			(view as any).getMode() === "source";

		if (!isSourceMode) {
			new Notice("Please switch to edit mode to insert tags.");
			return;
		}

		const editor = view.editor;
		if (!editor) return;

		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const charBefore = cursor.ch > 0 ? line.charAt(cursor.ch - 1) : "";
		const charAfter = cursor.ch < line.length ? line.charAt(cursor.ch) : "";

		let textToInsert = `#${tag}`;

		if (charBefore && /[^\s]/.test(charBefore)) {
			textToInsert = " " + textToInsert;
		}

		if (charAfter && /[^\s]/.test(charAfter)) {
			textToInsert = textToInsert + " ";
		}

		editor.replaceSelection(textToInsert);

		const newCursorPos = { line: cursor.line, ch: cursor.ch + textToInsert.length };
		editor.setCursor(newCursorPos);

		new Notice(`Inserted #${tag}`);
	}

	private async executeGlobalMute(tag: string) {
		const isCurrentlyMuted = tag.startsWith("%");
		const targetTagWord = isCurrentlyMuted ? tag.slice(1) : `%${tag}`;

		const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const tagRegex = new RegExp(`(^| )#${escapedTag}(?![\\p{L}\\p{N}\\-_/])`, "gmu");


		let filesModified = 0;
		const filesToProcess: string[] = [];

		this.tagIndex.tagsByFile.forEach((tagsArr, filePath) => {
			if (tagsArr.includes(tag)) filesToProcess.push(filePath);
		});

		new Notice(`Globally replacing #${tag}...`);

		for (const filePath of filesToProcess) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				await this.app.vault.process(file, (data) => {
					const newData = data.replace(tagRegex, `$1#${targetTagWord}`);
					if (data !== newData) filesModified++;
					return newData;
				});
			}
		}

		new Notice(`Success! Replaced #${tag} with #${targetTagWord} in ${filesModified} files.`);

		this.selectedTags.delete(tag);
		this.excludedTags.delete(tag);
		void this.renderTags();
		void this.updateSearch();
	}

	private syncScopesUI() {
		if (!this.scopesToggleBtn || !this.scopesText) return;
		const scopes = this.plugin.settings.scopes || [];

		if (this.activeScopeId && !scopes.find((s) => s.id === this.activeScopeId)) {
			this.activeScopeId = scopes.length > 0 ? scopes[0].id : null;
			if (!this.activeScopeId) this.scopesOn = false;
		}

		const activeScope = scopes.find((s) => s.id === this.activeScopeId) || scopes[0];

		if (this.scopesOn && activeScope) {
			this.scopesToggleBtn.classList.add("is-enabled");
			this.scopesText.classList.add("is-enabled");
			this.scopesText.textContent = activeScope.name;
		} else {
			this.scopesToggleBtn.classList.remove("is-enabled");
			this.scopesText.classList.remove("is-enabled");
			this.scopesText.textContent = activeScope ? activeScope.name : "Entire vault";
		}
	}

	private fileInScope(filePath: string): boolean {
		if (!this.scopesOn) return true;

		const scopes = this.plugin.settings.scopes || [];
		const activeScope = scopes.find((s) => s.id === this.activeScopeId) || scopes[0];
		if (!activeScope || activeScope.folders.length === 0) return true;

		let included = false;
		let hasInclusions = false;

		const inFolder = (fp: string, folderPath: string) => {
			if (folderPath === "/") {
				return !fp.includes("/");
			}
			if (folderPath === "") return true;

			const normalized = folderPath.endsWith("/") ? folderPath.slice(0, -1) : folderPath;
			return fp.startsWith(normalized + "/") || fp === normalized;
		};

		for (const folder of activeScope.folders) {
			if (!folder.included) {
				if (inFolder(filePath, folder.path)) return false;
			} else {
				hasInclusions = true;
				if (inFolder(filePath, folder.path)) included = true;
			}
		}

		if (included) return true;
		if (!hasInclusions) return true;
		return false;
	}


	private isTaskMode(): boolean {
		return (
			this.searchMode === "task" ||
			this.searchMode === "task-todo" ||
			this.searchMode === "task-done"
		);
	}

	private getHoverPreviewMode(): HoverPreviewMode {
		return this.isTaskMode() && this.altHeld ? "tasks" : "files";
	}

	private getGraphemeCount(text: string): number {
		const SegmenterCtor = (Intl as any)?.Segmenter;
		if (SegmenterCtor) {
			const segmenter = new SegmenterCtor(undefined, { granularity: "grapheme" });
			return Array.from(segmenter.segment(text)).length;
		}

		return Array.from(text).length;
	}

	private parseTaskLine(line: string): { marker: string; state: TaskState; taskText: string } | null {
		const m = line.match(/^\s*-\s\[(.*?)\](?:\s+(.*)|\s*)$/u);
		if (!m) return null;

		const marker = m[1];
		if (this.getGraphemeCount(marker) !== 1) return null;

		const state: TaskState =
			marker === " "
				? "todo"
				: marker === "x" || marker === "X"
					? "done"
					: "other";

		return {
			marker,
			state,
			taskText: line.trimStart(),
		};
	}

	private taskStateMatchesMode(state: TaskState): boolean {
		if (this.searchMode === "task") return true;
		if (this.searchMode === "task-todo") return state === "todo";
		if (this.searchMode === "task-done") return state === "done";
		return true;
	}

	private hasLineTagBoundary(line: string, hashIndex: number): boolean {
		return hashIndex === 0 || line.charAt(hashIndex - 1) === " ";
	}

	private isLineTagBodyChar(ch: string): boolean {
		return /[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]/u.test(ch);
	}

	private extractLineTags(line: string): string[] {
		const found = new Set<string>();

		for (let i = 0; i < line.length; i++) {
			if (line.charAt(i) !== "#") continue;
			if (!this.hasLineTagBoundary(line, i)) continue;

			let end = i + 1;
			while (end < line.length && this.isLineTagBodyChar(line.charAt(end))) end++;

			if (end === i + 1) continue;

			const tag = line.slice(i + 1, end);
			if (!tag.startsWith("%")) found.add(tag);

			i = end - 1;
		}

		return Array.from(found);
	}


	private lineHasAllTags(lineTags: string[], required: string[]): boolean {
		return required.every((sel) =>
			lineTags.some((t) => t.toLowerCase() === sel.toLowerCase())
		);
	}

	private lineHasExcludedTags(lineTags: string[], excluded: string[]): boolean {
		return excluded.some((sel) =>
			lineTags.some((t) => t.toLowerCase() === sel.toLowerCase())
		);
	}

	private async getFilteredTagsAsync(): Promise<Map<string, number>> {
		let filtered = new Map<string, number>();

		const selectedArr = Array.from(this.selectedTags);
		const excludedArr = Array.from(this.excludedTags);
		const matchingFiles: string[] = [];

		this.tagIndex.tagsByFile.forEach((tagsArr, filePath) => {
			if (!this.fileInScope(filePath)) return;
			if (selectedArr.every((t) => tagsArr.includes(t))) matchingFiles.push(filePath);
		});

		const useLineLevel = this.searchMode !== "note";

		if (!useLineLevel) {
			if (this.selectedTags.size === 0 && !this.scopesOn) {
				filtered = new Map(this.tagIndex.allTags);
			} else {
				for (const filePath of matchingFiles) {
					const tags = this.tagIndex.tagsByFile.get(filePath);
					if (!tags) continue;

					for (const t of tags) {
						filtered.set(t, (filtered.get(t) || 0) + 1);
					}
				}
			}
		} else {
            // Line and Task Modes -> JIT Cache Parsing
			for (const filePath of matchingFiles) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) continue;

				const cache = this.app.metadataCache.getFileCache(file);
                if (!cache) continue; // Rely entirely on Obsidian cache

                // 1. Group tags by line number
                const lineTags: Record<number, string[]> = {};

                cache.tags?.forEach(t => {
                    const line = t.position.start.line;
                    const cleanTag = this.tagIndex.normalizeTag(t.tag);
                    if (!cleanTag || cleanTag.startsWith("%")) return;

                    if (!lineTags[line]) lineTags[line] = [];
                    if (!lineTags[line].includes(cleanTag)) lineTags[line].push(cleanTag);
                });

                // Add frontmatter tags to line 0 (or a special bucket if you prefer)
                // so they can be filtered. Or we can just consider them file-level and match with line 0.
                const fmTags = this.tagIndex.extractFrontmatterTags(cache);
                if (fmTags.length > 0) {
                    if (!lineTags[0]) lineTags[0] = [];
                    fmTags.forEach(t => {
                        if (!lineTags[0].includes(t)) lineTags[0].push(t);
                    });
                }

                // 2. Identify Task statuses per line
                const taskLines: Record<number, string> = {};
                if (this.searchMode !== "line") {
                    cache.listItems?.forEach(item => {
                        if (item.task !== undefined) {
                            taskLines[item.position.start.line] = String(item.task);
                        }
                    });
                }

                // 3. Filter line by line
                for (const lineStr of Object.keys(lineTags)) {
                    const line = Number(lineStr);
                    const tagsOnThisLine = lineTags[line];

                    // Selected tags check
                    if (!selectedArr.every(sel => tagsOnThisLine.some(t => t.toLowerCase() === sel.toLowerCase()))) continue;

                    // Excluded tags check
                    if (excludedArr.some(exc => tagsOnThisLine.some(t => t.toLowerCase() === exc.toLowerCase()))) continue;

                    // Task Check
                    if (this.searchMode !== "line") {
                        const taskStatus = taskLines[line];
                        if (taskStatus === undefined) continue; // Not a task

                        if (this.searchMode === "task-todo" && taskStatus !== " ") continue;
                        if (this.searchMode === "task-done" && taskStatus === " ") continue;
                        // "task" (all) just needs taskStatus !== undefined which is already checked
                    }

                    // Survived filtering! Add tags to the filtered map
                    for (const t of tagsOnThisLine) {
                        filtered.set(t, (filtered.get(t) || 0) + 1);
                    }
                }
			}
		}

		for (const t of this.selectedTags) {
			if (!filtered.has(t)) {
				// Fall back to global count ONLY if we are in standard Note mode AND Scopes are OFF.
				// If a Scope is active, or a strict Mode is active, and the tag didn't survive filtering, its count is 0.
				const count = (this.searchMode === "note" && !this.scopesOn) 
					? (this.tagIndex.allTags.get(t) || 0) 
					: 0;
				filtered.set(t, count);
			}
		}

		for (const t of this.excludedTags) {
			if (!filtered.has(t)) {
				const count = (this.searchMode === "note" && !this.scopesOn) 
					? (this.tagIndex.allTags.get(t) || 0) 
					: 0;
				filtered.set(t, count);
			}
		}


		const cutoffEnabled = this.plugin.settings.frequencyCutoffEnabled ?? false;
		const cutoff = cutoffEnabled ? (this.plugin.settings.frequencyCutoff ?? 0) : 0;
		const pinned = new Set(this.plugin.settings.pinnedTags ?? []);

		if (cutoff > 0) {
			const next = new Map<string, number>();
			filtered.forEach((count, tag) => {
				if (count >= cutoff || this.selectedTags.has(tag) || pinned.has(tag)) {
					next.set(tag, count);
				}
			});
			filtered = next;
		}

		if (this.tagSearchText) {
			const q = this.tagSearchText.toLowerCase();
			const next = new Map<string, number>();
			filtered.forEach((count, tag) => {
				if (
					tag.toLowerCase().includes(q) ||
					this.selectedTags.has(tag) ||
					this.excludedTags.has(tag)
				) {
					next.set(tag, count);
				}
			});
			filtered = next;
		}

		return filtered;
	}

	private async updateSearch(options?: { revealSearch?: boolean; createIfMissing?: boolean }) {
		const workspace = this.app.workspace;
		const prevLeaf = workspace.activeLeaf;

		const isTouchContext = Platform.isMobile || this.lastInteractionWasTouch;
		const revealSearch = options?.revealSearch ?? !isTouchContext;
		const createIfMissing = options?.createIfMissing ?? !isTouchContext;

		let searchLeaf = workspace.getLeavesOfType("search")[0];

		if (!searchLeaf && createIfMissing) {
			const rightLeaf = workspace.getRightLeaf(true);
			if (rightLeaf) {
				searchLeaf = rightLeaf;
				await searchLeaf.setViewState({ type: "search", active: false });
			}
		}

		if (searchLeaf && revealSearch) workspace.revealLeaf(searchLeaf);
		if (prevLeaf) workspace.setActiveLeaf(prevLeaf, { focus: true });

		this.lastInteractionWasTouch = false;

		if (!searchLeaf) return;

		const selected = Array.from(this.selectedTags);
		const excluded = Array.from(this.excludedTags);
		const searchView = searchLeaf.view as any;

		const activeScopeHasRules = this.scopesOn && !!this.activeScopeId;

		// We should clear the search pane if no tags are selected,
		// regardless of whether a scope is active!
		if (selected.length === 0 && excluded.length === 0) {

			const clearBtn = searchView?.containerEl?.querySelector(
				".search-input-clear-button"
			) as HTMLElement | null;

			if (clearBtn) {
				clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: false }));
                
				// Wait 10ms for Obsidian to finish focusing its own input, then steal it back!
				setTimeout(() => {
					this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
				}, 10);

			} else if (typeof searchView?.setQuery === "function") {
				searchView.setQuery("");
			}
			return;
		}


		let scopeQuery = "";
		if (this.scopesOn) {
			const scopes = this.plugin.settings.scopes || [];
			const activeScope = scopes.find((s: any) => s.id === this.activeScopeId) || scopes[0];

			if (activeScope && activeScope.folders.length > 0) {
				const includedPaths = activeScope.folders
					.filter((f: any) => f.included)
					.map((f: any) => (f.path === "/" ? '-path:"/"' : `path:"${f.path}"`));

				const excludedPaths = activeScope.folders
					.filter((f: any) => !f.included)
					.map((f: any) => (f.path === "/" ? 'path:"/"' : `-path:"${f.path}"`));

				const incStr = includedPaths.length > 0 ? `(${includedPaths.join(" OR ")})` : "";
				const excStr = excludedPaths.join(" ");
				scopeQuery = [incStr, excStr].filter((s) => s).join(" ");
			}
		}

		let query = "";
		if (this.searchMode === "note") {
			query = [
				...selected.map((t) => `tag:#${t}`),
				...excluded.map((t) => `-tag:#${t}`),
			].join(" ");

			if (scopeQuery) query = query ? `${query} ${scopeQuery}` : scopeQuery;
		} else {
			const prefix =
				this.searchMode === "line"
					? "line:("
					: this.searchMode === "task"
					? "task:("
					: this.searchMode === "task-todo"
					? "task-todo:("
					: "task-done:(";

			const body = [
				...selected.map((t) => `#${t}`),
				...excluded.map((t) => `-#${t}`),
			].join(" ");

			if (body) {
				query = `${prefix}${body})`;
				if (scopeQuery) query = `${query} ${scopeQuery}`;
			} else if (scopeQuery) {
				query = scopeQuery;
			}
		}

		if (typeof searchView?.setQuery === "function") {
			searchView.setQuery(query);
			setTimeout(() => searchView.setQuery(query), 150);
		}
	}

	private syncCutoffControlsFromSettings() {
		const enabled = this.plugin.settings.frequencyCutoffEnabled ?? false;
		const cutoff = this.plugin.settings.frequencyCutoff ?? 0;

		this.cutoffInput.value = String(cutoff);
		this.cutoffInput.disabled = !enabled;

		this.cutoffToggleBtn.toggleClass("is-enabled", enabled);
		this.cutoffToggleBtn.toggleClass("is-disabled", !enabled);
		setIcon(this.cutoffToggleBtn, enabled ? "eye" : "eye-off");
	}

	public updateModeUI(skipSearch = false) {
		this.sortAzBtn.toggleClass("is-active", this.currentSort === "az");
		this.sortCountBtn.toggleClass("is-active", this.currentSort === "count");

		this.notelineBtn.removeClass("is-active");
		this.taskBtn.removeClass("is-active");

		if (this.searchMode === "note") {
			this.notelineBtn.setText("NOTE");
			this.notelineBtn.addClass("is-active");
		} else if (this.searchMode === "line") {
			this.notelineBtn.setText("LINE");
			this.notelineBtn.addClass("is-active");
		} else if (this.searchMode === "task") {
			this.taskBtn.setText("TASK-ALL");
			this.taskBtn.addClass("is-active");
		} else if (this.searchMode === "task-todo") {
			this.taskBtn.setText("TASK-TODO");
			this.taskBtn.addClass("is-active");
		} else if (this.searchMode === "task-done") {
			this.taskBtn.setText("TASK-DONE");
			this.taskBtn.addClass("is-active");
		}

		if (["note", "line"].includes(this.searchMode)) {
			if (!["TASK-ALL", "TASK-TODO", "TASK-DONE"].includes(this.taskBtn.innerText)) {
				this.taskBtn.setText("TASK-ALL");
			}
		} else {
			if (!["NOTE", "LINE"].includes(this.notelineBtn.innerText)) {
				this.notelineBtn.setText("NOTE");
			}
		}

		if (!skipSearch) void this.updateSearch();
		if (this.tagContainer) void this.renderTags();
	}

	public toggleNoteLineMode() {
		if (["note", "line"].includes(this.searchMode)) {
			this.searchMode = this.searchMode === "note" ? "line" : "note";
		} else {
			this.searchMode = this.notelineBtn.innerText === "LINE" ? "line" : "note";
		}

		this.updateModeUI();
	}

	public toggleTaskMode() {
		if (this.searchMode === "task") this.searchMode = "task-todo";
		else if (this.searchMode === "task-todo") this.searchMode = "task-done";
		else if (this.searchMode === "task-done") this.searchMode = "task";
		else {
			const label = this.taskBtn?.innerText ?? "TASK-ALL";
			this.searchMode =
				label === "TASK-TODO" ? "task-todo" : label === "TASK-DONE" ? "task-done" : "task";
		}

		this.updateModeUI();
	}

	public toggleSort() {
		this.currentSort = this.currentSort === "az" ? "count" : "az";
		this.updateModeUI(true);
	}

	public async applyScope(scopeId: string) {
		const scopes = this.plugin.settings.scopes || [];
		const targetScope = scopes.find((s) => s.id === scopeId);

		if (targetScope) {
			this.scopesOn = true;
			this.activeScopeId = targetScope.id;
			this.syncScopesUI();
			void this.renderTags();
			void this.updateSearch();
		}
	}

	public toggleScopes() {
		this.scopesOn = !this.scopesOn;
		this.syncScopesUI();
		void this.renderTags();
		void this.updateSearch();

		if (this.scopesOn) {
			const scopes = this.plugin.settings.scopes || [];
			const activeScope = scopes.find((s) => s.id === this.activeScopeId) || scopes[0];
			new Notice(activeScope ? `Scopes ON: ${activeScope.name}` : "Scopes ON");
		} else {
			new Notice("Scopes OFF (Entire Vault)");
		}
	}

	public clearTagSelections() {
		this.selectedTags.clear();
		this.excludedTags.clear();
		void this.renderTags();
		void this.updateSearch({ revealSearch: false, createIfMissing: false });
	}

	public clearSearchBox() {
		const searchBox = this.contentEl.querySelector(
			".flat-tag-search-input"
		) as HTMLInputElement | null;

		if (searchBox) {
			searchBox.value = "";
			this.tagSearchText = "";
			void this.renderTags();
		}
	}

	public selectSingleTag(tag: string) {
		this.selectedTags.clear();
		this.excludedTags.clear();

		const cleanTag = tag.replace(/^#+/, "");
		this.selectedTags.add(cleanTag);

		void this.renderTags();
		void this.updateSearch({ revealSearch: true, createIfMissing: true });
	}

	private scheduleHoverPreview(anchor: HTMLElement, tag: string) {
		if (this.hoverPreviewTimer) {
			window.clearTimeout(this.hoverPreviewTimer);
		}

		this.hoverPreviewTimer = window.setTimeout(() => {
			this.hoverPreviewTimer = null;
			if (!this.shiftHeld && !this.capsLockOn) return;

			const mode = this.getHoverPreviewMode();
			const previewKey = `${mode}:${tag}`;
			if (this.lastPreviewKey === previewKey) return;

			this.lastPreviewKey = previewKey;
			void this.showTagHoverPreview(anchor, tag);
		}, 80);
	}

	private cancelLeaveTimer() {
		if (this.hoverLeaveTimer) {
			window.clearTimeout(this.hoverLeaveTimer);
			this.hoverLeaveTimer = null;
		}
	}

	private beginLeaveTimer() {
		if (this.hoverPreviewHovered) return;

		this.cancelLeaveTimer();

		const armed = this.shiftHeld || this.capsLockOn;

		if (!armed) {
			this.clearHoverPreview();
			this.lastPreviewKey = null;
			return;
		}

		this.hoverLeaveTimer = window.setTimeout(() => {
			this.hoverLeaveTimer = null;
			if (!this.hoverPreviewHovered && !this.hoveredTag) {
				this.clearHoverPreview();
				this.lastPreviewKey = null;
			}
		}, 150);
	}

	public clearHoverPreview() {
		if (this.hoverPreviewTimer) {
			window.clearTimeout(this.hoverPreviewTimer);
			this.hoverPreviewTimer = null;
		}

		this.cancelLeaveTimer();
		this.hoverPreviewHovered = false;
		this.hoverPreviewAnchorEl = null;

		if (this.resizeListener) {
			window.removeEventListener("resize", this.resizeListener);
			this.resizeListener = null;
		}

		this.hoverPreviewEl?.remove();
		this.hoverPreviewEl = null;
	}

	private closeHelpPopup() {
		if (this.helpPopupEl) {
			this.helpPopupEl.remove();
			this.helpPopupEl = null;
		}

		if (this.helpCleanup) {
			this.helpCleanup();
			this.helpCleanup = null;
		}
	}

	private showHelpPopup(anchor: HTMLElement) {
		if (this.helpPopupEl) {
			this.closeHelpPopup();
			return;
		}

		this.clearHoverPreview();

		const box = document.createElement("div");
		box.className = "ftv-popup ftv-help-popup";
		box.style.position = "fixed";
		box.style.zIndex = "999999";

		document.body.appendChild(box);
		this.helpPopupEl = box;

		const onResize = () => {
			if (this.helpPopupEl) this.positionPopup(anchor, this.helpPopupEl);
		};
		window.addEventListener("resize", onResize);

		const onEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				this.closeHelpPopup();
			}
		};

		document.addEventListener("keydown", onEsc, { capture: true });

		this.helpCleanup = () => {
			window.removeEventListener("resize", onResize);
			document.removeEventListener("keydown", onEsc, { capture: true } as any);
		};

		const header = box.createDiv({ cls: "ftv-popup-header" });
		const titleLabel = header.createSpan({ cls: "ftv-popup-tag-label" });
		titleLabel.textContent = "Help & Shortcuts";

		const controls = header.createSpan({ cls: "ftv-popup-controls" });
		const closeBtn = controls.createSpan({ cls: "ftv-popup-ctrl-btn" });
		setIcon(closeBtn, "x");
		closeBtn.title = "Close";
		closeBtn.addEventListener("click", () => this.closeHelpPopup());

		        const body = box.createDiv({ cls: "ftv-help-content" });

        // Helper to safely create headers
        const createHeader = (text: string, marginTop: string) => {
            const header = body.createDiv({ text: text });
            header.style.marginLeft = "18px";
            header.style.marginTop = marginTop;
            header.style.marginBottom = "8px";
            header.style.fontWeight = "600";
            header.style.fontSize = "14px";
            header.style.color = "var(--text-normal)";
            header.style.borderBottom = "1px solid var(--background-modifier-border)";
            header.style.paddingBottom = "4px";
        };

        // Helper to safely create bullet points with bold prefixes
        const createList = (items: [string, string][]) => {
            const ul = body.createEl("ul");
            ul.style.marginTop = "0px";
            ul.style.marginBottom = "0px";
            for (const [boldText, normalText] of items) {
                const li = ul.createEl("li");
                li.createEl("b", { text: boldText });
                li.appendChild(document.createTextNode(normalText)); // Safe text injection
            }
        };

        // --- PANE SECTION ---
        createHeader("Pane", "0px");
        createList([
            ["Click", ": Select this tag"],
            ["Ctrl+Click", ": Add tag to selection"],
            ["Shift+Click", ": Exclude tag"],
            ["Alt+Click", ": Pin/unpin tag"],
            ["Ctrl+Alt+Click", ": Insert tag into last active editor at cursor"],
            ["Right Click", ": Global mute/un-mute tag"],
            ["Shift/CapsLock+Hover", ": Show popup with matching files"],
            ["Shift/CapsLock+Alt+Hover", ": In task modes, show popup with matching tasks"],
            ["Shift+1", ": Scroll to top"],
            ["Shift+0", ": Scroll to bottom"],
            ["Shift/CapsLock+Letter", ": Jump to that letter header"],
            ["Type", ": Filter tags live"],
            ["Esc", ": Clear tag search or close help"]
        ]);

        // --- EDITOR SECTION ---
        createHeader("EDITOR", "16px");
        createList([
            ["Alt+Click", ": Create/remove tag at cursor (respects tag insertion mode"],
            ["Ctrl+Alt+Click", ": Send tag at cursor to FTV and Search Pane"],
            ["Shift+Alt+Click", ": Strip hash from tag at cursor (always preserve text)"],
            ["Shift+Ctrl+Alt+ Click", ": Local mute/unmute tag instance at cursor"]
        ]);


		this.positionPopup(anchor, box);
	}

		private async getPopupFiles(tag: string): Promise<PopupFileResult[]> {
		// NEW: If in a task mode, derive files strictly from matching tasks
		if (this.searchMode.startsWith("task")) {
			const tasks = await this.getPopupTasks(tag);
			const uniquePaths = new Set<string>();
			const results: PopupFileResult[] = [];
			
			for (const task of tasks) {
				if (!uniquePaths.has(task.file.path)) {
					uniquePaths.add(task.file.path);
					const parts = task.file.path.split("/");
					const folder = parts.length > 1 ? parts[parts.length - 2] : "/";
					results.push({ file: task.file, folder });
				}
			}
			return results;
		}

		// EXISTING LOGIC for "note" and "line" modes
		const selected = Array.from(this.selectedTags);
		const excluded = Array.from(this.excludedTags);
		const required = [...new Set([...selected, tag])];
		const results: PopupFileResult[] = [];

		this.tagIndex.tagsByFile.forEach((tags, path) => {
			if (!this.fileInScope(path)) return;
			if (!required.every((t) => tags.includes(t))) return;
			if (excluded.some((t) => tags.includes(t))) return;

			const af = this.app.vault.getAbstractFileByPath(path);
			if (!(af instanceof TFile)) return;

			const parts = path.split("/");
			const folder = parts.length > 1 ? parts[parts.length - 2] : "/";
			results.push({ file: af, folder });
		});

		return results;
	}


	private async getPopupTasks(tag: string): Promise<PopupTaskResult[]> {
		const selected = Array.from(this.selectedTags);
		const excluded = Array.from(this.excludedTags);
		const required = [...new Set([...selected, tag])];
		const results: PopupTaskResult[] = [];

		for (const [path] of this.tagIndex.tagsByFile) {
			if (!this.fileInScope(path)) continue;

			const af = this.app.vault.getAbstractFileByPath(path);
			if (!(af instanceof TFile)) continue;

			const content = await this.app.vault.cachedRead(af);
			const lines = content.split(/\r?\n/);

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const taskInfo = this.parseTaskLine(line);
				if (!taskInfo) continue;
				if (!this.taskStateMatchesMode(taskInfo.state)) continue;

				const lineTags = this.extractLineTags(line);
				if (lineTags.length === 0) continue;
				if (!this.lineHasAllTags(lineTags, required)) continue;
				if (this.lineHasExcludedTags(lineTags, excluded)) continue;

				results.push({
					file: af,
					lineNumber: i,
					taskText: taskInfo.taskText,
				});
			}
		}

		return results;
	}

	private async openTaskResult(item: PopupTaskResult, openInNewLeaf: boolean) {
		const leaf = this.app.workspace.getLeaf(openInNewLeaf);
		await leaf.openFile(item.file);

		const view = leaf.view;
		if (view instanceof MarkdownView) {
			const editor = view.editor;
			if (editor) {
				const pos = { line: item.lineNumber, ch: 0 };
				editor.setCursor(pos);
				(editor as any).scrollIntoView?.({ from: pos, to: pos }, true);
			}
		}

		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private async showTagHoverPreview(anchor: HTMLElement, tag: string) {
		this.clearHoverPreview();
		this.hoverPreviewAnchorEl = anchor;

		const box = document.createElement("div");
		box.className = "ftv-popup";
		box.style.position = "fixed";
		box.style.zIndex = "999999";

		box.addEventListener("mouseenter", () => {
			this.hoverPreviewHovered = true;
			this.cancelLeaveTimer();
		});

		box.addEventListener("mouseleave", () => {
			this.hoverPreviewHovered = false;
			this.beginLeaveTimer();
		});

		document.body.appendChild(box);
		this.hoverPreviewEl = box;

		const onResize = () => this.positionPopup(anchor, box);
		window.addEventListener("resize", onResize);
		this.resizeListener = onResize;

		await this.renderPopupContents(box, anchor, tag);
	}

	private async renderPopupContents(box: HTMLElement, anchor: HTMLElement, tag: string) {
		const sortMode: PopupSortMode = this.plugin.settings.popupSortMode ?? "newest";
		const countSetting: PopupResultCount = this.plugin.settings.popupResultCount ?? 5;
		const previewMode = this.getHoverPreviewMode();

		box.empty();

		const MARGIN = 10;
		const GAP = 2;
		const a = anchor.getBoundingClientRect();
		const vh = window.innerHeight;

		const spaceBelow = vh - a.bottom - GAP - MARGIN;
		const spaceAbove = a.top - GAP - MARGIN;
		const maxSpace = Math.max(spaceBelow, spaceAbove);

		const HEADER_H = 30;
		const ROW_H = 22;
		const FOOTER_H = 22;

		const availH = maxSpace - HEADER_H - FOOTER_H;
		const maxByViewport = Math.max(3, Math.floor(availH / ROW_H));
		const limit = countSetting === "max" ? maxByViewport : Math.min(countSetting as number, maxByViewport);

		const header = box.createDiv({ cls: "ftv-popup-header" });
		const tagLabel = header.createSpan({ cls: "ftv-popup-tag-label" });
		tagLabel.textContent = previewMode === "tasks" ? `#${tag} · tasks` : `#${tag}`;

		const controls = header.createSpan({ cls: "ftv-popup-controls" });

		const lockAndRefresh = async (action: () => Promise<void>) => {
			this.hoverPreviewHovered = true;
			this.skipNextSettingsRender = true;
			await action();
			await this.renderPopupContents(box, anchor, tag);
			this.positionPopup(anchor, box);
		};

		const sortBtn = controls.createSpan({ cls: "ftv-popup-ctrl-btn" });
		sortBtn.textContent = sortMode === "newest" ? "newest modified" : "alphabetical a-z";
		sortBtn.title = "Click to toggle sort order";
		sortBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void lockAndRefresh(async () => {
				this.plugin.settings.popupSortMode = sortMode === "newest" ? "alpha" : "newest";
				await this.plugin.saveSettings();
			});
		});

		controls.createSpan({ cls: "ftv-popup-ctrl-sep", text: "•" });

		const countCycle: PopupResultCount[] = [5, 10, 20, "max"];
		const countBtn = controls.createSpan({ cls: "ftv-popup-ctrl-btn" });
		countBtn.textContent = `show ${countSetting}`;
		countBtn.title = "Click to change result count";
		countBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void lockAndRefresh(async () => {
				const idx = countCycle.indexOf(countSetting);
				this.plugin.settings.popupResultCount = countCycle[(idx + 1) % countCycle.length];
				await this.plugin.saveSettings();
			});
		});

		if (previewMode === "tasks") {
			let allResults = await this.getPopupTasks(tag);

			if (sortMode === "newest") {
				allResults.sort((a, b) => {
					const diff = b.file.stat.mtime - a.file.stat.mtime;
					return diff !== 0 ? diff : a.lineNumber - b.lineNumber;
				});
			} else {
				allResults.sort((a, b) => {
					const byFile = a.file.basename.localeCompare(b.file.basename, undefined, { sensitivity: "base" });
					if (byFile !== 0) return byFile;
					return a.lineNumber - b.lineNumber;
				});
			}

			const shown = allResults.slice(0, limit);
			const overflow = allResults.length - shown.length;

			if (shown.length === 0) {
				box.createDiv({ cls: "ftv-popup-empty", text: "No matching tasks." });
			} else {
				const measurer = document.createElement("span");
				measurer.className = "ftv-popup-folder-measure";
				measurer.style.position = "fixed";
				measurer.style.visibility = "hidden";
				measurer.style.pointerEvents = "none";
				document.body.appendChild(measurer);

				let maxFileWidth = 60;
				for (const item of shown) {
					measurer.textContent = item.file.basename;
					maxFileWidth = Math.max(maxFileWidth, measurer.offsetWidth);
				}
				measurer.remove();

				const finalFileWidth = Math.min(maxFileWidth + 4, 180);
				box.style.setProperty("--ftv-folder-col", `${finalFileWidth}px`);

				const rowsContainer = box.createDiv({ cls: "ftv-popup-rows" });
				for (const item of shown) {
					const row = rowsContainer.createDiv({ cls: "ftv-popup-row" });
					row.createSpan({ cls: "ftv-popup-folder", text: item.file.basename });
					row.createSpan({ cls: "ftv-popup-sep", text: "│" });
					row.createSpan({ cls: "ftv-popup-name", text: item.taskText });
					row.addEventListener("click", (e) => {
						this.clearHoverPreview();
						void this.openTaskResult(item, e.shiftKey);
					});
				}

				if (overflow > 0) {
					const footer = box.createDiv({ cls: "ftv-popup-overflow" });
					footer.textContent = `+ ${overflow} more matching tasks`;
				}
			}
		} else {
		let allResults = await this.getPopupFiles(tag);


			if (sortMode === "newest") {
				allResults.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
			} else {
				allResults.sort((a, b) =>
					a.file.name.localeCompare(b.file.name, undefined, { sensitivity: "base" })
				);
			}

			const shown = allResults.slice(0, limit);
			const overflow = allResults.length - shown.length;

			if (shown.length === 0) {
				box.createDiv({ cls: "ftv-popup-empty", text: "No matching files." });
			} else {
				const measurer = document.createElement("span");
				measurer.className = "ftv-popup-folder-measure";
				measurer.style.position = "fixed";
				measurer.style.visibility = "hidden";
				measurer.style.pointerEvents = "none";
				document.body.appendChild(measurer);

				let maxFolderWidth = 30;
				for (const item of shown) {
					measurer.textContent = item.folder;
					maxFolderWidth = Math.max(maxFolderWidth, measurer.offsetWidth);
				}
				measurer.remove();

				const finalFolderWidth = Math.min(maxFolderWidth + 4, 140);
				box.style.setProperty("--ftv-folder-col", `${finalFolderWidth}px`);

				const rowsContainer = box.createDiv({ cls: "ftv-popup-rows" });
				for (const item of shown) {
					const row = rowsContainer.createDiv({ cls: "ftv-popup-row" });
					row.createSpan({ cls: "ftv-popup-folder", text: item.folder });
					row.createSpan({ cls: "ftv-popup-sep", text: "│" });
					row.createSpan({ cls: "ftv-popup-name", text: item.file.basename });
					row.addEventListener("click", (e) => {
						this.clearHoverPreview();
						void this.app.workspace.getLeaf(e.shiftKey).openFile(item.file);
					});
				}

				if (overflow > 0) {
					const footer = box.createDiv({ cls: "ftv-popup-overflow" });
					footer.textContent = `+ ${overflow} more (see search pane)`;
				}
			}
		}

		this.positionPopup(anchor, box);
	}

	private positionPopup(anchor: HTMLElement, box: HTMLElement) {
		if (!anchor.isConnected) {
			this.clearHoverPreview();
			return;
		}

		const GAP = 2;
		const MARGIN = 10;

		const a = anchor.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		box.style.left = "0px";
		box.style.top = "0px";
		box.style.visibility = "hidden";

		const w = box.offsetWidth;
		const h = box.offsetHeight;

		const spaceBelow = vh - a.bottom - GAP - MARGIN;
		const spaceAbove = a.top - GAP - MARGIN;

		const placeBelow = spaceBelow >= h || spaceBelow >= spaceAbove;
		let top = placeBelow ? a.bottom + GAP : a.top - GAP - h;
		top = Math.max(MARGIN, Math.min(top, vh - MARGIN - h));

		let left = a.left;
		if (left + w > vw - MARGIN) left = a.right - w;
		left = Math.max(MARGIN, Math.min(left, vw - MARGIN - w));

		box.style.left = `${left}px`;
		box.style.top = `${top}px`;
		box.style.visibility = "visible";
	}
}