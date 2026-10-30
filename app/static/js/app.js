// ─── State ────────────────────────────────────────────────────────────────────
let selectedId = null;
let peopleView = 'list';
let companiesData = [];
let currentView = 'dashboard';
let activeFunnelStage = null;  // null = all

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchCompanies() {
  const res = await fetch('/api/companies');
  companiesData = await res.json();
  return companiesData;
}

async function fetchFunnel() {
  const res = await fetch('/api/dashboard/funnel');
  return await res.json();
}

async function fetchCompanyDetails(id) {
  const res = await fetch(`/api/companies/${id}/details`);
  return await res.json();
}

async function fetchPeople() {
  const res = await fetch('/api/people');
  return await res.json();
}

async function fetchTasks() {
  const res = await fetch('/api/tasks');
  return await res.json();
}

async function postTask(company_id, text, due_date) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id, text, due_date: due_date || null })
  });
  return await res.json();
}

async function postNote(company_id, content) {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id, content })
  });
  return await res.json();
}

async function patchTaskDone(task_id) {
  const res = await fetch(`/api/tasks/${task_id}/done`, { method: 'PATCH' });
  return await res.json();
}

async function patchStage(company_id, stage) {
  const res = await fetch(`/api/companies/${company_id}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage })
  });
  return await res.json();
}

async function postPersonTask(person_id, text, due_date) {
  const res = await fetch(`/api/people/${person_id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person_id, text, due_date: due_date || null })
  });
  return await res.json();
}

async function refreshTasksBadge() {
  try {
    const res = await fetch('/api/tasks');
    if (!res.ok) return;
    const tasks = await res.json();
    const badge = document.getElementById('tasks-badge');
    if (!badge) return;
    if (tasks.length > 0) {
      badge.textContent = tasks.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) {}
}

async function fetchDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) return { tasks_due_count: 0, tasks_due: [], stale_companies_count: 0, done_today_count: 0 };
    return await res.json();
  } catch(e) {
    return { tasks_due_count: 0, tasks_due: [], stale_companies_count: 0, done_today_count: 0 };
  }
}

async function fetchPersonDetails(id) {
  const res = await fetch(`/api/people/${id}`);
  if (!res.ok) return null;
  return await res.json();
}

async function postPersonNote(person_id, content) {
  const res = await fetch(`/api/people/${person_id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person_id, content })
  });
  return await res.json();
}

async function postCompany(data) {
  const res = await fetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

async function postPerson(data) {
  const res = await fetch('/api/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

// ─── Task helpers ─────────────────────────────────────────────────────────────
function taskItemHtml(t, isDone = false) {
  const due = dueDateLabel(t.due_date);
  const dueDateVal = t.due_date ? t.due_date.slice(0,10) : '';
  return `
    <div class="task-item" id="task-${t.id}" style="${isDone ? 'opacity:0.5;' : ''}">
      <div class="task-box${isDone ? ' task-box-done' : ''}"
           onclick="${isDone ? '' : `markTaskDone('${t.id}')`}"
           style="${isDone ? 'background:#7F77DD;border-color:#7F77DD;cursor:default;' : ''}"></div>
      <div style="flex:1;">
        <div id="task-view-${t.id}">
          <div class="task-text" style="${isDone ? 'text-decoration:line-through;color:#a09e97;' : ''}">${t.text}</div>
          ${due ? `<div class="task-due ${due.cls}">${due.label}</div>` : ''}
        </div>
        <div id="task-edit-${t.id}" style="display:none;">
          <input type="text" id="task-edit-text-${t.id}" value="${t.text.replace(/"/g,'&quot;')}" class="inline-input" style="margin-bottom:5px;"/>
          <input type="date" id="task-edit-date-${t.id}" value="${dueDateVal}" class="inline-input" style="margin-bottom:6px;"/>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-primary" style="padding:5px 12px;font-size:12px;" onclick="saveTaskEdit('${t.id}')">Save</button>
            <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="cancelTaskEdit('${t.id}')">Cancel</button>
          </div>
        </div>
      </div>
      ${!isDone ? `<button onclick="startTaskEdit('${t.id}')" style="background:none;border:none;cursor:pointer;color:#c8c6be;padding:4px;font-size:13px;" title="Edit"><i class="ti ti-pencil"></i></button>` : ''}
    </div>
  `;
}

function startTaskEdit(id) {
  document.getElementById(`task-view-${id}`).style.display = 'none';
  document.getElementById(`task-edit-${id}`).style.display = 'block';
  document.getElementById(`task-edit-text-${id}`).focus();
}

function cancelTaskEdit(id) {
  document.getElementById(`task-edit-${id}`).style.display = 'none';
  document.getElementById(`task-view-${id}`).style.display = 'block';
}

async function saveTaskEdit(id) {
  const text = document.getElementById(`task-edit-text-${id}`).value.trim();
  const date = document.getElementById(`task-edit-date-${id}`).value;
  if (!text) return;
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, due_date: date || null })
  });
  // Update view in place
  const viewEl = document.getElementById(`task-view-${id}`);
  const due = date ? dueDateLabel(date) : null;
  viewEl.innerHTML = `
    <div class="task-text">${text}</div>
    ${due ? `<div class="task-due ${due.cls}">${due.label}</div>` : ''}
  `;
  cancelTaskEdit(id);
}

// ── Note helpers ───────────────────────────────────────────────────────────────

function noteItemHtml(n, personId) {
  return `
    <div class="note-box" id="note-${n.id}">
      <div id="note-view-${n.id}">
        <div class="note-content">${n.content}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
          <div class="note-date">${timeAgo(n.created_at)}</div>
          <div style="display:flex;gap:4px;">
            <button onclick="startNoteEdit('${n.id}')" style="background:none;border:none;cursor:pointer;color:#c8c6be;font-size:12px;padding:2px 5px;" title="Edit"><i class="ti ti-pencil"></i></button>
            <button onclick="archiveNote('${n.id}','${personId}')" style="background:none;border:none;cursor:pointer;color:#c8c6be;font-size:12px;padding:2px 5px;" title="Archive"><i class="ti ti-archive"></i></button>
          </div>
        </div>
      </div>
      <div id="note-edit-${n.id}" style="display:none;">
        <textarea id="note-edit-text-${n.id}" class="inline-input" rows="4" style="resize:vertical;">${n.content}</textarea>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="btn btn-primary" style="padding:5px 12px;font-size:12px;" onclick="saveNoteEdit('${n.id}')">Save</button>
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="cancelNoteEdit('${n.id}')">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function startNoteEdit(id) {
  document.getElementById(`note-view-${id}`).style.display = 'none';
  document.getElementById(`note-edit-${id}`).style.display = 'block';
  document.getElementById(`note-edit-text-${id}`).focus();
}

function cancelNoteEdit(id) {
  document.getElementById(`note-edit-${id}`).style.display = 'none';
  document.getElementById(`note-view-${id}`).style.display = 'block';
}

