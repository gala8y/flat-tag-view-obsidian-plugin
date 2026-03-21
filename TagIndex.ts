

import { App, CachedMetadata, TFile } from "obsidian";





export class TagIndex {
  private static instance: TagIndex;

  public allTags: Map<string, number> = new Map();
  public tagsByFile: Map<string, string[]> = new Map();
  public fileSignatures: Map<string, string> = new Map(); // Tracks changes to tags/tasks
  public onUpdate: Set<() => void> = new Set();

  private loadRunId = 0;

  private constructor(private app: App) {}

  public static getInstance(app: App): TagIndex {
    if (!TagIndex.instance) TagIndex.instance = new TagIndex(app);
    return TagIndex.instance;
  }

  public triggerUpdate() {
    for (const cb of this.onUpdate) {
      cb();
    }
  }

  public async loadTags() {
    const runId = ++this.loadRunId;

    this.allTags.clear();
    this.tagsByFile.clear();
    this.fileSignatures.clear();

    const files = this.app.vault.getMarkdownFiles();

    // Process files chunk by chunk to avoid blocking UI thread
    let index = 0;
    const CHUNK_SIZE = 100;

    const processChunk = () => {
        if (runId !== this.loadRunId) return;

        const chunk = files.slice(index, index + CHUNK_SIZE);
        for (const file of chunk) {
            const ignored = (this.app.metadataCache as any).isUserIgnored?.(file.path);
            if (ignored) continue;

            const fileTags = this.extractTagsFromCache(file);
            if (!fileTags || fileTags.length === 0) continue;

            this.tagsByFile.set(file.path, fileTags);
            this.fileSignatures.set(file.path, this.generateFileSignature(file));

            for (const tag of fileTags) {
                this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
            }
        }

        index += CHUNK_SIZE;
        if (index < files.length) {
            // Yield to main thread
            window.setTimeout(processChunk, 10);
        } else {
            this.triggerUpdate();
        }
    };

    processChunk();
  }

  public getFileTags(file: TFile): string[] {
    return this.tagsByFile.get(file.path) ?? [];
  }

  public updateFileTags(file: TFile) {
    if (file.extension !== "md") return;

    const ignored = (this.app.metadataCache as any).isUserIgnored?.(file.path);
    if (ignored) {
      this.removeFileTags(file.path);
      return;
    }

    const nextTags = this.extractTagsFromCache(file) || [];
    const prevTags = this.tagsByFile.get(file.path) ?? [];

    const prevSig = this.fileSignatures.get(file.path) ?? "";
    const nextSig = this.generateFileSignature(file);

    // If exact same tags, same lines, and same task states, do nothing!
    if (prevSig === nextSig) return;

    // We only update allTags counts if the ACTUAL tag list changed
    const prevTagStr = prevTags.join(",");
    const nextTagStr = nextTags.join(",");

    if (prevTagStr !== nextTagStr) {
      for (const tag of prevTags) {
        const prev = this.allTags.get(tag) ?? 0;
        if (prev <= 1) this.allTags.delete(tag);
        else this.allTags.set(tag, prev - 1);
      }

      if (nextTags.length === 0) {
          this.tagsByFile.delete(file.path);
      } else {
          this.tagsByFile.set(file.path, nextTags);
          for (const tag of nextTags) {
            this.allTags.set(tag, (this.allTags.get(tag) ?? 0) + 1);
          }
      }
    }

    // Always update the signature
    if (nextTags.length === 0) {
      this.fileSignatures.delete(file.path);
    } else {
      this.fileSignatures.set(file.path, nextSig);
    }

    // Trigger update so FlatTagView knows to re-render the JIT lists
    this.triggerUpdate();
  }

  public renameFile(oldPath: string, file: TFile) {
    const oldTags = this.tagsByFile.get(oldPath);
    const oldSig = this.fileSignatures.get(oldPath);

    if (oldTags) {
      this.tagsByFile.delete(oldPath);
      this.tagsByFile.set(file.path, oldTags);

      if (oldSig) {
          this.fileSignatures.delete(oldPath);
          this.fileSignatures.set(file.path, oldSig);
      }

      this.triggerUpdate();
    }
  }

  public removeFileTags(filePath: string) {
    const oldTags = this.tagsByFile.get(filePath) ?? [];

    for (const tag of oldTags) {
      const prev = this.allTags.get(tag) ?? 0;
      if (prev <= 1) this.allTags.delete(tag);
      else this.allTags.set(tag, prev - 1);
    }

    this.tagsByFile.delete(filePath);
    this.fileSignatures.delete(filePath);
    this.triggerUpdate();
  }

  private generateFileSignature(file: TFile): string {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return "";

    let sig = "T:";
    cache.tags?.forEach(t => {
      sig += `${t.tag}@${t.position.start.line},`;
    });

    sig += "|L:";
    cache.listItems?.forEach(item => {
      if (item.task !== undefined) {
        sig += `${item.position.start.line}[${item.task}],`;
      }
    });

    return sig;
  }

  private extractTagsFromCache(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return [];

    const tagSet = new Set<string>();

    cache.tags?.forEach(t => {
      const clean = this.normalizeTag(t.tag);
      if (clean && !clean.startsWith("%")) tagSet.add(clean);
    });

    this.extractFrontmatterTags(cache).forEach(t => tagSet.add(t));

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
  }

  public extractFrontmatterTags(cache: import("obsidian").CachedMetadata): string[] {
    const fm = cache?.frontmatter;
    if (!fm) return [];

    const raw = fm.tags ?? fm.tag;
    if (!raw) return [];

    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    const out = new Set<string>();

    for (const value of values) {
      if (typeof value !== "string") continue;

      for (const part of value.split(",")) {
        const normalized = this.normalizeTag(part);
        if (normalized) out.add(normalized);
      }
    }

    return Array.from(out);
  }

  public normalizeTag(raw: string): string | null {
    if (!raw) return null;
    let tag = String(raw).trim();
    if (!tag) return null;
    tag = tag.replace(/^#/, "");
    if (!tag || tag.startsWith("#")) return null;
    return tag;
  }
}





