# flat-tag-view-obsidian-plugin

Displays tags in a flat, space-separated format with sorting options and search integration.

![flat-tag-view-buttons](./flat-tag-view-see-me.png)

- **Core feature: select multiple tags and filter FTV view with ctrl-click** 
- Add negative selection with shift-click (do not show files with this tag)
- Pin/unpin commonly accessed tags to top of the view with alt-click
- Modes: standard/line/tasks/tasks-todo/tasks-done
- Sort tags a-z or by usage
- Clear tags selection with one click (x) or hotkey
- Setting to hide infrequently used tags (frequency cutoff)
- Simple search for tags with clear button 
- Configurable hotkeys
- Automatically focuses search pane and sends selected tags to it

## Mobile Use
FTV works on Obsidian for Android and (probably) on iOS (not tested) without any extra configuration. Standard keyboard and mouse interactions on desktop have direct touch equivalents: a single tap selects a tag (or deselects it if it is the only active selection), matching a regular left-click. A long press (~500 ms) activates multi-select on the tapped tag, equivalent to Ctrl/Cmd+Click — useful for building AND queries without a keyboard. Long press unselects tag from multiple selection. There is no touch event to handle negative tag selection. To pin or unpin a tag on mobile, swipe on tag left-to-right. Touch support is still somehow quirky.

### _vibe coded w/ ai_
- _0.1.0 claude 3.7 sonnet / 4o_
- _0.2.0 gemini 3.1 pro_

### ver. 0.2.2 changelog
- optimized view update logic (now ftv view updates quickly after current note changes)
- added ability to pin/unpin tags to top of flat-tag-view (with alt-click)
- added line-mode (check co-occurance per line, tags have to be on same line to show up as co-occuring)
- added tasks-mode (same as line-mode, but works only with tasks)
- changed 'hide single use tags' to 'frequency cutoff' (hides tags occuring less than x times)
- fixed byUsage sorting within same frequency groups - ftag(2), atag(2), btag(2), dtag(1), ctag(1) are now sorted properly as atag(2), btag(2), ftag(2), ctag(1), dtag(1).
- added mobile version compatibility

