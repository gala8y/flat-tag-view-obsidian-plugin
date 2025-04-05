import { ItemView, WorkspaceLeaf, TFile, setIcon } from "obsidian";
import { VIEW_TYPE } from "./constants";

export class FlatTagView extends ItemView {
  private container: HTMLElement;
  private tagContainer: HTMLElement;
  private sortContainer: HTMLElement;
  private selectedTags: Set<string> = new Set();
  private excludedTags: Set<string> = new Set();
  private allTags: Map<string, number> = new Map();
  private currentSort: "az" | "count" = "az";
  private tagsByFile: Map<string, Set<string>> = new Map();
  private hideSingleUseTags: boolean = false;
  private showAlphabetLetters: boolean = false;
  private tagSearchText: string = "";

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
    // Create container and sort container
    this.container = this.contentEl.createDiv({ cls: "flat-tag-container" });
    this.sortContainer = this.container.createDiv({ cls: "flat-tag-sort-container" });
  
    // Create left section for buttons
    const buttonSection = this.sortContainer.createDiv({ cls: "flat-tag-buttons-section" });
  
    // Add existing buttons to the button section
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
  
    const clearButton = buttonSection.createDiv({ cls: "flat-tag-clear-button" });
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
  
    const toggleAlphabetButton = buttonSection.createDiv({ 
      cls: "flat-tag-sort-button", 
      title: "Toggle alphabet letters" 
    });
    setIcon(toggleAlphabetButton, "lucide-brick-wall");
    toggleAlphabetButton.addEventListener("click", () => {
      this.toggleAlphabetLetters();
      setIcon(toggleAlphabetButton, this.showAlphabetLetters ? "cuboid" : "lucide-brick-wall");
    });
  
    // Create search section on the right
    const searchSection = this.sortContainer.createDiv({ cls: "flat-tag-search-section" });
    
    // Add search box
    const searchBox = searchSection.createEl("input", {
      cls: "flat-tag-search-input",
      attr: { 
        type: "text", 
        placeholder: "Search tags...",
      }
    });
    
    // Add clear search button
    const clearSearchButton = searchSection.createDiv({ 
      cls: "flat-tag-search-clear-button",
      title: "Clear search" 
    });
    setIcon(clearSearchButton, "square-x");
    clearSearchButton.addEventListener("click", () => {
      this.clearSearchBox();
    });
    
