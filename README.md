# flat-tag-view-obsidian-plugin

Displays tags in a flat, space-separated format with multi-select filtering, sorting, and search integration.

![flat-tag-view-buttons](./flat-tag-view-see-me.png)

## Flat Tag View Pane
- **Core feature: select multiple tags and filter FTV view with ctrl-click**
- Add negative selection with shift-click (do not show files with this tag)
- Pin/unpin commonly accessed tags to top of the view with alt-click
- **Global Mute:** right-click a tag to globally decommission it (replaces `#tag` with `#%tag` across vault)
- Modes: standard / line / tasks / tasks-todo / tasks-done
- Sort tags a-z or by usage (emojis and digits intelligently pushed to top)
- Clear tags selection with one click (x) or hotkey
- Setting to hide infrequently used tags (frequency cutoff)
- Simple search for tags with clear button
- Configurable hotkeys
- Automatically focuses search pane and sends selected tags to it

## Tag Interaction (Editor)

Alt-clicking a word in the editor turns it into a tag. Alt-clicking an existing tag removes tag (#). Placement of newly created tags is configurable:

| Mode | Behavior |
|---|---|
| **SOL** (Start of Line) | Tag is inserted at the beginning of the line, sorted alphabetically with any existing leading tags |
| **INP** (In Place) | The word under the cursor is converted to a tag in place |
| **EOL** (End of Line) | Tag is appended at the end of the line, before any `^block-id` suffix |

The current mode is shown in the Obsidian status bar (this can be toggled off in settings). You can cycle through modes by clicking the status bar text, using the **Cycle Tag Placement** hotkey, or via direct SOL/INP/EOL hotkeys.

**Power User Shortcuts:**
- **Drill Down (Ctrl+Alt+Click):** Click a tag in the editor to immediately open the FTV pane, clear current selections, and select only that tag.
- **Local Mute (Ctrl+Shift+Alt+Click):** Instantly invalidates a specific tag by changing it to `#%tag` (and vice-versa). Perfect for temporarily dropping a single line out of a tagged pool without deleting the text.

## Mobile Use

FTV works on Obsidian for Android and (probably) on iOS (not tested) without any extra configuration. Standard keyboard and mouse interactions on desktop have direct touch equivalents: a single tap selects a tag (or deselects it if it is the only active selection), matching a regular left-click. A long press (~500 ms) activates multi-select on the tapped tag, equivalent to Ctrl/Cmd+Click — useful for building AND queries without a keyboard. Long press unselects a tag from multiple selection. To pin or unpin a tag on mobile, swipe the tag to the left. Touch support is still somewhat quirky.

## Settings

| Area | Setting | Description |
|---|---|---|
| Tags Pane | Frequency cutoff | Hides tags that appear fewer than N times in the vault |
| Tags Pane | Clear pinned tags | Removes all pinned tags from the top section |
| Tag insertion | Alt-click tag placement | SOL / INP / EOL — where a newly created tag is placed |
| Tag insertion | Show placement in status bar | Displays SOL / INP / EOL in the Obsidian status bar |

## Hotkeys

All hotkeys are unbound by default and can be assigned in Obsidian Settings → Hotkeys.

| Command | Description |
|---|---|
| Open Flat Tags | Opens / reveals the FTV sidebar panel |
| Toggle Flat Tag Sort (A-Z/Usage) | Switches between alphabetical and usage sort |
| Toggle Flat Tag Mode (Note/Line) | Switches between Note and Line scope |
| Cycle Flat Tag Task Mode (All/Todo/Done) | Cycles through task filter modes |
| Clear Flat Tag Selections | Clears all selected and excluded tags |
| Clear Flat Tag Search Box | Clears the tag search input |
| Cycle Tag Placement (SOL / INP / EOL) | Cycles insertion placement mode and shows a notice |
| Set Tag Placement (SOL / INP / EOL) | Three separate hotkeys to directly set specific modes |

---

### _vibe coded w/ ai_
- _0.1.0 claude 3.7 sonnet / 4o_
- _0.2.2 gemini 3.1 pro_
- _0.3.0 gpt 5.2 / gemini 3.1 pro_
- _0.4.0 gemini 3.1 pro_

### ver. 0.4.0 changelog
- added: editor drill-down (ctrl-alt-click tag in editor to instantly filter it in FTV)
- added: local mute/unmute (ctrl-shift-alt-click tag in editor to safely disable it as `#%tag` and re-enable it)
- added: global mute (right-click tag in FTV to securely decommission it across entire vault)
- added: three new hotkeys to directly set SOL, INP, or EOL modes
- added: clickable status bar text to quickly cycle placement modes
- fixed: improved true universal sorting (e.g., `Ą` sorts right after `A`) while perfectly pinning emojis and digits to the very top #%improved
- fixed: blocked standard alt-clicks from accidentally interacting with locally muted `#%tags`
- easter egg: clicking the active sort button reveals total unique vault tag count

### ver. 0.3.0 changelog
- added: tag insertion and deletion
    - alt-click tag insertion in editor (SOL / INP / EOL modes)
        - modes: start of line, in place, end of line
        - auto-detection: alt-click on existing `#tag` removes it, on plain word creates it
        - tag insertion preserves `^block-id` suffix when placing tags at end of line
        - newly inserted tags are sorted alphabetically with existing leading/trailing tags
    - added: status bar indicator showing current tag placement mode (SOL / INP / EOL)
    - added: "Show placement in status bar" toggle in settings
    - added: "Cycle Tag Placement" hotkey command
- ~~added mobile long-press support for editor tag insertion~~
- improved: touch handling in tag list (fixed double-fire from synthetic click events)
- improved: optimistic CSS update on tag selection (no more colour lag on long-press)
- code: refactored mobile touch state to per-element closures

### ver. 0.2.2 changelog
- optimized view update logic (now FTV view updates quickly after current note changes)
- added ability to pin/unpin tags to top of flat-tag-view (with alt-click)
- added line-mode (check co-occurrence per line, tags have to be on same line to show up as co-occurring)
- added tasks-mode (same as line-mode, but works only with tasks)
- changed 'hide single use tags' to 'frequency cutoff' (hides tags occurring less than x times)
- fixed byUsage sorting within same frequency groups — ftag(2), atag(2), btag(2), dtag(1), ctag(1) are now sorted properly as atag(2), btag(2), ftag(2), ctag(1), dtag(1)
- added mobile version compatibility
