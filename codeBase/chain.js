(function() {
  const canvasWrap = document.getElementById('canvas-wrap');
  const nodesEl = document.getElementById('nodes');
  const linksEl = document.getElementById('links');
  const statusEl = document.getElementById('status');
  const themeSelect = document.getElementById('theme-select');
  const importInput = document.getElementById('import-json');

  const BUTTONS = {
    addNode: document.getElementById('add-node'),
    del: document.getElementById('delete-node'),
    toggle: document.getElementById('toggle-node'), // Correctly referenced
    center: document.getElementById('center-view'),
    newMap: document.getElementById('new-map'),
    export: document.getElementById('export-json'),
    importBtn: document.getElementById('import-json-btn')
  };

  const STORAGE_KEY = 'flexible-chain-v1';
  const THEME_KEY = 'lite-mindmap-theme';
  const HORIZONTAL_SPACING = 250;
  const NODE_WIDTH = 160;

  let nodes = {};
  let rootId = null;
  let selectedId = null;
  let openPopover = null;

  /** @typedef {Object} MindNode ... */

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function nowStr() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function setStatus(msg) { statusEl.textContent = msg; }

  function createNode(partial) {
    const id = uid();
    const node = { id, title: 'New Event', x: 0, y: 0, parentId: null, children: [], notes: '', collapsed: false, ...partial };
    nodes[id] = node;
    return node;
  }

  function addNode(parentId) {
    if (!parentId || !nodes[parentId]) return;
    const parent = nodes[parentId];
    if (parent.children.length > 0) {
      alert("This node already has a next item. Select the last node to add a new one.");
      return;
    }
    const child = createNode({
      parentId: parentId,
      x: parent.x + HORIZONTAL_SPACING,
      y: parent.y
    });
    parent.children.push(child.id);
    selectNode(child.id);
    persist(); render();
    focusSelectedInput();
  }

  function deleteNode(nodeId) {
    if (!nodeId || !nodes[nodeId] || nodeId === rootId) {
        if(nodeId === rootId) alert('Cannot delete the first node. Try "New Map" instead.');
        return;
    }
    const nodeToDelete = nodes[nodeId];
    const parent = nodes[nodeToDelete.parentId];
    const childId = nodeToDelete.children[0];

    parent.children = [];
    if (childId && nodes[childId]) {
      nodes[childId].parentId = parent.id;
      parent.children.push(childId);
    }
    delete nodes[nodeId];
    selectNode(parent.id);
    persist(); render();
  }

  function toggleNode(nodeId) {
    if (!nodeId || !nodes[nodeId]) return;
    const node = nodes[nodeId];
    node.collapsed = !node.collapsed;
    persist(); render();
  }

  function selectNode(nodeId) {
    selectedId = nodeId;
    updateSelectionStyles();
  }

  function updateSelectionStyles() {
    document.querySelectorAll('.node').forEach(el => el.classList.remove('selected'));
    if (selectedId) {
      const el = document.querySelector(`[data-id="${selectedId}"]`);
      if (el) el.classList.add('selected');
    }
  }

  function ensureRoot() {
    if (Object.keys(nodes).length === 0 || !rootId || !nodes[rootId]) {
      const centerX = (canvasWrap.clientWidth / 2) - (NODE_WIDTH / 2);
      const centerY = (canvasWrap.clientHeight / 2) - (NODE_WIDTH / 2) - 50;
      const root = createNode({ title: 'Starting Point', x: centerX, y: centerY });
      rootId = root.id;
      selectNode(root.id);
    }
  }

  function render() {
    ensureRoot();
    
    const hidden = new Set();
    let currentNodeId = rootId;
    let isAncestorCollapsed = false;
    while(currentNodeId && nodes[currentNodeId]) {
        const node = nodes[currentNodeId];
        if (isAncestorCollapsed) {
            hidden.add(node.id);
        }
        if (node.collapsed) {
            isAncestorCollapsed = true;
        }
        currentNodeId = node.children[0];
    }
    
    nodesEl.innerHTML = '';
    Object.values(nodes).forEach(node => {
      if (hidden.has(node.id)) return;
      const el = document.createElement('div');
      el.className = 'node';
      if (node.id === rootId) el.classList.add('root');
      if (node.collapsed) el.classList.add('collapsed');
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';
      el.dataset.id = node.id;

      const input = document.createElement('input');
      input.className = 'title';
      input.value = node.title;
      input.addEventListener('input', () => { node.title = input.value; persist(); });
      input.addEventListener('pointerdown', e => e.stopPropagation());
      el.appendChild(input);

      const noteBtn = document.createElement('button');
      noteBtn.type = 'button';
      noteBtn.className = 'note-btn';
      noteBtn.textContent = 'Notes';
      if (node.notes?.trim()) {
        const dot = document.createElement('span');
        dot.className = 'note-indicator';
        noteBtn.appendChild(dot);
      }
      noteBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openNotesPopover(node, el); });
      el.appendChild(noteBtn);

      el.addEventListener('pointerdown', onDragStart);
      el.addEventListener('click', () => { selectNode(node.id); focusSelectedInput(); });
      nodesEl.appendChild(el);
    });

    updateSelectionStyles();
    drawLinks(hidden);
  }

  let drag = null;
  function onDragStart(e) { /* ... Same as previous correct version ... */ }
  function onDragMove(e) { /* ... Same as previous correct version ... */ }
  function onDragEnd() { /* ... Same as previous correct version ... */ }
  onDragStart = function(e) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return; e.preventDefault(); const target = e.currentTarget; const id = target.dataset.id; selectNode(id); const node = nodes[id]; drag = { id, node, ox: e.clientX, oy: e.clientY, startX: node.x, startY: node.y }; window.addEventListener('pointermove', onDragMove); window.addEventListener('pointerup', onDragEnd, { once: true }); };
  onDragMove = function(e) { if (!drag) return; const dx = e.clientX - drag.ox; const dy = e.clientY - drag.oy; drag.node.x = drag.startX + dx; drag.node.y = drag.startY + dy; const el = document.querySelector(`[data-id="${drag.id}"]`); if (el) { el.style.left = drag.node.x + 'px'; el.style.top = drag.node.y + 'px'; } drawLinks(new Set()); };
  onDragEnd = function() { if (!drag) return; drag = null; persist(); render(); };


  function focusSelectedInput() {
    if (!selectedId) return;
    const input = document.querySelector(`[data-id="${selectedId}"] input.title`);
    if (input && document.activeElement !== input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  function drawLinks(hidden) {
    linksEl.innerHTML = '';
    const NS = 'http://www.w3.org/2000/svg';
    Object.values(nodes).forEach(node => {
        if (!node.parentId || hidden.has(node.id)) return;
        const parent = nodes[node.parentId];
        if(!parent || hidden.has(parent.id)) return;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('class', 'link-path');
        const r = NODE_WIDTH / 2;
        const [sx, sy, tx, ty] = [parent.x + r, parent.y + r, node.x + r, node.y + r];
        const drape = Math.max(20, Math.sqrt(Math.abs(sy - ty)) * 4); // Make drape dynamic
        const d = `M ${sx} ${sy} C ${sx} ${sy + drape}, ${tx} ${ty + drape}, ${tx} ${ty}`;
        p.setAttribute('d', d);
        linksEl.appendChild(p);
    });
  }

  // --- BUTTON AND HELPER FUNCTIONS (ALL CORRECTED AND WRITTEN IN FULL) ---

  BUTTONS.addNode.addEventListener('click', () => selectedId && addNode(selectedId));
  BUTTONS.del.addEventListener('click', () => selectedId && deleteNode(selectedId));
  BUTTONS.toggle.addEventListener('click', () => selectedId && toggleNode(selectedId));
  BUTTONS.center.addEventListener('click', centerView);
  BUTTONS.newMap.addEventListener('click', newMap);
  BUTTONS.export.addEventListener('click', exportJson);
  BUTTONS.importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', onImportFile);

  document.addEventListener('keydown', e => {
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Enter') { e.preventDefault(); selectedId && addNode(selectedId); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); selectedId && deleteNode(selectedId); }
      else if (e.key === ' ') { e.preventDefault(); selectedId && toggleNode(selectedId); }
  });

  function openNotesPopover(node, anchorEl) {
    closeNotesPopover();
    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Notes</div><textarea placeholder="Write notes..."></textarea><div class="pop-actions"><span style="color: var(--muted); font-size: 12px;">Autosaves</span><button type="button" data-close>Close</button></div>`;
    
    const ta = pop.querySelector('textarea');
    ta.value = node.notes || '';
    
    // FIX: Only persist data. Do NOT re-render the entire UI.
    ta.addEventListener('input', () => {
      node.notes = ta.value;
      persist();
      // Also update the note indicator dot in real-time without a full render
      const noteBtn = anchorEl.querySelector('.note-btn');
      let dot = anchorEl.querySelector('.note-indicator');
      if (node.notes.trim() && !dot) {
          dot = document.createElement('span');
          dot.className = 'note-indicator';
          noteBtn.appendChild(dot);
      } else if (!node.notes.trim() && dot) {
          dot.remove();
      }
    });

    pop.querySelector('[data-close]').addEventListener('click', closeNotesPopover);
    const left = anchorEl.offsetLeft + anchorEl.offsetWidth / 2 - 110;
    const top = anchorEl.offsetTop + anchorEl.offsetHeight + 15;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    nodesEl.appendChild(pop);
    openPopover = pop;
    
    setTimeout(() => {
      const onDoc = (e) => {
        if (!openPopover || openPopover.contains(e.target) || anchorEl.contains(e.target)) return;
        closeNotesPopover();
        document.removeEventListener('pointerdown', onDoc);
      };
      document.addEventListener('pointerdown', onDoc);
    }, 0);
    ta.focus();
  }

  function closeNotesPopover() {
    if (openPopover?.parentNode) openPopover.parentNode.removeChild(openPopover);
    openPopover = null;
  }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    themeSelect.value = theme;
    localStorage.setItem(THEME_KEY, theme);
  }
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, rootId }));
    setStatus('Saved at ' + nowStr());
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        nodes = data.nodes || {}; rootId = data.rootId || null;
      } catch (e) { console.warn('Failed to load from storage', e); }
    }
    const theme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(theme);
  }

  function newMap() {
    if (!confirm('Start a new empty chain? This clears the current one.')) return;
    nodes = {}; rootId = null; selectedId = null;
    // FIX: Render first to create the new root, THEN persist it.
    render();
    persist();
  }

  function exportJson() {
    const data = JSON.stringify({ nodes, rootId }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'infographic-chain.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.nodes || !data.rootId) throw new Error('Invalid format');
        nodes = data.nodes; rootId = data.rootId; selectedId = rootId;
        persist(); render();
        centerView();
      } catch (err) { alert('Failed to import JSON: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Clear input to allow re-importing the same file
  }

  function centerView() {
    const root = nodes[rootId];
    if (!root) return;
    canvasWrap.scrollTo({
      left: root.x - canvasWrap.clientWidth / 2 + NODE_WIDTH / 2,
      top: root.y - canvasWrap.clientHeight / 2 + NODE_WIDTH / 2,
      behavior: 'smooth'
    });
  }

  // Initialize
  load();
  render();
  if (rootId) centerView();
})();