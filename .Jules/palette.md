## 2025-01-30 - Accessible Results Dropdown
**Learning:** Dynamic result lists (divs) are invisible to keyboard users unless explicitly managed with `tabIndex`, `role`, and `keydown`. Adding these transformed the search from mouse-only to fully accessible.
**Action:** Always add `tabIndex="0"` and keydown handlers to custom interactive list items.

## 2025-01-31 - Smart Focus Flow
**Learning:** In multi-step workflows, hiding the currently focused element (e.g., search results) causes focus to reset to the document body, disorienting screen reader users.
**Action:** Always programmatically move focus to the next logical step (e.g., the next input field) immediately after a selection is made and the previous element is hidden.
