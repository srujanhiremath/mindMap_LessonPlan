A tiny, dependency-free mind map app (single HTML/CSS/JS). Supports:

- Multiple branches (add child/sibling), drag nodes, collapse/expand
- Notes per node
- Theme switch (Light, Dark, Sepia)
- Autosave to localStorage, Import/Export JSON

Usage
-----

1. Open `index.html` in your browser (double-click).
2. Keyboard shortcuts:
   - Enter: Add child
   - Tab: Add sibling
   - Delete/Backspace: Delete node (root cannot be deleted)
   - Space: Collapse/Expand node
3. Click and drag nodes to reposition. Click a node to select and edit its title.
4. Edit notes in the right panel for the selected node.
5. Use the toolbar to center view, change theme, or import/export.

Notes
-----

- Data persists automatically in your browser under `localStorage`.
- JSON format is `{ nodes: Record<string, MindNode>, rootId: string }`.
- The app purposely keeps layout simple. No complex auto-layout to stay lightweight.
