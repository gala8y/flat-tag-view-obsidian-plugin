import { ItemView, Platform, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE } from "./constants";
import FlatTagPlugin from "./main";

type SortMode = "az" | "count";
type SearchMode = "note" | "line" | "task" | "task-todo" | "task-done";

export class FlatTagView extends ItemView {
	public plugin: FlatTagPlugin;

	private container!: HTMLElement;
	private tagContainer!: HTMLElement;

	private sortContainer!: HTMLElement;
	private sortAzBtn!: HTMLElement;
	private sortCountBtn!: HTMLElement;

	private scopeBtn!: HTMLElement;
	private taskBtn!: HTMLElement;

	private cutoffToggleBtn!: HTMLElement;
	private cutoffInput!: HTMLInputElement;

	private selectedTags: Set<string> = new Set();
	private excludedTags: Set<string> = new Set();

	private allTags: Map<string, number> = new Map();
	private tagsByFile: Map<string, string[]> = new Map();

	private currentSort: SortMode = "az";
	private searchMode: SearchMode = "note";

	private tagSearchText = "";

	private touchTimer: number | null = null;
	private lastInteractionWasTouch = false;

	constructor(leaf: WorkspaceLeaf, plugin: FlatTagPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.containerEl.addClass("flat-tag-view");
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return "Flat Tags"; }
	getIcon(): string { return "tag"; }

