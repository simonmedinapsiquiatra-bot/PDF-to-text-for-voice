## 2025-01-30 - Accessible Results Dropdown
**Learning:** Dynamic result lists (divs) are invisible to keyboard users unless explicitly managed with `tabIndex`, `role`, and `keydown`. Adding these transformed the search from mouse-only to fully accessible.
**Action:** Always add `tabIndex="0"` and keydown handlers to custom interactive list items.

## 2025-01-30 - Focus Management on State Change
**Learning:** Hiding an active element (e.g., search results) resets focus to `body`, causing keyboard users to lose context. Manually moving focus to the next logical step (e.g., next input or button) creates a seamless flow.
**Action:** Whenever a focused element is removed/hidden, explicitly call `.focus()` on the next relevant interactive element.
