(function () {
  const jobs = [
    {
      id: 'J-1042', client: 'Mason Residence', address: '214 Cedar Bend', status: 'Needs arborist review', queued: 'Today',
      standards: ['A300 Part 1 pruning objective: crown cleaning', 'A300 Part 9 risk-assessment observation log', 'Z133 PPE, drop-zone, and work-positioning checklist'],
      trees: [
        { id: 'T-01', species: 'Live oak', dbh: '28 in', height: 'Large', condition: 'Fair', risk: 'Moderate', x: 32, y: 42 },
        { id: 'T-02', species: 'Pecan', dbh: '18 in', height: 'Medium', condition: 'Poor', risk: 'High', x: 68, y: 30 },
        { id: 'T-03', species: 'Crape myrtle', dbh: '7 in', height: 'Small', condition: 'Good', risk: 'Low', x: 52, y: 68 }
      ]
    },
    {
      id: 'J-1043', client: 'Northgate HOA', address: 'Trail easement block B', status: 'Queued', queued: 'Tomorrow',
      standards: ['A300 Part 1 pruning objective: clearance pruning', 'Z133 traffic control and public exclusion zone'],
      trees: [
        { id: 'T-11', species: 'Sycamore', dbh: '24 in', height: 'Large', condition: 'Good', risk: 'Moderate', x: 26, y: 58 },
        { id: 'T-12', species: 'Hackberry', dbh: '14 in', height: 'Medium', condition: 'Fair', risk: 'Moderate', x: 74, y: 48 }
      ]
    },
    {
      id: 'J-1044', client: 'Lena Patel', address: '809 Pine Hollow', status: 'Ready for crew', queued: 'Friday',
      standards: ['A300 Part 1 pruning specification: deadwood removal', 'Z133 pre-climb inspection and communication plan'],
      trees: [
        { id: 'T-21', species: 'Red maple', dbh: '16 in', height: 'Medium', condition: 'Good', risk: 'Low', x: 40, y: 36 }
      ]
    }
  ];

  const objectiveGuidance = {
    'crown-cleaning': {
      title: 'Crown cleaning',
      items: ['Prioritize dead, diseased, broken, or crossing limbs.', 'Keep cuts outside the branch collar and preserve the branch bark ridge.', 'Warns against topping, lion-tailing, flush cuts, or vague “thin heavily” directions.'],
      basis: 'A300 Part 1 pruning objective: crown cleaning.'
    },
    clearance: {
      title: 'Utility / structure clearance',
      items: ['Mark a measurable clearance envelope before assigning cuts.', 'Escalate utility-adjacent work for qualified line-clearance review.', 'Separate drop zone, pedestrian control, and equipment approach notes.'],
      basis: 'A300 clearance-pruning specification + Z133 electrical hazard and work-zone planning.'
    },
    'risk-mitigation': {
      title: 'Risk mitigation',
      items: ['Document defect, target, likelihood, and consequence before recommendations.', 'Tie each mitigation to a specific tree ID and target.', 'Flag cavities, included bark, root damage, or dead scaffold limbs for site inspection.'],
      basis: 'A300 Part 9 risk-assessment output concepts.'
    }
  };

  const toolMeta = {
    'trim-zone': { label: 'Trim Zone', icon: '✂', cls: 'trim-marker' },
    deadwood: { label: 'Deadwood', icon: '•', cls: 'deadwood-marker' },
    'cut-marker': { label: '3-cut', icon: '⟂', cls: 'cut-marker' },
    defect: { label: 'Defect', icon: '!', cls: 'defect-marker' },
    'drop-zone': { label: 'Drop Zone', icon: '⌄', cls: 'drop-marker' },
    clearance: { label: 'Clearance', icon: '↔', cls: 'clearance-marker' }
  };

  let selectedJobId = jobs[0].id;
  let activeTool = 'trim-zone';
  const $ = (id) => document.getElementById(id);

  function selectedJob() {
    return jobs.find((job) => job.id === selectedJobId) || jobs[0];
  }

  function riskClass(risk) {
    return String(risk || '').toLowerCase().replace(/[^a-z]/g, '') || 'low';
  }

  function renderMetrics() {
    $('metricQueued').textContent = jobs.length;
    $('metricTrees').textContent = jobs.reduce((sum, job) => sum + job.trees.length, 0);
    $('metricHighRisk').textContent = jobs.reduce((sum, job) => sum + job.trees.filter((tree) => tree.risk === 'High').length, 0);
  }

  function renderJobs() {
    $('opsJobQueue').innerHTML = jobs.map((job) => `
      <button class="ops-job-card ${job.id === selectedJobId ? 'active' : ''}" type="button" data-job="${job.id}">
        <span><strong>${job.id} · ${job.client}</strong><small>${job.address} · ${job.trees.length} trees · ${job.queued}</small></span>
        <em>${job.status}</em>
      </button>
    `).join('');
    $('opsJobQueue').querySelectorAll('[data-job]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedJobId = btn.dataset.job;
        renderAll();
      });
    });
  }

  function renderSiteSelect() {
    $('siteSelect').innerHTML = jobs.map((job) => `<option value="${job.id}">${job.id} · ${job.client}</option>`).join('');
    $('siteSelect').value = selectedJobId;
  }

  function renderInventory() {
    const job = selectedJob();
    $('selectedSiteLabel').textContent = `${job.client} · ${job.address}`;
    $('treeInventoryBody').innerHTML = job.trees.map((tree) => `
      <tr>
        <td><strong>${tree.id}</strong></td>
        <td>${tree.species}</td>
        <td>${tree.dbh}</td>
        <td>${tree.height}</td>
        <td>${tree.condition}</td>
        <td><span class="risk-badge ${riskClass(tree.risk)}">${tree.risk}</span></td>
      </tr>
    `).join('');
  }

  function renderMap() {
    const job = selectedJob();
    $('opsMap').innerHTML = '<div class="map-grid"></div><div class="map-zone utility-zone">Utility corridor</div>' + job.trees.map((tree) => `
      <button class="tree-pin ${riskClass(tree.risk)}" style="left:${tree.x}%;top:${tree.y}%" title="${tree.id} ${tree.species} — ${tree.risk} risk">
        <span>${tree.id}</span>
      </button>
    `).join('');
  }

  function renderStandards() {
    const job = selectedJob();
    $('standardsBasis').innerHTML = job.standards.map((item) => `<div class="standard-item"><span>✓</span>${item}</div>`).join('');
  }

  function renderSuggestions() {
    const guidance = objectiveGuidance[$('objectiveSelect').value];
    $('suggestions').innerHTML = `<p><strong>${guidance.title}</strong></p><ul>${guidance.items.map((item) => `<li>${item}</li>`).join('')}</ul><div class="basis-note">${guidance.basis}</div>`;
  }

  function renderLegend() {
    $('symbolLegend').innerHTML = Object.values(toolMeta).map((tool) => `<span><i class="${tool.cls}">${tool.icon}</i>${tool.label}</span>`).join('');
  }

  function addAnnotation(event) {
    const rect = $('annotationCanvas').getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const tool = toolMeta[activeTool];
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `annotation-marker ${tool.cls}`;
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
    marker.textContent = tool.icon;
    marker.title = tool.label;
    marker.setAttribute('aria-label', tool.label);
    marker.addEventListener('click', (e) => { e.stopPropagation(); marker.remove(); });
    $('annotationLayer').appendChild(marker);
  }

  function exportCsv() {
    const rows = [['Job ID', 'Client', 'Address', 'Tree ID', 'Species', 'DBH', 'Height', 'Condition', 'Risk', 'Standards basis']];
    jobs.forEach((job) => job.trees.forEach((tree) => rows.push([job.id, job.client, job.address, tree.id, tree.species, tree.dbh, tree.height, tree.condition, tree.risk, job.standards.join(' | ')])));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'treevision-tree-ops-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    $('siteSelect').addEventListener('change', (event) => { selectedJobId = event.target.value; renderAll(); });
    $('objectiveSelect').addEventListener('change', renderSuggestions);
    document.querySelectorAll('.tool-btn').forEach((btn) => btn.addEventListener('click', () => {
      activeTool = btn.dataset.tool;
      document.querySelectorAll('.tool-btn').forEach((item) => item.classList.toggle('active', item === btn));
    }));
    $('annotationCanvas').addEventListener('click', addAnnotation);
    $('clearAnnotationsBtn').addEventListener('click', () => { $('annotationLayer').innerHTML = ''; });
    $('exportReportBtn').addEventListener('click', exportCsv);
    $('printReportBtn').addEventListener('click', () => window.print());
    $('photoInput').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { $('canvasPhoto').style.backgroundImage = `url("${reader.result}")`; };
      reader.readAsDataURL(file);
    });
  }

  function renderAll() {
    renderMetrics();
    renderJobs();
    renderSiteSelect();
    renderInventory();
    renderMap();
    renderStandards();
    renderSuggestions();
    renderLegend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { renderAll(); bindEvents(); });
  } else {
    renderAll(); bindEvents();
  }
}());