	async onOpen() {
		this.container = this.contentEl.createDiv({ cls: "flat-tag-container" });

		this.containerEl.addEventListener("touchstart", () => {
			this.lastInteractionWasTouch = true;
		}, { passive: true });

		this.containerEl.addEventListener("pointerdown", (e: PointerEvent) => {
			if (e.pointerType && e.pointerType !== "touch") this.lastInteractionWasTouch = false;
		}, { passive: true });

		this.sortContainer = this.container.createDiv({ cls: "flat-tag-sort-container" });
		const buttonSection = this.sortContainer.createDiv({ cls: "flat-tag-buttons-section" });

		this.sortAzBtn = buttonSection.createDiv({ cls: "flat-tag-sort-button", title: "Sort A-Z" });
		setIcon(this.sortAzBtn, "lucide-sort-asc");

		this.sortCountBtn = buttonSection.createDiv({ cls: "flat-tag-sort-button", title: "Sort by usage" });
		setIcon(this.sortCountBtn, "lucide-bar-chart-2");

		const clearButton = buttonSection.createDiv({ cls: "flat-tag-clear-button", title: "Clear tag selections" });
		setIcon(clearButton, "x");
		clearButton.addEventListener("click", () => this.clearTagSelections());

		this.scopeBtn = buttonSection.createDiv({
			cls: "flat-tag-mode-button", text: "NOTE", title: "Click to cycle: Note -> Line",
		});
		this.taskBtn = buttonSection.createDiv({
			cls: "flat-tag-mode-button", text: "TASK-ALL", title: "Click to cycle: All -> Todo -> Done",
		});

		const cutoffSpacer = buttonSection.createDiv({ cls: "flat-tag-cutoff-spacer" });
		cutoffSpacer.ariaHidden = "true";

		const cutoffSection = buttonSection.createDiv({ cls: "flat-tag-cutoff-section" });
		this.cutoffToggleBtn = cutoffSection.createDiv({ cls: "flat-tag-cutoff-toggle", title: "Toggle frequency cutoff" });
		this.cutoffInput = cutoffSection.createEl("input", {
			cls: "flat-tag-cutoff-input",
			attr: { type: "number", min: "0", step: "1", inputmode: "numeric", placeholder: "0" },
		});

		this.cutoffToggleBtn.addEventListener("click", async () => {
			this.plugin.settings.frequencyCutoffEnabled = !this.plugin.settings.frequencyCutoffEnabled;
			await this.plugin.saveSettings();
			this.syncCutoffControlsFromSettings();
			this.renderTags();
		});

		this.cutoffInput.addEventListener("input", async () => {
			const parsed = parseInt(this.cutoffInput.value, 10);
			if (!isNaN(parsed) && parsed >= 0) {
				this.plugin.settings.frequencyCutoff = parsed;
				await this.plugin.saveSettings();
				this.renderTags();
			}
		});

		this.sortAzBtn.addEventListener("click", () => { this.currentSort = "az"; this.updateModeUI(true); });
		this.sortCountBtn.addEventListener("click", () => { this.currentSort = "count"; this.updateModeUI(true); });
		this.scopeBtn.addEventListener("click", () => this.toggleScopeMode());
		this.taskBtn.addEventListener("click", () => this.toggleTaskMode());

		const searchSection = this.sortContainer.createDiv({ cls: "flat-tag-search-section" });
		const searchBox = searchSection.createEl("input", {
			cls: "flat-tag-search-input",
			attr: { type: "text", placeholder: "Search tags..." },
		});

		const clearSearchButton = searchSection.createDiv({ cls: "flat-tag-search-clear-button", title: "Clear search" });
		setIcon(clearSearchButton, "square-x");
		clearSearchButton.addEventListener("click", () => this.clearSearchBox());

		searchBox.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			this.tagSearchText = target.value ?? "";
			this.renderTags();
		});

		this.tagContainer = this.container.createDiv({ cls: "flat-tag-list" });

		this.syncCutoffControlsFromSettings();
		this.updateModeUI(true);

		await this.loadTags();

		this.registerEvent(this.app.metadataCache.on("changed", (file: TFile) => {
			this.updateFileTags(file);
		}));

		this.registerEvent(this.app.vault.on("delete", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				this.removeFileTags(file.path);
				this.renderTags();
			}
		}));

		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && file.extension === "md") {
				const tags = this.tagsByFile.get(oldPath);
				if (tags) {
					this.tagsByFile.set(file.path, tags);
					this.tagsByFile.delete(oldPath);
				}
			}
		}));

		this.registerEvent(this.app.workspace.on("flat-tag-view:settings-updated" as any, () => {
			this.syncCutoffControlsFromSettings();
			this.renderTags();
		}));
	}

	async onClose() {
		this.contentEl.empty();
	}

	async loadTags() {
		this.allTags.clear();
		this.tagsByFile.clear();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const fileTags = this.getFileTags(file);
			this.tagsByFile.set(file.path, fileTags);
			fileTags.forEach(tag => this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1));
		}
		this.renderTags();
	}

	private updateFileTags(file: TFile) {
		const oldTagsArr = this.tagsByFile.get(file.path) || [];
		const newTagsArr = this.getFileTags(file);
		const oldSorted = [...oldTagsArr].sort().join(",");
		const newSorted = [...newTagsArr].sort().join(",");
		if (oldSorted === newSorted) return;

		oldTagsArr.forEach(tag => {
			const count = (this.allTags.get(tag) || 0) - 1;
			if (count <= 0) this.allTags.delete(tag);
			else this.allTags.set(tag, count);
		});
		newTagsArr.forEach(tag => this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1));
		this.tagsByFile.set(file.path, newTagsArr);
		this.renderTags();
	}

	private removeFileTags(filePath: string) {
		const oldTags = this.tagsByFile.get(filePath);
		if (!oldTags) return;
		oldTags.forEach(tag => {
			const count = (this.allTags.get(tag) || 0) - 1;
			if (count <= 0) this.allTags.delete(tag);
			else this.allTags.set(tag, count);
		});
		this.tagsByFile.delete(filePath);
	}

	async renderTags() {
		this.tagContainer.empty();

		this.sortAzBtn.toggleClass("is-active", this.currentSort === "az");
		this.sortCountBtn.toggleClass("is-active", this.currentSort === "count");

		const filteredTags = await this.getFilteredTagsAsync();

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
			Array.from(pinned.entries())
				.sort((a, b) => a[0].localeCompare(b[0], "pl"))
				.forEach(([tag, count]) => this.createTagElement(tag, count, pinContainer));
			this.tagContainer.createDiv({ cls: "flat-tag-separator" });
		}

		let sortedTags = Array.from(normal.entries());

		if (this.currentSort === "az") {
			sortedTags.sort((a, b) => a[0].localeCompare(b[0], "pl"));

			const polishDiacritics = ["Ą", "Ć", "Ę", "Ł", "Ń", "Ó", "Ś", "Ź", "Ż"];
			const buckets = new Map<string, [string, number][]>();
			for (let c = 65; c <= 90; c++) buckets.set(String.fromCharCode(c), []);
			polishDiacritics.forEach(l => buckets.set(l, []));
			buckets.set("OTHER", []);

			for (const item of sortedTags) {
				const first = (item[0].charAt(0) || "").toUpperCase();
				if (buckets.has(first)) buckets.get(first)!.push(item);
				else buckets.get("OTHER")!.push(item);
			}

			for (const [letter, items] of buckets.entries()) {
				if (items.length === 0) continue;
				if (letter !== "OTHER") {
					const letterEl = this.tagContainer.createSpan({ cls: "flat-tag-letter" });
					letterEl.setText(letter);
				}
				items.forEach(([tag, count]) => this.createTagElement(tag, count, this.tagContainer));
			}
		} else {
			sortedTags.sort((a, b) => {
				if (b[1] !== a[1]) return b[1] - a[1];
				return a[0].localeCompare(b[0], "pl");
			});
			sortedTags.forEach(([tag, count]) => this.createTagElement(tag, count, this.tagContainer));
		}
	}

	private createTagElement(tag: string, count: number, parentEl: HTMLElement) {
		const tagEl = parentEl.createSpan({ cls: "flat-tag" });

		if (this.selectedTags.has(tag)) tagEl.addClass("flat-tag-selected");
		else if (this.excludedTags.has(tag)) tagEl.addClass("flat-tag-excluded");
		if ((this.plugin.settings.pinnedTags ?? []).includes(tag)) tagEl.addClass("flat-tag-pinned");

		tagEl.setText(`#${tag} (${count})`);
		tagEl.style.userSelect = "none";
		(tagEl.style as any).webkitUserSelect = "none";

		const handleTagInteraction = async (isMultiSelect: boolean, isExclude: boolean, isPin: boolean) => {
			if (isPin) {
				const list = this.plugin.settings.pinnedTags ?? [];
				this.plugin.settings.pinnedTags = list.includes(tag)
					? list.filter(t => t !== tag)
					: [...list, tag];
				await this.plugin.saveSettings();
				this.renderTags();
				return;
			}

			if (isExclude) {
				if (this.excludedTags.has(tag)) this.excludedTags.delete(tag);
				else { this.excludedTags.add(tag); this.selectedTags.delete(tag); }
			} else if (isMultiSelect) {
				if (this.selectedTags.has(tag)) this.selectedTags.delete(tag);
				else { this.selectedTags.add(tag); this.excludedTags.delete(tag); }
			} else {
				if (this.selectedTags.size === 1 && this.selectedTags.has(tag)) this.selectedTags.clear();
				else {
					this.selectedTags.clear();
					this.excludedTags.clear();
					this.selectedTags.add(tag);
				}
			}

			// ── Optimistic immediate visual update ────────────────────────────────
			// renderTags() is async; update this element's class right now so the
			// colour change is instant, without waiting for the full re-render.
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
			// ─────────────────────────────────────────────────────────────────────

			this.renderTags();
			void this.updateSearch();
		};

		// ── Per-element touch-handled flag ────────────────────────────────────────
		// On mobile the browser synthesises a `click` event ~300ms after touchend.
		// Since touchend is passive we cannot call preventDefault(). Instead we set
		// this flag whenever a touch interaction has already been handled, and the
		// click listener bails out when it sees it set.
		// ─────────────────────────────────────────────────────────────────────────
		let touchHandled = false;

		// Per-element touch state (all in closure — no shared class fields needed)
		let touchStartX = 0;
		let touchStartY = 0;
		let isSwiping = false;
		let longPressTriggered = false;

		tagEl.addEventListener("click", (e) => {
			// Skip the synthetic click that follows a touch interaction.
			if (touchHandled) {
				touchHandled = false;
				return;
			}
			e.preventDefault();
			void handleTagInteraction(!!(e.ctrlKey || e.metaKey), !!e.shiftKey, !!e.altKey);
		});

		tagEl.addEventListener("touchstart", (e) => {
			const touch = e.touches[0];
			touchStartX = touch.clientX;
			touchStartY = touch.clientY;
			isSwiping = false;
			longPressTriggered = false;
			touchHandled = false;

			if (this.touchTimer) window.clearTimeout(this.touchTimer);
			this.touchTimer = window.setTimeout(() => {
				this.touchTimer = null;
				if (!isSwiping) {
					longPressTriggered = true;
					touchHandled = true; // suppress the upcoming synthetic click
					void handleTagInteraction(true, false, false);
				}
			}, 500);
		}, { passive: true });

		tagEl.addEventListener("touchmove", (e) => {
			const touch = e.touches[0];
			const dx = touch.clientX - touchStartX;
			const dy = touch.clientY - touchStartY;
			if (!isSwiping) {
				if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
					if (this.touchTimer) { window.clearTimeout(this.touchTimer); this.touchTimer = null; }
					isSwiping = true;
				} else if (Math.abs(dy) > 10) {
					if (this.touchTimer) { window.clearTimeout(this.touchTimer); this.touchTimer = null; }
					return;
				}
			}
			if (isSwiping && dx < 0) {
				e.preventDefault();
				const capped = Math.max(dx, -90);
				tagEl.style.transform = `translateX(${capped}px)`;
				tagEl.style.opacity = String(0.5 + (Math.abs(capped) / 90) * 0.5);
			}
		}, { passive: false });

		tagEl.addEventListener("touchend", (e) => {
			const touch = e.changedTouches[0];
			const dx = touch.clientX - touchStartX;
			tagEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
			tagEl.style.transform = "";
			tagEl.style.opacity = "";
			setTimeout(() => { tagEl.style.transition = ""; }, 220);

			// Swipe handled
			if (isSwiping) {
				isSwiping = false;
				touchHandled = true; // suppress synthetic click after swipe
				if (dx <= -60) void handleTagInteraction(false, false, true);
				return;
			}

			// Long press already fired — do nothing, click already suppressed
			if (longPressTriggered) {
				longPressTriggered = false;
				return;
			}

			// Short tap — cancel timer and handle as single-select
			if (this.touchTimer) {
				window.clearTimeout(this.touchTimer);
				this.touchTimer = null;
				touchHandled = true; // suppress synthetic click after tap
				void handleTagInteraction(false, false, false);
			}
		}, { passive: true });

		tagEl.addEventListener("touchcancel", () => {
			isSwiping = false;
			longPressTriggered = false;
			touchHandled = false;
			if (this.touchTimer) { window.clearTimeout(this.touchTimer); this.touchTimer = null; }
			tagEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
			tagEl.style.transform = "";
			tagEl.style.opacity = "";
			setTimeout(() => { tagEl.style.transition = ""; }, 220);
		}, { passive: true });
	}

	private async getFilteredTagsAsync(): Promise<Map<string, number>> {
		let filtered = new Map<string, number>();

		if (this.selectedTags.size === 0) {
			filtered = new Map(this.allTags);
		} else {
			const selectedArr = Array.from(this.selectedTags);
			const matchingFiles: string[] = [];
			this.tagsByFile.forEach((tagsArr, filePath) => {
				if (selectedArr.every(t => tagsArr.includes(t))) matchingFiles.push(filePath);
			});

			if (this.searchMode === "note") {
				for (const filePath of matchingFiles) {
					const tags = this.tagsByFile.get(filePath);
					if (!tags) continue;
					for (const t of tags) filtered.set(t, (filtered.get(t) || 0) + 1);
				}
			} else {
				for (const filePath of matchingFiles) {
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (!(file instanceof TFile)) continue;
					const content = await this.app.vault.cachedRead(file);
					const lines = content.split(/\r?\n/);
					for (const line of lines) {
						const lower = line.toLowerCase();
						if (this.searchMode === "task"      && !lower.includes("- ["))   continue;
						if (this.searchMode === "task-todo" && !lower.includes("- [ ]")) continue;
						if (this.searchMode === "task-done" && !lower.includes("- [x"))  continue;
						const lineTags = new Set<string>();
						const tagRegex = /#([^\s#]+)/g;
						let m: RegExpExecArray | null;
						while ((m = tagRegex.exec(lower)) !== null) lineTags.add(m[1]);
						const hasAll = selectedArr.every(sel =>
							Array.from(lineTags).some(t => t.toLowerCase() === sel.toLowerCase())
						);
						if (!hasAll) continue;
						for (const t of lineTags) filtered.set(t, (filtered.get(t) || 0) + 1);
					}
				}
			}
		}

		for (const t of this.selectedTags) if (!filtered.has(t)) filtered.set(t, this.allTags.get(t) || 0);
		for (const t of this.excludedTags) if (!filtered.has(t)) filtered.set(t, this.allTags.get(t) || 0);

		const cutoffEnabled = this.plugin.settings.frequencyCutoffEnabled ?? false;
		const cutoff = cutoffEnabled ? (this.plugin.settings.frequencyCutoff ?? 0) : 0;
		const pinned = new Set(this.plugin.settings.pinnedTags ?? []);

		if (cutoff > 0) {
			const next = new Map<string, number>();
			filtered.forEach((count, tag) => {
				if (count >= cutoff || this.selectedTags.has(tag) || pinned.has(tag)) next.set(tag, count);
			});
			filtered = next;
		}

		if (this.tagSearchText) {
			const q = this.tagSearchText.toLowerCase();
			const next = new Map<string, number>();
			filtered.forEach((count, tag) => {
				if (tag.toLowerCase().includes(q) || this.selectedTags.has(tag) || this.excludedTags.has(tag))
					next.set(tag, count);
			});
			filtered = next;
		}

		return filtered;
	}

	private async updateSearch(options?: { revealSearch?: boolean; createIfMissing?: boolean }) {
		const workspace = this.app.workspace;
		const prevLeaf = workspace.activeLeaf;

		const isTouchContext = Platform.isMobile || this.lastInteractionWasTouch;
		const revealSearch    = options?.revealSearch    ?? !isTouchContext;
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

		if (selected.length === 0 && excluded.length === 0) {
			const clearBtn = searchView?.containerEl?.querySelector(".search-input-clear-button") as HTMLElement | null;
			if (clearBtn) clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: false }));
			else if (typeof searchView?.setQuery === "function") searchView.setQuery("");
			return;
		}

		let query = "";
		if (this.searchMode === "note") {
			query = [
				...selected.map(t => `tag:#${t}`),
				...excluded.map(t => `-tag:#${t}`),
			].join(" ");
		} else {
			const prefix =
				this.searchMode === "line"      ? "line:("      :
				this.searchMode === "task"      ? "task:("      :
				this.searchMode === "task-todo" ? "task-todo:(" :
				                                  "task-done:(";
			const body = [
				...selected.map(t => `#${t}`),
				...excluded.map(t => `-#${t}`),
			].join(" ");
			query = `${prefix}${body})`;
		}

		if (typeof searchView?.setQuery === "function") searchView.setQuery(query);
	}

	getFileTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return [];
		const tags: string[] = [];
		if (cache.tags) cache.tags.forEach(t => tags.push(t.tag.replace(/^#/, "")));
		const fm = cache.frontmatter?.tags;
		if (typeof fm === "string") {
			fm.split(",").map(s => s.trim()).filter(Boolean).forEach(t => tags.push(t.replace(/^#/, "")));
		} else if (Array.isArray(fm)) {
			fm.forEach(t => { if (t) tags.push(String(t).replace(/^#/, "")); });
		}
		return Array.from(new Set(tags));
	}

	private syncCutoffControlsFromSettings() {
		const enabled = this.plugin.settings.frequencyCutoffEnabled ?? false;
		const cutoff  = this.plugin.settings.frequencyCutoff ?? 0;
		this.cutoffInput.value = String(cutoff);
		this.cutoffInput.disabled = !enabled;
		this.cutoffToggleBtn.toggleClass("is-enabled", enabled);
		this.cutoffToggleBtn.toggleClass("is-disabled", !enabled);
		setIcon(this.cutoffToggleBtn, enabled ? "eye" : "eye-off");
	}

	public updateModeUI(skipSearch = false) {
		this.sortAzBtn.toggleClass("is-active", this.currentSort === "az");
		this.sortCountBtn.toggleClass("is-active", this.currentSort === "count");

		this.scopeBtn.removeClass("is-active");
		this.taskBtn.removeClass("is-active");

		if      (this.searchMode === "note")      { this.scopeBtn.setText("NOTE");      this.scopeBtn.addClass("is-active"); }
		else if (this.searchMode === "line")      { this.scopeBtn.setText("LINE");      this.scopeBtn.addClass("is-active"); }
		else if (this.searchMode === "task")      { this.taskBtn.setText("TASK-ALL");   this.taskBtn.addClass("is-active"); }
		else if (this.searchMode === "task-todo") { this.taskBtn.setText("TASK-TODO");  this.taskBtn.addClass("is-active"); }
		else if (this.searchMode === "task-done") { this.taskBtn.setText("TASK-DONE");  this.taskBtn.addClass("is-active"); }

		if (["note", "line"].includes(this.searchMode)) {
			if (!["TASK-ALL", "TASK-TODO", "TASK-DONE"].includes(this.taskBtn.innerText)) this.taskBtn.setText("TASK-ALL");
		} else {
			if (!["NOTE", "LINE"].includes(this.scopeBtn.innerText)) this.scopeBtn.setText("NOTE");
		}

		if (!skipSearch) void this.updateSearch();
		if (this.tagContainer) this.renderTags();
	}

	public toggleScopeMode() {
		if (["note", "line"].includes(this.searchMode)) this.searchMode = this.searchMode === "note" ? "line" : "note";
		else this.searchMode = this.scopeBtn.innerText === "LINE" ? "line" : "note";
		this.updateModeUI();
	}

	public toggleTaskMode() {
		if (this.searchMode === "task")           this.searchMode = "task-todo";
		else if (this.searchMode === "task-todo") this.searchMode = "task-done";
		else if (this.searchMode === "task-done") this.searchMode = "task";
		else                                       this.searchMode = "task";
		this.updateModeUI();
	}

	public toggleSort() {
		this.currentSort = this.currentSort === "az" ? "count" : "az";
		this.updateModeUI(true);
	}

	public clearTagSelections() {
		this.selectedTags.clear();
		this.excludedTags.clear();
		this.renderTags();
		void this.updateSearch({ revealSearch: false, createIfMissing: false });
	}

	public clearSearchBox() {
		const searchBox = this.contentEl.querySelector(".flat-tag-search-input") as HTMLInputElement | null;
		if (searchBox) searchBox.value = "";
		this.tagSearchText = "";
		this.renderTags();
	}
}
