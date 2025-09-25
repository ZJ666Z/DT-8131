// Fullscreen Three.js Scene — Domain Ontography (AI Health Insurance)
// Complete build with color-key legend, meanings, toggle, and category spotlight.
// Assumes: index.html loads THREE + OrbitControls and has a button #fullscreen-btn.
// Keeps your existing HTML/CSS and back button flow intact.

let fullscreenScene, fullscreenCamera, fullscreenRenderer, fullscreenControls;
let fullscreenContainer, animationId;
let raycaster, mouse;
let spheres = [];         // [{ id, mesh, sprite, label, category }]
let connections = [];     // [{ line, aId, bId }]
let tooltipEl, legendEl;

const CATEGORY_STYLES = {
  "Users":           { color: 0x4f9cf7, meaning: "End customers & their devices/channels" },
  "Insurers":        { color: 0x9b59b6, meaning: "Carrier org units & core insurance roles" },
  "Data & Tech":     { color: 0x27ae60, meaning: "Models, data sources, and platform components" },
  "Health Services": { color: 0xe67e22, meaning: "Partner providers delivering interventions" },
  "Governance":      { color: 0x34495e, meaning: "Policy, consent, fairness & regulation guardrails" },
  "External Forces": { color: 0xbdc3c7, meaning: "Market & societal pressures shaping behavior" }
};

// ---- Ontography data (edit/extend here to iterate with your team) ----
const NODES = [
  // Users
  { label: "Young Health-Conscious Users", category: "Users" },
  { label: "High-Net-Worth Users",         category: "Users" },
  { label: "Family/Dependents",            category: "Users" },
  { label: "Mobile App / Mini Program",    category: "Users" },
  { label: "Wearables (Watch/Fitbit)",     category: "Users" },

  // Insurers
  { label: "Traditional Insurer",          category: "Insurers" },
  { label: "Internet Insurer",             category: "Insurers" },
  { label: "Product / Actuarial",          category: "Insurers" },
  { label: "Underwriting",                 category: "Insurers" },
  { label: "Claims",                       category: "Insurers" },
  { label: "Risk Control",                 category: "Insurers" },

  // Data & Tech
  { label: "AI Risk Model",                category: "Data & Tech" },
  { label: "Dynamic Premium Engine",       category: "Data & Tech" },
  { label: "EMR (Electronic Medical Records)", category: "Data & Tech" },
  { label: "Genomic Data",                 category: "Data & Tech" },
  { label: "Behavioral Signals (Steps/Sleep/HR)", category: "Data & Tech" },
  { label: "Data Platform / Pipelines",    category: "Data & Tech" },

  // Health Services
  { label: "Nutrition Services",           category: "Health Services" },
  { label: "Psychological Counseling",     category: "Health Services" },
  { label: "Fitness Providers",            category: "Health Services" },
  { label: "Hospitals / Clinics",          category: "Health Services" },
  { label: "Rehab / Prevention Programs",  category: "Health Services" },

  // Governance
  { label: "Data Privacy & Consent",       category: "Governance" },
  { label: "Pricing Fairness Audits",      category: "Governance" },
  { label: "Insurance Regulation",         category: "Governance" },

  // External Forces
  { label: "Rising Medical Costs",         category: "External Forces" },
  { label: "Market Competition",           category: "External Forces" },
  { label: "Rising Health Awareness",      category: "External Forces" },
  { label: "Aging Population",             category: "External Forces" }
];

