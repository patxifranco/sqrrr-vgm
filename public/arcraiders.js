// Arc Raiders Skill Tree Builder
// Data source: https://github.com/RaidTheory/arcraiders-data

// Category colors
const CATEGORY_COLORS = {
  CONDITIONING: '#1bff7b',
  MOBILITY: '#ffd008',
  SURVIVAL: '#f60110'
};

// Custom layout positions matching the reference image exactly
// Format: { x: percentage from left, y: percentage from top }
// Based on careful analysis of the in-game skill tree layout
const CUSTOM_POSITIONS = {
  // ============ MOBILITY ============
  'mob_1': { x: 50, y: 76 },
  'mob_2l': { x: 44, y: 66 },
  'mob_2r': { x: 56, y: 66 },
  'mob_3l': { x: 44, y: 56 },
  'mob_3r': { x: 56, y: 56 },
  'mob_4l': { x: 46, y: 46 },
  'mob_4r': { x: 54, y: 46 },
  'mob_5c': { x: 50, y: 34 },
  'mob_5l': { x: 44, y: 34 },
  'mob_5r': { x: 56, y: 34 },
  'mob_6c': { x: 50, y: 22 },
  'mob_6l': { x: 44, y: 22 },
  'mob_6r': { x: 56, y: 22 },
  'mob_7l': { x: 46, y: 10 },
  'mob_7r': { x: 54, y: 10 },

  // ============ CONDITIONING ============
  'cond_1': { x: 44, y: 88 },
  'cond_2l': { x: 34, y: 84 },
  'cond_2r': { x: 38, y: 76 },
  'cond_3l': { x: 30, y: 78 },
  'cond_3r': { x: 38, y: 66 },
  'cond_4l': { x: 26, y: 72 },
  'cond_4r': { x: 34, y: 58 },
  'cond_5c': { x: 24, y: 56 },
  'cond_5l': { x: 20, y: 62 },
  'cond_5r': { x: 28, y: 50 },
  'cond_6c': { x: 20, y: 48 },
  'cond_6l': { x: 16, y: 56 },
  'cond_6r': { x: 24, y: 42 },
  'cond_7l': { x: 12, y: 44 },
  'cond_7r': { x: 18, y: 32 },

  // ============ SURVIVAL ============
  'surv_1': { x: 58, y: 88 },
  'surv_2l': { x: 66, y: 74 },
  'surv_2r': { x: 66, y: 86 },
  'surv_3l': { x: 66, y: 64 },
  'surv_3r': { x: 72, y: 80 },
  'surv_4l': { x: 70, y: 54 },
  'surv_4r': { x: 76, y: 72 },
  'surv_5c': { x: 76, y: 54 },
  'surv_5l': { x: 74, y: 44 },
  'surv_5r': { x: 82, y: 58 },
  'surv_6c': { x: 80, y: 46 },
  'surv_6l': { x: 78, y: 36 },
  'surv_6r': { x: 86, y: 48 },
  'surv_7l': { x: 82, y: 26 },
  'surv_7r': { x: 90, y: 36 },
};

