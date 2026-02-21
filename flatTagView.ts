import { ItemView, WorkspaceLeaf, TFile, setIcon } from "obsidian";
import { VIEW_TYPE } from "./constants";
import FlatTagPlugin from "./main";

export class FlatTagView extends ItemView {
  public plugin: FlatTagPlugin;
  private container: HTMLElement;
  private tagContainer: HTMLElement;
  private sortContainer: HTMLElement;
  
  private selectedTags: Set<string> = new Set();
  private excludedTags: Set<string> = new Set();
  private allTags: Map<string, number> = new Map();
  private currentSort: "az" | "count" = "az";
  private tagsByFile: Map<string, Set<string>> = new Map();
  
  private hideSingleUseTags: boolean = false;
  private tagSearchText: string = "";
  
  // UNIFIED MODE STATE FOR TASK AND LINE MODES
  private searchMode: "note" | "line" | "task" | "task-todo" | "task-done" = "note";

  constructor(leaf: WorkspaceLeaf, plugin: FlatTagPlugin) {
    super(leaf);
    this.plugin = plugin;
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
    this.container = this.contentEl.createDiv({ cls: "flat-tag-container" });
    this.sortContainer = this.container.createDiv({ cls: "flat-tag-sort-container" });
  
    const buttonSection = this.sortContainer.createDiv({ cls: "flat-tag-buttons-section" });
  
    const sortByAZ = buttonSection.createDiv({ cls: "flat-tag-sort-button", title: "Sort A-Z" });
    setIcon(sortByAZ, "lucide-sort-asc");
    sortByAZ.addEventListener("click", () => {
      this.currentSort = "az";
      this.renderTags();
    });
  
    const sortByCount = buttonSection.createDiv({ cls: "flat-tag-sort-button", title: "Sort by usage" });
    setIcon(sortByCount, "lucide-bar-chart-2");
    sortByCount.addEventListener("click", () => {
      this.currentSort = "count";
      this.renderTags();
    });
  
    const clearButton = buttonSection.createDiv({ cls: "flat-tag-clear-button", title: "Clear tag selections" });
    setIcon(clearButton, "x");
    clearButton.addEventListener("click", () => {
      this.clearTagSelections();
    });
  
    const toggleSingleUseButton = buttonSection.createDiv({ 
      cls: "flat-tag-sort-button", 
      title: "Toggle single-use tags" 
    });
    setIcon(toggleSingleUseButton, "eye-off");
    toggleSingleUseButton.addEventListener("click", () => {
      this.toggleSingleUseTags();
      setIcon(toggleSingleUseButton, this.hideSingleUseTags ? "eye" : "eye-off");
    });

    // Create Scope Button (Note / Line)
    const scopeBtn = buttonSection.createDiv({ 
      cls: "flat-tag-mode-button", 
      text: "NOTE",
      title: "Click to cycle: Note -> Line" 
    });

    // Create Task Button (Task / Todo / Done)
    const taskBtn = buttonSection.createDiv({ 
      cls: "flat-tag-mode-button", 
      text: "TASK-ALL",
      title: "Click to cycle: All -> Todo -> Done"
    });

    const updateModeUI = () => {
      // Remove active states
      scopeBtn.removeClass("is-active");
      taskBtn.removeClass("is-active");
      
      // Update text and active state based on current mode
      if (this.searchMode === "note") {
        scopeBtn.setText("NOTE");
        scopeBtn.addClass("is-active");
      } else if (this.searchMode === "line") {
        scopeBtn.setText("LINE");
        scopeBtn.addClass("is-active");
      } else if (this.searchMode === "task") {
        taskBtn.setText("TASK-ALL");
        taskBtn.addClass("is-active");
      } else if (this.searchMode === "task-todo") {
        taskBtn.setText("TASK-TODO");
        taskBtn.addClass("is-active");
      } else if (this.searchMode === "task-done") {
        taskBtn.setText("TASK-DONE");
        taskBtn.addClass("is-active");
      }
      
      // Maintain the correct text on the inactive button
      if (["note", "line"].includes(this.searchMode)) {
        if (!["TASK-ALL", "TASK-TODO", "TASK-DONE"].includes(taskBtn.innerText)) {
          taskBtn.setText("TASK-ALL");
        }
      } else {
        if (!["NOTE", "LINE"].includes(scopeBtn.innerText)) {
          scopeBtn.setText("NOTE");
        }
      }

      this.updateSearch(); 
      // Only render tags if the container has actually been created!
      if (this.tagContainer) {
        this.renderTags(); 
      }
    };


    // Cycle Scope Button Logic
    scopeBtn.addEventListener("click", () => {
      if (["note", "line"].includes(this.searchMode)) {
        this.searchMode = this.searchMode === "note" ? "line" : "note";
      } else {
        this.searchMode = scopeBtn.innerText === "LINE" ? "line" : "note";
      }
      updateModeUI();
    });
    
    // Cycle Task Button Logic
    taskBtn.addEventListener("click", () => {
      if (["task", "task-todo", "task-done"].includes(this.searchMode)) {
        if (this.searchMode === "task") this.searchMode = "task-todo";
        else if (this.searchMode === "task-todo") this.searchMode = "task-done";
        else this.searchMode = "task";
      } else {
        if (taskBtn.innerText === "TASK-TODO") this.searchMode = "task-todo";
        else if (taskBtn.innerText === "TASK-DONE") this.searchMode = "task-done";
        else this.searchMode = "task";
      }
      updateModeUI();
    });

    // Initialize UI
    updateModeUI();
  
    const searchSection = this.sortContainer.createDiv({ cls: "flat-tag-search-section" });
    
    const searchBox = searchSection.createEl("input", {
      cls: "flat-tag-search-input",
      attr: { 
        type: "text", 
        placeholder: "Search tags...",
      }
    });
    
    const clearSearchButton = searchSection.createDiv({ 
      cls: "flat-tag-search-clear-button",
      title: "Clear search" 
    });
    setIcon(clearSearchButton, "square-x");
    clearSearchButton.addEventListener("click", () => {
      this.clearSearchBox();
    });
    
    searchBox.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      this.tagSearchText = target.value;
      this.renderTags();
    });
    
    this.tagContainer = this.container.createDiv({ cls: "flat-tag-list" });
  
    await this.loadTags();
  
    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        this.updateFileTags(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.removeFileTags(file.path);
          this.renderTags();
        }
      })
    );
    
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          const tags = this.tagsByFile.get(oldPath);
          if (tags) {
            this.tagsByFile.set(file.path, tags);
            this.tagsByFile.delete(oldPath);
          }
        }
      })
    );
  }

  async loadTags() {
    this.allTags.clear();
    this.tagsByFile.clear();
    
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      const fileTags = this.getFileTags(file);
      this.tagsByFile.set(file.path, new Set(fileTags));
      fileTags.forEach(tag => {
        this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
      });
    }
    
    this.renderTags();
  }

  private updateFileTags(file: TFile) {
    const oldTags = this.tagsByFile.get(file.path) || new Set<string>();
    const newTagsArr = this.getFileTags(file);
    const newTags = new Set(newTagsArr);
    
    let hasChanges = false;
    
    oldTags.forEach(tag => {
      if (!newTags.has(tag)) {
        hasChanges = true;
        const count = (this.allTags.get(tag) || 0) - 1;
        if (count <= 0) this.allTags.delete(tag);
        else this.allTags.set(tag, count);
      }
    });
    
    newTags.forEach(tag => {
      if (!oldTags.has(tag)) {
        hasChanges = true;
        this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
      }
    });
    
    if (hasChanges) {
      this.tagsByFile.set(file.path, newTags);
      this.renderTags();
    }
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
    
    const filteredTags = await this.getFilteredTagsAsync();
    let sortedTags: [string, number][];
    
    if (this.currentSort === "az") {
      sortedTags = Array.from(filteredTags.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
    } else {
      sortedTags = Array.from(filteredTags.entries()).sort((a, b) => b[1] - a[1]);
    }
    
    if (this.currentSort === "az") {
      const tagsByLetter = new Map<string, Array<[string, number]>>();
      tagsByLetter.set("other", []);
      
      for (let charCode = 65; charCode <= 90; charCode++) {
        tagsByLetter.set(String.fromCharCode(charCode), []);
      }
      
      const polishDiacritics = ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'];
      polishDiacritics.forEach(letter => tagsByLetter.set(letter, []));
      
      sortedTags.forEach(tagItem => {
        const [tag] = tagItem;
        const firstChar = tag.charAt(0).toUpperCase();
        
        if (firstChar.match(/[A-Z]/)) {
          tagsByLetter.get(firstChar)?.push(tagItem);
        } else if (polishDiacritics.includes(firstChar)) {
          tagsByLetter.get(firstChar)?.push(tagItem);
        } else {
          tagsByLetter.get("other")?.push(tagItem);
        }
      });
      
      tagsByLetter.forEach((letterTags, letter) => {
        if (letterTags.length > 0) {
          if (letter !== "other") {
            const letterEl = this.tagContainer.createSpan({ cls: "flat-tag-letter" });
            letterEl.setText(letter);
          }
          
          letterTags.forEach(([tag, count]) => {
            this.createTagElement(tag, count);
          });
        }
      });
    } else {
      sortedTags.forEach(([tag, count]) => {
        this.createTagElement(tag, count);
      });
    }
  }

  private createTagElement(tag: string, count: number) {
    const tagEl = this.tagContainer.createSpan({ cls: "flat-tag" });
    
    if (this.selectedTags.has(tag)) {
      tagEl.addClass("flat-tag-selected");
    } else if (this.excludedTags.has(tag)) {
      tagEl.addClass("flat-tag-excluded");
    }
    
    tagEl.setText(`#${tag} (${count})`);
    
    tagEl.addEventListener("click", (e) => {
      const isMultiSelect = e.ctrlKey || e.metaKey;
      const isExclude = e.shiftKey;
      
      if (isExclude) {
        if (this.excludedTags.has(tag)) {
          this.excludedTags.delete(tag);
        } else {
          this.excludedTags.add(tag);
          this.selectedTags.delete(tag);
        }
      } else if (isMultiSelect) {
        if (this.selectedTags.has(tag)) {
          this.selectedTags.delete(tag);
        } else {
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
      
      this.renderTags();
      this.updateSearch();
    });
  }

  private async getFilteredTagsAsync(): Promise<Map<string, number>> {
    let filteredTags = new Map<string, number>();
    
    if (this.selectedTags.size === 0) {
      filteredTags = new Map(this.allTags);
    } else {
      const selectedTagsArray = Array.from(this.selectedTags);
      const matchingFiles: string[] = [];
      
      this.tagsByFile.forEach((tags, filePath) => {
        if (selectedTagsArray.every(tag => tags.has(tag))) {
          matchingFiles.push(filePath);
        }
      });
      
      if (this.searchMode === "note") {
        matchingFiles.forEach(filePath => {
          const fileTags = this.tagsByFile.get(filePath);
          if (fileTags) {
            fileTags.forEach(tag => {
              filteredTags.set(tag, (filteredTags.get(tag) || 0) + 1);
            });
          }
        });
      } else {
        for (const filePath of matchingFiles) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile) {
            const content = await this.app.vault.cachedRead(file);
            const lines = content.split('\n');
            
            for (const line of lines) {
              const lowerLine = line.toLowerCase();
              if (this.searchMode === "task" && !lowerLine.includes("- [")) continue;
              if (this.searchMode === "task-todo" && !lowerLine.includes("- [ ]")) continue;
              if (this.searchMode === "task-done" && !lowerLine.includes("- [x]")) continue;
              
              const lineTags = new Set<string>();
              const tagRegex = /#([^\s#]+)/g;
              let match;
              while ((match = tagRegex.exec(line)) !== null) {
                lineTags.add(match[1]);
              }
              
              if (selectedTagsArray.every(selectedTag => {
                return Array.from(lineTags).some(t => t.toLowerCase() === selectedTag.toLowerCase());
              })) {
                lineTags.forEach(tag => {
                  filteredTags.set(tag, (filteredTags.get(tag) || 0) + 1);
                });
              }
            }
          }
        }
      }
      
      selectedTagsArray.forEach(tag => {
        if (!filteredTags.has(tag)) {
          filteredTags.set(tag, this.allTags.get(tag) || 0);
        }
      });
    }
    
    if (this.hideSingleUseTags) {
      const result = new Map<string, number>();
      filteredTags.forEach((count, tag) => {
        if (count > 1 || this.selectedTags.has(tag)) {
          result.set(tag, count);
        }
      });
      filteredTags = result;
    }
    
    if (this.tagSearchText) {
      const searchText = this.tagSearchText.toLowerCase();
      const result = new Map<string, number>();
      
      filteredTags.forEach((count, tag) => {
        if (tag.toLowerCase().includes(searchText) || this.selectedTags.has(tag) || this.excludedTags.has(tag)) {
          result.set(tag, count);
        }
      });
      return result;
    }
    
    return filteredTags;
  }

  private updateSearch() {
    let searchLeaf = this.app.workspace.getLeavesOfType("search")[0];
    
    if (!searchLeaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        searchLeaf = rightLeaf;
        searchLeaf.setViewState({ type: "search" });
      }
    }

    if (this.selectedTags.size === 0 && this.excludedTags.size === 0) {
      if (searchLeaf) {
        const searchView = searchLeaf.view as any;
        if (searchView && typeof searchView.setQuery === "function") {
          searchView.setQuery("");
        }
      }
      return;
    }
    
    let tagQuery = "";
    const selected = Array.from(this.selectedTags);
    const excluded = Array.from(this.excludedTags);

    if (this.searchMode === "note") {
      tagQuery = [
        ...selected.map(tag => `tag:#${tag}`),
        ...excluded.map(tag => `-tag:#${tag}`)
      ].join(" ");
    } else {
      let prefix = "line:(";
      if (this.searchMode === "task") prefix = "task:(";
      else if (this.searchMode === "task-todo") prefix = "task-todo:(";
      else if (this.searchMode === "task-done") prefix = "task-done:(";
      
      const blockContents = [
        ...selected.map(tag => `#${tag}`),
        ...excluded.map(tag => `-#${tag}`)
      ].join(" ");

      tagQuery = `${prefix} ${blockContents} )`;
    }
    
    if (searchLeaf) {
      const searchView = searchLeaf.view as any;
      if (searchView && typeof searchView.setQuery === "function") {
        searchView.setQuery(tagQuery);
      }
      this.app.workspace.revealLeaf(searchLeaf);
    }
  }

  getFileTags(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return [];
    
    const tags = new Set<string>();
    
    if (cache.tags) {
      cache.tags.forEach(tagObj => {
        const tag = tagObj.tag.replace(/^#/, "");
        tags.add(tag);
      });
    }
    
    if (cache.frontmatter && cache.frontmatter.tags) {
      const fmTags = cache.frontmatter.tags;
      if (typeof fmTags === 'string') {
        fmTags.split(/[\s,]+/).filter(Boolean).forEach(tag => {
          tags.add(tag);
        });
      } else if (Array.isArray(fmTags)) {
        fmTags.forEach(tag => {
          if (tag) tags.add(String(tag));
        });
      }
    }
    
    return Array.from(tags);
  }

  public toggleSort() {
    this.currentSort = this.currentSort === "az" ? "count" : "az";
    this.renderTags();
  }

  public clearTagSelections() {
    this.selectedTags.clear();
    this.excludedTags.clear();
    this.renderTags();
    this.updateSearch();
  }

  public toggleSingleUseTags() {
    this.hideSingleUseTags = !this.hideSingleUseTags;
    this.renderTags();
  }

  public clearSearchBox() {
    const searchBox = this.contentEl.querySelector('.flat-tag-search-input') as HTMLInputElement;
    if (searchBox) {
      searchBox.value = "";
      this.tagSearchText = "";
      this.renderTags();
    }
  }
}
