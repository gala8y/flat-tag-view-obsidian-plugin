import { Editor, EditorPosition, MarkdownView, Notice, Platform, Plugin, WorkspaceLeaf } from "obsidian";

import { VIEW_TYPE } from "./constants";
import { FlatTagView } from "./flatTagView";
import { getStyles } from "./styles";
import { AltClickTagMode, DEFAULT_SETTINGS, FlatTagPluginSettings, FlatTagSettingTab } from "./settings";

type EditorRange = { from: EditorPosition; to: EditorPosition };
type Candidate = { raw: string; range?: EditorRange };

export default class FlatTagPlugin extends Plugin {
    settings: FlatTagPluginSettings;
    private statusBarEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new FlatTagView(leaf, this));
        this.addRibbonIcon("tag", "Open Flat Tags", () => void this.activateView());
        this.addSettingTab(new FlatTagSettingTab(this.app, this));

        this.addCommand({
            id: "open-flat-tags",
            name: "Open Flat Tags",
            callback: () => void this.activateView(),
        });

        this.addCommand({
            id: "toggle-flat-tag-sort",
            name: "Toggle Flat Tag Sort (A-Z/Usage)",
            callback: () => {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.toggleSort === "function") view.toggleSort();
            },
        });

        this.addCommand({
            id: "clear-flat-tag-selections",
            name: "Clear Flat Tag Selections",
            callback: () => {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.clearTagSelections === "function") view.clearTagSelections();
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-frequency-cutoff",
            name: "Toggle Frequency Cutoff",
            callback: async () => {
                this.settings.frequencyCutoffEnabled = !this.settings.frequencyCutoffEnabled;
                await this.saveSettings();
            },
        });

        this.addCommand({
            id: "clear-flat-tag-search",
            name: "Clear Flat Tag Search Box",
            callback: () => {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.clearSearchBox === "function") view.clearSearchBox();
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-scope-mode",
            name: "Toggle Flat Tag Mode (Note/Line)",
            callback: () => {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.toggleScopeMode === "function") view.toggleScopeMode();
            },
        });

        this.addCommand({
            id: "toggle-flat-tag-task-mode",
            name: "Cycle Flat Tag Task Mode (All/Todo/Done)",
            callback: () => {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FlatTagView;
                if (view && typeof view.toggleTaskMode === "function") view.toggleTaskMode();
            },
        });

        this.addCommand({
            id: "cycle-flat-tag-placement",
            name: "Cycle Tag Placement (SOL / INP / EOL)",
            callback: () => void this.cycleTagPlacement(),
        });

        this.addCommand({
            id: "set-flat-tag-placement-sol",
            name: "Set Tag Placement to Start of Line (SOL)",
            callback: async () => {
                this.settings.altClickTagMode = "start-line";
                await this.saveSettings();
                new Notice("Tag placement: Start of line");
            },
        });

        this.addCommand({
            id: "set-flat-tag-placement-inp",
            name: "Set Tag Placement to In Place (INP)",
            callback: async () => {
                this.settings.altClickTagMode = "in-place";
                await this.saveSettings();
                new Notice("Tag placement: In place");
            },
        });

        this.addCommand({
            id: "set-flat-tag-placement-eol",
            name: "Set Tag Placement to End of Line (EOL)",
            callback: async () => {
                this.settings.altClickTagMode = "end-line";
                await this.saveSettings();
                new Notice("Tag placement: End of line");
            },
        });


        this.addStyle();

        // Status bar placement indicator
        this.statusBarEl = this.addStatusBarItem();
        this.updateStatusBar();
        this.statusBarEl.addClass("mod-clickable");
        this.statusBarEl.addEventListener("click", () => void this.cycleTagPlacement());
        
        // Desktop: Intercept editor clicks with capture to prevent Obsidian hijacking them
        this.registerDomEvent(document, "click", (evt: MouseEvent) => {
            if (!evt.altKey) return;

            // 1. Ctrl + Alt + Shift + Click -> Local Mute / Unmute tag
            if (evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {
                evt.preventDefault();
                evt.stopPropagation();
                void this.handleEditorTrigger({ kind: "local-mute", mouseEvent: evt });
                return;
            }

            // 1b. Shift + Alt + Click -> strip leading '#' but keep the expression text
                if (evt.shiftKey && !evt.ctrlKey && !evt.metaKey) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    void this.handleEditorTrigger({ kind: "strip-hash", mouseEvent: evt });
                    return;
                }

                // 2. Ctrl + Alt + Click -> FTV Drill Down
            if (!evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {
                evt.preventDefault();
                evt.stopPropagation();
                void this.handleEditorTrigger({ kind: "drill-down", mouseEvent: evt });
                return;
            }

            // 3. Alt + Click (only Alt) -> Create/Remove tag
            if (!evt.shiftKey && !evt.ctrlKey && !evt.metaKey) {
                evt.preventDefault(); 
                void this.handleEditorTrigger({ kind: "alt-click", mouseEvent: evt });
                return;
            }
        }, { capture: true });

        // Mobile: long press
        this.registerMobileLongPress();
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);
        if (this.statusBarEl) {
            this.statusBarEl.remove();
            this.statusBarEl = null;
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

    // ── Status bar ──────────────────────────────────────────────────────────────

    updateStatusBar() {
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
        this.statusBarEl.setText(`#>${modeLabel}`);
        this.statusBarEl.style.display = "";
    }

    // ── Mobile long press ────────────────────────────────────────────────────────

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
                const ms = Math.max(250, Math.min(5000, this.settings.mobileLongPressMs ?? 1000));
                timer = window.setTimeout(() => {
                    timer = null;
                    if (cancelled) return;
                    // Arm; fire on touchend after OS selection is established.
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
                if (dx > 12 || dy > 12) { cancelled = true; clear(); }
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
            () => { cancelled = true; clear(); },
            { passive: true }
        );
    }

    // ── Trigger entry-point ──────────────────────────────────────────────────────

    private async handleEditorTrigger(
        trigger: { kind: "alt-click" | "drill-down" | "local-mute" | "strip-hash"; mouseEvent?: MouseEvent } | { kind: "mobile-long-press" }
    ) {
        // const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        // if (!view) return;

        // // Source / editor mode only
        // const anyView = view as any;
        // if (typeof anyView.getMode === "function" && anyView.getMode() !== "source") return;

        // const editor = view.editor;
        // if (!editor) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        // Determine if we are in source mode
        const isSourceMode =
        (view as any).getMode &&
        typeof (view as any).getMode === "function" &&
        (view as any).getMode() === "source";

        if (!isSourceMode) {
        // Reading/Preview mode:
        // Support ONLY Ctrl+Alt+Click drill-down on rendered tags
        if ("kind" in trigger && trigger.kind === "drill-down" && trigger.mouseEvent) {
            const target = trigger.mouseEvent.target as HTMLElement;
            const tagEl = target?.closest(".tag");
            const tagText = tagEl?.textContent?.trim();

            if (tagText && tagText.startsWith("#") && !tagText.startsWith("#%")) {
            await this.activateView();
            setTimeout(() => {
                const ftvLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
                if (ftvLeaf && ftvLeaf.view instanceof FlatTagView) {
                ftvLeaf.view.selectSingleTag(tagText);
                }
            }, 50);
            }
        }
        return;
        }

        const editor = view.editor;
        if (!editor) return;

        // Mobile: require a real selection to avoid accidental triggers
        if (trigger.kind === "mobile-long-press") {
            const sel = editor.getSelection();
            if (!sel || !sel.trim()) return;
        }

        const candidate = this.getCandidateWithRange(editor, { preferSelection: Platform.isMobile });
        if (!candidate) return;

        // 1. Drill down action
        if (trigger.kind === "drill-down") {
            if (candidate.raw.startsWith("#") && !candidate.raw.startsWith("#%")) {
                await this.activateView();
                setTimeout(() => {
                    const ftvLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
                    if (ftvLeaf && ftvLeaf.view instanceof FlatTagView) {
                        ftvLeaf.view.selectSingleTag(candidate.raw);
                    }
                }, 50);
            }
            return;
        }

        // 2. Local Mute action
        if (trigger.kind === "local-mute") {
            if (candidate.raw.startsWith("#") && candidate.range) {
                const currentTag = candidate.raw;
                let newTag = "";
                
                if (currentTag.startsWith("#%")) {
                    newTag = "#" + currentTag.slice(2); // Remove %
                } else {
                    newTag = "#%" + currentTag.slice(1); // Add %
                }
                
                editor.replaceRange(newTag, candidate.range.from, candidate.range.to);
            }
            return;
        }

        // 2b. Strip-hash action (always leave expression text)
        if (trigger.kind === "strip-hash") {
            if (candidate.raw.startsWith("#%")) return;
            if (!candidate.raw.startsWith("#")) return;

            await this.stripHashFromTag(editor, candidate);
            return;
        }

        // 3. Alt-click (default create/remove)
        if (trigger.kind === "alt-click" || trigger.kind === "mobile-long-press") {
            // Completely ignore Alt-clicks on muted tags
            if (candidate.raw.startsWith("#%")) {
                return;
            }

            if (candidate.raw.startsWith("#")) {
                await this.removeTag(editor, candidate);
            } else {
                await this.createTag(editor, this.settings.altClickTagMode, candidate);
            }
        }
    }

    // ── Candidate resolution ─────────────────────────────────────────────────────

    private getSelectionRange(editor: Editor): EditorRange | null {
        const anyEditor = editor as any;
        const from = anyEditor.getCursor?.("from") as EditorPosition | undefined;
        const to = anyEditor.getCursor?.("to") as EditorPosition | undefined;
        if (!from || !to) return null;
        if (from.line === to.line && from.ch === to.ch) return null;
        if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) return { from: to, to: from };
        return { from, to };
    }

    private buildSelCandidate(editor: Editor, sel: string, r: EditorRange): Candidate {
        const raw = sel.trim();
        if (!raw.startsWith("#") && r.from.ch > 0) {
            const lineText = editor.getLine(r.from.line);
            if (lineText.charAt(r.from.ch - 1) === "#") {
                return {
                    raw: "#" + raw,
                    range: { from: { line: r.from.line, ch: r.from.ch - 1 }, to: r.to },
                };
            }
        }
        return { raw, range: r };
    }

    private getCandidateWithRange(editor: Editor, opts?: { preferSelection?: boolean }): Candidate | null {
        const preferSelection = opts?.preferSelection ?? true;

        const sel = editor.getSelection();
        const selRange = this.getSelectionRange(editor);

        if (preferSelection && sel && sel.trim() && !/[\r\n]/.test(sel) && selRange) {
            return this.buildSelCandidate(editor, sel, selRange);
        }

        const token = this.getTokenAtCursor(editor);
        if (token) return token;

        if (!preferSelection && sel && sel.trim() && !/[\r\n]/.test(sel) && selRange) {
            return this.buildSelCandidate(editor, sel, selRange);
        }

        return null;
    }

    private getTokenAtCursor(editor: Editor): Candidate | null {
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line) ?? "";
        if (!lineText) return null;

        const isBodyChar = (ch: string) => /[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]/u.test(ch);

        let i = cursor.ch;
        if (i >= lineText.length) i = lineText.length - 1;
        if (i < 0) return null;

        const cur = lineText.charAt(i);

        // Case 1: cursor directly on '#'
        if (cur === "#") {
            let end = i + 1;
            while (end < lineText.length && isBodyChar(lineText.charAt(end))) end++;
            if (end === i + 1) return null;
            return {
                raw: lineText.slice(i, end),
                range: { from: { line: cursor.line, ch: i }, to: { line: cursor.line, ch: end } },
            };
        }

        // Case 2: cursor on a body character
        if (isBodyChar(cur)) {
            return this.wordRangeAt(cursor.line, lineText, i);
        }

        // Case 3: cursor just after a body character
        if (i > 0 && isBodyChar(lineText.charAt(i - 1))) {
            return this.wordRangeAt(cursor.line, lineText, i - 1);
        }

        return null;
    }

    private wordRangeAt(line: number, lineText: string, i: number): Candidate | null {
        const isBodyChar = (ch: string) => /[^\s"'`\]\[{}()=+\\|,<.>!?:;*&^@$#]/u.test(ch);

        let start = i;
        while (start > 0 && isBodyChar(lineText.charAt(start - 1))) start--;

        const hashStart = (start > 0 && lineText.charAt(start - 1) === "#") ? start - 1 : start;

        let end = i + 1;
        while (end < lineText.length && isBodyChar(lineText.charAt(end))) end++;

        const raw = lineText.slice(hashStart, end);
        if (!raw.trim()) return null;

        return {
            raw,
            range: { from: { line, ch: hashStart }, to: { line, ch: end } },
        };
    }

    // ── Validation ───────────────────────────────────────────────────────────────

    private hasForbiddenChars(raw: string): boolean {
        const s = raw.trim();
        if (!s) return true;

        const body = s.startsWith("#") ? s.slice(1) : s;
        if (body.includes("#")) return true;

        return /[!@$^&*()+= <>,.?`~]/.test(body);
    }

    private normalizeCandidate(raw: string): string | null {
        let t = raw.trim();
        if (!t) return null;
        if (this.hasForbiddenChars(t)) return null;

        if (t.startsWith("#")) t = t.slice(1);
        if (!t) return null;

        if (/^\d+$/.test(t) || t === "%") return null;
        if (/\s/.test(t)) return null;

        return t;
    }

    // ── Tag helpers ──────────────────────────────────────────────────────────────

    private tagTokenForPlacement(candidate: string, mode: AltClickTagMode): string {
        const text = (mode === "start-line" || mode === "end-line") ? candidate.toLowerCase() : candidate;
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
        return uniq.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), "pl"));
    }

    // ── Line parsing ─────────────────────────────────────────────────────────────

    private parseLeadingTags(lineText: string): { indent: string; tagBlock: string; tags: string[]; after: string } {
        const indent = (lineText.match(/^\s*/) ?? [""])[0];
        const rest = lineText.slice(indent.length);
        const m = rest.match(/^((?:#[^\s#]+\s+)*)/);
        const tagBlock = m?.[1] ?? "";
        const tags = tagBlock.match(/#[^\s#]+/g) ?? [];
        const after = rest.slice(tagBlock.length);
        return { indent, tagBlock, tags, after };
    }

    private splitBlockIdSuffix(lineText: string): { core: string; blockId: string; trailingWs: string } {
        const trailingWs = (lineText.match(/\s*$/) ?? [""])[0];
        const noTrail = lineText.slice(0, lineText.length - trailingWs.length);

        const m = noTrail.match(/(\s\^[\p{L}\p{N}_-]+)$/u);
        if (!m) return { core: noTrail, blockId: "", trailingWs };

        const blockWithSpace = m[1];
        const core = noTrail.slice(0, noTrail.length - blockWithSpace.length);
        const blockId = blockWithSpace.trim();

        return { core, blockId, trailingWs };
    }

    private parseTrailingTags(coreText: string): { before: string; tags: string[] } {
        const m = coreText.match(/(\s+(?:#[^\s#]+\s*)+)$/);
        if (!m) return { before: coreText, tags: [] };

        const tagBlock = m[1];
        const tags = tagBlock.match(/#[^\s#]+/g) ?? [];
        const before = coreText.slice(0, coreText.length - tagBlock.length);
        return { before, tags };
    }

    private buildLineWithLeading(indent: string, tags: string[], after: string): string {
        const afterClean = after.replace(/^\s+/, "");
        const tagBlock = tags.join(" ");
        const body = tagBlock ? (afterClean ? `${tagBlock} ${afterClean}` : tagBlock) : afterClean;
        return `${indent}${body}`;
    }

    private buildLineWithTrailing(before: string, tags: string[], blockId: string, trailingWs: string): string {
        const beforeClean = before.replace(/\s+$/, "");
        const tagBlock = tags.join(" ");
        const parts: string[] = [];
        if (beforeClean) parts.push(beforeClean);
        if (tagBlock) parts.push(tagBlock);
        if (blockId) parts.push(blockId);
        return `${parts.join(" ")}${trailingWs}`;
    }

    // ── Create / Remove ─────────────────────────────────────────────────────────

    private async createTag(editor: Editor, mode: AltClickTagMode, candidate: Candidate) {
        const normalized = this.normalizeCandidate(candidate.raw);
        if (!normalized) return;

        const tagToken = this.tagTokenForPlacement(normalized, mode);

        if (mode === "in-place") {
            if (candidate.range) editor.replaceRange(tagToken, candidate.range.from, candidate.range.to);
            else editor.replaceSelection(tagToken);
            return;
        }

        const line = editor.getCursor().line;
        const lineText = editor.getLine(line);

        if (mode === "start-line") {
            const lead = this.parseLeadingTags(lineText);
            const next = this.sortTags([...lead.tags, tagToken]);
            const newLine = this.buildLineWithLeading(lead.indent, next, lead.after);
            editor.replaceRange(newLine, { line, ch: 0 }, { line, ch: lineText.length });
            return;
        }

        // end-line: insert BEFORE the ^block-id suffix (if any)
        const split = this.splitBlockIdSuffix(lineText);
        const trail = this.parseTrailingTags(split.core);
        const next = this.sortTags([...trail.tags, tagToken]);
        const newLine = this.buildLineWithTrailing(trail.before, next, split.blockId, split.trailingWs);
        editor.replaceRange(newLine, { line, ch: 0 }, { line, ch: lineText.length });
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

        if (beforeTag.endsWith("[") && afterTag.startsWith(`](${selected})`)) {
            let expandedFrom = fromCh - 1; 
            let expandedTo = toCh + 3 + selected.length; 

            if (expandedTo < lineText.length && lineText.charAt(expandedTo) === " ") expandedTo++;
            else if (expandedFrom > 0 && lineText.charAt(expandedFrom - 1) === " ") expandedFrom--;

            editor.replaceRange(selected.slice(1), { line, ch: expandedFrom }, { line, ch: expandedTo });
            return;
        }

        editor.replaceRange(selected.slice(1), candidate.range.from, candidate.range.to);
    }

    private async removeTag(editor: Editor, candidate: Candidate) {
        const normalized = this.normalizeCandidate(candidate.raw);
        if (!normalized) return;

        const key = normalized.toLowerCase();
        const cursor = editor.getCursor();
        const line = candidate.range?.from?.line ?? cursor.line;

        if (candidate.range && (candidate.range.from.line !== line || candidate.range.to.line !== line)) return;

        const lineText = editor.getLine(line);
        const ch = candidate.range?.from?.ch ?? cursor.ch;

        const lead = this.parseLeadingTags(lineText);
        const split = this.splitBlockIdSuffix(lineText);
        const trail = this.parseTrailingTags(split.core);

        const leadStart = 0;
        const leadEnd = lead.indent.length + lead.tagBlock.length;
        const trailStart = trail.before.length;
        const trailEnd = split.core.length;

        const inLeading = ch >= leadStart && ch < leadEnd;
        const inTrailing = ch >= trailStart && ch < trailEnd;

        // 1. Remove from leading block ONLY if clicked inside it
        if (inLeading) {
            const leadHas = lead.tags.some(t => t.replace(/^#/, "").toLowerCase() === key);
            if (leadHas) {
                const kept = lead.tags.filter(t => t.replace(/^#/, "").toLowerCase() !== key);
                const newLine = this.buildLineWithLeading(lead.indent, kept, lead.after);
                editor.replaceRange(newLine, { line, ch: 0 }, { line, ch: lineText.length });
                return;
            }
        }

        // 2. Remove from trailing block ONLY if clicked inside it
        if (inTrailing) {
            const trailHas = trail.tags.some(t => t.replace(/^#/, "").toLowerCase() === key);
            if (trailHas) {
                const kept = trail.tags.filter(t => t.replace(/^#/, "").toLowerCase() !== key);
                const newLine = this.buildLineWithTrailing(trail.before, kept, split.blockId, split.trailingWs);
                editor.replaceRange(newLine, { line, ch: 0 }, { line, ch: lineText.length });
                return;
            }
        }

        // 3. Inline tag or markdown-link tag removal
        if (candidate.range) {
            const fromCh = candidate.range.from.ch;
            const toCh = candidate.range.to.ch;
            const selected = editor.getRange(candidate.range.from, candidate.range.to);

            if (selected && selected.startsWith("#")) {
                const beforeTag = lineText.slice(0, fromCh);
                const afterTag = lineText.slice(toCh);

                // Edge case: User wants to remove a tag formatted as a markdown link `[#tag](#tag)`
                if (beforeTag.endsWith("[") && afterTag.startsWith(`](${selected})`)) {
                    let expandedFrom = fromCh - 1;
                    let expandedTo = toCh + 3 + selected.length; // length of `](` + tag + `)`
                    
                    if (expandedTo < lineText.length && lineText.charAt(expandedTo) === ' ') {
                        expandedTo++;
                    } else if (expandedFrom > 0 && lineText.charAt(expandedFrom - 1) === ' ') {
                        expandedFrom--;
                    }
                    
                    editor.replaceRange("", { line, ch: expandedFrom }, { line, ch: expandedTo });
                } else {
                    // Standard inline tag: strip the '#'
                    editor.replaceRange(selected.slice(1), candidate.range.from, candidate.range.to);
                }
            }
        }
    }

    // ── Settings ────────────────────────────────────────────────────────────────

    async loadSettings() {
        const loaded = (await this.loadData()) ?? {};
        const anyLoaded = loaded as Partial<FlatTagPluginSettings> & Record<string, unknown>;

        const mode = anyLoaded.altClickTagMode;

        this.settings = {
            pinnedTags: Array.isArray(anyLoaded.pinnedTags)
                ? (anyLoaded.pinnedTags as unknown[]).filter((t): t is string => typeof t === "string")
                : DEFAULT_SETTINGS.pinnedTags,

            frequencyCutoff: (typeof anyLoaded.frequencyCutoff === "number" && !isNaN(anyLoaded.frequencyCutoff))
                ? Math.max(0, Math.floor(anyLoaded.frequencyCutoff))
                : DEFAULT_SETTINGS.frequencyCutoff,

            frequencyCutoffEnabled: typeof anyLoaded.frequencyCutoffEnabled === "boolean"
                ? anyLoaded.frequencyCutoffEnabled
                : DEFAULT_SETTINGS.frequencyCutoffEnabled,

            altClickTagMode: (mode === "start-line" || mode === "in-place" || mode === "end-line")
                ? mode
                : DEFAULT_SETTINGS.altClickTagMode,

            mobileLongPressEnabled: typeof anyLoaded.mobileLongPressEnabled === "boolean"
                ? anyLoaded.mobileLongPressEnabled
                : DEFAULT_SETTINGS.mobileLongPressEnabled,

            mobileLongPressMs: (typeof anyLoaded.mobileLongPressMs === "number" && !isNaN(anyLoaded.mobileLongPressMs))
                ? Math.max(250, Math.min(5000, Math.floor(anyLoaded.mobileLongPressMs)))
                : DEFAULT_SETTINGS.mobileLongPressMs,

            showPlacementInStatusBar: typeof anyLoaded.showPlacementInStatusBar === "boolean"
                ? anyLoaded.showPlacementInStatusBar
                : DEFAULT_SETTINGS.showPlacementInStatusBar,
        } as FlatTagPluginSettings;

        // Persist immediately to drop stale keys and backfill new defaults
        await this.saveData(this.settings);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.app.workspace.trigger("flat-tag-view:settings-updated");
        this.updateStatusBar();
    }

    // ── View activation / style ────────────────────────────────────────────────

    async activateView() {
        const workspace = this.app.workspace;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];

        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            if (!rightLeaf) return;
            leaf = rightLeaf;
            await leaf.setViewState({ type: VIEW_TYPE });
        }

        workspace.revealLeaf(leaf);
        // this steals focus for ftv
        workspace.setActiveLeaf(leaf, { focus: true });

    }

    private addStyle() {
        const styleEl = document.createElement("style");
        styleEl.innerHTML = getStyles();
        document.head.appendChild(styleEl);
    }
}