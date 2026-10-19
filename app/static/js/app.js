let selectedId = null;
let peopleView = 'list';
let companiesData = [];

async function fetchCompanies() {
  const res = await fetch('/api/companies');
  const companies = await res.json();
  companiesData = companies;
  return companies;
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

function getStageClass(stage) {
  const map = { 'Proposal sent': 's-proposal', 'In conversation': 's-active', 'Gone cold': 's-cold', 'New lead': 's-new', 'Follow up needed': 's-cold', 'Closed won': 's-active', 'Closed lost': 's-cold' };
  return map[stage] || 's-new';
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function timeAgo(dateStr) {
  if (!dateStr) return 'No contact';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return 'Yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

async function renderCompanies() {
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader"></i><p>Loading...</p></div>';
  const companies = await fetchCompanies();

  const urgent = companies.filter(c => c.ai_class === 'ai-urgent').length;
  const active = companies.filter(c => ['In conversation', 'Proposal sent'].includes(c.stage)).length;

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total companies</div><div class="stat-value">${companies.length}</div><div class="stat-sub up">In database</div></div>
      <div class="stat-card"><div class="stat-label">Active discussions</div><div class="stat-value">${active}</div><div class="stat-sub">Proposals and conversations</div></div>
      <div class="stat-card"><div class="stat-label">Need follow up</div><div class="stat-value">${urgent}</div><div class="stat-sub" style="color:#A32D2D;">Urgent attention</div></div>
      <div class="stat-card"><div class="stat-label">New leads</div><div class="stat-value">${companies.filter(c => c.stage === 'New lead').length}</div><div class="stat-sub">Recently discovered</div></div>
    </div>
    <div class="section-label">All companies</div>
    <div class="cards-grid">
      ${companies.map(c => `
        <div class="company-card ${c.id === selectedId ? 'selected' : ''}" onclick="selectCompany('${c.id}', this)">
          <div class="card-top">
            <div class="company-avatar ${c.avatar_color}">${c.initials}</div>
            <span class="stage-pill ${getStageClass(c.stage)}">${c.stage || 'New lead'}</span>
          </div>
          <div class="company-name">${c.name}</div>
          <div class="company-meta">${c.industry || ''} · ${c.location || ''}</div>
          <div class="card-stats">
            <span class="card-stat"><i class="ti ti-clock"></i> ${timeAgo(c.updated_at)}</span>
          </div>
          ${c.ai_tag ? `<div class="ai-tag ${c.ai_class || 'ai-neutral'}"><i class="ti ti-robot"></i> ${c.ai_tag}</div>` : '<div class="ai-tag ai-neutral"><i class="ti ti-robot"></i> No AI data yet</div>'}
          <div class="card-divider"></div>
          <div class="card-people"><span class="person-chip">${c.industry || 'Unknown'}</span></div>
        </div>
      `).join('')}
    </div>
  `;
}

async function selectCompany(id, el) {
  selectedId = id;
  document.querySelectorAll('.company-card').forEach(e => e.classList.remove('selected'));
  if (el) el.classList.add('selected');

  const details = await fetchCompanyDetails(id);
  const c = details.company;
  const engagement = details.engagement;

  document.getElementById('d-avatar').textContent = c.initials;
  document.getElementById('d-avatar').className = 'detail-avatar ' + c.avatar_color;
  document.getElementById('d-company').textContent = c.name;
  document.getElementById('d-industry').textContent = (c.industry || '') + ' · ' + (c.location || '');

  document.getElementById('d-people').innerHTML = details.people.length
    ? details.people.map(p => `
      <div class="person-row">
        <div class="p-avatar av-purple">${getInitials(p.full_name)}</div>
        <div><div class="p-name">${p.full_name}</div><div class="p-role">${p.role || ''}</div></div>
      </div>
    `).join('')
    : '<div style="font-size:12px;color:#a09e97;">No contacts yet.</div>';

  document.getElementById('d-tasks').innerHTML = details.tasks.length
    ? details.tasks.map(t => `
      <div class="task-item">
        <div class="task-box"></div>
        <div><div class="task-text">${t.text}</div><div class="task-due">${t.due_label || ''}</div></div>
      </div>
    `).join('')
    : '<div style="font-size:12px;color:#a09e97;">No tasks yet.</div>';

  document.getElementById('d-notes').innerHTML = details.notes.length
    ? details.notes.map(n => `<div class="note-box">${n.content}</div>`).join('')
    : '<div class="note-box" style="color:#a09e97;">No notes yet.</div>';

  document.getElementById('d-timeline').innerHTML = details.activities.length
    ? details.activities.map(a => `
      <div class="tl-item">
        <div class="tl-dot" style="background:${a.color};"></div>
        <div><div class="tl-text">${a.text}</div><div class="tl-date">${timeAgo(a.activity_date)}</div></div>
      </div>
    `).join('')
    : '<div style="font-size:12px;color:#a09e97;">No activity yet.</div>';
}

async function renderDashboard() {
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader"></i><p>Loading...</p></div>';
  const companies = await fetchCompanies();
  const urgent = companies.filter(c => c.ai_class === 'ai-urgent');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total companies</div><div class="stat-value">${companies.length}</div><div class="stat-sub up">In pipeline</div></div>
      <div class="stat-card"><div class="stat-label">Active discussions</div><div class="stat-value">${companies.filter(c => c.stage === 'In conversation').length}</div><div class="stat-sub">In conversation</div></div>
      <div class="stat-card"><div class="stat-label">Proposals sent</div><div class="stat-value">${companies.filter(c => c.stage === 'Proposal sent').length}</div><div class="stat-sub">Awaiting response</div></div>
      <div class="stat-card"><div class="stat-label">Need follow up</div><div class="stat-value">${urgent.length}</div><div class="stat-sub" style="color:#A32D2D;">Action needed</div></div>
    </div>
    <div class="section-label">Follow up today</div>
    <div class="cards-grid">
      ${urgent.map(c => `
        <div class="company-card" onclick="selectCompany('${c.id}', this); switchToCompanies();">
          <div class="card-top">
            <div class="company-avatar ${c.avatar_color}">${c.initials}</div>
            <span class="stage-pill ${getStageClass(c.stage)}">${c.stage || 'New lead'}</span>
          </div>
          <div class="company-name">${c.name}</div>
          <div class="company-meta">${c.industry || ''} · ${c.location || ''}</div>
          <div class="ai-tag ai-urgent"><i class="ti ti-robot"></i> ${c.ai_tag}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderPeople() {
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader"></i><p>Loading...</p></div>';
  const records = await fetchPeople();

  const toggleBtns = `
    <div style="display:flex; gap:6px; margin-bottom:14px; justify-content:flex-end;">
      <button onclick="peopleView='list'; renderPeople();" class="btn ${peopleView === 'list' ? 'btn-primary' : 'btn-secondary'}" style="padding:5px 12px;font-size:12px;"><i class="ti ti-list"></i> List</button>
      <button onclick="peopleView='card'; renderPeople();" class="btn ${peopleView === 'card' ? 'btn-primary' : 'btn-secondary'}" style="padding:5px 12px;font-size:12px;"><i class="ti ti-layout-grid"></i> Cards</button>
    </div>
  `;

  const statsHtml = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total contacts</div><div class="stat-value">${records.length}</div><div class="stat-sub up">Across all companies</div></div>
      <div class="stat-card"><div class="stat-label">Companies covered</div><div class="stat-value">${new Set(records.map(r => r.company_id)).size}</div><div class="stat-sub">Unique companies</div></div>
    </div>
  `;

  const listHtml = `
    <div style="background:#ffffff; border:1px solid #e8e6df; border-radius:12px; overflow:hidden;">
      <div style="display:grid; grid-template-columns:2fr 1.5fr 2fr 1.5fr 1fr; padding:10px 16px; background:#f9f8f5; border-bottom:1px solid #e8e6df;">
        <div style="font-size:11px;font-weight:600;color:#a09e97;text-transform:uppercase;letter-spacing:0.4px;">Name</div>
        <div style="font-size:11px;font-weight:600;color:#a09e97;text-transform:uppercase;letter-spacing:0.4px;">Company</div>
        <div style="font-size:11px;font-weight:600;color:#a09e97;text-transform:uppercase;letter-spacing:0.4px;">Email</div>
        <div style="font-size:11px;font-weight:600;color:#a09e97;text-transform:uppercase;letter-spacing:0.4px;">Phone</div>
        <div style="font-size:11px;font-weight:600;color:#a09e97;text-transform:uppercase;letter-spacing:0.4px;">Role</div>
      </div>
      ${records.map((r, i) => `
        <div onclick="selectCompany('${r.company_id}', null); switchToCompanies();" style="display:grid; grid-template-columns:2fr 1.5fr 2fr 1.5fr 1fr; padding:12px 16px; border-bottom:${i < records.length - 1 ? '1px solid #f0ede6' : 'none'}; cursor:pointer; transition:background 0.1s;" onmouseover="this.style.background='#faf9f7'" onmouseout="this.style.background='transparent'">
          <div style="display:flex;align-items:center;gap:9px;">
            <div class="p-avatar av-purple" style="width:30px;height:30px;font-size:11px;">${getInitials(r.people.full_name)}</div>
            <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${r.people.full_name}</div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;">
            <div class="company-avatar ${r.companies.avatar_color}" style="width:20px;height:20px;font-size:9px;border-radius:4px;">${r.companies.initials}</div>
            <div style="font-size:13px;color:#444441;">${r.companies.name}</div>
          </div>
          <div style="display:flex;align-items:center;font-size:12px;color:#73726c;"><a href="mailto:${r.people.email}" onclick="event.stopPropagation();" style="color:#534AB7;text-decoration:none;">${r.people.email || '—'}</a></div>
          <div style="display:flex;align-items:center;font-size:12px;color:#73726c;">${r.people.phone || '—'}</div>
          <div style="display:flex;align-items:center;font-size:12px;color:#a09e97;">${r.role || '—'}</div>
        </div>
      `).join('')}
    </div>
  `;

  const cardHtml = `
    <div class="cards-grid">
      ${records.map(r => `
        <div class="company-card" onclick="selectCompany('${r.company_id}', null); switchToCompanies();">
          <div class="card-top">
            <div class="company-avatar av-purple">${getInitials(r.people.full_name)}</div>
            <span class="stage-pill s-new">Contact</span>
          </div>
          <div class="company-name">${r.people.full_name}</div>
          <div class="company-meta" style="font-weight:500;color:#534AB7;">${r.companies.name}</div>
          <div class="company-meta">${r.role || ''}</div>
          <div class="card-stats"><span class="card-stat"><i class="ti ti-mail"></i> ${r.people.email || '—'}</span></div>
          <div class="card-divider"></div>
          <div class="card-people"><span class="person-chip">${r.people.phone || '—'}</span></div>
        </div>
      `).join('')}
    </div>
  `;

  content.innerHTML = statsHtml + toggleBtns + '<div class="section-label">All people</div>' + (peopleView === 'list' ? listHtml : cardHtml);
}

async function renderTasks() {
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="empty-state"><i class="ti ti-loader"></i><p>Loading...</p></div>';
  const tasks = await fetchTasks();

  const sorted = [...tasks].sort((a, b) => {
    const order = { 'Due today': 0, 'Overdue': 1, 'Due tomorrow': 2, 'Due Friday': 3, 'Due in 3 days': 4 };
    return (order[a.due_label] ?? 5) - (order[b.due_label] ?? 5);
  });

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total tasks</div><div class="stat-value">${tasks.length}</div><div class="stat-sub">Across all companies</div></div>
      <div class="stat-card"><div class="stat-label">Due today</div><div class="stat-value">${tasks.filter(t => t.due_label === 'Due today').length}</div><div class="stat-sub up">Action needed</div></div>
      <div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value">${tasks.filter(t => t.due_label === 'Overdue').length}</div><div class="stat-sub" style="color:#A32D2D;">Needs attention</div></div>
    </div>
    <div class="section-label">All tasks — sorted by urgency</div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${sorted.map(t => `
        <div class="company-card" style="display:flex; align-items:center; gap:12px; padding:12px 16px;" onclick="selectCompany('${t.company_id}', null); switchToCompanies();">
          <div class="task-box" style="width:16px;height:16px;flex-shrink:0;"></div>
          <div class="company-avatar ${t.companies.avatar_color}" style="width:32px;height:32px;font-size:12px;">${t.companies.initials}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;color:#2c2c2a;">${t.text}</div>
            <div style="font-size:11px;color:#a09e97;margin-top:2px;">${t.companies.name}</div>
          </div>
          <div style="font-size:11px;font-weight:500;${t.due_label === 'Overdue' ? 'color:#A32D2D;' : t.due_label === 'Due today' ? 'color:#854F0B;' : 'color:#a09e97;'}">${t.due_label || ''}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('topbar-title').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  const addLabels = { dashboard: 'Add item', companies: 'Add company', people: 'Add person', opportunities: 'Add opportunity', tasks: 'Add task', notes: 'Add note' };
  document.getElementById('add-btn').textContent = '+ ' + addLabels[view];
  if (view === 'companies') { renderCompanies(); }
  else if (view === 'people') { renderPeople(); }
  else if (view === 'tasks') { renderTasks(); }
  else if (view === 'dashboard') { renderDashboard(); }
  else {
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state">
        <i class="ti ti-clock"></i>
        <p>${view.charAt(0).toUpperCase() + view.slice(1)} view coming soon</p>
      </div>
    `;
  }
}

function switchFilter(el) {
  document.querySelectorAll('.filter-pill').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
}

function switchToCompanies() {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item')[1].classList.add('active');
  document.getElementById('topbar-title').textContent = 'Companies';
  document.getElementById('add-btn').textContent = '+ Add company';
  renderCompanies();
}

// Init
renderCompanies();