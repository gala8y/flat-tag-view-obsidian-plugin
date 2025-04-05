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
    }
    
    .flat-tag-buttons-section {
      display: flex;
      gap: 8px;
    }
    
    .flat-tag-search-section {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      background-color: var(--background-secondary);
      border-radius: 4px;
      padding: 2px 8px;
    }
    
    .flat-tag-search-input {
      background: transparent;
      border: none;
      color: var(--text-normal);
      width: 150px;
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
    }

    .flat-tag-sort-button:hover, .flat-tag-clear-button:hover {
      background-color: var(--interactive-hover);
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
      display: inline-block;
      font-weight: bold;
      font-size: 1.2em;
      margin: 2px;
      padding: 2px 6px;
      border-radius: 4px;
      background-color: var(--background-secondary);
      color: var(--text-normal);
      vertical-align: middle;
    }
  `;
};