    // Add event listener for search input
    searchBox.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      this.tagSearchText = target.value;
      this.renderTags();
    });
    
    this.tagContainer = this.container.createDiv({ cls: "flat-tag-list" });
  
    await this.loadTags();
  
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.loadTags();
      })
    );
  }
  
  async loadTags() {
    this.allTags.clear();
    this.tagsByFile.clear();
    
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      const fileTags = this.getFileTags(file);
      
      // Store tags by file for filtering
      this.tagsByFile.set(file.path, new Set(fileTags));
      
      fileTags.forEach(tag => {
        this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
      });
    }
    
    this.renderTags();
  }

  renderTags() {
    this.tagContainer.empty();
    
    const filteredTags = this.getFilteredTags();
    
    let sortedTags: [string, number][];
    
    if (this.currentSort === "az") {
      sortedTags = Array.from(filteredTags.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
    } else {
      sortedTags = Array.from(filteredTags.entries()).sort((a, b) => b[1] - a[1]);
    }
    
    if (this.showAlphabetLetters && this.currentSort === "az") {
      const tagsByLetter = new Map<string, Array<[string, number]>>();
      
      // Initialize with "other" group first, then A-Z, then Polish diacritics
      tagsByLetter.set("other", []);
      for (let charCode = 65; charCode <= 90; charCode++) {
        const letter = String.fromCharCode(charCode);
        tagsByLetter.set(letter, []);
      }
      const polishDiacritics = ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'];
      polishDiacritics.forEach(letter => tagsByLetter.set(letter, []));
      
      sortedTags.forEach(tagItem => {
        const [tag, count] = tagItem;
        const firstChar = tag.charAt(0).toUpperCase();
        
        if (firstChar.match(/[A-Z]/)) {
          const letterTags = tagsByLetter.get(firstChar) || [];
          letterTags.push(tagItem);
          tagsByLetter.set(firstChar, letterTags);
        } else if (polishDiacritics.includes(firstChar)) {
          const letterTags = tagsByLetter.get(firstChar) || [];
          letterTags.push(tagItem);
          tagsByLetter.set(firstChar, letterTags);
        } else {
          const otherTags = tagsByLetter.get("other") || [];
          otherTags.push(tagItem);
          tagsByLetter.set("other", otherTags);
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
      const isExclude = e.shiftKey && isMultiSelect;
      
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
    
  getFilteredTags(): Map<string, number> {
    // Get tags based on current selection
    let filteredTags = new Map<string, number>();
    
    // If no tags selected, show all tags
    if (this.selectedTags.size === 0) {
      filteredTags = new Map(this.allTags);
    } else {
      // Find files that contain ALL selected tags
      const selectedTagsArray = Array.from(this.selectedTags);
      const matchingFiles: string[] = [];
      
      this.tagsByFile.forEach((tags, filePath) => {
        if (selectedTagsArray.every(tag => tags.has(tag))) {
          matchingFiles.push(filePath);
        }
      });
      
      // Add all co-occurring tags
      matchingFiles.forEach(filePath => {
        const fileTags = this.tagsByFile.get(filePath);
        if (fileTags) {
          fileTags.forEach(tag => {
            filteredTags.set(tag, (filteredTags.get(tag) || 0) + 1);
          });
        }
      });
      
      // Ensure selected tags are included
      selectedTagsArray.forEach(tag => {
        if (!filteredTags.has(tag)) {
          filteredTags.set(tag, this.allTags.get(tag) || 0);
        }
      });
    }
    
    // Filter out single-use tags if option is enabled
    if (this.hideSingleUseTags) {
      const result = new Map<string, number>();
      filteredTags.forEach((count, tag) => {
        if (count > 1 || this.selectedTags.has(tag)) {
          result.set(tag, count);
        }
      });
      filteredTags = result;
    }
    
    // Filter by search text but keep selected/excluded tags visible
    if (this.tagSearchText) {
      const searchText = this.tagSearchText.toLowerCase();
      const result = new Map<string, number>();
      
      filteredTags.forEach((count, tag) => {
        if (tag.toLowerCase().includes(searchText) || 
            this.selectedTags.has(tag) || 
            this.excludedTags.has(tag)) {
          result.set(tag, count);
        }
      });
      
      return result;
    }
    
    return filteredTags;
  }
  
  updateSearch() {
    if (this.selectedTags.size === 0 && this.excludedTags.size === 0) {
      this.app.workspace.getLeavesOfType("search").forEach(leaf => {
        const searchView = leaf.view as any;
        if (searchView && typeof searchView.clearSearch === "function") {
          searchView.clearSearch();
        }
      });
      return;
    }
    
    const tagQuery = [
      ...Array.from(this.selectedTags).map(tag => `tag:#${tag}`),
      ...Array.from(this.excludedTags).map(tag => `-tag:#${tag}`)
    ].join(" ");
    
    let searchLeaf = this.app.workspace.getLeavesOfType("search")[0];
    
    if (!searchLeaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        searchLeaf = rightLeaf;
        searchLeaf.setViewState({ type: "search" });
      }
    }
    
    if (searchLeaf) {
      const searchView = searchLeaf.view as any;
      if (searchView && typeof searchView.setQuery === "function") {
        searchView.setQuery(tagQuery);
        searchView.search();
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
        fmTags.split(/[,\s]+/).filter(Boolean).forEach(tag => {
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

  // Methods for hotkey functionality
  toggleSort() {
    this.currentSort = this.currentSort === "az" ? "count" : "az";
    this.renderTags();
  }

  clearTagSelections() {
    this.selectedTags.clear();
    this.excludedTags.clear();
    this.renderTags();
    this.updateSearch();
  }

  toggleSingleUseTags() {
    this.hideSingleUseTags = !this.hideSingleUseTags;
    this.renderTags();
  }

  toggleAlphabetLetters() {
    this.showAlphabetLetters = !this.showAlphabetLetters;
    this.renderTags();
  }

  clearSearchBox() {
    const searchBox = this.contentEl.querySelector(".flat-tag-search-input") as HTMLInputElement;
    if (searchBox) {
      searchBox.value = "";
      this.tagSearchText = "";
      this.renderTags();
    }
  }
}