// Emoji icons for skills (placeholders based on skill type)
const SKILL_EMOJIS = {
  // Conditioning - green themed
  'cond_1': '\u{1F6E1}',      // Shield - root
  'cond_2l': '\u{1F4A5}',     // Explosion
  'cond_2r': '\u{1F91B}',     // Fist
  'cond_3l': '\u{26A1}',      // Lightning
  'cond_3r': '\u{1F511}',     // Key
  'cond_4l': '\u{2764}',      // Heart (major)
  'cond_4r': '\u{1F3C3}',     // Running (major)
  'cond_5c': '\u{1F49A}',     // Green heart - center merge
  'cond_5l': '\u{1F4AA}',     // Muscle
  'cond_5r': '\u{1F9F1}',     // Brick
  'cond_6c': '\u{2728}',      // Sparkles - center
  'cond_6l': '\u{1F9B5}',     // Leg
  'cond_6r': '\u{1F3CB}',     // Weightlifter
  'cond_7l': '\u{1F44A}',     // Punch (capstone)
  'cond_7r': '\u{1F91C}',     // Right Hook (capstone)

  // Mobility - yellow themed
  'mob_1': '\u{1F9D7}',       // Climbing - root
  'mob_2l': '\u{1F3C3}',      // Running
  'mob_2r': '\u{1F4A8}',      // Dash
  'mob_3l': '\u{27A1}',       // Arrow
  'mob_3r': '\u{1F97E}',      // Boot
  'mob_4l': '\u{1F680}',      // Rocket (major)
  'mob_4r': '\u{1F308}',      // Rainbow (major)
  'mob_5c': '\u{1F4AB}',      // Dizzy - center merge (big node)
  'mob_5l': '\u{1F3AF}',      // Target
  'mob_5r': '\u{21A9}',       // Return arrow
  'mob_6c': '\u{1F31F}',      // Glowing star - center
  'mob_6l': '\u{1F525}',      // Fire
  'mob_6r': '\u{1F6B4}',      // Cycling
  'mob_7l': '\u{2B06}',       // Up Arrow (capstone)
  'mob_7r': '\u{1F3C4}',      // Surfing (capstone)

  // Survival - red themed
  'surv_1': '\u{1F9CE}',      // Kneeling - root
  'surv_2l': '\u{1F6E0}',     // Tools
  'surv_2r': '\u{1F50D}',     // Magnifier
  'surv_3l': '\u{1F510}',     // Lock
  'surv_3r': '\u{1F4E6}',     // Package
  'surv_4l': '\u{1F4A3}',     // Bomb (major)
  'surv_4r': '\u{1F392}',     // Backpack (major)
  'surv_5c': '\u{2764}',      // Red heart - center merge
  'surv_5l': '\u{1F4E1}',     // Antenna
  'surv_5r': '\u{1F9F0}',     // Toolbox
  'surv_6c': '\u{1F4A2}',     // Anger - center
  'surv_6l': '\u{1F575}',     // Detective
  'surv_6r': '\u{1F4B0}',     // Money
  'surv_7l': '\u{1F47B}',     // Ghost (capstone)
  'surv_7r': '\u{1F48E}',     // Gem (capstone)
};

// Default emoji for skills not in the map
const DEFAULT_EMOJI = '\u{2B50}'; // Star

// Skill data will be loaded from JSON
let skillNodes = [];
let currentBuild = {}; // { skillId: pointsAllocated }
let arcRaidersTooltip;
let arcRaidersScreen;

// Default build - loaded when screen opens
const DEFAULT_BUILD = {
  "cond_1": 5,
  "mob_1": 5,
  "surv_1": 1,
  "cond_2l": 1,
  "cond_2r": 1,
  "cond_3l": 5,
  "cond_4l": 1,
  "cond_3r": 5,
  "cond_4r": 1,
  "cond_5c": 1,
  "cond_5l": 1,
  "cond_6l": 5,
  "cond_6c": 1,
  "surv_2l": 5,
  "surv_3l": 4,
  "surv_4l": 1,
  "surv_2r": 5,
  "surv_5l": 5,
  "surv_6l": 5,
  "mob_2l": 5,
  "mob_3l": 5,
  "mob_4l": 1,
  "mob_5c": 5,
  "mob_5l": 1
};

// Edit mode state
let arcEditMode = false;
let arcEditModeBuild = {}; // Temporary build being edited

// Debug drag mode
let dragModeEnabled = false;
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };
let modifiedPositions = {}; // Track changes during drag mode

// Initialize
async function initArcRaiders() {
  console.log('Initializing Arc Raiders...');
  arcRaidersScreen = document.getElementById('arcraiders-screen');
  arcRaidersTooltip = document.getElementById('arcraiders-tooltip');

  console.log('arcRaidersScreen:', arcRaidersScreen);

  // Load skill data
  try {
    const response = await fetch('arcraiders/skillNodes.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    skillNodes = await response.json();
    console.log('Loaded', skillNodes.length, 'Arc Raiders skills');
  } catch (err) {
    console.error('Failed to load Arc Raiders skill data:', err);
    return;
  }

  // Setup event listeners
  const arcRaidersBtn = document.getElementById('arcraiders-btn');
  if (arcRaidersBtn) {
    arcRaidersBtn.addEventListener('click', showArcRaidersScreen);
  }

  const backBtn = document.getElementById('arcraiders-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', hideArcRaidersScreen);
  }

  const resetBtn = document.getElementById('arcraiders-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetBuild);
  }

  // Add drag mode toggle button
  setupDragModeButton();

  // Add edit mode controls
  setupArcEditModeControls();

  // Load default build
  currentBuild = { ...DEFAULT_BUILD };

  // Render the skill tree
  renderSkillTree();
}

