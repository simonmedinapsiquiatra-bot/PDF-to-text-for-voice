## 2025-01-30 - Accessible Results Dropdown
**Learning:** Dynamic result lists (divs) are invisible to keyboard users unless explicitly managed with `tabIndex`, `role`, and `keydown`. Adding these transformed the search from mouse-only to fully accessible.
**Action:** Always add `tabIndex="0"` and keydown handlers to custom interactive list items.

## 2025-01-31 - Sequential Focus Flow
**Learning:** In multi-step linear workflows (Search File -> Search Folder -> Convert), auto-advancing focus significantly reduces friction and clarifies the "next step" for keyboard users, essentially guiding them through the UI.
**Action:** Identify linear paths in UIs and implement programmatic focus advancement upon completion of each step.