// Weak ties (relations) — descriptive only; not causal/hierarchical
const EDGES = [
  // Users <-> Data/Tech
  ["Wearables (Watch/Fitbit)", "Behavioral Signals (Steps/Sleep/HR)"],
  ["Mobile App / Mini Program", "Behavioral Signals (Steps/Sleep/HR)"],
  ["EMR (Electronic Medical Records)", "AI Risk Model"],
  ["Genomic Data", "AI Risk Model"],
  ["AI Risk Model", "Dynamic Premium Engine"],
  ["Data Platform / Pipelines", "AI Risk Model"],

  // Insurer <-> Platform
  ["Underwriting", "AI Risk Model"],
  ["Claims", "AI Risk Model"],
  ["Risk Control", "AI Risk Model"],
  ["Product / Actuarial", "Dynamic Premium Engine"],
  ["Traditional Insurer", "Underwriting"],
  ["Internet Insurer", "Underwriting"],

  // Users <-> Health Services
  ["Young Health-Conscious Users", "Nutrition Services"],
  ["Young Health-Conscious Users", "Fitness Providers"],
  ["High-Net-Worth Users", "Hospitals / Clinics"],
  ["Psychological Counseling", "Mobile App / Mini Program"],
  ["Rehab / Prevention Programs", "Mobile App / Mini Program"],

  // Governance / External
  ["Data Privacy & Consent", "Data Platform / Pipelines"],
  ["Data Privacy & Consent", "Genomic Data"],
  ["Pricing Fairness Audits", "Dynamic Premium Engine"],
  ["Insurance Regulation", "Traditional Insurer"],
  ["Insurance Regulation", "Internet Insurer"],
  ["Rising Medical Costs", "Claims"],
  ["Market Competition", "Product / Actuarial"],
  ["Rising Health Awareness", "Young Health-Conscious Users"],
  ["Aging Population", "Hospitals / Clinics"]
];

// Cluster centers to keep categories spatially organized
const CLUSTERS = {
  "Users":           { x: -6, y:  1, z:  0 },
  "Insurers":        { x:  6, y:  1, z:  0 },
  "Data & Tech":     { x:  0, y:  1, z:  6 },
  "Health Services": { x:  0, y:  1, z: -6 },
  "Governance":      { x: -6, y:  4, z:  6 },
  "External Forces": { x:  6, y:  4, z: -6 }
};

function initFullscreen() {
  // Container
  fullscreenContainer = document.createElement('div');
  fullscreenContainer.className = 'fullscreen-canvas';
  fullscreenContainer.style.display = 'none';
  document.body.appendChild(fullscreenContainer);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'fullscreen-threejs-canvas';
  fullscreenContainer.appendChild(canvas);

  // Back button
  const backButton = document.createElement('button');
  backButton.className = 'back-button';
  backButton.textContent = '← Back';
  backButton.onclick = exitFullscreen;
  fullscreenContainer.appendChild(backButton);

  // Tooltip
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'onto-tooltip';
  tooltipEl.style.display = 'none';
  fullscreenContainer.appendChild(tooltipEl);

  // Legend
  legendEl = document.createElement('div');
  legendEl.className = 'onto-legend';
  fullscreenContainer.appendChild(legendEl);
  buildLegend();  // build + wire up interactivity

  // Scene
  fullscreenScene = new THREE.Scene();
  fullscreenScene.background = new THREE.Color(0xd0d0d0);

  // Camera
  fullscreenCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  fullscreenCamera.position.set(10, 8, 12);

  // Renderer
  fullscreenRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
  fullscreenRenderer.setSize(window.innerWidth, window.innerHeight);
  fullscreenRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Controls
  fullscreenControls = new THREE.OrbitControls(fullscreenCamera, fullscreenRenderer.domElement);
  fullscreenControls.enableDamping = true;

  // Picking
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  fullscreenRenderer.domElement.addEventListener('mousemove', onMouseMove);

  // Content
  addBasicLighting();
  createOntography();

  // Loop + resize
  animateFullscreen();
  window.addEventListener('resize', onFullscreenWindowResize);
}