// Setup drag mode button
function setupDragModeButton() {
  const header = document.querySelector('.arcraiders-header');
  if (!header) return;

  // Check if button already exists
  if (document.getElementById('arcraiders-drag-btn')) return;

  const dragBtn = document.createElement('button');
  dragBtn.id = 'arcraiders-drag-btn';
  dragBtn.className = 'arcraiders-reset-btn';
  dragBtn.textContent = 'Edit Layout';
  dragBtn.style.marginLeft = '10px';
  dragBtn.style.background = '#444';

  dragBtn.addEventListener('click', toggleDragMode);
  header.appendChild(dragBtn);
}

// Toggle drag mode
function toggleDragMode() {
  dragModeEnabled = !dragModeEnabled;
  const dragBtn = document.getElementById('arcraiders-drag-btn');
  const container = document.getElementById('arcraiders-tree-container');

  if (dragModeEnabled) {
    dragBtn.textContent = 'Exit Edit (see console)';
    dragBtn.style.background = '#f60110';
    container.classList.add('drag-mode');
    // Copy current positions to modified (only if empty - preserve previous edits)
    if (Object.keys(modifiedPositions).length === 0) {
      modifiedPositions = JSON.parse(JSON.stringify(CUSTOM_POSITIONS));
    }
    console.log('=== DRAG MODE ENABLED ===');
    console.log('Drag nodes to reposition them.');
    console.log('When done, click "Exit Edit" to export positions.');
  } else {
    dragBtn.textContent = 'Edit Layout';
    dragBtn.style.background = '#444';
    container.classList.remove('drag-mode');
    exportPositions();
    // DON'T clear modifiedPositions - keep them for display
  }

  // Re-render to apply drag handlers
  renderSkillTree();
}

// Export positions to console
function exportPositions() {
  console.log('=== EXPORTED POSITIONS ===');
  console.log('Copy and paste this into CUSTOM_POSITIONS:');
  console.log('');

  // Group by category for readability
  const categories = ['mob', 'cond', 'surv'];
  const categoryNames = ['MOBILITY', 'CONDITIONING', 'SURVIVAL'];

  categories.forEach((cat, idx) => {
    console.log(`  // ============ ${categoryNames[idx]} ============`);
    Object.keys(modifiedPositions)
      .filter(key => key.startsWith(cat))
      .sort()
      .forEach(key => {
        const pos = modifiedPositions[key];
        console.log(`  '${key}': { x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)} },`);
      });
    console.log('');
  });
}

function showArcRaidersScreen() {
  console.log('showArcRaidersScreen called');
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });
  if (!arcRaidersScreen) {
    arcRaidersScreen = document.getElementById('arcraiders-screen');
  }
  console.log('arcRaidersScreen:', arcRaidersScreen);
  if (arcRaidersScreen) {
    arcRaidersScreen.classList.add('active');
    console.log('Screen activated, rendering connections...');
    setTimeout(renderConnections, 50);
  } else {
    console.error('arcRaidersScreen not found!');
  }
}

function hideArcRaidersScreen() {
  if (arcRaidersScreen) {
    arcRaidersScreen.classList.remove('active');
  }
  document.getElementById('hub-screen').classList.add('active');
}

function resetBuild() {
  if (arcEditMode) {
    arcEditModeBuild = {};
  } else {
    currentBuild = {};
  }
  updateAllNodes();
  updatePointsDisplay();
  renderConnections();
}

