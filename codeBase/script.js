(function() {
  const nodesEl = document.getElementById('nodes');
  const linksEl = document.getElementById('links');
  const statusEl = document.getElementById('status');
  const themeSelect = document.getElementById('theme-select');
  const importInput = document.getElementById('import-json');

  const BUTTONS = {
    addChild: document.getElementById('add-child'),
    addSibling: document.getElementById('add-sibling'),
    del: document.getElementById('delete-node'),
    toggle: document.getElementById('collapse'),
    center: document.getElementById('center-view'),
    newMap: document.getElementById('new-map'),
    export: document.getElementById('export-json'),
    importBtn: document.getElementById('import-json-btn')
  };

  const STORAGE_KEY = 'lite-mindmap-v1';
  const THEME_KEY = 'lite-mindmap-theme';

  /** @type {Record<string, MindNode>} */
  let nodes = {};
  /** @type {string | null} */
  let rootId = null;
  /** @type {string | null} */
  let selectedId = null;
  let openPopover = null; // currently open notes popover element

  /**
   * @typedef {Object} MindNode
   * @property {string} id
   * @property {string} title
   * @property {number} x
   * @property {number} y
   * @property {string | null} parentId
   * @property {string[]} children
   * @property {string} notes
   * @property {boolean} collapsed
   */

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function nowStr() {
    const t = new Date();
    return t.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  function setStatus(msg) { statusEl.textContent = msg; }

  // color palette by depth (loops)
  const DEPTH_COLORS = [
    '#ef4444', // red (root)
    '#f59e0b', // orange (level 1)
    '#facc15', // yellow (level 2)
    '#22c55e', // green
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
    '#06b6d4'  // cyan
  ];
  function colorForDepth(d) { return DEPTH_COLORS[d % DEPTH_COLORS.length]; }
  function nodeColorForDepth(d) { return colorForDepth(d); }

  function createNode(partial) {
    const id = uid();
    /** @type {MindNode} */
    const node = Object.assign({
      id,
      title: 'Topic',
      x: 0,
      y: 0,
      parentId: null,
      children: [],
      notes: '',
      collapsed: false
    }, partial || {});
    nodes[id] = node;
    return node;
  }

  function addChild(parentId) {
    const parent = nodes[parentId];
    const child = createNode({
      title: 'New Idea',
      x: parent.x + (parent.children.length % 2 === 0 ? 180 : -180),
      y: parent.y + 80 + parent.children.length * 16,
      parentId: parentId
    });
    parent.children.push(child.id);
    selectNode(child.id);
    persist();
    render();
    focusSelectedInput();
  }

  function addSibling(nodeId) {
    const node = nodes[nodeId];
    const parentId = node.parentId;
    if (!parentId) return; // root has no sibling creator
    const parent = nodes[parentId];
    const sibling = createNode({
      title: 'Sibling',
      x: node.x + 0,
      y: node.y + 100,
      parentId
    });
    parent.children.push(sibling.id);
    selectNode(sibling.id);
    persist();
    render();
    focusSelectedInput();
  }

  function deleteNode(nodeId) {
    if (!nodeId) return;
    const node = nodes[nodeId];
    if (!node) return;
    if (nodeId === rootId) {
      alert('Cannot delete root node.');
      return;
    }
    // remove from parent
    const parent = nodes[node.parentId];
    parent.children = parent.children.filter(id => id !== nodeId);
    // recursively delete children
    (function delRec(id) {
      const n = nodes[id];
      n.children.slice().forEach(delRec);
      delete nodes[id];
    })(nodeId);
    selectedId = parent.id;
    persist();
    render();
  }

  function toggleNode(nodeId) {
    const node = nodes[nodeId];
    if (!node) return;
    node.collapsed = !node.collapsed;
    persist();
    render();
  }

  function selectNode(nodeId) {
    selectedId = nodeId;
    const node = nodes[nodeId];
    updateSelectionStyles();
    // If a node gets selected via click/keyboard, focus its title for typing
    focusSelectedInput();
  }

  function updateSelectionStyles() {
    document.querySelectorAll('.node').forEach(el => el.classList.remove('selected'));
    if (selectedId) {
      const el = document.querySelector(`[data-id="${selectedId}"]`);
      if (el) el.classList.add('selected');
    }
  }

  function ensureRoot() {
    const ids = Object.keys(nodes);
    if (ids.length === 0 || !rootId || !nodes[rootId]) {
      const centerX = 900; const centerY = 500;
      const root = createNode({ title: 'Central Topic', x: centerX, y: centerY });
      rootId = root.id;
      selectNode(root.id);
    }
  }

  function render() {
    ensureRoot();
    // compute visibility and depth
    /** @type {Record<string, number>} */
    const depth = {}; // depth per node id
    /** @type {Set<string>} */
    const hidden = new Set(); // nodes hidden by collapsed ancestor
    function walk(id, d, ancestorCollapsed) {
      depth[id] = d;
      const n = nodes[id];
      if (!n) return;
      const isHidden = ancestorCollapsed === true;
      if (isHidden) hidden.add(id);
      const nextCollapsed = isHidden || n.collapsed;
      n.children.forEach(cid => walk(cid, d + 1, nextCollapsed));
    }
    walk(rootId, 0, false);

    // render nodes
    nodesEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    Object.values(nodes).forEach(node => {
      if (hidden.has(node.id)) return;
      const el = document.createElement('div');
      el.className = 'node' + (node.id === rootId ? ' root' : '');
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';
      el.dataset.id = node.id;
      // depth-based border color and emphasis
      const dpth = depth[node.id] || 0;
      const borderColor = nodeColorForDepth(dpth);
      el.style.borderColor = borderColor;
      el.style.borderWidth = (node.id === rootId ? 3 : Math.max(2, 4 - Math.min(dpth, 2))) + 'px';
      el.style.boxShadow = `0 0 0 2px ${borderColor}22`;

      const input = document.createElement('input');
      input.className = 'title';
      input.value = node.title;
      // Update title without full re-render to preserve focus while typing
      input.addEventListener('input', () => { node.title = input.value; persist(); });
      input.addEventListener('pointerdown', e => e.stopPropagation());

      el.appendChild(input);
      // per-node notes button
      const noteBtn = document.createElement('button');
      noteBtn.type = 'button';
      noteBtn.className = 'note-btn';
      noteBtn.textContent = 'Notes';
      if (node.notes && node.notes.trim().length > 0) {
        const dot = document.createElement('span');
        dot.className = 'note-indicator';
        noteBtn.appendChild(dot);
      }
      noteBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openNotesPopover(node, el); });
      el.appendChild(noteBtn);

      el.addEventListener('pointerdown', onDragStart);
      el.addEventListener('click', () => { selectNode(node.id); input.focus(); input.select(); });
      frag.appendChild(el);
    });
    nodesEl.appendChild(frag);
    updateSelectionStyles();

    // render links (parent-child solid arrows, sibling dotted arrows)
    drawLinks(depth, hidden);
  }

  // Dragging
  let drag = null;
  function onDragStart(e) {
    const target = /** @type {HTMLElement} */(e.currentTarget);
    const id = target.dataset.id;
    selectNode(id);
    const node = nodes[id];
    drag = { id, ox: e.clientX - node.x, oy: e.clientY - node.y };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  }
  function onDragMove(e) {
    if (!drag) return;
    const node = nodes[drag.id];
    node.x = e.clientX - drag.ox;
    node.y = e.clientY - drag.oy;
    // live update only positions and links for performance
    const el = document.querySelector(`[data-id="${drag.id}"]`);
    if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
    drawLinksOnly();
  }
  function onDragEnd() {
    if (!drag) return;
    drag = null;
    persist();
  }

  // Keyboard shortcuts
  // Keyboard shortcuts removed by request; users operate via toolbar buttons only

  function focusSelectedInput() {
    if (!selectedId) return;
    const nodeEl = document.querySelector(`[data-id="${selectedId}"]`);
    if (!nodeEl) return;
    const input = nodeEl.querySelector('input.title');
    if (input && document.activeElement !== input) {
      input.focus();
      // place cursor at end
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }

  // Buttons
  BUTTONS.addChild.addEventListener('click', () => selectedId && addChild(selectedId));
  BUTTONS.addSibling.addEventListener('click', () => selectedId && addSibling(selectedId));
  BUTTONS.del.addEventListener('click', () => selectedId && deleteNode(selectedId));
  BUTTONS.toggle.addEventListener('click', () => selectedId && toggleNode(selectedId));
  BUTTONS.center.addEventListener('click', centerView);
  BUTTONS.newMap.addEventListener('click', newMap);
  BUTTONS.export.addEventListener('click', exportJson);
  BUTTONS.importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', onImportFile);

  // Notes
  function openNotesPopover(node, anchorEl) {
    closeNotesPopover();
    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.innerHTML = `
      <div style="font-weight:600; margin-bottom:6px;">Notes</div>
      <textarea placeholder="Write notes..."></textarea>
      <div class="pop-actions">
        <span style="color: var(--muted); font-size: 12px;">Autosaves</span>
        <button type="button" data-close>Close</button>
      </div>
    `;
    const ta = pop.querySelector('textarea');
    ta.value = node.notes || '';
    ta.addEventListener('input', () => { node.notes = ta.value; persist(); });
    pop.querySelector('[data-close]').addEventListener('click', () => closeNotesPopover());
    // position near node
    const wrap = document.getElementById('canvas-wrap');
    const rect = anchorEl.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const left = anchorEl.offsetLeft + anchorEl.offsetWidth + 12;
    const top = anchorEl.offsetTop;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    // ensure inside nodes layer for correct positioning
    nodesEl.appendChild(pop);
    openPopover = pop;
    // outside click to close
    setTimeout(() => {
      const onDoc = (e) => {
        if (!openPopover) return;
        if (openPopover.contains(e.target)) return;
        if (anchorEl.contains(e.target)) return;
        closeNotesPopover();
        document.removeEventListener('pointerdown', onDoc);
      };
      document.addEventListener('pointerdown', onDoc);
    });
    // focus textarea
    ta.focus();
  }

  function closeNotesPopover() {
    if (openPopover && openPopover.parentNode) openPopover.parentNode.removeChild(openPopover);
    openPopover = null;
  }

  // Theme
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    themeSelect.value = theme;
    localStorage.setItem(THEME_KEY, theme);
  }
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

  // Persistence
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, rootId }));
    setStatus('Saved at ' + nowStr());
  }
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        nodes = data.nodes || {};
        rootId = data.rootId || null;
      } catch (e) {
        console.warn('Failed to load from storage', e);
      }
    }
    const theme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(theme);
  }

  function newMap() {
    if (!confirm('Start a new empty map? This clears current map.')) return;
    nodes = {}; rootId = null; selectedId = null;
    ensureRoot();
    persist();
    render();
  }

  function exportJson() {
    const data = JSON.stringify({ nodes, rootId }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.json';
    a.click();
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
        nodes = data.nodes; rootId = data.rootId;
        selectedId = rootId;
        persist();
        render();
      } catch (err) {
        alert('Failed to import JSON');
      }
    };
    reader.readAsText(file);
  }

  function centerView() {
    const wrap = document.getElementById('canvas-wrap');
    const root = nodes[rootId];
    if (!root) return;
    wrap.scrollTo({
      left: Math.max(0, root.x - wrap.clientWidth / 2 + 60),
      top: Math.max(0, root.y - wrap.clientHeight / 2 + 20),
      behavior: 'smooth'
    });
  }

  // Basic layout helper: when collapsing, hide descendants from render
  function scheduleRender() {
    if (scheduleRender._t) cancelAnimationFrame(scheduleRender._t);
    scheduleRender._t = requestAnimationFrame(render);
  }

  function drawLinksOnly() {
    if (!rootId) return;
    /** @type {Record<string, number>} */
    const depth = {};
    /** @type {Set<string>} */
    const hidden = new Set();
    function walk(id, d, ancestorCollapsed) {
      depth[id] = d;
      const n = nodes[id];
      if (!n) return;
      const isHidden = ancestorCollapsed === true;
      if (isHidden) hidden.add(id);
      const nextCollapsed = isHidden || n.collapsed;
      n.children.forEach(cid => walk(cid, d + 1, nextCollapsed));
    }
    walk(rootId, 0, false);
    drawLinks(depth, hidden);
  }

  function ensureDefs() { /* markers removed; using explicit polygons for full compatibility */ }

  function drawLinks(depth, hidden) {
    linksEl.innerHTML = '';
    const NS = 'http://www.w3.org/2000/svg';
    // parent-child solid arrows
    Object.values(nodes).forEach(node => {
      if (!node.parentId) return;
      if (hidden.has(node.id)) return;
      const parent = nodes[node.parentId];
      if (!parent || hidden.has(parent.id)) return;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'link-path');
      const dpth = depth[node.id] || 0;
      const color = colorForDepth(dpth);
      p.setAttribute('stroke', color);
      const thickness = Math.max(2, 5 - Math.min(dpth, 3));
      p.setAttribute('stroke-width', String(thickness));
      const [sx, sy] = [parent.x + 60, parent.y + 20];
      const [tx, ty] = [node.x + 60, node.y + 20];
      const mx = (sx + tx) / 2;
      const d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
      p.setAttribute('d', d);
      linksEl.appendChild(p);
      // arrowhead polygon at end (pointing to child)
      const ah = document.createElementNS(NS, 'polygon');
      const ahSize = 8;
      // approximate arrow orientation using last segment tangent towards (tx,ty)
      const ax = tx, ay = ty;
      const dx = Math.max(1, Math.abs(tx - mx));
      const dirX = 1; // curve ends left->right; approximate
      const dirY = 0;
      const leftX = ax - ahSize;
      const leftY = ay - ahSize * 0.6;
      const rightX = ax - ahSize;
      const rightY = ay + ahSize * 0.6;
      ah.setAttribute('points', `${ax},${ay} ${leftX},${leftY} ${rightX},${rightY}`);
      ah.setAttribute('fill', color);
      ah.setAttribute('opacity', '0.95');
      linksEl.appendChild(ah);
    });
    // sibling-to-sibling dotted arrows (ordered pairs within same parent)
    /** @type {Record<string,string[]>} */
    const groups = {};
    Object.values(nodes).forEach(n => {
      if (!n.parentId) return;
      if (hidden.has(n.id)) return;
      if (!groups[n.parentId]) groups[n.parentId] = [];
      groups[n.parentId].push(n.id);
    });
    Object.keys(groups).forEach(pid => {
      const ids = groups[pid];
      // keep source order based on parent's children array
      const ordered = (nodes[pid]?.children || []).filter(id => ids.includes(id));
      for (let i = 0; i < ordered.length - 1; i++) {
        const a = nodes[ordered[i]];
        const b = nodes[ordered[i+1]];
        if (!a || !b) continue;
        const pa = document.createElementNS(NS, 'path');
        const dpth = depth[a.id] || 0;
        const color = colorForDepth(dpth);
        pa.setAttribute('class', 'link-path');
        pa.setAttribute('stroke-dasharray', '6 6');
        pa.setAttribute('stroke', color);
        pa.setAttribute('stroke-width', '2');
        const [sx, sy] = [a.x + 60, a.y + 20];
        const [tx, ty] = [b.x + 60, b.y + 20];
        const d = `M ${sx} ${sy} L ${tx} ${ty}`;
        pa.setAttribute('d', d);
        linksEl.appendChild(pa);
        // arrowhead for sibling link (towards b)
        const ah = document.createElementNS(NS, 'polygon');
        const size = 7;
        const ax = tx, ay = ty;
        const leftX = ax - size;
        const leftY = ay - size * 0.6;
        const rightX = ax - size;
        const rightY = ay + size * 0.6;
        ah.setAttribute('points', `${ax},${ay} ${leftX},${leftY} ${rightX},${rightY}`);
        ah.setAttribute('fill', color);
        ah.setAttribute('opacity', '0.95');
        linksEl.appendChild(ah);
      }
    });
  }

  // Initialize
  load();
  ensureRoot();
  render();
  centerView();
})();


