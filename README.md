# flat-tag-view-obsidian-plugin

Displays tags in a flat, space-separated format with multi-select filtering, sorting, and search integration.

![flat-tag-view-buttons](./flat-tag-view-see-me.png)

## Flat Tag View Pane / Main features
- **Core feature: select multiple tags and filter FTV view with Ctrl-click**
- Add negative selection with Shift-click (do not show files with this tag)
- Pin / Unpin commonly accessed tags to/from top of the view with Alt-click
- Modes: standard / line / tasks / tasks-todo / tasks-done
- Sort tags a-z or by usage
- Setting to hide infrequently used tags (frequency cutoff)
- Clear tags selection with one click (x) or a hotkey
- Simple search for tags with clear button
- Configurable hotkeys
- Global Mute: right-click a tag in FTV pane to globally decommission it (replaces `#tag` with `#%tag` across vault)
- Automatically focuses search pane and sends selected tags to it
- Performant on very large vaults (+10k notes, +5k tags)

### Filter Modes (Note / Line / Task)

By default, selecting multiple tags in FTV works on a **Note-level** basis. clicking the `NOTE` and `TASK-ALL` buttons allows you to tighten the scope of your search to find tags that co-occur on the same line or within specific task types.

| Mode | Behavior |
|---|---|
| **NOTE** (Standard) | Shows tags that co-occur anywhere within the same file. |
| **LINE** | Strict mode. Only shows tags that co-occur on the exact same line of text. |
| **TASK-ALL** | Only shows tags that co-occur on a line formatted as a task (e.g., `- [ ]` or `- [x]`). |
| **TASK-TODO** | Only shows tags that co-occur on an incomplete task line (`- [ ]`). |
| **TASK-DONE** | Only shows tags that co-occur on a completed task line (`- [x]`). |


_Important Notes on Task Modes_

1. When you switch to `LINE` or `TASK` modes, the FTV pane will still display **all tags in your vault** until you actually click your first tag to begin filtering. Scanning every line of every file in the vault just to hide non-task tags from the initial view would be computationally expensive and cause significant lag. The strict line/task filtering kicks in *after* you make your first selection.

2. If you have a #tag used 8 times in a note (once in text, plus 7 tasks marked with this #tag (two of which are done and five are to-do)), FTV will show:
    - #tag (1) in note mode
    - #tag (8) in line mode
    - #tag (7) in task-all mode
    - #tag (5) in task-todo mode
    - #tag (2) in task-done mode

3. FTV's task modes are strictly line-based. This means tags placed on indented lines underneath a task will not be associated with that parent task. Only tags sitting on the exact same line as the task checkbox are taken into account.


## Tag Insertion and Interaction (Editor)

Alt-clicking a word in the editor turns it into a tag. Alt-clicking an existing tag removes tag (#). Placement of newly created tags is configurable:

| Mode | Behavior |
|---|---|
| **SOL** (Start of Line) | Tag is inserted at the beginning of the line, sorted alphabetically with any existing leading tags |
| **INP** (In Place) | The word under the cursor is converted to a tag in place |
| **EOL** (End of Line) | Tag is appended at the end of the line, before any `^block-id` suffix |

The current mode is shown in the Obsidian status bar (this can be toggled off in settings). You can cycle through modes by clicking the status bar text, using the **Cycle Tag Placement** hotkey, or via direct SOL/INP/EOL hotkeys.

**Extra Shortcuts**
- Ctrl-Alt-click - **Start Drill Down** - click a tag in the editor to immediately open the FTV pane, clear current selections, and select that tag. **This works in Reading View, too.**
- Ctrl-Shift-Alt-click - **Local Mute** - Instantly invalidate/revalidate tag under cursor by changing it to `#%tag` (and back to `#tag`).
- Shift-Alt-click - **Remove #** - Removes # always preserving text, regardless of location of a tag on a line and regardless of mode (SOL/INP/EOL)
_<small>These extra shortcuts/actions collide with `Create/Open Tag Page` function in Tag Wrangler plugin by PJ Eby</small>_


## Mobile Use

FTV works on Obsidian for Android and (probably) on iOS (not tested) without any extra configuration. A single tap selects a tag (or deselects it if it is the only active selection). A long press (~500 ms) activates multi-select on the tapped tag. Long press unselects a tag from multiple selection. To pin or unpin a tag on mobile, swipe the tag to the left. Manually move between FTV Pane and Search Pane.

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

## Modifier + click Actions Summary

**In Flat Tag View (FTV Pane)**
- Ctrl-click → Add tag to selection (multi-select filter)
- Shift-click → Add tag as negative filter (exclude notes with this tag)
- Alt-click → Pin / Unpin tag to top of view
- Right-click → Global Mute (convert #tag → #%tag across vault)

**In Editor**
- Alt-click (word) → Create tag
- Alt-click (existing tag) → Remove # (SOL / INP / EOL mode dependent)
- Shift-Alt-click → Remove # but always preserve text (mode-independent)
- Ctrl-Alt-click → Select tag in FTV Pane and send it to Search Pane
- Ctrl-Shift-Alt-click → Local Mute / Unmute (#tag ↔ #%tag)

**In Reading / Preview Mode**
- Ctrl-Alt-click (tag) → Select tag in FTV Pane and send it to Search Pane
_Other modifier actions are disabled in Preview._

**Mobile (FTV Pane)**
- Tap tag → Select tag
- Long Press tag → Multi-select / deselect
- Swipe Left on tag → Pin / Unpin

---

## _vibe coded w/ ai_
- _0.1.0 claude 3.7 sonnet / 4o_
- _0.2.2 gemini 3.1 pro_
- _0.3.0 gpt 5.2 / gemini 3.1 pro_
- _0.4.0 gemini 3.1 pro / chatGPT_

### ver. 0.4.0 changelog
- added: editor drill-down (ctrl-alt-click tag in editor to instantly filter it in FTV)
- added: local mute/unmute (ctrl-shift-alt-click) tag in editor to safely disable it as `#%tag` and re-enable it
- added: global mute (right-click tag in FTV to decommission it across entire vault)
- added: three new hotkeys to directly set SOL, INP, or EOL modes
- added: clickable status bar text to quickly cycle placement modes
- added: glow hint for non-empty FTV search box if unfocused
- fixed: improved a-z universal sorting
- fixed: handling touch and long touch on mobile
- quirky: on mobile tags from FTV are not always properly sent to search pane
- quirky: on mobile selected tags do not always get background highlight immediately
- (not much of an) easter egg: clicking the active sort button reveals total unique vault tag count

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

### ver. 0.2.2 changelog
- optimized view update logic (now FTV view updates quickly after current note changes)
- added ability to pin/unpin tags to top of flat-tag-view (with alt-click)
- added line-mode (check co-occurrence per line, tags have to be on same line to show up as co-occurring)
- added tasks-mode (same as line-mode, but works only with tasks)
- changed 'hide single use tags' to 'frequency cutoff' (hides tags occurring less than x times)
- fixed byUsage sorting within same frequency groups — ftag(2), atag(2), btag(2), dtag(1), ctag(1) are now sorted properly as atag(2), btag(2), ftag(2), ctag(1), dtag(1)
- added mobile version compatibility