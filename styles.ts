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
      flex-wrap: wrap; /* Allows searching to wrap nicely on narrow panes */
      gap: 8px;
    }
    
    .flat-tag-buttons-section {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    /* Base styling for our Note/Line and Task toggle buttons */
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
    }

    /* Hover effect for inactive state */
    .flat-tag-mode-button:hover {
      color: var(--text-normal);
      background-color: var(--background-modifier-hover);
      border-color: var(--background-modifier-border-hover);
    }

    /* Highly visible active (pressed) state */
    .flat-tag-mode-button.is-active {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      border-color: var(--interactive-accent);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    /* Hover effect when active */
    .flat-tag-mode-button.is-active:hover {
      background-color: var(--interactive-accent-hover);
      border-color: var(--interactive-accent-hover);
    }
    
    .flat-tag-search-section {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      background-color: var(--background-secondary);
      border-radius: 4px;
      padding: 2px 8px;
      flex-grow: 1;
      max-width: 200px;
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
    
    .flat-tag-search-icon {
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
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

    .flat-tag-sort-button, .flat-tag-clear-button {
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .flat-tag-sort-button:hover, .flat-tag-clear-button:hover {
      background-color: var(--interactive-hover);
    }

    .flat-tag-sort-button.is-active {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .flat-tag-sort-button.is-active:hover {
      background-color: var(--interactive-accent-hover);
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
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      background-color: var(--background-secondary-alt);
      padding: 4px;
      border-radius: var(--radius-s);
      margin-bottom: 4px;
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

  `;
};
