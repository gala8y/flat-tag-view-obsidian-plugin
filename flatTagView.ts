import { ItemView, WorkspaceLeaf, TFile, setIcon } from "obsidian";
import { VIEW_TYPE } from "./constants";
import FlatTagPlugin from "./main";

export class FlatTagView extends ItemView {
  public plugin: FlatTagPlugin;
  private container: HTMLElement;
  private tagContainer: HTMLElement;
  private sortContainer: HTMLElement;
  
  private sortAzBtn: HTMLElement;
  private sortCountBtn: HTMLElement;
  private scopeBtn: HTMLElement;
  private taskBtn: HTMLElement;

  private selectedTags: Set<string> = new Set();
  private excludedTags: Set<string> = new Set();
  private allTags: Map<string, number> = new Map();
  private currentSort: "az" | "count" = "az";
  
  // CHANGED FROM Set<string> TO string[] SO WE COUNT TOTAL OCCURRENCES, NOT JUST FILES!
  private tagsByFile: Map<string, string[]> = new Map();
  
  private tagSearchText: string = "";
  private searchMode: "note" | "line" | "task" | "task-todo" | "task-done" = "note";
  private touchTimer: number | null = null;

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
  
    this.sortAzBtn = buttonSection.createDiv({ cls: "flat-tag-sort-button", title: "Sort A-Z" });
    setIcon(this.sortAzBtn, "lucide-sort-asc");
    
    this.sortCountBtn = buttonSection.createDiv({ cls: "flat-tag-sort-button", title: "Sort by usage" });
    setIcon(this.sortCountBtn, "lucide-bar-chart-2");
  
    const clearButton = buttonSection.createDiv({ cls: "flat-tag-clear-button", title: "Clear tag selections" });
    setIcon(clearButton, "x");
    clearButton.addEventListener("click", () => {
      this.clearTagSelections();
    });

    this.scopeBtn = buttonSection.createDiv({ 
      cls: "flat-tag-mode-button", 
      text: "NOTE",
      title: "Click to cycle: Note -> Line" 
    });

    this.taskBtn = buttonSection.createDiv({ 
      cls: "flat-tag-mode-button", 
      text: "TASK-ALL",
      title: "Click to cycle: All -> Todo -> Done"
    });

    this.sortAzBtn.addEventListener("click", () => {
      this.currentSort = "az";
      this.updateModeUI();
    });

    this.sortCountBtn.addEventListener("click", () => {
      this.currentSort = "count";
      this.updateModeUI();
    });

    this.scopeBtn.addEventListener("click", () => this.toggleScopeMode());
    this.taskBtn.addEventListener("click", () => this.toggleTaskMode());

    this.updateModeUI();
  
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