function renderSkillTree() {
  const nodesContainer = document.getElementById('arcraiders-nodes');
  if (!nodesContainer) return;
  nodesContainer.innerHTML = '';

  const build = getActiveBuild();

  // Create nodes using custom positions
  skillNodes.forEach(skill => {
    const node = document.createElement('div');
    node.className = 'arcraiders-node';
    node.dataset.skillId = skill.id;
    node.dataset.category = skill.category;

    // Get position - use modified positions if they exist (preserves drag edits), otherwise use CUSTOM_POSITIONS
    const hasModifiedPositions = Object.keys(modifiedPositions).length > 0;
    const positionsSource = hasModifiedPositions ? modifiedPositions : CUSTOM_POSITIONS;
    const customPos = positionsSource[skill.id];
    let xPercent, yPercent;

    if (customPos) {
      xPercent = customPos.x;
      yPercent = customPos.y;
    } else {
      // Fallback for any unmapped skills - place based on category
      const catOffset = skill.category === 'CONDITIONING' ? 0 :
                       skill.category === 'MOBILITY' ? 33 : 66;
      xPercent = catOffset + 15;
      yPercent = 50;
    }

    node.style.left = `${xPercent}%`;
    node.style.top = `${yPercent}%`;

    // Get color based on category
    const color = CATEGORY_COLORS[skill.category] || '#ffffff';
    node.style.setProperty('--category-color', color);

    // Major nodes are larger
    if (skill.isMajor) {
      node.classList.add('major');
    }

    // In drag mode, show the skill ID for easier identification
    if (dragModeEnabled) {
      node.innerHTML = `
        <div class="node-icon"></div>
        <div class="node-points">${skill.id}</div>
      `;
      node.classList.add('draggable');
    } else {
      // Show points display (current/max)
      const points = build[skill.id] || 0;
      node.innerHTML = `
        <div class="node-points">${points}/${skill.maxPoints}</div>
      `;
    }

    // Event listeners - different behavior in drag mode
    if (dragModeEnabled) {
      node.addEventListener('mousedown', (e) => startDrag(skill.id, node, e));
    } else {
      node.addEventListener('click', (e) => handleNodeClick(skill, e));
      node.addEventListener('contextmenu', (e) => handleNodeRightClick(skill, e));
      node.addEventListener('mouseenter', (e) => showTooltip(skill, e));
      node.addEventListener('mouseleave', hideTooltip);
      node.addEventListener('mousemove', (e) => moveTooltip(e));
    }

    nodesContainer.appendChild(node);
  });

  // Initial render
  updateAllNodes();
  updatePointsDisplay();

  // Render connections after nodes are positioned
  setTimeout(renderConnections, 100);
}

function renderConnections() {
  const svg = document.getElementById('arcraiders-connections');
  const container = document.getElementById('arcraiders-tree-container');
  const nodesContainer = document.getElementById('arcraiders-nodes');

  if (!svg || !container) return;

  // Set SVG size to match container
  const rect = container.getBoundingClientRect();
  svg.setAttribute('width', rect.width);
  svg.setAttribute('height', rect.height);
  svg.innerHTML = '';

  // Create connections based on prerequisites
  skillNodes.forEach(skill => {
    if (skill.prerequisiteNodeIds && skill.prerequisiteNodeIds.length > 0) {
      skill.prerequisiteNodeIds.forEach(prereqId => {
        const fromNode = nodesContainer.querySelector(`[data-skill-id="${prereqId}"]`);
        const toNode = nodesContainer.querySelector(`[data-skill-id="${skill.id}"]`);

        if (fromNode && toNode) {
          const fromRect = fromNode.getBoundingClientRect();
          const toRect = toNode.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
          const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
          const x2 = toRect.left + toRect.width / 2 - containerRect.left;
          const y2 = toRect.top + toRect.height / 2 - containerRect.top;

          // Determine if connection is active (both nodes have points)
          const build = getActiveBuild();
          const fromPoints = build[prereqId] || 0;
          const toPoints = build[skill.id] || 0;
          const isActive = fromPoints > 0 && toPoints > 0;

          // Get color based on category
          const color = CATEGORY_COLORS[skill.category] || '#ffffff';

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x1);
          line.setAttribute('y1', y1);
          line.setAttribute('x2', x2);
          line.setAttribute('y2', y2);
          line.setAttribute('stroke', isActive ? color : '#60626f');
          line.setAttribute('stroke-width', isActive ? '5' : '4');
          line.setAttribute('stroke-opacity', isActive ? '1' : '0.6');

          svg.appendChild(line);
        }
      });
    }
  });

  // Add decorative lines from outside screen to root nodes
  const rootNodes = ['cond_1', 'mob_1', 'surv_1'];
  const build = getActiveBuild();

  rootNodes.forEach(rootId => {
    const rootNode = nodesContainer.querySelector(`[data-skill-id="${rootId}"]`);
    if (!rootNode) return;

    const nodeRect = rootNode.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const nodeX = nodeRect.left + nodeRect.width / 2 - containerRect.left;
    const nodeY = nodeRect.top + nodeRect.height / 2 - containerRect.top;

    // Determine category and color
    const skill = skillNodes.find(s => s.id === rootId);
    const category = skill ? skill.category : 'MOBILITY';
    const color = CATEGORY_COLORS[category] || '#ffffff';
    const hasPoints = (build[rootId] || 0) > 0;

    // Create curved path from bottom of screen to root node
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Start point at bottom, curve up to node
    const startY = rect.height + 50; // Below screen
    const startX = nodeX;

    // Create a smooth curve
    const controlY = nodeY + (startY - nodeY) * 0.5;
    const d = `M ${startX} ${startY} Q ${startX} ${controlY} ${nodeX} ${nodeY}`;

    path.setAttribute('d', d);
    path.setAttribute('stroke', hasPoints ? color : '#60626f');
    path.setAttribute('stroke-width', hasPoints ? '5' : '4');
    path.setAttribute('stroke-opacity', hasPoints ? '1' : '0.6');
    path.setAttribute('fill', 'none');

    svg.appendChild(path);
  });
}

