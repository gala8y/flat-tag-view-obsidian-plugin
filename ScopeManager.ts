

import { App } from "obsidian";
import type FlatTagPlugin from "./main";

export class ScopeManager {
    public scopedFiles = new Set<string>();

    constructor(private app: App, private plugin: FlatTagPlugin) {}

    public recomputeScopedFiles(allFiles: string[]) {
        this.scopedFiles.clear();
        if (!this.plugin.settings.scopesOn) {
            allFiles.forEach(f => this.scopedFiles.add(f));
            return;
        }

        const scopes = this.plugin.settings.scopes || [];
        let activeScope = scopes.find(s => s.id === this.plugin.settings.lastScopeId);
        
        // Auto-correct stale IDs
        if (!activeScope && scopes.length > 0) {
            activeScope = scopes[0];
            this.plugin.settings.lastScopeId = activeScope.id;
            this.plugin.saveSettings();
        }

        if (!activeScope || activeScope.folders.length === 0) {
            allFiles.forEach(f => this.scopedFiles.add(f));
            return;
        }

        for (const file of allFiles) {
            if (this.fileInScopeDef(file, activeScope)) {
                this.scopedFiles.add(file);
            }
        }
    }

    private fileInScopeDef(filePath: string, activeScope: any): boolean {
        let included = false;
        let hasInclusions = false;

        const inFolder = (fp: string, folderPath: string) => {
            if (!folderPath) return true;
            const normalized = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
            return fp.startsWith(normalized + '/') || fp === normalized;
        };

        for (const folder of activeScope.folders) {
            if (!folder.included) {
                if (inFolder(filePath, folder.path)) return false; 
            } else {
                hasInclusions = true;
                if (inFolder(filePath, folder.path)) included = true;
            }
        }
        
        if (included) return true;
        if (!hasInclusions) return true;
        return false;
    }

    public buildScopeQuery(): string | null {
        if (!this.plugin.settings.scopesOn) return null;
        const scopes = this.plugin.settings.scopes || [];
        const activeScope = scopes.find(s => s.id === this.plugin.settings.lastScopeId) || scopes[0];
        
        if (!activeScope || activeScope.folders.length === 0) return null;

        const includedPaths = activeScope.folders
            .filter((f: any) => f.included)
            .map((f: any) => f.path ? `path:"${f.path}"` : '');
            
        const excludedPaths = activeScope.folders
            .filter((f: any) => !f.included)
            .map((f: any) => f.path ? `-path:"${f.path}"` : '');
        
        const incStr = includedPaths.length > 0 ? `(${includedPaths.join(' OR ')})` : '';
        const excStr = excludedPaths.join(' ');
        
        const scopeQuery = [incStr, excStr].filter(s => s).join(' ');
        return scopeQuery || null;
    }
}