    this.registerEvent(
      this.app.workspace.on("flat-tag-view:settings-updated" as any, () => {
        this.renderTags();
      })
    );
  }

  async loadTags() {
    this.allTags.clear();
    this.tagsByFile.clear();
    
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      const fileTags = this.getFileTags(file); // Now returns all duplicates!
      this.tagsByFile.set(file.path, fileTags);
      
      fileTags.forEach(tag => {
        this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
      });
    }
    
    this.renderTags();
  }

  private updateFileTags(file: TFile) {
    const oldTagsArr = this.tagsByFile.get(file.path) || [];
    const newTagsArr = this.getFileTags(file);
    
    // Sort and join arrays to quickly check if the exact tags and counts have changed
    const oldSorted = [...oldTagsArr].sort().join(",");
    const newSorted = [...newTagsArr].sort().join(",");
    
    if (oldSorted !== newSorted) {
      // Decrement the old tag occurrences
      oldTagsArr.forEach(tag => {
        const count = (this.allTags.get(tag) || 0) - 1;
        if (count <= 0) this.allTags.delete(tag);
        else this.allTags.set(tag, count);
      });
      
      // Increment the new tag occurrences
      newTagsArr.forEach(tag => {
        this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
      });
      
      this.tagsByFile.set(file.path, newTagsArr);
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
    
    if (this.sortContainer) {
      const sortAzBtn = this.sortContainer.querySelector('.flat-tag-sort-button[title="Sort A-Z"]');
      const sortCountBtn = this.sortContainer.querySelector('.flat-tag-sort-button[title="Sort by usage"]');
      if (sortAzBtn && sortCountBtn) {
        sortAzBtn.removeClass('is-active');
        sortCountBtn.removeClass('is-active');
        if (this.currentSort === 'az') sortAzBtn.addClass('is-active');
        else sortCountBtn.addClass('is-active');
      }
    }
    
    const filteredTags = await this.getFilteredTagsAsync();
    
    const pinnedTags = new Map<string, number>();
    const normalTags = new Map<string, number>();
    const safePinnedList = this.plugin.settings?.pinnedTags || [];
    const pinnedSet = new Set(safePinnedList);
    
    filteredTags.forEach((count, tag) => {
      if (pinnedSet.has(tag)) {
        pinnedTags.set(tag, count);
      } else {
        normalTags.set(tag, count);
      }
    });

    if (pinnedTags.size > 0) {
      const pinContainer = this.tagContainer.createDiv({ cls: "flat-tag-pinned-section" });
      
      const pinnedIcon = pinContainer.createSpan({ cls: "flat-tag-letter" });
      setIcon(pinnedIcon, "pin");
      
      const pinnedSorted = Array.from(pinnedTags.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
      pinnedSorted.forEach(([tag, count]) => {
        this.createTagElement(tag, count, pinContainer);
      });
      
      this.tagContainer.createDiv({ cls: "flat-tag-separator" });
    }

    let sortedTags: [string, number][];
    
    if (this.currentSort === "az") {
      sortedTags = Array.from(normalTags.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
    } else {
      sortedTags = Array.from(normalTags.entries()).sort((a, b) => b[1] - a[1]);
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
            this.createTagElement(tag, count, this.tagContainer);
          });
        }
      });
    } else {
      sortedTags.forEach(([tag, count]) => {
        this.createTagElement(tag, count, this.tagContainer);
      });
    }
  }

  private createTagElement(tag: string, count: number, parentEl: HTMLElement) {
    const tagEl = parentEl.createSpan({ cls: "flat-tag" });
    
    if (this.selectedTags.has(tag)) tagEl.addClass("flat-tag-selected");
    else if (this.excludedTags.has(tag)) tagEl.addClass("flat-tag-excluded");
    
    const safePinned = this.plugin.settings?.pinnedTags || [];
    if (safePinned.includes(tag)) tagEl.addClass("flat-tag-pinned");
    
    tagEl.setText(`#${tag} (${count})`);

    const handleTagInteraction = async (isMultiSelect: boolean, isExclude: boolean, isPin: boolean) => {
      if (isPin) {
        if (!this.plugin.settings) return;
        if (!this.plugin.settings.pinnedTags) this.plugin.settings.pinnedTags = [];
        
        if (this.plugin.settings.pinnedTags.includes(tag)) {
          this.plugin.settings.pinnedTags = this.plugin.settings.pinnedTags.filter(t => t !== tag);
        } else {
          this.plugin.settings.pinnedTags.push(tag);
        }
        await this.plugin.saveSettings();
        return; 
      }

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
    };

    tagEl.addEventListener("click", (e) => {
      e.preventDefault();
      handleTagInteraction(e.ctrlKey || e.metaKey, e.shiftKey, e.altKey);
    });

    tagEl.addEventListener("touchstart", (e) => {
      this.touchTimer = window.setTimeout(() => {
        this.touchTimer = null;
        const isCurrentlySelected = this.selectedTags.has(tag);
        handleTagInteraction(!isCurrentlySelected, isCurrentlySelected, false);
      }, 500); 
    }, { passive: true });

    tagEl.addEventListener("touchend", (e) => {
      if (this.touchTimer) {
        window.clearTimeout(this.touchTimer);
        this.touchTimer = null;
        handleTagInteraction(false, false, false);
      } else {
        e.preventDefault(); 
      }
    });
    
    tagEl.addEventListener("touchmove", () => {
      if (this.touchTimer) {
        window.clearTimeout(this.touchTimer);
        this.touchTimer = null;
      }
    }, { passive: true });
  }

  private async getFilteredTagsAsync(): Promise<Map<string, number>> {
    let filteredTags = new Map<string, number>();
    
    if (this.selectedTags.size === 0) {
      filteredTags = new Map(this.allTags);
    } else {
      const selectedTagsArray = Array.from(this.selectedTags);
      const matchingFiles: string[] = [];
      
      this.tagsByFile.forEach((tagsArr, filePath) => {
        if (selectedTagsArray.every(tag => tagsArr.includes(tag))) {
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
    
    const cutoff = this.plugin.settings?.frequencyCutoff || 0;
    const safePinned = this.plugin.settings?.pinnedTags || [];
    
    if (cutoff > 0) {
      const result = new Map<string, number>();
      filteredTags.forEach((count, tag) => {
        if (count >= cutoff || this.selectedTags.has(tag) || safePinned.includes(tag)) {
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
    
    const tags: string[] = []; // Changed to array to allow duplicates
    
    if (cache.tags) {
      cache.tags.forEach(tagObj => {
        tags.push(tagObj.tag.replace(/^#/, ""));
      });
    }
    
    if (cache.frontmatter && cache.frontmatter.tags) {
      const fmTags = cache.frontmatter.tags;
      if (typeof fmTags === 'string') {
        fmTags.split(/[\s,]+/).filter(Boolean).forEach(tag => {
          tags.push(tag);
        });
      } else if (Array.isArray(fmTags)) {
        fmTags.forEach(tag => {
          if (tag) tags.push(String(tag));
        });
      }
    }
    
    return tags;
  }

  public updateModeUI() {
    if (!this.sortAzBtn || !this.sortCountBtn || !this.scopeBtn || !this.taskBtn) return;
    
    this.sortAzBtn.removeClass("is-active");
    this.sortCountBtn.removeClass("is-active");
    if (this.currentSort === "az") this.sortAzBtn.addClass("is-active");
    if (this.currentSort === "count") this.sortCountBtn.addClass("is-active");

    this.scopeBtn.removeClass("is-active");
    this.taskBtn.removeClass("is-active");
    
    if (this.searchMode === "note") {
      this.scopeBtn.setText("NOTE");
      this.scopeBtn.addClass("is-active");
    } else if (this.searchMode === "line") {
      this.scopeBtn.setText("LINE");
      this.scopeBtn.addClass("is-active");
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
      if (!["NOTE", "LINE"].includes(this.scopeBtn.innerText)) {
        this.scopeBtn.setText("NOTE");
      }
    }

    this.updateSearch(); 
    if (this.tagContainer) {
      this.renderTags();
    }
  }

  public toggleScopeMode() {
    if (!this.scopeBtn) return;
    if (["note", "line"].includes(this.searchMode)) {
      this.searchMode = this.searchMode === "note" ? "line" : "note";
    } else {
      this.searchMode = this.scopeBtn.innerText === "LINE" ? "line" : "note";
    }
    this.updateModeUI();
  }

  public toggleTaskMode() {
    if (!this.taskBtn) return;
    if (["task", "task-todo", "task-done"].includes(this.searchMode)) {
      if (this.searchMode === "task") this.searchMode = "task-todo";
      else if (this.searchMode === "task-todo") this.searchMode = "task-done";
      else this.searchMode = "task";
    } else {
      if (this.taskBtn.innerText === "TASK-TODO") this.searchMode = "task-todo";
      else if (this.taskBtn.innerText === "TASK-DONE") this.searchMode = "task-done";
      else this.searchMode = "task";
    }
    this.updateModeUI();
  }

  public toggleSort() {
    this.currentSort = this.currentSort === "az" ? "count" : "az";
    this.updateModeUI();
  }

  public clearTagSelections() {
    this.selectedTags.clear();
    this.excludedTags.clear();
    this.renderTags();
    this.updateSearch();
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
