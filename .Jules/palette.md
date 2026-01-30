## 2025-01-30 - Accessible Results Dropdown
**Learning:** Dynamic result lists (divs) are invisible to keyboard users unless explicitly managed with `tabIndex`, `role`, and `keydown`. Adding these transformed the search from mouse-only to fully accessible.
**Action:** Always add `tabIndex="0"` and keydown handlers to custom interactive list items.
