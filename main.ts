

import {
	Editor,
	EditorPosition,
	MarkdownView,
	Notice,
	Platform,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { VIEW_TYPE } from "./constants";
import { FlatTagView } from "./flatTagView";
import { getStyles } from "./styles";
import {
	AltClickTagMode,
	DEFAULT_SETTINGS,
	FlatTagPluginSettings,
	FlatTagSettingTab,
	PopupResultCount,
} from "./settings";
import { TagIndex } from "./TagIndex";

type EditorRange = { from: EditorPosition; to: EditorPosition };
type Candidate = { raw: string; range?: EditorRange };

export default class FlatTagPlugin extends Plugin {
	settings: FlatTagPluginSettings;
	private statusBarEl: HTMLElement | null = null;
	private styleEl: HTMLStyleElement | null = null;
	private saveTimeout: number | null = null;
    private startupReloadTimer: number | null = null;

    async onload() {
        await this.loadSettings();

        const tagIndex = TagIndex.getInstance(this.app);

        this.registerTagIndexListeners(tagIndex);

        this.app.workspace.onLayoutReady(() => {
            void this.runInitialTagIndexLoad(tagIndex);
        });

        this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new FlatTagView(leaf, this));
        this.addRibbonIcon("tag", "Open Flat Tags", () => void this.activateView());
        this.addSettingTab(new FlatTagSettingTab(this.app, this));

        this.addCommand({
            id: "open-flat-tags",
            name: "Open Flat Tag View pane",
            callback: () => void this.activateView(),
        });

        this.addCommand({
            id: "toggle-flat-tag-sort",
            name: "Toggle sort (A-Z/Usage)",
            callback: () => {
            const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
            if (view && typeof view.toggleSort === "function") view.toggleSort();
            },
        });

        this.addCommand({
            id: "clear-flat-tag-selections",
            name: "Clear tags selection",
            callback: () => {
            const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
            if (view && typeof view.clearTagSelections === "function") view.clearTagSelections();
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-frequency-cutoff",
            name: "Toggle frequency cutoff",
            callback: async () => {
            this.settings.frequencyCutoffEnabled = !this.settings.frequencyCutoffEnabled;
            await this.saveSettings();
            },
        });

        this.addCommand({
            id: "clear-flat-tag-search",
            name: "Clear search box",
            callback: () => {
            const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
            if (view && typeof view.clearSearchBox === "function") view.clearSearchBox();
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-note-line-mode",
            name: "Toggle mode (Note/Line)",
            callback: () => {
            const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
            if (view && typeof view.toggleNoteLineMode === "function") view.toggleNoteLineMode();
            },
        });

        this.addCommand({
            id: 'toggle-flat-tag-at-cursor',
            name: 'Create/remove tag at cursor',
            editorCallback: (editor: Editor, view: MarkdownView) => {
            void this.handleEditorTrigger({ kind: 'alt-click' });
            },
        });

        this.addCommand({
            id: 'strip-hash-from-tag-at-cursor',
            name: 'Strip hash from tag at cursor position',
            editorCallback: (editor: Editor, view: MarkdownView) => {
            void this.handleEditorTrigger({ kind: 'strip-hash' });
            },
        });

        this.addCommand({
            id: 'drill-down-tag-at-cursor',
            name: 'Send tag at cursor to pane',
            editorCallback: (editor: Editor, view: MarkdownView) => {
            void this.handleEditorTrigger({ kind: 'drill-down' });
            },
        });

        this.addCommand({
            id: 'local-mute-tag-at-cursor',
            name: 'Mute/Unmute tag instance at cursor',
            editorCallback: (editor: Editor, view: MarkdownView) => {
            void this.handleEditorTrigger({ kind: 'local-mute' });
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-task-mode",
            name: "Cycle task mode (All/Todo/Done)",
            callback: () => {
            const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
            if (view && typeof view.toggleTaskMode === "function") view.toggleTaskMode();
            },
        });

        this.addCommand({
            id: "cycle-flat-tag-placement",
            name: "Cycle tag placement (SOL / INP / EOL)",
            callback: () => void this.cycleTagPlacement(),
        });

        this.addCommand({
            id: "set-flat-tag-placement-sol",
            name: "Set new tag placement to Start of Line (SOL)",
            callback: async () => {
            this.settings.altClickTagMode = "start-line";
            await this.saveSettings();
            new Notice("Tag placement: Start of line");
            },
        });

        this.addCommand({
            id: "set-flat-tag-placement-inp",
            name: "Set new tag placement to In Place (INP)",
            callback: async () => {
            this.settings.altClickTagMode = "in-place";
            await this.saveSettings();
            new Notice("Tag placement: In place");
            },
        });

        this.addCommand({
            id: "set-flat-tag-placement-eol",
            name: "Set new tag placement to End of Line (EOL)",
            callback: async () => {
            this.settings.altClickTagMode = "end-line";
            await this.saveSettings();
            new Notice("Tag placement: End of line");
            },
        });

        this.addCommand({
            id: "set-flat-tag-scope-first",
            name: "Switch to 1st scope",
            callback: async () => {
            const scopes = this.settings.scopes || [];
            if (scopes.length > 0) {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.applyScope === "function") {
                await view.applyScope(scopes[0].id);
                new Notice(`Scope applied: ${scopes[0].name}`);
                }
            } else {
                new Notice("No scopes configured.");
            }
            },
        });

        this.addCommand({
            id: "set-flat-tag-scope-second",
            name: "Switch to 2nd scope",
            callback: async () => {
            const scopes = this.settings.scopes || [];
            if (scopes.length > 1) {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.applyScope === "function") {
                await view.applyScope(scopes[1].id);
                new Notice(`Scope applied: ${scopes[1].name}`);
                }
            } else {
                new Notice("2nd scope not configured.");
            }
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-scopes",
            name: "Toggle scopes On/Off",
            callback: () => {
            const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
            if (view && typeof view.toggleScopes === "function") {
                view.toggleScopes();
            }
            },
        });

        this.addStyle();

        this.statusBarEl = this.addStatusBarItem();
        this.updateStatusBar();
        this.statusBarEl.addClass("mod-clickable");
        this.statusBarEl.addEventListener("click", () => void this.cycleTagPlacement());

        // --- NEW MULTI-WINDOW CLICK LISTENER LOGIC ---
        const attachEditorClickListener = (doc: Document) => {
            this.registerDomEvent(doc, "click", (evt: MouseEvent) => {
                if (!evt.altKey) return;

                const target = evt.target as HTMLElement;
                if (target && target.closest('.flat-tag-container')) return;

                if (evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    void this.handleEditorTrigger({ kind: "local-mute", mouseEvent: evt });
                    return;
                }

                if (evt.shiftKey && !evt.ctrlKey && !evt.metaKey) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    void this.handleEditorTrigger({ kind: "strip-hash", mouseEvent: evt });
                    return;
                }

                if (!evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    void this.handleEditorTrigger({ kind: "drill-down", mouseEvent: evt });
                    return;
                }

                if (!evt.shiftKey && !evt.ctrlKey && !evt.metaKey) {
                    evt.preventDefault();
                    void this.handleEditorTrigger({ kind: "alt-click", mouseEvent: evt });
                    return;
                }
            }, { capture: true });
        };

        attachEditorClickListener(document);

        this.app.workspace.onLayoutReady(() => {
            this.app.workspace.iterateAllLeaves((leaf) => {
                const doc = leaf.view.containerEl.ownerDocument;
                if (doc && doc !== document) {
                    if (!(doc as any)._ftvClickAttached) {
                        attachEditorClickListener(doc);
                        (doc as any)._ftvClickAttached = true;
                    }
                }
            });
        });

        this.registerEvent(
            this.app.workspace.on("window-open", (workspaceWindow) => {
                attachEditorClickListener(workspaceWindow.doc);
            })
        );
        // --- END NEW MULTI-WINDOW CLICK LISTENER LOGIC ---

        this.registerMobileLongPress();
    }

    private registerTagIndexListeners(tagIndex: TagIndex) {
        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
            if (!(file instanceof TFile) || file.extension !== "md") return;

            const ignored = (this.app.metadataCache as any).isUserIgnored?.(file.path);
            if (ignored) {
                if (tagIndex.tagsByFile.has(file.path)) {
                tagIndex.removeFileTags(file.path);
                }
                return;
            }

            void tagIndex.updateFileTags(file);
            })
        );

        this.registerEvent(
            this.app.vault.on("delete", (file) => {
            if (file instanceof TFile && file.extension === "md") {
                tagIndex.removeFileTags(file.path);
            }
            })
        );

        this.registerEvent(
            this.app.vault.on("rename", (file, oldPath) => {
            if (!(file instanceof TFile) || file.extension !== "md") return;

            const ignored = (this.app.metadataCache as any).isUserIgnored?.(file.path);
            if (ignored) {
                tagIndex.removeFileTags(oldPath);
                return;
            }

            void tagIndex.renameFile(oldPath, file);
            })
        );
        }

        private async runInitialTagIndexLoad(tagIndex: TagIndex) {
        await tagIndex.loadTags();

        if (this.startupReloadTimer) {
            window.clearTimeout(this.startupReloadTimer);
        }

        this.startupReloadTimer = window.setTimeout(() => {
            this.startupReloadTimer = null;
            void tagIndex.loadTags();
        }, 1500);
    }


    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);

        if (this.startupReloadTimer) {
            window.clearTimeout(this.startupReloadTimer);
            this.startupReloadTimer = null;
        }

        if (this.statusBarEl) {
            this.statusBarEl.remove();
            this.statusBarEl = null;
        }

        if (this.styleEl) {
            this.styleEl.remove();
            this.styleEl = null;
        }
    }


	public async cycleTagPlacement() {
		const modes: AltClickTagMode[] = ["start-line", "in-place", "end-line"];
		const current = this.settings.altClickTagMode;
		const next = modes[(modes.indexOf(current) + 1) % modes.length];
		this.settings.altClickTagMode = next;
		await this.saveSettings();

		const labels: Record<AltClickTagMode, string> = {
			"start-line": "Start of line",
			"in-place": "In place",
			"end-line": "End of line",
		};

		new Notice(`Tag placement: ${labels[next]}`);
	}

	private updateStatusBar() {
		if (!this.statusBarEl) return;

		const show = this.settings.showPlacementInStatusBar ?? true;
		if (!show) {
			this.statusBarEl.setText("");
			this.statusBarEl.style.display = "none";
			return;
		}

		const labels: Record<AltClickTagMode, string> = {
			"start-line": "SOL",
			"in-place": "INP",
			"end-line": "EOL",
		};

		const modeLabel = labels[this.settings.altClickTagMode] ?? "SOL";
		this.statusBarEl.setText(modeLabel);
		this.statusBarEl.style.display = "";
	}

	private registerMobileLongPress() {
		if (!Platform.isMobile) return;
		let timer: number | null = null;
		let startX = 0;
		let startY = 0;
		let cancelled = false;
		let longPressArmed = false;

		const clear = () => {
			if (timer) window.clearTimeout(timer);
			timer = null;
			longPressArmed = false;
		};

		this.registerDomEvent(
			document,
			"touchstart",
			(evt: TouchEvent) => {
				if (!this.settings.mobileLongPressEnabled) return;
				if (evt.touches.length !== 1) return;

				cancelled = false;
				longPressArmed = false;

				const t = evt.touches[0];
				startX = t.clientX;
				startY = t.clientY;

				clear();

				const ms = Math.max(
					250,
					Math.min(5000, this.settings.mobileLongPressMs ?? 1000)
				);

				timer = window.setTimeout(() => {
					timer = null;
					if (cancelled) return;
					longPressArmed = true;
				}, ms);
			},
			{ passive: true }
		);

		this.registerDomEvent(
			document,
			"touchmove",
			(evt: TouchEvent) => {
				if (!timer) return;
				const t = evt.touches[0];
				const dx = Math.abs(t.clientX - startX);
				const dy = Math.abs(t.clientY - startY);
				if (dx > 12 || dy > 12) {
					cancelled = true;
					clear();
				}
			},
			{ passive: true }
		);

		this.registerDomEvent(
			document,
			"touchend",
			() => {
				const shouldFire = longPressArmed && !cancelled;
				clear();
				if (!shouldFire) return;
				void this.handleEditorTrigger({ kind: "mobile-long-press" });
			},
			{ passive: true }
		);

		this.registerDomEvent(
			document,
			"touchcancel",
			() => {
				cancelled = true;
				clear();
			},
			{ passive: true }
		);
	}

	private async handleEditorTrigger(trigger: {
		kind: "alt-click" | "drill-down" | "local-mute" | "strip-hash" | "mobile-long-press";
		mouseEvent?: MouseEvent;
	}) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const isSourceMode =
			(view as any).getMode &&
			typeof (view as any).getMode === "function" &&
			(view as any).getMode() === "source";

		if (!isSourceMode) {
			if (trigger.kind === "drill-down" && trigger.mouseEvent) {
				const target = trigger.mouseEvent.target as HTMLElement | null;
				const tagEl = target?.closest(".tag");
				const tagText = tagEl?.textContent?.trim();

				if (tagText && tagText.startsWith("#") && !tagText.startsWith("#%")) {
					await this.activateView();
					setTimeout(() => {
						const ftvLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
						if (ftvLeaf?.view instanceof FlatTagView) {
							ftvLeaf.view.selectSingleTag(tagText);
						}
					}, 50);
				}
			}
			return;
		}

		const editor = view.editor;
		if (!editor) return;

		if (trigger.kind === "mobile-long-press") {
			const sel = editor.getSelection();
			if (!sel || !sel.trim()) return;
		}

		const candidate = this.getCandidateWithRange(editor, {
			preferSelection: Platform.isMobile,
		});
		if (!candidate) return;

		if (trigger.kind === "drill-down") {
			if (candidate.raw.startsWith("#") && !candidate.raw.startsWith("#%")) {
				await this.activateView();
				setTimeout(() => {
					const ftvLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
					if (ftvLeaf?.view instanceof FlatTagView) {
						ftvLeaf.view.selectSingleTag(candidate.raw);
					}
				}, 50);
			}
			return;
		}

		if (trigger.kind === "local-mute") {
			if (!candidate.range) return;
			const currentTag = candidate.raw;
			if (!currentTag.startsWith("#")) return;

			let newTag = currentTag;
			if (currentTag.startsWith("#%")) newTag = "#" + currentTag.slice(2);
			else newTag = "#%" + currentTag.slice(1);

			editor.replaceRange(newTag, candidate.range.from, candidate.range.to);
			return;
		}

		if (trigger.kind === "strip-hash") {
			if (candidate.raw.startsWith("#%")) return;
			if (!candidate.raw.startsWith("#")) return;
			await this.stripHashFromTag(editor, candidate);
			return;
		}

		if (trigger.kind === "alt-click" || trigger.kind === "mobile-long-press") {
			if (candidate.raw.startsWith("#%")) return;

			if (candidate.raw.startsWith("#")) {
				await this.removeTag(editor, candidate);
			} else {
				await this.createTag(editor, this.settings.altClickTagMode, candidate);
			}
		}
	}

	private getSelectionRange(editor: Editor): EditorRange | null {
		const anyEditor = editor as any;
		const from = anyEditor.getCursor?.("from") as EditorPosition | undefined;
		const to = anyEditor.getCursor?.("to") as EditorPosition | undefined;

		if (!from || !to) return null;
		if (from.line === to.line && from.ch === to.ch) return null;

		if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
			return { from: to, to: from };
		}

		return { from, to };
	}

	private buildSelCandidate(editor: Editor, sel: string, r: EditorRange): Candidate {
		const raw = sel.trim();

		if (!raw.startsWith("#") && r.from.ch > 0) {
			const lineText = editor.getLine(r.from.line);
			const hashIndex = r.from.ch - 1;

			if (
				lineText.charAt(hashIndex) === "#" &&
				this.hasTagBoundary(lineText, hashIndex)
			) {
				return {
					raw: "#" + raw,
					range: { from: { line: r.from.line, ch: hashIndex }, to: r.to },
				};
			}
		}

		return { raw, range: r };
	}

	private getCandidateWithRange(
		editor: Editor,
		opts?: { preferSelection?: boolean }
	): Candidate | null {
		const preferSelection = opts?.preferSelection ?? true;
		const sel = editor.getSelection();
		const selRange = this.getSelectionRange(editor);

		if (preferSelection && sel && sel.trim() && !/\r?\n/.test(sel) && selRange) {
			return this.buildSelCandidate(editor, sel, selRange);
		}

		const token = this.getTokenAtCursor(editor);
		if (token) return token;

		if (!preferSelection && sel && sel.trim() && !/\r?\n/.test(sel) && selRange) {
			return this.buildSelCandidate(editor, sel, selRange);
		}

		return null;
	}

	private getTokenAtCursor(editor: Editor): Candidate | null {
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line) ?? "";
		if (!lineText) return null;

		let i = cursor.ch;
		if (i >= lineText.length) i = lineText.length - 1;
		if (i < 0) return null;

		const cur = lineText.charAt(i);

		if (cur === "#") {
			if (!this.hasTagBoundary(lineText, i)) return null;

			let end = i + 1;
			while (end < lineText.length && this.isTagBodyChar(lineText.charAt(end))) end++;
			if (end === i + 1) return null;

			return {
				raw: lineText.slice(i, end),
				range: {
					from: { line: cursor.line, ch: i },
					to: { line: cursor.line, ch: end },
				},
			};
		}

		if (this.isTagBodyChar(cur)) {
			return this.wordRangeAt(cursor.line, lineText, i);
		}

		if (i > 0 && this.isTagBodyChar(lineText.charAt(i - 1))) {
			return this.wordRangeAt(cursor.line, lineText, i - 1);
		}

		return null;
	}

	private wordRangeAt(line: number, lineText: string, i: number): Candidate | null {
		let start = i;
		while (start > 0 && this.isTagBodyChar(lineText.charAt(start - 1))) start--;

		let hashStart = start;
		if (
			start > 0 &&
			lineText.charAt(start - 1) === "#" &&
			this.hasTagBoundary(lineText, start - 1)
		) {
			hashStart = start - 1;
		}

		let end = i + 1;
		while (end < lineText.length && this.isTagBodyChar(lineText.charAt(end))) end++;

		const raw = lineText.slice(hashStart, end);
		if (!raw.trim()) return null;

		return {
			raw,
			range: { from: { line, ch: hashStart }, to: { line, ch: end } },
		};
	}

	private hasTagBoundary(lineText: string, hashIndex: number): boolean {
		return hashIndex === 0 || lineText.charAt(hashIndex - 1) === " ";
	}

	private isTagBodyChar(ch: string): boolean {
		return /[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]/u.test(ch);
	}

	private hasForbiddenChars(raw: string): boolean {
		const s = raw.trim();
		if (!s) return true;

		const body = s.startsWith("#") ? s.slice(1) : s;
		if (!body) return true;
		if (body.includes("#")) return true;

		for (const ch of Array.from(body)) {
			if (!this.isTagBodyChar(ch)) return true;
		}

		return false;
	}

	private normalizeCandidate(raw: string): string | null {
		let t = raw.trim();
		if (!t) return null;
		if (this.hasForbiddenChars(t)) return null;

		if (t.startsWith("#")) t = t.slice(1);
		if (!t) return null;
		if (/\s/u.test(t)) return null;
		if (t === "%") return null;

		return t;
	}

	private tagTokenForPlacement(candidate: string, mode: AltClickTagMode): string {
		const text =
			mode === "start-line" || mode === "end-line"
				? candidate.toLowerCase()
				: candidate;
		return `#${text}`;
	}

	private sortTags(tokens: string[]): string[] {
		const uniq: string[] = [];
		const seen = new Set<string>();

		for (const t of tokens) {
			const key = t.replace(/^#/, "").toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			uniq.push(t);
		}

		return uniq.sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase(), "pl")
		);
	}

	private parseLeadingTags(lineText: string): {
		indent: string;
		tagBlock: string;
		tags: string[];
		after: string;
	} {
		const indent = lineText.match(/^\s*/)?.[0] ?? "";
		const rest = lineText.slice(indent.length);

		const m = rest.match(/^((?:#(?:[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]+)\s*)*)/u);
		const tagBlock = m?.[1] ?? "";
		const tags = tagBlock.match(/#(?:[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]+)/gu) ?? [];
		const after = rest.slice(tagBlock.length);

		return { indent, tagBlock, tags, after };
	}

	private splitBlockIdSuffix(lineText: string): {
		core: string;
		blockId: string;
		trailingWs: string;
	} {
		const trailingWs = lineText.match(/\s*$/)?.[0] ?? "";
		const noTrail = lineText.slice(0, lineText.length - trailingWs.length);
		const m = noTrail.match(/(\s+\^[\p{L}\p{N}_-]+)$/u);

		if (!m) return { core: noTrail, blockId: "", trailingWs };

		const blockWithSpace = m[1];
		const core = noTrail.slice(0, noTrail.length - blockWithSpace.length);
		const blockId = blockWithSpace.trim();

		return { core, blockId, trailingWs };
	}

	private parseTrailingTags(coreText: string): { before: string; tags: string[] } {
		const m = coreText.match(/((?:\s+#(?:[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]+))*)$/u);
		if (!m) return { before: coreText, tags: [] };

		const tagBlock = m[1];
		const tags = tagBlock.match(/#(?:[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]+)/gu) ?? [];
		const before = coreText.slice(0, coreText.length - tagBlock.length);

		return { before, tags };
	}

	private buildLineWithLeading(indent: string, tags: string[], after: string): string {
		const afterClean = after.replace(/^\s+/, "");
		const tagBlock = tags.join(" ");
		const body = tagBlock ? (afterClean ? `${tagBlock} ${afterClean}` : tagBlock) : afterClean;
		return indent + body;
	}

	private buildLineWithTrailing(
		before: string,
		tags: string[],
		blockId: string,
		trailingWs: string
	): string {
		const beforeClean = before.replace(/\s+$/, "");
		const tagBlock = tags.join(" ");
		const parts: string[] = [];

		if (beforeClean) parts.push(beforeClean);
		if (tagBlock) parts.push(tagBlock);
		if (blockId) parts.push(blockId);

		return parts.join(" ") + trailingWs;
	}

	private async createTag(
		editor: Editor,
		mode: AltClickTagMode,
		candidate: Candidate
	) {
		const normalized = this.normalizeCandidate(candidate.raw);
		if (!normalized) return;

		const tagToken = this.tagTokenForPlacement(normalized, mode);

		if (mode === "in-place") {
			if (candidate.range) {
				editor.replaceRange(tagToken, candidate.range.from, candidate.range.to);
			} else {
				editor.replaceSelection(tagToken);
			}
			return;
		}

		const line = editor.getCursor().line;
		const lineText = editor.getLine(line);

		if (mode === "start-line") {
			const lead = this.parseLeadingTags(lineText);
			const next = this.sortTags([...lead.tags, tagToken]);
			const newLine = this.buildLineWithLeading(lead.indent, next, lead.after);
			const oldCursor = editor.getCursor();
			const lengthDiff = newLine.length - lineText.length;
			editor.replaceRange(
				newLine,
				{ line, ch: 0 },
				{ line, ch: lineText.length }
			);
			editor.setCursor({ line: oldCursor.line, ch: Math.max(0, oldCursor.ch + lengthDiff) });
			return;
		}

		const split = this.splitBlockIdSuffix(lineText);
		const trail = this.parseTrailingTags(split.core);
		const next = this.sortTags([...trail.tags, tagToken]);
		const newLine = this.buildLineWithTrailing(
			trail.before,
			next,
			split.blockId,
			split.trailingWs
		);

		const oldCursor = editor.getCursor();
		const lengthDiff = newLine.length - lineText.length;
		editor.replaceRange(
			newLine,
			{ line, ch: 0 },
			{ line, ch: lineText.length }
		);
		editor.setCursor({ line: oldCursor.line, ch: Math.max(0, oldCursor.ch + lengthDiff) });
	}

	private async removeTag(editor: Editor, candidate: Candidate) {
		const normalized = this.normalizeCandidate(candidate.raw);
		if (!normalized) return;

		const key = normalized.toLowerCase();
		const cursor = editor.getCursor();
		const line = candidate.range?.from?.line ?? cursor.line;

		if (
			candidate.range &&
			(candidate.range.from.line !== line || candidate.range.to.line !== line)
		) {
			return;
		}

		const lineText = editor.getLine(line);
		const ch = candidate.range?.from?.ch ?? cursor.ch;

		const lead = this.parseLeadingTags(lineText);
		const split = this.splitBlockIdSuffix(lineText);
		const trail = this.parseTrailingTags(split.core);

		const leadStart = 0;
		const leadEnd = lead.indent.length + lead.tagBlock.length;
		const trailStart = trail.before.length;
		const trailEnd = split.core.length;

		const inLeading = ch >= leadStart && ch <= leadEnd;
		const inTrailing = ch >= trailStart && ch <= trailEnd;

		if (inLeading) {
			const leadHas = lead.tags.some((t) => t.replace(/^#/, "").toLowerCase() === key);
			if (leadHas) {
				const kept = lead.tags.filter(
					(t) => t.replace(/^#/, "").toLowerCase() !== key
				);
				const newLine = this.buildLineWithLeading(lead.indent, kept, lead.after);
				const oldCursor = editor.getCursor();
				const lengthDiff = newLine.length - lineText.length;
				editor.replaceRange(
					newLine,
					{ line, ch: 0 },
					{ line, ch: lineText.length }
				);
				if (oldCursor.line === line) editor.setCursor({ line: oldCursor.line, ch: Math.max(0, oldCursor.ch + lengthDiff) });
				return;
			}
		}

		if (inTrailing) {
			const trailHas = trail.tags.some((t) => t.replace(/^#/, "").toLowerCase() === key);
			if (trailHas) {
				const kept = trail.tags.filter(
					(t) => t.replace(/^#/, "").toLowerCase() !== key
				);
				const newLine = this.buildLineWithTrailing(
					trail.before,
					kept,
					split.blockId,
					split.trailingWs
				);
				const oldCursor = editor.getCursor();
				const lengthDiff = newLine.length - lineText.length;
				editor.replaceRange(
					newLine,
					{ line, ch: 0 },
					{ line, ch: lineText.length }
				);
				if (oldCursor.line === line) editor.setCursor({ line: oldCursor.line, ch: Math.max(0, oldCursor.ch + lengthDiff) });
				return;
			}
		}

		if (candidate.range) {
			const fromCh = candidate.range.from.ch;
			const toCh = candidate.range.to.ch;
			const selected = editor.getRange(candidate.range.from, candidate.range.to);

			if (selected && selected.startsWith("#")) {
				const beforeTag = lineText.slice(0, fromCh);
				const afterTag = lineText.slice(toCh);

				if (beforeTag.endsWith(" ") && afterTag.startsWith(" ")) {
					let expandedFrom = fromCh - 1;
					let expandedTo = toCh;

					if (expandedTo < lineText.length && lineText.charAt(expandedTo) === " ") {
						expandedTo++;
					} else if (
						expandedFrom > 0 &&
						lineText.charAt(expandedFrom - 1) === " "
					) {
						expandedFrom--;
					}

					editor.replaceRange(
						"",
						{ line, ch: expandedFrom },
						{ line, ch: expandedTo }
					);
					return;
				}

				editor.replaceRange(
					selected.slice(1),
					candidate.range.from,
					candidate.range.to
				);
			}
		}
	}

	private async stripHashFromTag(editor: Editor, candidate: Candidate) {
		if (!candidate.range) return;

		const line = candidate.range.from.line;
		if (candidate.range.to.line !== line) return;

		const lineText = editor.getLine(line);
		const fromCh = candidate.range.from.ch;
		const toCh = candidate.range.to.ch;
		const selected = editor.getRange(candidate.range.from, candidate.range.to);

		if (!selected || !selected.startsWith("#")) return;

		const beforeTag = lineText.slice(0, fromCh);
		const afterTag = lineText.slice(toCh);

		if (beforeTag.endsWith(" ") && afterTag.startsWith(" ")) {
			let expandedFrom = fromCh - 1;
			let expandedTo = toCh + 1 - selected.length;

			if (expandedTo < lineText.length && lineText.charAt(expandedTo) === " ") {
				expandedTo++;
			} else if (expandedFrom > 0 && lineText.charAt(expandedFrom - 1) === " ") {
				expandedFrom--;
			}

			editor.replaceRange(
				selected.slice(1),
				{ line, ch: expandedFrom },
				{ line, ch: expandedTo }
			);
			return;
		}

		editor.replaceRange(selected.slice(1), candidate.range.from, candidate.range.to);
	}

	async loadSettings() {
		const loaded = (await this.loadData()) ?? {};
		const anyLoaded = loaded as Partial<FlatTagPluginSettings> & Record<string, unknown>;
		const mode = anyLoaded.altClickTagMode;

		this.settings = {
			pinnedTags: Array.isArray(anyLoaded.pinnedTags)
				? (anyLoaded.pinnedTags as unknown[]).filter(
						(t): t is string => typeof t === "string"
				  )
				: DEFAULT_SETTINGS.pinnedTags,
			frequencyCutoff:
				typeof anyLoaded.frequencyCutoff === "number" &&
				!isNaN(anyLoaded.frequencyCutoff)
					? Math.max(0, Math.floor(anyLoaded.frequencyCutoff))
					: DEFAULT_SETTINGS.frequencyCutoff,
			frequencyCutoffEnabled:
				typeof anyLoaded.frequencyCutoffEnabled === "boolean"
					? anyLoaded.frequencyCutoffEnabled
					: DEFAULT_SETTINGS.frequencyCutoffEnabled,
			altClickTagMode:
				mode === "start-line" || mode === "in-place" || mode === "end-line"
					? mode
					: DEFAULT_SETTINGS.altClickTagMode,
			showPlacementInStatusBar:
				typeof anyLoaded.showPlacementInStatusBar === "boolean"
					? anyLoaded.showPlacementInStatusBar
					: DEFAULT_SETTINGS.showPlacementInStatusBar,
			mobileLongPressEnabled:
				typeof anyLoaded.mobileLongPressEnabled === "boolean"
					? anyLoaded.mobileLongPressEnabled
					: DEFAULT_SETTINGS.mobileLongPressEnabled,
			mobileLongPressMs:
				typeof anyLoaded.mobileLongPressMs === "number" &&
				!isNaN(anyLoaded.mobileLongPressMs)
					? Math.max(250, Math.min(5000, Math.floor(anyLoaded.mobileLongPressMs)))
					: DEFAULT_SETTINGS.mobileLongPressMs,
			popupSortMode:
				anyLoaded.popupSortMode === "newest" || anyLoaded.popupSortMode === "alpha"
					? anyLoaded.popupSortMode
					: DEFAULT_SETTINGS.popupSortMode,
			popupResultCount: ([5, 10, 20, "max"] as PopupResultCount[]).includes(
				anyLoaded.popupResultCount as PopupResultCount
			)
				? (anyLoaded.popupResultCount as PopupResultCount)
				: DEFAULT_SETTINGS.popupResultCount,
			scopes: Array.isArray(anyLoaded.scopes)
				? (anyLoaded.scopes as any[])
				: DEFAULT_SETTINGS.scopes,
			scopesOn:
				typeof anyLoaded.scopesOn === "boolean"
					? anyLoaded.scopesOn
					: DEFAULT_SETTINGS.scopesOn,
			lastScopeId:
				(anyLoaded.lastScopeId as string | null | undefined) ??
				DEFAULT_SETTINGS.lastScopeId,
		};

		if (
			this.settings.lastScopeId &&
			!this.settings.scopes.find((s) => s.id === this.settings.lastScopeId)
		) {
			this.settings.lastScopeId =
				this.settings.scopes.length > 0 ? this.settings.scopes[0].id : null;
			if (!this.settings.lastScopeId) this.settings.scopesOn = false;
			await this.saveData(this.settings);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.app.workspace.trigger("flat-tag-view:settings-updated");
		this.updateStatusBar();
	}

	public requestSaveSettings() {
		if (this.saveTimeout) window.clearTimeout(this.saveTimeout);
		this.saveTimeout = window.setTimeout(() => {
			this.saveTimeout = null;
			void this.saveSettings();
		}, 500);
	}

	async activateView() {
		const workspace = this.app.workspace;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}

		workspace.revealLeaf(leaf);
		workspace.setActiveLeaf(leaf, { focus: true });
	}

	private addStyle() {
		this.styleEl = document.createElement("style");
		this.styleEl.innerHTML = getStyles();
		document.head.appendChild(this.styleEl);
	}
}