async function saveNoteEdit(id) {
  const content = document.getElementById(`note-edit-text-${id}`).value.trim();
  if (!content) return;
  await fetch(`/api/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  document.querySelector(`#note-view-${id} .note-content`).textContent = content;
  cancelNoteEdit(id);
}

async function archiveNote(id, personId) {
  await fetch(`/api/notes/${id}/archive`, { method: 'PATCH' });
  const el = document.getElementById(`note-${id}`);
  if (el) el.remove();
}

function toggleDoneTasks(scopeId) {
  const list = document.getElementById(`done-list-${scopeId}`);
  const chevron = document.getElementById(`done-chevron-${scopeId}`);
  if (!list) return;
  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function toggleStageDropdown(companyId) {
  const dd = document.getElementById(`stage-dropdown-${companyId}`);
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  // Close all other dropdowns
  document.querySelectorAll('[id^="stage-dropdown-"]').forEach(el => el.style.display = 'none');
  if (isOpen) return;

  // Position using fixed coords so it escapes overflow:hidden containers
  const pill = document.getElementById(`company-stage-pill-${companyId}`);
  if (pill) {
    const rect = pill.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top = (rect.bottom + 6) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';
    dd.style.left = 'auto';
  }
  dd.style.display = 'block';
  const close = (e) => {
    if (!dd.contains(e.target) && e.target !== pill) {
      dd.style.display = 'none';
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

async function changeCompanyStage(companyId, newStage) {
  const pill = document.getElementById(`company-stage-pill-${companyId}`);
  const s = stageStyle(newStage);
  if (pill) {
    pill.innerHTML = `${newStage} <i class="ti ti-chevron-down" style="font-size:10px;margin-left:2px;"></i>`;
    pill.style.background = s.bg;
    pill.style.color = s.text;
  }
  // Close dropdown and update options to exclude new stage
  const dd = document.getElementById(`stage-dropdown-${companyId}`);
  if (dd) {
    dd.style.display = 'none';
    dd.innerHTML = STAGE_ORDER.filter(st => st !== newStage).map(st => {
      const sc = stageStyle(st);
      return `<div onclick="changeCompanyStage('${companyId}','${st}')" style="padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='#faf9f7'" onmouseout="this.style.background='transparent'"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sc.text};flex-shrink:0;"></span>${st}</div>`;
    }).join('');
  }
  try {
    await patchStage(companyId, newStage);
    fetchCompanies();
  } catch(e) { }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const STAGE_ORDER = ['Funnel', 'Pipeline', 'Prospect', 'Lead', 'Client'];

const STAGE_COLORS = {
  'Funnel':   { bg: '#EEF2FF', text: '#4338CA', dot: '#6366F1' },
  'Pipeline': { bg: '#FAEEDA', text: '#854F0B', dot: '#F59E0B' },
  'Prospect': { bg: '#E1F5EE', text: '#0F6E56', dot: '#10B981' },
  'Lead':     { bg: '#F0EFFE', text: '#534AB7', dot: '#7F77DD' },
  'Client':   { bg: '#ECFDF5', text: '#065F46', dot: '#059669' },
};

function stageStyle(stage) {
  return STAGE_COLORS[stage] || { bg: '#F1EFE8', text: '#5F5E5A', dot: '#a09e97' };
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function timeAgo(dateStr) {
  if (!dateStr) return 'No contact';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function dueDateLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((d - now) / 86400000);
  if (diffDays < 0) return { label: 'Overdue', cls: 'due-overdue' };
  if (diffDays === 0) return { label: 'Due today', cls: 'due-today' };
  if (diffDays === 1) return { label: 'Due tomorrow', cls: 'due-soon' };
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, cls: 'due-soon' };
  return { label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), cls: 'due-later' };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// Stores data fetched once so expand/collapse doesn't re-fetch
let _dashData = null;

async function renderDashboard() {
  currentView = 'dashboard';
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Loading…</p></div>';

  const [funnel, stats, allCompanies] = await Promise.all([
    fetchFunnel(),
    fetchDashboardStats().catch(() => ({ tasks_due_count: 0, tasks_due: [], stale_companies_count: 0, stale_companies: [], done_today_count: 0 })),
    fetch('/api/companies').then(r => r.json()).catch(() => [])
  ]);

  _dashData = { funnel, stats, allCompanies };
  // Default: open gone cold panel if there are cold companies, otherwise open tasks if any
  const defaultPanel = (stats.stale_companies_count > 0) ? 'cold' : (stats.tasks_due_count > 0 ? 'tasks' : null);
  _dashExpandedStage = null;
  _dashExpandedPanel = defaultPanel;
  _buildDashboard(null, defaultPanel);
}

function _buildDashboard(expandedStage, expandedPanel) {
  const { funnel, stats, allCompanies } = _dashData;
  const { counts } = funnel;
  const content = document.getElementById('main-content');

  // ── Funnel strip ──────────────────────────────────────────────────────────
  const funnelTilesHtml = STAGE_ORDER.map(stage => {
    const s = stageStyle(stage);
    const n = counts[stage] || 0;
    const isActive = expandedStage === stage;
    return `
      <div class="funnel-tile ${isActive ? 'funnel-tile--active' : ''}"
           style="--stage-bg:${s.bg};--stage-text:${s.text};--stage-dot:${s.dot};cursor:pointer;position:relative;"
           onclick="dashToggleStage('${stage}')">
        <div class="funnel-dot"></div>
        <div class="funnel-stage">${stage}</div>
        <div class="funnel-count">${n}</div>
        <div class="funnel-label">compan${n === 1 ? 'y' : 'ies'}</div>
        <i class="ti ti-chevron-${isActive ? 'up' : 'down'}" style="position:absolute;bottom:6px;right:8px;font-size:11px;color:var(--stage-dot);opacity:0.7;"></i>
      </div>`;
  }).join('<div class="funnel-arrow"><i class="ti ti-chevron-right"></i></div>');

  // ── Stage expand panel ────────────────────────────────────────────────────
  let stagePanelHtml = '';
  if (expandedStage) {
    const cos = allCompanies.filter(c => c.stage === expandedStage);
    stagePanelHtml = `
      <div class="dash-expand-panel" id="dash-stage-panel">
        ${cos.length === 0
          ? `<div style="padding:20px;text-align:center;color:#a09e97;font-size:13px;">No companies in ${expandedStage}</div>`
          : cos.map(c => `
            <div class="company-card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;" onclick="openCompanyDetail('${c.id}')">
              <div class="company-avatar ${c.avatar_color}" style="width:32px;height:32px;font-size:12px;flex-shrink:0;">${c.initials}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${c.name}</div>
                <div style="font-size:11px;color:#a09e97;margin-top:1px;">${[c.industry, c.location].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <i class="ti ti-chevron-right" style="color:#c4c0b8;font-size:14px;"></i>
            </div>`).join('')}
      </div>`;
  }

  // ── Action tiles ──────────────────────────────────────────────────────────
  const taskCount = stats.tasks_due_count || 0;
  const coldCount = stats.stale_companies_count || 0;
  const taskActive = expandedPanel === 'tasks';
  const coldActive = expandedPanel === 'cold';

  const actionTilesHtml = `
    <div class="stats-row" style="margin-top:24px;">
      <div class="stat-card action-tile ${taskActive ? 'action-tile--active' : ''}" onclick="dashTogglePanel('tasks')" style="cursor:pointer;position:relative;">
        <div class="stat-label" style="display:flex;align-items:center;gap:5px;">
          <i class="ti ti-alert-circle" style="color:#A32D2D;font-size:13px;"></i> Tasks overdue / due today
        </div>
        <div class="stat-value" style="${taskCount > 0 ? 'color:#A32D2D;' : ''}">${taskCount}</div>
        <div class="stat-sub" style="${taskCount > 0 ? 'color:#A32D2D;' : 'color:#0F6E56;'}">
          ${taskCount > 0 ? 'Click to expand' : 'All clear'}
        </div>
        <i class="ti ti-chevron-${taskActive ? 'up' : 'down'}" style="position:absolute;top:14px;right:14px;font-size:13px;color:#c4c0b8;"></i>
      </div>
      <div class="stat-card action-tile ${coldActive ? 'action-tile--active' : ''}" onclick="dashTogglePanel('cold')" style="cursor:pointer;position:relative;">
        <div class="stat-label" style="display:flex;align-items:center;gap:5px;">
          <i class="ti ti-building-off" style="color:#854F0B;font-size:13px;"></i> Gone cold
        </div>
        <div class="stat-value" style="${coldCount > 0 ? 'color:#854F0B;' : ''}">${coldCount}</div>
        <div class="stat-sub" style="${coldCount > 0 ? 'color:#854F0B;' : 'color:#0F6E56;'}">
          ${coldCount > 0 ? 'Click to expand' : 'All active'}
        </div>
        <i class="ti ti-chevron-${coldActive ? 'up' : 'down'}" style="position:absolute;top:14px;right:14px;font-size:13px;color:#c4c0b8;"></i>
      </div>
      <div class="stat-card" style="opacity:0.5;pointer-events:none;">
        <div class="stat-label" style="display:flex;align-items:center;gap:5px;">
          <i class="ti ti-robot" style="font-size:13px;"></i> AI suggestions
        </div>
        <div class="stat-value">—</div>
        <div class="stat-sub">Phase 3</div>
      </div>
    </div>
  `;

  // ── Expand panel for tasks or cold ───────────────────────────────────────
  let expandPanelHtml = '';
  if (expandedPanel === 'tasks') {
    const tasks = stats.tasks_due || [];
    expandPanelHtml = `
      <div class="dash-expand-panel" id="dash-action-panel">
        ${tasks.length === 0
          ? `<div style="padding:20px;text-align:center;color:#a09e97;font-size:13px;">No overdue tasks</div>`
          : tasks.map(t => {
              const co = t.companies;
              const di = dueDateLabel(t.due_date);
              return `
                <div class="company-card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;${co ? 'cursor:pointer;' : ''}" ${co ? `onclick="openCompanyDetail('${t.company_id}')"` : ''}>
                  <div class="company-avatar ${co ? co.avatar_color : 'av-purple'}" style="width:32px;height:32px;font-size:12px;flex-shrink:0;">${co ? co.initials : '?'}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${t.text}</div>
                    <div style="font-size:11px;color:#a09e97;margin-top:1px;">${co ? co.name : 'Personal task'}</div>
                  </div>
                  ${di ? `<div class="task-due ${di.cls}">${di.label}</div>` : ''}
                </div>`;
            }).join('')}
      </div>`;
  } else if (expandedPanel === 'cold') {
    const cold = stats.stale_companies || [];
    expandPanelHtml = `
      <div class="dash-expand-panel" id="dash-action-panel">
        ${cold.length === 0
          ? `<div style="padding:20px;text-align:center;color:#a09e97;font-size:13px;">No cold companies</div>`
          : cold.map(c => `
            <div class="company-card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;" onclick="openCompanyDetail('${c.id}')">
              <div class="company-avatar ${c.avatar_color}" style="width:32px;height:32px;font-size:12px;flex-shrink:0;">${c.initials}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${c.name}</div>
                <div style="font-size:11px;color:#a09e97;margin-top:1px;">${[c.industry, c.location].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <i class="ti ti-chevron-right" style="color:#c4c0b8;font-size:14px;"></i>
            </div>`).join('')}
      </div>`;
  }

  // ── All clear ─────────────────────────────────────────────────────────────
  const allClearHtml = (taskCount === 0 && coldCount === 0) ? `
    <div style="margin-top:20px;padding:20px 24px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;text-align:center;color:#0F6E56;">
      <i class="ti ti-circle-check" style="font-size:22px;margin-bottom:6px;display:block;"></i>
      <div style="font-size:14px;font-weight:500;">All clear — nothing needs attention.</div>
    </div>` : '';

  content.innerHTML = `
    <div class="funnel-row">${funnelTilesHtml}</div>
    ${stagePanelHtml}
    ${actionTilesHtml}
    ${expandPanelHtml}
    ${allClearHtml}
  `;
}

// Track what's currently open on the dashboard
let _dashExpandedStage = null;
let _dashExpandedPanel = null;

function dashToggleStage(stage) {
  _dashExpandedStage = _dashExpandedStage === stage ? null : stage;
  _dashExpandedPanel = null; // close action panels when funnel clicked
  _buildDashboard(_dashExpandedStage, _dashExpandedPanel);
}

function dashTogglePanel(panel) {
  _dashExpandedPanel = _dashExpandedPanel === panel ? null : panel;
  _dashExpandedStage = null; // close stage panel when action tile clicked
  _buildDashboard(_dashExpandedStage, _dashExpandedPanel);
}

function filterByStage(stage) {
  activeFunnelStage = activeFunnelStage === stage ? null : stage;
  renderDashboard();
}

// ─── Company card (shared) ────────────────────────────────────────────────────
function companyCardHtml(c, fromDashboard = false) {
  const s = stageStyle(c.stage);
  return `
    <div class="company-card ${c.id === selectedId ? 'selected' : ''}"
         onclick="openCompanyDetail('${c.id}')">
      <div class="card-top">
        <div class="company-avatar ${c.avatar_color}">${c.initials}</div>
        <span class="stage-pill" style="background:${s.bg};color:${s.text};">${c.stage}</span>
      </div>
      <div class="company-name">${c.name}</div>
      <div class="company-meta">${c.industry || ''}${c.location ? ' · ' + c.location : ''}</div>
      <div class="card-stats">
        <span class="card-stat"><i class="ti ti-clock"></i> ${timeAgo(c.updated_at)}</span>
      </div>
      ${c.ai_tag
        ? `<div class="ai-tag ${c.ai_class || 'ai-neutral'}"><i class="ti ti-robot"></i> ${c.ai_tag}</div>`
        : `<div class="ai-tag ai-neutral"><i class="ti ti-robot"></i> No AI data yet</div>`
      }
    </div>
  `;
}

// ─── Company detail page ──────────────────────────────────────────────────────
async function openCompanyDetail(id) {
  selectedId = id;
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Loading…</p></div>';

  const details = await fetchCompanyDetails(id);
  const c = details.company;
  const s = stageStyle(details.stage);

  const peopleHtml = details.people.length
    ? details.people.map(p => `
        <div class="person-row clickable-row" onclick="openPersonDetail('${p.id}')">
          <div class="p-avatar av-purple">${getInitials(p.full_name)}</div>
          <div style="flex:1;">
            <div class="p-name">${p.full_name}</div>
            <div class="p-role">${p.role || '—'}</div>
          </div>
          ${p.email ? `<a href="mailto:${p.email}" onclick="event.stopPropagation();" class="icon-link"><i class="ti ti-mail"></i></a>` : ''}
          ${p.phone ? `<a href="tel:${p.phone}" onclick="event.stopPropagation();" class="icon-link"><i class="ti ti-phone"></i></a>` : ''}
          <i class="ti ti-chevron-right" style="color:#c8c6be;font-size:14px;margin-left:4px;"></i>
        </div>
      `).join('')
    : '<div class="empty-mini">No contacts yet.</div>';

  const pendingTasks = (details.tasks || []).filter(t => t.status !== 'done');
  const doneTasks = (details.tasks || []).filter(t => t.status === 'done');

  const pendingTasksHtml = pendingTasks.map(t => taskItemHtml(t)).join('') || '<div class="empty-mini">No open tasks.</div>';
  const doneTasksHtml = doneTasks.length
    ? `<div id="done-tasks-toggle-company-${c.id}" style="margin-top:8px;">
         <button onclick="toggleDoneTasks('company-${c.id}')" style="font-size:11px;color:#a09e97;background:none;border:none;cursor:pointer;padding:2px 0;display:flex;align-items:center;gap:4px;">
           <i class="ti ti-chevron-right" id="done-chevron-company-${c.id}"></i> ${doneTasks.length} completed
         </button>
         <div id="done-list-company-${c.id}" style="display:none;margin-top:6px;">
           ${doneTasks.map(t => taskItemHtml(t, true)).join('')}
         </div>
       </div>`
    : '';

  const notesHtml = details.notes.map(n => `
    <div class="note-box">
      <div class="note-content">${n.content}</div>
      <div class="note-date">${timeAgo(n.created_at)}</div>
    </div>
  `).join('') || '<div class="empty-mini">No notes yet.</div>';

  const activityTypeIcon = { call: 'ti-phone', meeting: 'ti-users', email: 'ti-mail', whatsapp: 'ti-brand-whatsapp', other: 'ti-activity' };
  const activityTypeLabel = { call: 'Call', meeting: 'Meeting', email: 'Email', whatsapp: 'WhatsApp', other: 'Activity' };
  const activitiesHtml = details.activities.map(a => {
    const icon = activityTypeIcon[a.activity_type] || 'ti-activity';
    const label = activityTypeLabel[a.activity_type] || a.activity_type || 'Activity';
    return `
    <div class="tl-item">
      <div class="tl-dot"><i class="ti ${icon}" style="font-size:11px;color:#fff;"></i></div>
      <div style="flex:1;">
        <div class="tl-text"><strong>${label}</strong>${a.notes ? ` — ${a.notes}` : ''}</div>
        <div class="tl-date">${timeAgo(a.activity_date)}</div>
      </div>
    </div>`;
  }).join('') || '<div class="empty-mini">No activity yet.</div>';

  content.innerHTML = `
    <div class="detail-page">

      <!-- Back nav -->
      <button class="back-btn" onclick="goBack()">
        <i class="ti ti-arrow-left"></i> Back
      </button>

      <!-- Header -->
      <div class="detail-page-header">
        <div class="detail-avatar ${c.avatar_color}" style="width:48px;height:48px;font-size:18px;border-radius:12px;">${c.initials}</div>
        <div style="flex:1;">
          <div style="font-size:20px;font-weight:700;color:#2c2c2a;">${c.name}</div>
          <div style="font-size:13px;color:#73726c;margin-top:3px;">${c.industry || ''}${c.location ? ' · ' + c.location : ''}</div>
        </div>
        <!-- Clickable stage badge with dropdown -->
        <div style="position:relative;">
          <span class="stage-pill-lg" id="company-stage-pill-${c.id}" style="background:${s.bg};color:${s.text};cursor:pointer;user-select:none;" onclick="toggleStageDropdown('${c.id}')">
            ${details.stage} <i class="ti ti-chevron-down" style="font-size:10px;margin-left:2px;"></i>
          </span>
          <div id="stage-dropdown-${c.id}" style="display:none;position:fixed;background:#fff;border:1px solid #e8e6df;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:140px;z-index:9999;">
            ${STAGE_ORDER.filter(st => st !== details.stage).map(st => {
              const sc = stageStyle(st);
              return `<div onclick="changeCompanyStage('${c.id}','${st}');toggleStageDropdown('${c.id}')" style="padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='#faf9f7'" onmouseout="this.style.background='transparent'"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sc.text};flex-shrink:0;"></span>${st}</div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Body: two-column -->
      <div class="detail-page-body">

        <!-- Left column -->
        <div class="detail-col-main">

          <!-- People -->
          <div class="detail-section">
            <div class="detail-section-title"><i class="ti ti-users"></i> Contacts</div>
            <div>${peopleHtml}</div>
          </div>

          <!-- Activity timeline -->
          <div class="detail-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div class="detail-section-title" style="margin-bottom:0;"><i class="ti ti-activity"></i> Activity</div>
              <button class="add-inline-btn" onclick="toggleLogActivity('${c.id}')"><i class="ti ti-plus"></i> Log</button>
            </div>
            <!-- Log activity inline form -->
            <div id="log-activity-form-${c.id}" style="display:none;" class="inline-form">
              <select id="activity-type-${c.id}" class="inline-input" style="margin-bottom:6px;">
                <option value="call">📞 Call</option>
                <option value="meeting">🤝 Meeting</option>
                <option value="email">✉️ Email</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="other">📌 Other</option>
              </select>
              <select id="activity-person-${c.id}" class="inline-input" style="margin-bottom:6px;">
                <option value="">— With whom? (optional)</option>
                ${details.people.map(p => `<option value="${p.id}">${p.full_name}${p.role ? ` · ${p.role}` : ''}</option>`).join('')}
              </select>
              <input type="date" id="activity-date-${c.id}" class="inline-input" style="margin-bottom:6px;" value="${new Date().toISOString().split('T')[0]}"/>
              <textarea id="activity-notes-${c.id}" class="inline-input" rows="2" placeholder="Notes (optional)…" style="resize:none;"></textarea>
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button class="btn btn-primary" style="flex:1;font-size:12px;" onclick="submitLogActivity('${c.id}')">Save</button>
                <button class="btn btn-secondary" style="font-size:12px;" onclick="toggleLogActivity('${c.id}')">Cancel</button>
              </div>
            </div>
            <div id="activities-list-${c.id}">${activitiesHtml}</div>
          </div>

        </div>

        <!-- Right column -->
        <div class="detail-col-side">

          <!-- Company info -->
          <div class="detail-section">
            <div class="detail-section-title"><i class="ti ti-building"></i> About</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
              ${c.industry ? `<div style="display:flex;gap:8px;align-items:center;"><i class="ti ti-tag" style="color:#a09e97;font-size:14px;"></i><span style="font-size:13px;color:#444441;">${c.industry}</span></div>` : ''}
              ${c.location ? `<div style="display:flex;gap:8px;align-items:center;"><i class="ti ti-map-pin" style="color:#a09e97;font-size:14px;"></i><span style="font-size:13px;color:#444441;">${c.location}</span></div>` : ''}
              ${c.website ? `<div style="display:flex;gap:8px;align-items:center;"><i class="ti ti-world" style="color:#a09e97;font-size:14px;"></i><a href="${c.website}" target="_blank" style="font-size:13px;color:#7F77DD;text-decoration:none;">${c.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
              ${!c.industry && !c.location && !c.website ? '<div class="empty-mini">No details on file.</div>' : ''}
            </div>
          </div>

          <!-- Notes (company-level) -->
          <div class="detail-section">
            <div class="detail-section-title" style="justify-content:space-between;">
              <span><i class="ti ti-notes"></i> Notes</span>
              <button class="add-inline-btn" onclick="toggleAddNote('${c.id}')"><i class="ti ti-plus"></i> Add</button>
            </div>
            <div id="notes-list-${c.id}">${notesHtml}</div>
            <div id="add-note-form-${c.id}" style="display:none;" class="inline-form">
              <textarea id="note-text-${c.id}" placeholder="Write a note…" class="inline-input" rows="4" style="resize:vertical;"></textarea>
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button class="btn btn-primary" style="flex:1;padding:7px;" onclick="submitNote('${c.id}')">Save</button>
                <button class="btn btn-secondary" onclick="toggleAddNote('${c.id}')">Cancel</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

function goBack() {
  selectedId = null;
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'companies') renderCompanies();
  else if (currentView === 'people') renderPeople();
  else renderDashboard();
}

// ─── Person detail page ───────────────────────────────────────────────────────
function switchPersonTab(tabName, personId) {
  document.querySelectorAll(`.person-tab[data-person="${personId}"]`).forEach(t => t.classList.remove('active'));
  document.querySelectorAll(`.person-tab-panel[data-person="${personId}"]`).forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`.person-tab[data-person="${personId}"][data-tab="${tabName}"]`);
  const panel = document.querySelector(`.person-tab-panel[data-person="${personId}"][data-tab="${tabName}"]`);
  if (tab) tab.classList.add('active');
  if (panel) panel.classList.add('active');
}

async function openPersonDetail(id) {
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Loading…</p></div>';

  const details = await fetchPersonDetails(id);
  if (!details || !details.person) {
    content.innerHTML = '<div class="empty-state"><i class="ti ti-user-off"></i><p>Person not found.</p></div>';
    return;
  }
  const p = details.person;

  // ── Derived counts ──────────────────────────────────────────────────────────
  const activityCount  = (details.activities || []).length;
  const notesCount     = (details.notes || []).length;
  const personTasks    = details.tasks || [];
  const pendingTasks   = personTasks.filter(t => t.status !== 'done');
  const doneTasks      = personTasks.filter(t => t.status === 'done');
  const taskCount      = personTasks.length;

  // ── Last interaction ────────────────────────────────────────────────────────
  const allDates = [
    ...( details.activities || []).map(a => a.activity_date),
    ...( details.notes      || []).map(n => n.created_at),
  ].filter(Boolean).sort().reverse();
  const lastInteractionDate = allDates[0];
  const lastSeenHtml = lastInteractionDate
    ? `<span class="person-last-seen"><i class="ti ti-clock"></i> Last interaction ${timeAgo(lastInteractionDate)}</span>`
    : `<span class="person-last-seen"><i class="ti ti-clock"></i> No interactions yet</span>`;

  // ── Company chip ────────────────────────────────────────────────────────────
  const companyChip = details.current_company
    ? `<div style="display:flex;align-items:center;gap:7px;cursor:pointer;" onclick="openCompanyDetail('${details.current_company.id}')">
         <div class="company-avatar ${details.current_company.avatar_color}" style="width:20px;height:20px;font-size:9px;border-radius:4px;">${details.current_company.initials}</div>
         <span style="font-size:13px;color:#444441;font-weight:500;">${details.current_company.name}</span>
         ${details.current_role ? `<span style="font-size:12px;color:#a09e97;">· ${details.current_role}</span>` : ''}
       </div>`
    : `<span style="font-size:13px;color:#a09e97;">No company on record</span>`;

  // ── Tab: Activity ───────────────────────────────────────────────────────────
  const activitiesHtml = (details.activities || []).map(a => `
    <div class="tl-item">
      <div class="tl-dot" style="background:${a.color || '#7F77DD'};"></div>
      <div>
        <div class="tl-text">${a.text}</div>
        <div class="tl-date">${timeAgo(a.activity_date)}</div>
      </div>
    </div>
  `).join('') || '<div class="empty-mini">No activity recorded yet.</div>';

  // Employment history inside activity tab
  const historyHtml = (details.history || []).length
    ? `<div style="margin-top:20px;">
         <div class="detail-section-title" style="margin-bottom:10px;"><i class="ti ti-briefcase"></i> Employment history</div>
         ${details.history.map(h => `
           <div class="tl-item">
             <div class="tl-dot" style="background:${h.is_current ? '#7F77DD' : '#c8c6be'};"></div>
             <div>
               <div class="tl-text">${h.companies?.name || 'Unknown'} — ${h.role || 'No role'}</div>
               <div class="tl-date">${h.is_current ? 'Current' : (h.from_date ? new Date(h.from_date).getFullYear() : '')}</div>
             </div>
           </div>
         `).join('')}
       </div>`
    : '';

  // ── Tab: Notes ──────────────────────────────────────────────────────────────
  const notesListHtml = (details.notes || []).map(n => noteItemHtml(n, p.id)).join('') || '<div class="empty-mini">No notes yet.</div>';

  // ── Tab: Tasks ──────────────────────────────────────────────────────────────
  const pendingTasksHtml = pendingTasks.map(t => taskItemHtml(t)).join('') || '<div class="empty-mini">No open tasks.</div>';
  const doneTasksHtml = doneTasks.length
    ? `<div id="done-tasks-toggle-person-${p.id}" style="margin-top:8px;">
         <button onclick="toggleDoneTasks('person-${p.id}')" style="font-size:11px;color:#a09e97;background:none;border:none;cursor:pointer;padding:2px 0;display:flex;align-items:center;gap:4px;">
           <i class="ti ti-chevron-right" id="done-chevron-person-${p.id}"></i>
           <span id="done-count-person-${p.id}">${doneTasks.length}</span> completed
         </button>
         <div id="done-list-person-${p.id}" style="display:none;margin-top:6px;">
           ${doneTasks.map(t => taskItemHtml(t, true)).join('')}
         </div>
       </div>`
    : '';

  // ── Contact details sidebar strip ───────────────────────────────────────────
  const contactDetailsHtml = `
    <div class="detail-section" style="margin-bottom:16px;">
      <div class="detail-section-title"><i class="ti ti-id-badge"></i> Contact</div>
      <div style="display:flex;flex-direction:column;gap:9px;margin-top:4px;">
        ${p.email ? `<div style="display:flex;gap:8px;align-items:center;"><i class="ti ti-mail" style="color:#a09e97;font-size:14px;width:16px;"></i><a href="mailto:${p.email}" style="font-size:13px;color:#7F77DD;text-decoration:none;word-break:break-all;">${p.email}</a></div>` : ''}
        ${p.phone ? `<div style="display:flex;gap:8px;align-items:center;"><i class="ti ti-phone" style="color:#a09e97;font-size:14px;width:16px;"></i><a href="tel:${p.phone}" style="font-size:13px;color:#444441;text-decoration:none;">${p.phone}</a></div>` : ''}
        ${p.linkedin ? `<div style="display:flex;gap:8px;align-items:center;"><i class="ti ti-brand-linkedin" style="color:#a09e97;font-size:14px;width:16px;"></i><a href="${p.linkedin}" target="_blank" style="font-size:13px;color:#7F77DD;text-decoration:none;">LinkedIn profile</a></div>` : ''}
        ${!p.email && !p.phone && !p.linkedin ? '<div class="empty-mini">No contact details.</div>' : ''}
      </div>
    </div>
  `;

  content.innerHTML = `
    <div class="detail-page">
      <button class="back-btn" onclick="goBack()"><i class="ti ti-arrow-left"></i> Back</button>

      <!-- Person header -->
      <div class="person-detail-header">
        <div class="p-avatar av-purple" style="width:52px;height:52px;font-size:19px;border-radius:50%;flex-shrink:0;">${getInitials(p.full_name)}</div>
        <div class="person-header-meta">
          <div class="person-header-name">${p.full_name}</div>
          <div class="person-header-sub">
            ${companyChip}
            <span style="color:#d4d1c8;">·</span>
            ${lastSeenHtml}
          </div>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="person-tabs-bar">
        <button class="person-tab active" data-person="${p.id}" data-tab="activity" onclick="switchPersonTab('activity','${p.id}')">
          <i class="ti ti-activity"></i> Activity <span class="tab-count">${activityCount}</span>
        </button>
        <button class="person-tab" data-person="${p.id}" data-tab="notes" onclick="switchPersonTab('notes','${p.id}')">
          <i class="ti ti-notes"></i> Notes <span class="tab-count">${notesCount}</span>
        </button>
        <button class="person-tab" data-person="${p.id}" data-tab="tasks" onclick="switchPersonTab('tasks','${p.id}')">
          <i class="ti ti-checkbox"></i> Tasks <span class="tab-count">${taskCount}</span>
        </button>
      </div>

      <!-- Tab panels + side contact column -->
      <div class="detail-page-body">
        <div class="detail-col-main">

          <!-- Activity panel -->
          <div class="person-tab-panel active detail-section" data-person="${p.id}" data-tab="activity">
            ${activitiesHtml}
            ${historyHtml}
          </div>

          <!-- Notes panel -->
          <div class="person-tab-panel detail-section" data-person="${p.id}" data-tab="notes">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span class="detail-section-title" style="margin-bottom:0;"><i class="ti ti-notes"></i> Notes</span>
              <button class="add-inline-btn" onclick="togglePersonAddNote('${p.id}')"><i class="ti ti-plus"></i> Add note</button>
            </div>
            <div id="person-notes-list-${p.id}">${notesListHtml}</div>
            <div id="person-add-note-form-${p.id}" style="display:none;" class="inline-form">
              <textarea id="person-note-text-${p.id}" placeholder="Write a note…" class="inline-input" rows="4" style="resize:vertical;"></textarea>
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button class="btn btn-primary" style="flex:1;padding:7px;" onclick="submitPersonNote('${p.id}')">Save</button>
                <button class="btn btn-secondary" onclick="togglePersonAddNote('${p.id}')">Cancel</button>
              </div>
            </div>
          </div>

          <!-- Tasks panel -->
          <div class="person-tab-panel detail-section" data-person="${p.id}" data-tab="tasks">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span class="detail-section-title" style="margin-bottom:0;"><i class="ti ti-checkbox"></i> Tasks</span>
              <button class="add-inline-btn" onclick="togglePersonAddTask('${p.id}')"><i class="ti ti-plus"></i> Add task</button>
            </div>
            <div id="person-tasks-list-${p.id}">${pendingTasksHtml}${doneTasksHtml}</div>
            <div id="person-add-task-form-${p.id}" style="display:none;" class="inline-form">
              <input type="text" id="person-task-text-${p.id}" placeholder="Task description…" class="inline-input"/>
              <input type="date" id="person-task-date-${p.id}" class="inline-input" style="margin-top:6px;"/>
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button class="btn btn-primary" style="flex:1;padding:7px;" onclick="submitPersonTask('${p.id}')">Save</button>
                <button class="btn btn-secondary" onclick="togglePersonAddTask('${p.id}')">Cancel</button>
              </div>
            </div>
          </div>

        </div>

        <!-- Side: contact details (always visible) -->
        <div class="detail-col-side">
          ${contactDetailsHtml}
        </div>
      </div>
    </div>
  `;
}

function togglePersonAddTask(personId) {
  const form = document.getElementById(`person-add-task-form-${personId}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') document.getElementById(`person-task-text-${personId}`).focus();
}

async function submitPersonTask(personId) {
  const textEl = document.getElementById(`person-task-text-${personId}`);
  const dateEl = document.getElementById(`person-task-date-${personId}`);
  const text = textEl.value.trim();
  if (!text) { textEl.focus(); return; }
  const btn = document.querySelector(`#person-add-task-form-${personId} .btn-primary`);
  btn.textContent = 'Saving…'; btn.disabled = true;
  const task = await postPersonTask(personId, text, dateEl.value);
  const due = dueDateLabel(task.due_date);
  const newItem = document.createElement('div');
  newItem.className = 'task-item';
  newItem.id = `task-${task.id}`;
  newItem.innerHTML = `
    <div class="task-box" onclick="markTaskDone('${task.id}')"></div>
    <div style="flex:1;">
      <div class="task-text">${task.text}</div>
      ${due ? `<div class="task-due ${due.cls}">${due.label}</div>` : ''}
    </div>
  `;
  const list = document.getElementById(`person-tasks-list-${personId}`);
  const emptyMini = list.querySelector('.empty-mini');
  if (emptyMini) emptyMini.remove();
  // Insert before done section if it exists
  const doneToggle = document.getElementById(`done-tasks-toggle-person-${personId}`);
  list.insertBefore(newItem, doneToggle || null);
  textEl.value = ''; dateEl.value = '';
  btn.textContent = 'Save'; btn.disabled = false;
  togglePersonAddTask(personId);
}

function togglePersonAddNote(personId) {
  const form = document.getElementById(`person-add-note-form-${personId}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') document.getElementById(`person-note-text-${personId}`).focus();
}

async function submitPersonNote(personId) {
  const textEl = document.getElementById(`person-note-text-${personId}`);
  const content = textEl.value.trim();
  if (!content) { textEl.focus(); return; }
  const btn = document.querySelector(`#person-add-note-form-${personId} .btn-primary`);
  btn.textContent = 'Saving…'; btn.disabled = true;
  const note = await postPersonNote(personId, content);
  const newNote = document.createElement('div');
  newNote.className = 'note-box';
  newNote.innerHTML = `<div class="note-content">${note.content}</div><div class="note-date">Just now</div>`;
  const list = document.getElementById(`person-notes-list-${personId}`);
  const empty = list.querySelector('.empty-mini');
  if (empty) empty.remove();
  list.insertBefore(newNote, list.firstChild);
  textEl.value = ''; btn.textContent = 'Save'; btn.disabled = false;
  togglePersonAddNote(personId);
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function showModal(html) {
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:1000;';
  overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:28px;width:440px;max-width:95vw;box-shadow:0 8px 40px rgba(0,0,0,0.18);">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

function showAddCompanyModal() {
  showModal(`
    <div style="font-size:17px;font-weight:700;margin-bottom:18px;">Add company</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <input id="mc-name" class="inline-input" placeholder="Company name *" autofocus/>
      <input id="mc-industry" class="inline-input" placeholder="Industry"/>
      <input id="mc-location" class="inline-input" placeholder="Location"/>
      <input id="mc-website" class="inline-input" placeholder="Website"/>
      <select id="mc-stage" class="inline-input">
        ${['Funnel','Pipeline','Prospect','Lead','Client'].map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px;">
      <button class="btn btn-primary" style="flex:1;" onclick="submitAddCompany()">Add company</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

async function submitAddCompany() {
  const name = document.getElementById('mc-name').value.trim();
  if (!name) { document.getElementById('mc-name').focus(); return; }
  const btn = document.querySelector('#modal-overlay .btn-primary');
  btn.textContent = 'Saving…'; btn.disabled = true;
  await postCompany({
    name,
    industry: document.getElementById('mc-industry').value.trim() || null,
    location: document.getElementById('mc-location').value.trim() || null,
    website: document.getElementById('mc-website').value.trim() || null,
    stage: document.getElementById('mc-stage').value,
  });
  closeModal();
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'companies') renderCompanies();
}

function showAddPersonModal() {
  showModal(`
    <div style="font-size:17px;font-weight:700;margin-bottom:18px;">Add person</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <input id="mp-name" class="inline-input" placeholder="Full name *" autofocus/>
      <input id="mp-email" class="inline-input" placeholder="Email"/>
      <input id="mp-phone" class="inline-input" placeholder="Phone"/>
      <input id="mp-linkedin" class="inline-input" placeholder="LinkedIn URL"/>
      <input id="mp-role" class="inline-input" placeholder="Role/title"/>
      <select id="mp-company" class="inline-input">
        <option value="">No company</option>
        ${companiesData.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px;">
      <button class="btn btn-primary" style="flex:1;" onclick="submitAddPerson()">Add person</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

async function submitAddPerson() {
  const name = document.getElementById('mp-name').value.trim();
  if (!name) { document.getElementById('mp-name').focus(); return; }
  const btn = document.querySelector('#modal-overlay .btn-primary');
  btn.textContent = 'Saving…'; btn.disabled = true;
  await postPerson({
    full_name: name,
    email: document.getElementById('mp-email').value.trim() || null,
    phone: document.getElementById('mp-phone').value.trim() || null,
    linkedin: document.getElementById('mp-linkedin').value.trim() || null,
    role: document.getElementById('mp-role').value.trim() || null,
    company_id: document.getElementById('mp-company').value || null,
  });
  closeModal();
  if (currentView === 'people') renderPeople();
}

// ─── Log activity ─────────────────────────────────────────────────────────────
function toggleLogActivity(companyId) {
  const form = document.getElementById(`log-activity-form-${companyId}`);
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function submitLogActivity(companyId) {
  const typeEl   = document.getElementById(`activity-type-${companyId}`);
  const personEl = document.getElementById(`activity-person-${companyId}`);
  const dateEl   = document.getElementById(`activity-date-${companyId}`);
  const notesEl  = document.getElementById(`activity-notes-${companyId}`);
  if (!typeEl || !dateEl) return;

  const personId   = personEl ? (personEl.value || null) : null;
  const personName = personEl && personEl.value ? personEl.options[personEl.selectedIndex].text : null;

  const payload = {
    company_id: companyId,
    activity_type: typeEl.value,
    activity_date: dateEl.value || new Date().toISOString().split('T')[0],
    notes: notesEl ? notesEl.value.trim() || null : null,
    person_id: personId,
  };

  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed');
    const activity = await res.json();

    // Prepend to the activity list in DOM — no full reload needed
    const list = document.getElementById(`activities-list-${companyId}`);
    if (list) {
      const empty = list.querySelector('.empty-mini');
      if (empty) empty.remove();
      const icons = { call: 'ti-phone', meeting: 'ti-users', email: 'ti-mail', whatsapp: 'ti-brand-whatsapp', other: 'ti-activity' };
      const labels = { call: 'Call', meeting: 'Meeting', email: 'Email', whatsapp: 'WhatsApp', other: 'Activity' };
      const icon = icons[activity.activity_type] || 'ti-activity';
      const label = labels[activity.activity_type] || 'Activity';
      const item = document.createElement('div');
      item.className = 'tl-item';
      item.innerHTML = `
        <div class="tl-dot"><i class="ti ${icon}" style="font-size:11px;color:#fff;"></i></div>
        <div style="flex:1;">
          <div class="tl-text"><strong>${label}</strong>${personName ? ` with ${personName}` : ''}${activity.notes ? ` — ${activity.notes}` : ''}</div>
          <div class="tl-date">Just now</div>
        </div>`;
      list.insertBefore(item, list.firstChild);
    }

    // Reset and close form
    if (notesEl) notesEl.value = '';
    typeEl.value = 'call';
    if (personEl) personEl.value = '';
    toggleLogActivity(companyId);
  } catch(e) {
    alert('Failed to save activity. Please try again.');
  }
}

// ─── Inline add forms ─────────────────────────────────────────────────────────
function toggleAddTask(companyId) {
  const form = document.getElementById(`add-task-form-${companyId}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') {
    document.getElementById(`task-text-${companyId}`).focus();
  }
}

function toggleAddNote(companyId) {
  const form = document.getElementById(`add-note-form-${companyId}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') {
    document.getElementById(`note-text-${companyId}`).focus();
  }
}

async function submitTask(companyId) {
  const textEl = document.getElementById(`task-text-${companyId}`);
  const dateEl = document.getElementById(`task-date-${companyId}`);
  const text = textEl.value.trim();
  if (!text) { textEl.focus(); return; }

  const btn = document.querySelector(`#add-task-form-${companyId} .btn-primary`);
  btn.textContent = 'Saving…';
  btn.disabled = true;

  const task = await postTask(companyId, text, dateEl.value);

  const due = dueDateLabel(task.due_date);
  const newItem = document.createElement('div');
  newItem.className = 'task-item';
  newItem.id = `task-${task.id}`;
  newItem.innerHTML = `
    <div class="task-box" onclick="markTaskDone('${task.id}')"></div>
    <div style="flex:1;">
      <div class="task-text">${task.text}</div>
      ${due ? `<div class="task-due ${due.cls}">${due.label}</div>` : ''}
    </div>
  `;

  const list = document.getElementById(`tasks-list-${companyId}`);
  const emptyMini = list.querySelector('.empty-mini');
  if (emptyMini) emptyMini.remove();
  list.appendChild(newItem);

  textEl.value = '';
  dateEl.value = '';
  btn.textContent = 'Save';
  btn.disabled = false;
  toggleAddTask(companyId);
}

async function submitNote(companyId) {
  const textEl = document.getElementById(`note-text-${companyId}`);
  const content = textEl.value.trim();
  if (!content) { textEl.focus(); return; }

  const btn = document.querySelector(`#add-note-form-${companyId} .btn-primary`);
  btn.textContent = 'Saving…';
  btn.disabled = true;

  const note = await postNote(companyId, content);

  const newNote = document.createElement('div');
  newNote.className = 'note-box';
  newNote.innerHTML = `
    <div class="note-content">${note.content}</div>
    <div class="note-date">Just now</div>
  `;

  const list = document.getElementById(`notes-list-${companyId}`);
  const emptyMini = list.querySelector('.empty-mini');
  if (emptyMini) emptyMini.remove();
  list.insertBefore(newNote, list.firstChild);

  textEl.value = '';
  btn.textContent = 'Save';
  btn.disabled = false;
  toggleAddNote(companyId);
}

async function markTaskDone(taskId) {
  const el = document.getElementById(`task-${taskId}`);
  if (!el) return;
  // Optimistic UI — style as done immediately
  el.style.opacity = '0.5';
  const box = el.querySelector('.task-box');
  if (box) { box.style.background = '#7F77DD'; box.style.borderColor = '#7F77DD'; box.style.cursor = 'default'; box.onclick = null; }
  const textEl = el.querySelector('.task-text');
  if (textEl) { textEl.style.textDecoration = 'line-through'; textEl.style.color = '#a09e97'; }

  try {
    await patchTaskDone(taskId);
    refreshTasksBadge(); // update nav badge
    // Find the parent tasks-list and look for / create a done section
    const tasksList = el.closest('[id^="tasks-list-"]');
    if (tasksList) {
      const scopeId = tasksList.id.replace('tasks-list-', '');
      let doneToggle = document.getElementById(`done-tasks-toggle-${scopeId}`);
      if (!doneToggle) {
        // Create collapsed done section
        doneToggle = document.createElement('div');
        doneToggle.id = `done-tasks-toggle-${scopeId}`;
        doneToggle.style.marginTop = '8px';
        doneToggle.innerHTML = `
          <button onclick="toggleDoneTasks('${scopeId}')" style="font-size:11px;color:#a09e97;background:none;border:none;cursor:pointer;padding:2px 0;display:flex;align-items:center;gap:4px;">
            <i class="ti ti-chevron-right" id="done-chevron-${scopeId}"></i> <span id="done-count-${scopeId}">0</span> completed
          </button>
          <div id="done-list-${scopeId}" style="display:none;margin-top:6px;"></div>
        `;
        tasksList.appendChild(doneToggle);
      }
      const doneList = document.getElementById(`done-list-${scopeId}`);
      const doneCountEl = document.getElementById(`done-count-${scopeId}`);
      // Move the element into the done list
      el.remove();
      doneList.appendChild(el);
      if (doneCountEl) doneCountEl.textContent = doneList.children.length;
      // If pending list is now empty, add empty-mini
      const pendingItems = tasksList.querySelectorAll('.task-item:not([style*="done"])');
      const hasPending = Array.from(tasksList.children).some(
        ch => ch.classList.contains('task-item') && ch !== el
      );
      // If no more pending tasks visible outside done section
      const nonDoneItems = tasksList.querySelectorAll(':scope > .task-item');
      if (nonDoneItems.length === 0 && !tasksList.querySelector(':scope > .empty-mini')) {
        const empty = document.createElement('div');
        empty.className = 'empty-mini';
        empty.textContent = 'No open tasks.';
        tasksList.insertBefore(empty, doneToggle);
      }
    }
  } catch(e) {
    // Revert on failure
    el.style.opacity = '1';
    if (box) { box.style.background = ''; box.style.borderColor = ''; box.style.cursor = 'pointer'; box.onclick = () => markTaskDone(taskId); }
    if (textEl) { textEl.style.textDecoration = ''; textEl.style.color = ''; }
  }
}

// ─── Companies list ───────────────────────────────────────────────────────────
async function renderCompanies() {
  currentView = 'companies';
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Loading…</p></div>';
  const companies = await fetchCompanies();

  const urgent = companies.filter(c => c.ai_class === 'ai-urgent').length;
  const active = companies.filter(c => ['Pipeline', 'Prospect', 'Lead'].includes(c.stage)).length;

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total companies</div><div class="stat-value">${companies.length}</div><div class="stat-sub up">In database</div></div>
      <div class="stat-card"><div class="stat-label">Active discussions</div><div class="stat-value">${active}</div><div class="stat-sub">Pipeline to Lead</div></div>
      <div class="stat-card"><div class="stat-label">Need follow up</div><div class="stat-value">${urgent}</div><div class="stat-sub" style="color:#A32D2D;">Urgent attention</div></div>
      <div class="stat-card"><div class="stat-label">Funnel</div><div class="stat-value">${companies.filter(c => c.stage === 'Funnel').length}</div><div class="stat-sub">Top of funnel</div></div>
    </div>
    <div class="section-label">All companies</div>
    <div class="cards-grid">
      ${companies.map(c => companyCardHtml(c, false)).join('')}
    </div>
  `;
}

// ─── People ───────────────────────────────────────────────────────────────────
async function renderPeople() {
  currentView = 'people';
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Loading…</p></div>';
  const [records] = await Promise.all([fetchPeople(), companiesData.length ? Promise.resolve() : fetchCompanies()]);

  const toggleBtns = `
    <div style="display:flex;gap:6px;margin-bottom:14px;justify-content:flex-end;">
      <button onclick="peopleView='list';renderPeople();" class="btn ${peopleView==='list'?'btn-primary':'btn-secondary'}" style="padding:5px 12px;font-size:12px;"><i class="ti ti-list"></i> List</button>
      <button onclick="peopleView='card';renderPeople();" class="btn ${peopleView==='card'?'btn-primary':'btn-secondary'}" style="padding:5px 12px;font-size:12px;"><i class="ti ti-layout-grid"></i> Cards</button>
    </div>
  `;

  const statsHtml = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total contacts</div><div class="stat-value">${records.length}</div><div class="stat-sub up">Across all companies</div></div>
      <div class="stat-card"><div class="stat-label">Companies covered</div><div class="stat-value">${new Set(records.map(r=>r.company_id)).size}</div><div class="stat-sub">Unique companies</div></div>
    </div>
  `;

  const listHtml = `
    <div style="background:#fff;border:1px solid #e8e6df;border-radius:12px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:2fr 1.5fr 2fr 1.5fr 1fr;padding:10px 16px;background:#f9f8f5;border-bottom:1px solid #e8e6df;">
        ${['Name','Company','Email','Phone','Role'].map(h=>`<div style="font-size:11px;font-weight:600;color:#a09e97;text-transform:uppercase;letter-spacing:0.4px;">${h}</div>`).join('')}
      </div>
      ${records.map((r,i) => `
        <div onclick="openPersonDetail('${r.people.id}')" style="display:grid;grid-template-columns:2fr 1.5fr 2fr 1.5fr 1fr;padding:12px 16px;border-bottom:${i<records.length-1?'1px solid #f0ede6':'none'};cursor:pointer;transition:background 0.1s;" onmouseover="this.style.background='#faf9f7'" onmouseout="this.style.background='transparent'">
          <div style="display:flex;align-items:center;gap:9px;">
            <div class="p-avatar av-purple" style="width:30px;height:30px;font-size:11px;">${getInitials(r.people.full_name)}</div>
            <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${r.people.full_name}</div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;">
            <div class="company-avatar ${r.companies.avatar_color}" style="width:20px;height:20px;font-size:9px;border-radius:4px;">${r.companies.initials}</div>
            <div style="font-size:13px;color:#444441;">${r.companies.name}</div>
          </div>
          <div style="display:flex;align-items:center;font-size:12px;"><a href="mailto:${r.people.email}" onclick="event.stopPropagation();" style="color:#534AB7;text-decoration:none;">${r.people.email||'—'}</a></div>
          <div style="display:flex;align-items:center;font-size:12px;color:#73726c;">${r.people.phone||'—'}</div>
          <div style="display:flex;align-items:center;font-size:12px;color:#a09e97;">${r.role||'—'}</div>
        </div>
      `).join('')}
    </div>
  `;

  const cardHtml = `
    <div class="cards-grid">
      ${records.map(r => `
        <div class="company-card" onclick="openPersonDetail('${r.people.id}')">
          <div class="card-top">
            <div class="company-avatar av-purple">${getInitials(r.people.full_name)}</div>
            <span class="stage-pill s-new">Contact</span>
          </div>
          <div class="company-name">${r.people.full_name}</div>
          <div class="company-meta" style="font-weight:500;color:#534AB7;">${r.companies.name}</div>
          <div class="company-meta">${r.role||''}</div>
          <div class="card-stats"><span class="card-stat"><i class="ti ti-mail"></i> ${r.people.email||'—'}</span></div>
        </div>
      `).join('')}
    </div>
  `;

  content.innerHTML = statsHtml + toggleBtns + '<div class="section-label">All people</div>' + (peopleView==='list' ? listHtml : cardHtml);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
async function renderTasks() {
  currentView = 'tasks';
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Loading…</p></div>';
  const tasks = await fetchTasks();

  const enriched = tasks.map(t => ({ ...t, dueInfo: dueDateLabel(t.due_date) }));
  const order = { 'Overdue': 0, 'Due today': 1, 'Due tomorrow': 2 };
  enriched.sort((a, b) => {
    const oa = order[a.dueInfo?.label] ?? 9;
    const ob = order[b.dueInfo?.label] ?? 9;
    return oa - ob;
  });

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total tasks</div><div class="stat-value">${tasks.length}</div><div class="stat-sub">Across all companies</div></div>
      <div class="stat-card"><div class="stat-label">Due today</div><div class="stat-value">${enriched.filter(t=>t.dueInfo?.label==='Due today').length}</div><div class="stat-sub up">Action needed</div></div>
      <div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value">${enriched.filter(t=>t.dueInfo?.label==='Overdue').length}</div><div class="stat-sub" style="color:#A32D2D;">Needs attention</div></div>
    </div>
    <div class="section-label">All tasks — sorted by urgency</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${enriched.map(t => {
        const co = t.companies;
        const avatarHtml = co
          ? `<div class="company-avatar ${co.avatar_color}" style="width:32px;height:32px;font-size:12px;">${co.initials}</div>`
          : `<div class="company-avatar av-purple" style="width:32px;height:32px;font-size:12px;">?</div>`;
        const subLabel = co ? co.name : (t.person_id ? 'Personal task' : '—');
        const clickAttr = co ? `onclick="openCompanyDetail('${t.company_id}')"` : '';
        return `
        <div class="company-card" style="display:flex;align-items:center;gap:12px;padding:12px 16px;${co ? 'cursor:pointer;' : ''}" ${clickAttr}>
          <div class="task-box" style="width:16px;height:16px;flex-shrink:0;"></div>
          ${avatarHtml}
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${t.text}</div>
            <div style="font-size:11px;color:#a09e97;margin-top:2px;">${subLabel}</div>
          </div>
          ${t.dueInfo ? `<div class="task-due ${t.dueInfo.cls}">${t.dueInfo.label}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('topbar-title').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  const addLabels = { dashboard: 'Add item', companies: 'Add company', people: 'Add person', opportunities: 'Add opportunity', tasks: 'Add task', notes: 'Add note' };
  document.getElementById('add-btn').textContent = '+ ' + (addLabels[view] || 'Add');
  document.getElementById('add-btn').onclick = () => {
    if (view === 'companies') showAddCompanyModal();
    else if (view === 'people') showAddPersonModal();
    else if (view === 'dashboard') showAddCompanyModal();
  };
  selectedId = null;

  if (view === 'dashboard') renderDashboard();
  else if (view === 'companies') renderCompanies();
  else if (view === 'people') renderPeople();
  else if (view === 'tasks') renderTasks();
  else {
    currentView = view;
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state"><i class="ti ti-clock"></i><p>${view.charAt(0).toUpperCase()+view.slice(1)} coming soon</p></div>
    `;
  }
}

function switchFilter(el) {
  document.querySelectorAll('.filter-pill').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
refreshTasksBadge();
renderDashboard();