// Get the active build (arcEditModeBuild in edit mode, currentBuild otherwise)
function getActiveBuild() {
  return arcEditMode ? arcEditModeBuild : currentBuild;
}

function handleNodeClick(skill, e) {
  e.preventDefault();

  // Only allow editing in edit mode
  if (!arcEditMode) return;

  const build = getActiveBuild();
  const points = build[skill.id] || 0;

  // Check if prerequisites are met
  if (!arePrerequisitesMet(skill)) {
    return;
  }

  // Check if we can add more points
  if (points >= skill.maxPoints) {
    return;
  }

  // Check total points limit
  const totalPoints = Object.values(build).reduce((sum, pts) => sum + pts, 0);
  if (totalPoints >= 75) {
    return;
  }

  // Add point
  build[skill.id] = points + 1;

  updateAllNodes();
  updatePointsDisplay();
  renderConnections();
}

function handleNodeRightClick(skill, e) {
  e.preventDefault();

  // Only allow editing in edit mode
  if (!arcEditMode) return;

  const build = getActiveBuild();
  const points = build[skill.id] || 0;

  if (points > 0) {
    // Check if any skills depend on this one
    const canRemove = canRemovePoint(skill);
    if (!canRemove) {
      return;
    }

    build[skill.id] = points - 1;
    if (build[skill.id] === 0) {
      delete build[skill.id];
    }

    updateAllNodes();
    updatePointsDisplay();
    renderConnections();
  }
}

function arePrerequisitesMet(skill) {
  if (!skill.prerequisiteNodeIds || skill.prerequisiteNodeIds.length === 0) {
    return true;
  }

  const build = getActiveBuild();
  // Use OR logic - only need ONE prerequisite to be met (matches actual game behavior)
  return skill.prerequisiteNodeIds.some(prereqId => {
    const prereqPoints = build[prereqId] || 0;
    return prereqPoints > 0;
  });
}

function canRemovePoint(skill) {
  // Check if removing a point would break any dependent skills
  const build = getActiveBuild();
  const dependentSkills = skillNodes.filter(s =>
    s.prerequisiteNodeIds && s.prerequisiteNodeIds.includes(skill.id)
  );

  // If we're at 1 point and have dependents with points, can't remove
  const points = build[skill.id] || 0;
  if (points <= 1) {
    return dependentSkills.every(dep => {
      const depPoints = build[dep.id] || 0;
      return depPoints === 0;
    });
  }

  return true;
}

function updateAllNodes() {
  const nodes = document.querySelectorAll('.arcraiders-node');
  const build = getActiveBuild();

  nodes.forEach(node => {
    const skillId = node.dataset.skillId;
    const skill = skillNodes.find(s => s.id === skillId);
    if (!skill) return;

    const points = build[skillId] || 0;
    const prereqsMet = arePrerequisitesMet(skill);
    const isMaxed = points >= skill.maxPoints;

    // Update classes - CSS handles all styling
    node.classList.remove('active', 'available', 'locked', 'maxed');
    if (points > 0) {
      if (isMaxed) {
        node.classList.add('maxed');
      } else {
        node.classList.add('active');
      }
    } else if (prereqsMet) {
      node.classList.add('available');
    } else {
      node.classList.add('locked');
    }

    // Update points display
    const pointsDisplay = node.querySelector('.node-points');
    if (pointsDisplay) {
      pointsDisplay.textContent = `${points}/${skill.maxPoints}`;
    }

    // Add editable class in edit mode
    if (arcEditMode) {
      node.classList.add('editable');
    } else {
      node.classList.remove('editable');
    }
  });
}