function buildLegend() {
  legendEl.innerHTML = `
    <div class="legend-header">
      <div class="legend-title">Ontography — Color Key</div>
      <button class="legend-toggle" type="button" aria-label="Hide legend">Hide</button>
    </div>
    <div class="legend-rows">
      ${Object.keys(CATEGORY_STYLES).map(k => {
        const hex = '#' + CATEGORY_STYLES[k].color.toString(16).padStart(6,'0');
        const meaning = CATEGORY_STYLES[k].meaning || '';
        return `
          <div class="legend-row" data-category="${k}">
            <span class="legend-dot" style="background:${hex}"></span>
            <div class="legend-text">
              <div class="legend-cat">${k}</div>
              <div class="legend-meaning">${meaning}</div>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="legend-notes">
      <div class="legend-edge">
        <span class="edge-sample"></span>
        <span>Thin gray lines = weak ties (contact/dependency/flow). Not causal or hierarchical.</span>
      </div>
      <div class="legend-hint">Tip: hover a node to highlight its ties. Click a legend row to spotlight a category.</div>
    </div>
  `;

  // Toggle
  const toggleBtn = legendEl.querySelector('.legend-toggle');
  const rowsWrap  = legendEl.querySelector('.legend-rows');
  const notesWrap = legendEl.querySelector('.legend-notes');
  toggleBtn.addEventListener('click', () => {
    const hidden = rowsWrap.style.display === 'none';
    rowsWrap.style.display = hidden ? '' : 'none';
    notesWrap.style.display = hidden ? '' : 'none';
    toggleBtn.textContent = hidden ? 'Hide' : 'Show';
    toggleBtn.setAttribute('aria-label', hidden ? 'Hide legend' : 'Show legend');
  });

  // Category spotlight
  legendEl.querySelectorAll('.legend-row').forEach(row => {
    row.addEventListener('click', () => {
      const cat = row.getAttribute('data-category');
      const alreadyFocused = legendEl.classList.contains('legend-focused-' + cat);
      // clear previous focus
      [...legendEl.classList].forEach(c => { if (c.startsWith('legend-focused-')) legendEl.classList.remove(c); });

      if (alreadyFocused) {
        // reset all
        spheres.forEach(s => { s.mesh.material.opacity = 1; s.mesh.material.transparent = false; s.sprite.material.opacity = 1; });
        connections.forEach(c => c.line.material.opacity = 0.6);
        return;
      }

      legendEl.classList.add('legend-focused-' + cat);
      spheres.forEach(s => {
        const inCat = s.category === cat;
        s.mesh.material.transparent = true;
        s.mesh.material.opacity = inCat ? 1 : 0.25;
        s.sprite.material.opacity   = inCat ? 1 : 0.25;
      });
      connections.forEach(cn => {
        const a = spheres.find(s => s.id === cn.aId);
        const b = spheres.find(s => s.id === cn.bId);
        cn.line.material.opacity = (a.category === cat && b.category === cat) ? 0.9 : 0.1;
      });
    });
  });
}

function createOntography() {
  // Create nodes
  const radius = 0.35;
  const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);

  NODES.forEach((node, idx) => {
    const color = CATEGORY_STYLES[node.category]?.color || 0x333333;
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;

    // Clustered jitter around category center
    const c = CLUSTERS[node.category] || { x: 0, y: 0, z: 0 };
    const jx = (Math.random() - 0.5) * 2.6;
    const jy = (Math.random() - 0.5) * 1.4;
    const jz = (Math.random() - 0.5) * 2.6;
    mesh.position.set(c.x + jx, c.y + jy, c.z + jz);

    // Label sprite
    const sprite = makeTextSprite(node.label);
    sprite.position.copy(mesh.position);
    sprite.position.y += 0.75;

    fullscreenScene.add(mesh);
    fullscreenScene.add(sprite);

    spheres.push({
      id: idx,
      mesh,
      label: node.label,
      category: node.category,
      sprite
    });
  });

  // Connections (weak ties)
  EDGES.forEach(([a, b]) => {
    const aRef = spheres.find(s => s.label === a);
    const bRef = spheres.find(s => s.label === b);
    if (!aRef || !bRef) return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      aRef.mesh.position.x, aRef.mesh.position.y, aRef.mesh.position.z,
      bRef.mesh.position.x, bRef.mesh.position.y, bRef.mesh.position.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(geometry, material);
    fullscreenScene.add(line);

    connections.push({ line, aId: aRef.id, bId: bRef.id });
  });
}

function makeTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '24px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // word wrap
  const maxWidth = 420;
  const words = text.split(' ');
  let line = '', y = canvas.height / 2;
  const lineHeight = 28;
  let lines = [];
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line); line = w;
    } else { line = test; }
  });
  lines.push(line);
  if (lines.length > 1) {
    y = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  }
  lines.forEach((ln, i) => ctx.fillText(ln, canvas.width / 2, y + i * lineHeight));

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 0.7, 1);
  return sprite;
}

function addBasicLighting() {
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  fullscreenScene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(6, 12, 6);
  dir.castShadow = true;
  fullscreenScene.add(dir);
}

function onMouseMove(e) {
  if (!fullscreenRenderer || !fullscreenCamera) return;
  const rect = fullscreenRenderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickAndHighlight() {
  raycaster.setFromCamera(mouse, fullscreenCamera);
  const intersect = raycaster.intersectObjects(spheres.map(s => s.mesh))[0];

  // reset all
  spheres.forEach(s => { s.mesh.scale.set(1,1,1); s.sprite.material.opacity = 1; });
  connections.forEach(c => c.line.material.opacity = 0.6);
  tooltipEl.style.display = 'none';

  if (intersect) {
    const picked = spheres.find(s => s.mesh === intersect.object);
    picked.mesh.scale.set(1.25, 1.25, 1.25);
    picked.sprite.material.opacity = 1;

    // emphasize its ties
    connections.forEach(c => {
      if (c.aId === picked.id || c.bId === picked.id) c.line.material.opacity = 1.0;
      else c.line.material.opacity = 0.2;
    });

    // tooltip
    tooltipEl.innerHTML = `
      <div class="tt-title">${picked.label}</div>
      <div class="tt-meta">${picked.category}</div>
      <div class="tt-hint">Weak ties shown in bold • Drag to orbit • Scroll to zoom</div>`;
    tooltipEl.style.display = 'block';

    // position near mouse
    const canvasRect = fullscreenRenderer.domElement.getBoundingClientRect();
    const x = Math.min(canvasRect.right - 260, Math.max(canvasRect.left, event.clientX + 12));
    const y = Math.min(canvasRect.bottom - 120, Math.max(canvasRect.top,  event.clientY + 12));
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top  = `${y}px`;
  }
}

function animateFullscreen() {
  animationId = requestAnimationFrame(animateFullscreen);
  fullscreenControls.update();
  pickAndHighlight();
  fullscreenRenderer.render(fullscreenScene, fullscreenCamera);
}

function onFullscreenWindowResize() {
  fullscreenCamera.aspect = window.innerWidth / window.innerHeight;
  fullscreenCamera.updateProjectionMatrix();
  fullscreenRenderer.setSize(window.innerWidth, window.innerHeight);
}

function enterFullscreen() {
  if (!fullscreenContainer) initFullscreen();
  fullscreenContainer.style.display = 'block';
  document.body.style.overflow = 'hidden';
  const canvas = document.getElementById('fullscreen-threejs-canvas');
  canvas.focus();
}

function exitFullscreen() {
  if (!fullscreenContainer) return;
  fullscreenContainer.style.display = 'none';
  document.body.style.overflow = 'auto';
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
}

window.addEventListener('load', function() {
  const btn = document.getElementById('fullscreen-btn');
  if (btn) btn.addEventListener('click', enterFullscreen);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && fullscreenContainer && fullscreenContainer.style.display === 'block') exitFullscreen();
  });
});
