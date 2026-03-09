
export const getStyles = (): string => {
    return `
.workspace-split.mod-root .view-content.flat-tag-view {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    height: 100%;
    padding: 0;
    margin: 0;
}

.flat-tag-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
}

.flat-tag-sort-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    padding: 8px;
    background-color: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
}

.flat-tag-buttons-section {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
}

/* Icon Buttons */
.flat-tag-sort-button,
.flat-tag-clear-button {
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-s);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
}

.flat-tag-sort-button:hover,
.flat-tag-clear-button:hover {
    background-color: var(--interactive-hover);
    color: var(--text-normal);
}

.flat-tag-sort-button.is-active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

.flat-tag-sort-button.is-active:hover {
    background-color: var(--interactive-accent-hover);
}

/* Text Buttons */
.flat-tag-mode-button {
    cursor: pointer;
    padding: 4px 10px;
    font-size: 0.8em;
    font-weight: 500;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    background-color: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    transition: all 0.15s ease-in-out;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 65px;
    height: 28px;
}

.flat-tag-mode-button:hover {
    color: var(--text-normal);
    background-color: var(--interactive-hover);
    border-color: var(--background-modifier-border-hover);
}

.flat-tag-mode-button.is-active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.flat-tag-mode-button.is-active:hover {
    background-color: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
}

.flat-tag-bottom-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 0 0 auto;           /* Locks height, prevents growing into empty space */
    padding: 8px;
    background-color: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
    width: 100%;
    gap: 8px;
    min-height: 40px;         /* Gives it a solid, uncollapsible baseline */
}

.flat-tag-search-section {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--background-secondary);
    border-radius: var(--radius-s);
    padding: 2px 8px;
    flex-grow: 1;
}

.flat-tag-search-input {
    background: transparent;
    border: none;
    color: var(--text-normal);
    width: 100%;
    height: 24px;
    font-size: 0.9em;
}

.flat-tag-search-input:focus {
    outline: none;
    box-shadow: none;
}

.flat-tag-search-clear-button {
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
}

.flat-tag-search-clear-button:hover {
    color: var(--text-normal);
}

.flat-tag-bottom-actions {
    display: flex;
    gap: 4px;
    align-items: center;
}

.flat-tag-bottom-button {
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: var(--radius-s);
    transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out;
}

.flat-tag-bottom-button:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
}

/* Cutoff controls */
.flat-tag-cutoff-spacer {
    flex: 0 0 8px;
    width: 8px;
    height: 1px;
}

/* Compound buttons */
.flat-tag-scope-section,
.flat-tag-cutoff-section {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    border-radius: var(--radius-s);
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-modifier-form-field);
    height: 28px;
}

.flat-tag-cutoff-toggle {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    padding: 2px;
    border-radius: var(--radius-s);
}

.flat-tag-cutoff-toggle:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
}

.flat-tag-cutoff-toggle.is-enabled {
    color: var(--interactive-accent);
}

.flat-tag-cutoff-toggle.is-disabled {
    opacity: 0.7;
}

.flat-tag-cutoff-input {
    width: 32px !important;
    height: 22px !important;
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    text-align: center;
    font-size: 0.9em;
    color: var(--text-normal);
}

.flat-tag-cutoff-input:focus {
    outline: none !important;
    box-shadow: none !important;
}

.flat-tag-cutoff-input:disabled {
    color: var(--text-faint);
    cursor: not-allowed;
}

/* --- Scope Controls Phase 3 --- */

.flat-tag-scope-toggle {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    padding: 2px;
    border-radius: var(--radius-s);
    transition: color 0.1s;
}

.flat-tag-scope-toggle:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
}

.flat-tag-scope-toggle.is-enabled {
    color: var(--interactive-accent);
}

.flat-tag-scope-text {
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 500;
    color: var(--text-muted);
    opacity: 0.7; /* Match the grey shade of the disabled cutoff icon */
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
    padding: 2px 4px;
    border-radius: var(--radius-s);
    transition: color 0.1s, opacity 0.1s;
}

/* Remove the opacity when active/enabled */
.flat-tag-scope-text.is-enabled {
    color: var(--text-normal);
    opacity: 1;
}

.flat-tag-scope-text:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
}

.flat-tag-scope-text.is-enabled {
    color: var(--text-normal);
}

.flat-tag-list {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    overflow-y: auto;
    flex: 1;
    line-height: 1.5em;
    padding: 8px;
    width: 100%;
}

.flat-tag {
    display: inline-block;
    padding: 2px 6px;
    margin: 2px;
    border-radius: 4px;
    cursor: pointer;
    background-color: var(--tag-background);
    color: var(--tag-color);
    transition: background-color 0.1s;
}

.flat-tag:hover {
    background-color: var(--tag-background-hover);
}

.flat-tag-selected {
    font-weight: bold;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}

.flat-tag-excluded {
    font-weight: bold;
    background-color: var(--color-red);
    color: var(--text-on-accent);
}

.flat-tag-letter {
    display: inline-flex;
    font-weight: bold;
    font-size: 1.2em;
    margin: 2px;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: var(--background-secondary);
    color: var(--text-normal);
    align-items: center;
    justify-content: center;
    min-width: 24px;
}

.flat-tag-pinned-section {
    position: sticky;
    top: 0;
    z-index: 5;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 4px;
    border-radius: var(--radius-s);
    margin-bottom: 4px;
    background-color: var(--background-primary);
}

.flat-tag-separator {
    width: 100%;
    height: 1px;
    background-color: var(--background-modifier-border);
    margin: 4px 0 8px 0;
}

.flat-tag-pinned {
    border: 1px solid var(--interactive-accent);
}

/* Glow reminder when list is filtered but input isn't focused */
.flat-tag-search-input:not(:focus):not(:placeholder-shown) {
    border-color: var(--interactive-accent);
    box-shadow:
        0 0 0 2px color-mixin(in srgb, var(--interactive-accent) 35%, transparent),
        0 0 14px color-mixin(in srgb, var(--interactive-accent) 25%, transparent);
    animation: ftv-search-pulse 2.2s ease-in-out infinite;
}

@keyframes ftv-search-pulse {
    0%, 100% {
        box-shadow:
            0 0 0 2px color-mixin(in srgb, var(--interactive-accent) 28%, transparent),
            0 0 10px color-mixin(in srgb, var(--interactive-accent) 18%, transparent);
    }
    50% {
        box-shadow:
            0 0 0 2px color-mixin(in srgb, var(--interactive-accent) 45%, transparent),
            0 0 18px color-mixin(in srgb, var(--interactive-accent) 35%, transparent);
    }
}

body.theme-light .flat-tag-search-input:not(:focus):not(:placeholder-shown) {
    animation-duration: 2.6s;
}
body.theme-dark .flat-tag-search-input:not(:focus):not(:placeholder-shown) {
    animation-duration: 2.0s;
}
@media (prefers-reduced-motion: reduce) {
    .flat-tag-search-input:not(:focus):not(:placeholder-shown) {
        animation: none;
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Flat Tag Hover Popup
───────────────────────────────────────────────────────────────────────────── */

.ftv-popup {
    position: fixed;
    z-index: 999999;
    width: max-content;
    max-width: min(480px, calc(100vw - 20px));
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 7px;
    box-shadow: var(--shadow-s);
    font-size: 11.5px;
    line-height: 1.4;
    padding: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
}

/* Invisible bridge to prevent mouseleave when moving from tag to popup */
.ftv-popup::before {
    content: "";
    position: absolute;
    top: -15px;
    bottom: -15px;
    left: -15px;
    right: -15px;
    z-index: -1;
}

.ftv-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 9px 4px 9px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    gap: 6px;
    min-height: 26px;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
}

.ftv-popup-tag-label {
    font-weight: 600;
    color: var(--text-accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
}

.ftv-popup-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    white-space: nowrap;
}

.ftv-popup-ctrl-btn {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 10.5px;
    padding: 1px 4px;
    border-radius: 3px;
    transition: color 0.1s, background 0.1s;
    user-select: none;
}
.ftv-popup-ctrl-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
}

.ftv-popup-ctrl-sep {
    color: var(--text-faint);
    font-size: 10px;
    user-select: none;
}

.ftv-popup-rows {
    display: flex;
    flex-direction: column;
    padding: 4px 0 2px 0;
    max-height: 50vh;
    overflow-y: auto;
    mask-image: linear-gradient(to right, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
}

.ftv-popup-row {
    display: grid;
    grid-template-columns: var(--ftv-folder-col, 70px) 16px 1fr;
    align-items: center;
    padding: 2px 9px;
    cursor: pointer;
    gap: 0;
    min-height: 20px;
}

.ftv-popup-row:hover {
    background: var(--background-modifier-hover);
}

.ftv-popup-folder {
    text-align: right;
    color: var(--text-muted);
    font-size: 10.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 3px;
}

.ftv-popup-sep {
    text-align: center;
    color: var(--text-faint);
    font-size: 10px;
    user-select: none;
}

.ftv-popup-name {
    text-align: left;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    padding-left: 2px;
}

.ftv-popup-overflow {
    padding: 3px 9px 5px 9px;
    color: var(--text-faint);
    font-size: 10.5px;
    font-style: italic;
    border-top: 1px solid var(--background-modifier-border);
    margin-top: 2px;
}

.ftv-popup-empty {
    padding: 8px 9px;
    color: var(--text-faint);
    font-style: italic;
    font-size: 11px;
}

.ftv-popup-folder-measure {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    font-size: 10.5px;
    white-space: nowrap;
}

.ftv-help-popup {
    min-width: 280px;
}

.ftv-help-content {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-normal);
    line-height: 1.6;
}

.ftv-help-content ul {
    margin: 0;
    padding-left: 18px;
}

.ftv-help-content li {
    margin-bottom: 4px;
}

/* Subtle flash when typing via keyboard to search */
.ftv-pulse {
    animation: type-pulse 0.3s ease-out;
}

@keyframes type-pulse {
    0% { background-color: var(--interactive-accent-hover); color: var(--text-on-accent); }
    100% { background-color: transparent; color: var(--text-normal); }
}

.ftv-count {
    opacity: 0.85;
    margin-left: 3px;
    font-size: 0.9em;
}

.ftv-mode-mark {
    font-size: 0.75em;
    vertical-align: super;
    margin-left: 1px;
    margin-right: 1px;
    opacity: 0.8;
    line-height: 0;
}


    `;
};