function updatePointsDisplay() {
  const build = getActiveBuild();
  const totalPoints = Object.values(build).reduce((sum, pts) => sum + pts, 0);

  // Calculate per-category points
  let condPoints = 0, mobPoints = 0, survPoints = 0;

  Object.keys(build).forEach(skillId => {
    const skill = skillNodes.find(s => s.id === skillId);
    if (skill) {
      const pts = build[skillId];
      switch(skill.category) {
        case 'CONDITIONING': condPoints += pts; break;
        case 'MOBILITY': mobPoints += pts; break;
        case 'SURVIVAL': survPoints += pts; break;
      }
    }
  });

  document.getElementById('arcraiders-points-used').textContent = totalPoints;
  document.getElementById('cond-points').textContent = condPoints;
  document.getElementById('mob-points').textContent = mobPoints;
  document.getElementById('surv-points').textContent = survPoints;

  // Also update the tree labels
  const condTreePts = document.getElementById('cond-tree-points');
  const mobTreePts = document.getElementById('mob-tree-points');
  const survTreePts = document.getElementById('surv-tree-points');
  if (condTreePts) condTreePts.textContent = condPoints;
  if (mobTreePts) mobTreePts.textContent = mobPoints;
  if (survTreePts) survTreePts.textContent = survPoints;
}

function showTooltip(skill, e) {
  if (!arcRaidersTooltip) return;

  const name = skill.name.en || skill.name;
  const desc = skill.description.en || skill.description;
  const impact = skill.impactedSkill ? (skill.impactedSkill.en || skill.impactedSkill) : '';
  const color = CATEGORY_COLORS[skill.category] || '#ffffff';

  arcRaidersTooltip.querySelector('.arcraiders-tooltip-name').textContent = name;
  arcRaidersTooltip.querySelector('.arcraiders-tooltip-name').style.color = color;
  arcRaidersTooltip.querySelector('.arcraiders-tooltip-desc').textContent = desc;
  arcRaidersTooltip.querySelector('.arcraiders-tooltip-impact').textContent = impact ? `Affects: ${impact}` : '';

  arcRaidersTooltip.classList.add('visible');
  moveTooltip(e);
}

function hideTooltip() {
  if (arcRaidersTooltip) {
    arcRaidersTooltip.classList.remove('visible');
  }
}

function moveTooltip(e) {
  if (!arcRaidersTooltip || !arcRaidersTooltip.classList.contains('visible')) return;

  const padding = 15;
  const tooltipRect = arcRaidersTooltip.getBoundingClientRect();

  let x = e.clientX + padding;
  let y = e.clientY + padding;

  // Keep tooltip on screen
  if (x + tooltipRect.width > window.innerWidth) {
    x = e.clientX - tooltipRect.width - padding;
  }
  if (y + tooltipRect.height > window.innerHeight) {
    y = e.clientY - tooltipRect.height - padding;
  }

  arcRaidersTooltip.style.left = `${x}px`;
  arcRaidersTooltip.style.top = `${y}px`;
}

// Handle window resize
window.addEventListener('resize', () => {
  if (arcRaidersScreen && arcRaidersScreen.classList.contains('active')) {
    renderConnections();
  }
});

// ============ DRAG MODE FUNCTIONS ============
function startDrag(skillId, node, e) {
  if (!dragModeEnabled) return;
  e.preventDefault();

  draggedNode = { skillId, element: node };

  const container = document.getElementById('arcraiders-tree-container');
  const containerRect = container.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();

  dragOffset.x = e.clientX - nodeRect.left - nodeRect.width / 2;
  dragOffset.y = e.clientY - nodeRect.top - nodeRect.height / 2;

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);

  node.style.zIndex = '1000';
  node.style.cursor = 'grabbing';
}

// Snap grid size in percentage (roughly 50px at typical screen size)
const SNAP_GRID = 2; // 2% snap grid

function onDrag(e) {
  if (!draggedNode) return;

  const container = document.getElementById('arcraiders-tree-container');
  const containerRect = container.getBoundingClientRect();

  // Calculate new position as percentage
  const x = e.clientX - containerRect.left - dragOffset.x;
  const y = e.clientY - containerRect.top - dragOffset.y;

  let xPercent = (x / containerRect.width) * 100;
  let yPercent = (y / containerRect.height) * 100;

  // Snap to grid
  xPercent = Math.round(xPercent / SNAP_GRID) * SNAP_GRID;
  yPercent = Math.round(yPercent / SNAP_GRID) * SNAP_GRID;

  // Clamp to container bounds
  const clampedX = Math.max(2, Math.min(98, xPercent));
  const clampedY = Math.max(2, Math.min(98, yPercent));

  // Update visual position
  draggedNode.element.style.left = `${clampedX}%`;
  draggedNode.element.style.top = `${clampedY}%`;

  // Update stored position
  modifiedPositions[draggedNode.skillId] = { x: clampedX, y: clampedY };

  // Update connections in real-time
  renderConnections();
}

function endDrag() {
  if (draggedNode) {
    draggedNode.element.style.zIndex = '';
    draggedNode.element.style.cursor = '';
  }
  draggedNode = null;

  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
}

// ============ EDIT MODE FUNCTIONS ============
function setupArcEditModeControls() {
  const header = document.querySelector('.arcraiders-header');
  if (!header) return;

  // Check if controls already exist
  let controlsContainer = document.getElementById('arc-edit-controls');
  if (!controlsContainer) {
    controlsContainer = document.createElement('div');
    controlsContainer.id = 'arc-edit-controls';
    controlsContainer.className = 'arc-edit-controls';
    header.appendChild(controlsContainer);
  }

  renderArcEditControls();
}

function renderArcEditControls() {
  const controlsContainer = document.getElementById('arc-edit-controls');
  if (!controlsContainer) return;

  controlsContainer.innerHTML = `
    <button id="arc-edit-toggle" class="arcraiders-reset-btn ${arcEditMode ? 'active' : ''}" style="background: ${arcEditMode ? '#1bff7b' : '#444'}; margin-left: 10px;">
      ${arcEditMode ? 'Exit Edit Mode' : 'Edit Build'}
    </button>
    ${arcEditMode ? `
      <button id="arc-clear-btn" class="arcraiders-reset-btn" style="margin-left: 5px;">Clear</button>
      <button id="arc-export-btn" class="arcraiders-reset-btn" style="background: #ffd008; color: #000; margin-left: 5px;">Export Build</button>
    ` : ''}
  `;

  // Setup event listeners
  const toggleBtn = document.getElementById('arc-edit-toggle');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      arcEditMode = !arcEditMode;
      if (arcEditMode) {
        // Enter edit mode - copy current build
        arcEditModeBuild = { ...currentBuild };
      } else {
        // Exit edit mode - save changes
        currentBuild = { ...arcEditModeBuild };
        arcEditModeBuild = {};
      }
      renderArcEditControls();
      renderSkillTree();
    };
  }

  const clearBtn = document.getElementById('arc-clear-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      arcEditModeBuild = {};
      renderSkillTree();
      updateAllNodes();
      updatePointsDisplay();
      renderConnections();
    };
  }

  const exportBtn = document.getElementById('arc-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      exportArcBuild();
    };
  }
}

function exportArcBuild() {
  // Save current edit first
  if (arcEditMode) {
    currentBuild = { ...arcEditModeBuild };
  }

  const buildsJson = JSON.stringify(currentBuild, null, 2);

  // Create modal to show the JSON
  let modal = document.getElementById('arc-export-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'arc-export-modal';
    modal.className = 'arc-export-modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="arc-export-content">
      <h3>Arc Raiders Build Export</h3>
      <p style="color: #888; font-size: 12px;">Copy and paste this into DEFAULT_BUILD in arcraiders.js</p>
      <textarea id="arc-export-text" readonly>${buildsJson}</textarea>
      <div class="arc-export-buttons">
        <button id="arc-copy-json" class="arcraiders-reset-btn" style="background: #1bff7b; color: #000;">Copy to Clipboard</button>
        <button id="arc-close-modal" class="arcraiders-reset-btn">Close</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('arc-copy-json').onclick = () => {
    const textarea = document.getElementById('arc-export-text');
    textarea.select();
    document.execCommand('copy');
    alert('Copied to clipboard');
  };

  document.getElementById('arc-close-modal').onclick = () => {
    modal.style.display = 'none';
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initArcRaiders);
