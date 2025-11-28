/**
 * Dependency Graph Visualization
 *
 * Interactive graph with multiple layout algorithms:
 * - Force-Directed (physics simulation)
 * - Hierarchical (Sugiyama-style layered)
 * - Radial (importance-centered concentric)
 * - Clustered (grouped by module type)
 * - Circular (equal emphasis ring)
 * - Tree (entry-point radiating)
 */

export function generateGraphVisualizationScript(graphData: {
  nodes: { id: string; group: string; deps: number; usedBy: number }[];
  links: { source: string; target: string }[];
}): string {
  return `
    (function() {
      const graphData = ${JSON.stringify(graphData)};
      const container = document.getElementById('dependency-graph');
      const tooltip = document.getElementById('graph-tooltip');
      if (!container || graphData.nodes.length === 0) return;
      
      // ============================================
      // Configuration
      // ============================================
      const config = {
        width: container.clientWidth,
        height: 600,
        minZoom: 0.1,
        maxZoom: 4,
        nodeMinSize: 10,
        nodeMaxSize: 35,
        linkDistance: 120,
        repulsion: 8000,
        attraction: 0.008,
        damping: 0.85,
        centerGravity: 0.02,
        simulationIterations: 300
      };
      
      const groupColors = {
        core: '#58a6ff',
        tools: '#3fb950',
        config: '#d29922',
        agents: '#a371f7',
        utils: '#db61a2',
        types: '#39c5cf',
        plugins: '#f97583',
        mcp: '#79c0ff',
        logging: '#ffa657',
        quality: '#56d364',
        state: '#ff7b72',
        other: '#8b949e'
      };
      
      // ============================================
      // State
      // ============================================
      let transform = { x: 0, y: 0, k: 1 };
      let isDragging = false;
      let isPanning = false;
      let dragNode = null;
      let dragOffset = { x: 0, y: 0 };
      let panStart = { x: 0, y: 0 };
      let simulationRunning = true;
      let selectedNode = null;
      let searchQuery = '';
      let frame = 0;
      let currentLayout = 'force';
      
      // ============================================
      // Initialize Nodes & Links
      // ============================================
      const nodes = graphData.nodes.map((n, i) => {
        const angle = (i / graphData.nodes.length) * Math.PI * 2;
        const radius = Math.min(config.width, config.height) * 0.35;
        return {
        ...n,
          x: config.width/2 + Math.cos(angle) * radius * (0.5 + Math.random() * 0.5),
          y: config.height/2 + Math.sin(angle) * radius * (0.5 + Math.random() * 0.5),
          vx: 0, vy: 0,
          fx: null, fy: null,
          size: Math.min(Math.max(n.usedBy * 2 + n.deps + config.nodeMinSize, config.nodeMinSize), config.nodeMaxSize),
          layer: 0,  // For hierarchical layout
          cluster: n.group  // For clustered layout
        };
      });
      
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const links = graphData.links.map(l => ({
        source: nodeMap.get(l.source),
        target: nodeMap.get(l.target)
      })).filter(l => l.source && l.target);
      
      // Build adjacency lists for highlighting
      const outgoingLinks = new Map();
      const incomingLinks = new Map();
      nodes.forEach(n => {
        outgoingLinks.set(n.id, []);
        incomingLinks.set(n.id, []);
      });
      
      // ============================================
      // LAYOUT ALGORITHMS
      // ============================================
      
      /**
       * 1. HIERARCHICAL LAYOUT (Sugiyama-style)
       * Assigns layers based on dependency depth, then positions within layers
       */
      function applyHierarchicalLayout() {
        // Step 1: Compute layers using longest path from roots
        const inDegree = new Map();
        nodes.forEach(n => inDegree.set(n.id, 0));
        links.forEach(l => {
          inDegree.set(l.target.id, (inDegree.get(l.target.id) || 0) + 1);
        });
        
        // Find roots (nodes with no incoming edges)
        const roots = nodes.filter(n => inDegree.get(n.id) === 0);
        if (roots.length === 0) {
          // If no roots, use nodes with most outgoing links
          const sortedByOut = [...nodes].sort((a, b) => b.deps - a.deps);
          roots.push(sortedByOut[0]);
        }
        
        // BFS to assign layers
        const visited = new Set();
        const queue = roots.map(r => ({ node: r, layer: 0 }));
        roots.forEach(r => {
          r.layer = 0;
          visited.add(r.id);
        });
        
        while (queue.length > 0) {
          const { node, layer } = queue.shift();
          node.layer = Math.max(node.layer || 0, layer);
          
          // Find children (nodes this node depends on)
          const children = links
            .filter(l => l.source.id === node.id)
            .map(l => l.target);
          
          children.forEach(child => {
            child.layer = Math.max(child.layer || 0, layer + 1);
            if (!visited.has(child.id)) {
              visited.add(child.id);
              queue.push({ node: child, layer: layer + 1 });
            }
          });
        }
        
        // Handle unvisited nodes
        nodes.filter(n => !visited.has(n.id)).forEach(n => {
          n.layer = Math.max(...nodes.map(m => m.layer || 0)) + 1;
        });
        
        // Step 2: Group nodes by layer
        const layers = {};
        nodes.forEach(n => {
          if (!layers[n.layer]) layers[n.layer] = [];
          layers[n.layer].push(n);
        });
        
        // Step 3: Position nodes
        const layerKeys = Object.keys(layers).map(Number).sort((a, b) => a - b);
        const layerHeight = config.height / (layerKeys.length + 1);
        const padding = 80;
        
        layerKeys.forEach((layerNum, layerIndex) => {
          const layerNodes = layers[layerNum];
          const layerWidth = config.width - padding * 2;
          const nodeSpacing = layerWidth / (layerNodes.length + 1);
          
          layerNodes.forEach((node, nodeIndex) => {
            node.targetX = padding + nodeSpacing * (nodeIndex + 1);
            node.targetY = padding + layerHeight * (layerIndex + 0.5);
          });
        });
        
        animateToTarget(500);
      }
      
      /**
       * 2. RADIAL LAYOUT
       * Most important node in center, others in concentric rings by distance
       */
      function applyRadialLayout() {
        // Find most important node (most connections)
        const sortedByImportance = [...nodes].sort((a, b) => 
          (b.deps + b.usedBy) - (a.deps + a.usedBy)
        );
        const centerNode = sortedByImportance[0];
        
        // BFS from center to assign rings
        const visited = new Set([centerNode.id]);
        const queue = [{ node: centerNode, ring: 0 }];
        centerNode.ring = 0;
        
        while (queue.length > 0) {
          const { node, ring } = queue.shift();
          
          // Find all connected nodes (both directions)
          const connected = links
            .filter(l => l.source.id === node.id || l.target.id === node.id)
            .map(l => l.source.id === node.id ? l.target : l.source);
          
          connected.forEach(conn => {
            if (!visited.has(conn.id)) {
              visited.add(conn.id);
              conn.ring = ring + 1;
              queue.push({ node: conn, ring: ring + 1 });
            }
          });
        }
        
        // Handle disconnected nodes
        nodes.filter(n => !visited.has(n.id)).forEach(n => {
          n.ring = Math.max(...nodes.map(m => m.ring || 0)) + 1;
        });
        
        // Position nodes in rings
        const rings = {};
        nodes.forEach(n => {
          if (!rings[n.ring]) rings[n.ring] = [];
          rings[n.ring].push(n);
        });
        
        const cx = config.width / 2;
        const cy = config.height / 2;
        const maxRing = Math.max(...Object.keys(rings).map(Number));
        const ringSpacing = Math.min(config.width, config.height) / (2 * (maxRing + 2));
        
        Object.entries(rings).forEach(([ringNum, ringNodes]) => {
          const ring = Number(ringNum);
          const radius = ring === 0 ? 0 : ringSpacing * ring;
          const angleStep = (2 * Math.PI) / ringNodes.length;
          
          ringNodes.forEach((node, i) => {
            const angle = angleStep * i - Math.PI / 2;
            node.targetX = cx + Math.cos(angle) * radius;
            node.targetY = cy + Math.sin(angle) * radius;
          });
        });
        
        animateToTarget(500);
      }
      
      /**
       * 3. CLUSTERED LAYOUT
       * Groups nodes by their group/type, arranges clusters in a grid
       */
      function applyClusteredLayout() {
        // Group nodes by cluster
        const clusters = {};
        nodes.forEach(n => {
          const cluster = n.group || 'other';
          if (!clusters[cluster]) clusters[cluster] = [];
          clusters[cluster].push(n);
        });
        
        const clusterNames = Object.keys(clusters).sort();
        const numClusters = clusterNames.length;
        
        // Arrange clusters in a grid-like pattern
        const cols = Math.ceil(Math.sqrt(numClusters));
        const rows = Math.ceil(numClusters / cols);
        const cellWidth = config.width / cols;
        const cellHeight = config.height / rows;
        const padding = 40;
        
        clusterNames.forEach((clusterName, clusterIndex) => {
          const clusterNodes = clusters[clusterName];
          const col = clusterIndex % cols;
          const row = Math.floor(clusterIndex / cols);
          
          const centerX = cellWidth * (col + 0.5);
          const centerY = cellHeight * (row + 0.5);
          
          // Arrange nodes in cluster in a circle
          const clusterRadius = Math.min(cellWidth, cellHeight) / 2 - padding;
          const angleStep = (2 * Math.PI) / clusterNodes.length;
          
          clusterNodes.forEach((node, i) => {
            if (clusterNodes.length === 1) {
              node.targetX = centerX;
              node.targetY = centerY;
            } else {
              const angle = angleStep * i - Math.PI / 2;
              const radius = Math.min(clusterRadius, 30 + clusterNodes.length * 8);
              node.targetX = centerX + Math.cos(angle) * radius;
              node.targetY = centerY + Math.sin(angle) * radius;
            }
          });
        });
        
        animateToTarget(500);
      }
      
      /**
       * 4. CIRCULAR LAYOUT
       * All nodes arranged in a single circle
       */
      function applyCircularLayout() {
        // Sort nodes by group for visual clustering
        const sortedNodes = [...nodes].sort((a, b) => {
          if (a.group !== b.group) return a.group.localeCompare(b.group);
          return a.id.localeCompare(b.id);
        });
        
        const cx = config.width / 2;
        const cy = config.height / 2;
        const radius = Math.min(config.width, config.height) / 2 - 60;
        const angleStep = (2 * Math.PI) / sortedNodes.length;
        
        sortedNodes.forEach((node, i) => {
          const angle = angleStep * i - Math.PI / 2;
          node.targetX = cx + Math.cos(angle) * radius;
          node.targetY = cy + Math.sin(angle) * radius;
        });
        
        animateToTarget(500);
      }
      
      /**
       * 5. TREE LAYOUT
       * Radiates from entry points (nodes with no incoming edges)
       */
      function applyTreeLayout() {
        // Find entry points
        const hasIncoming = new Set(links.map(l => l.target.id));
        const entryPoints = nodes.filter(n => !hasIncoming.has(n.id));
        
        if (entryPoints.length === 0) {
          // Fallback: use most connected nodes
          const sorted = [...nodes].sort((a, b) => b.deps - a.deps);
          entryPoints.push(sorted[0]);
        }
        
        // Build tree structure with BFS
        const visited = new Set();
        const levels = [entryPoints];
        entryPoints.forEach(n => visited.add(n.id));
        
        while (true) {
          const currentLevel = levels[levels.length - 1];
          const nextLevel = [];
          
          currentLevel.forEach(node => {
            const children = links
              .filter(l => l.source.id === node.id && !visited.has(l.target.id))
              .map(l => l.target);
            
            children.forEach(child => {
              if (!visited.has(child.id)) {
                visited.add(child.id);
                nextLevel.push(child);
                child.parent = node;
              }
            });
          });
          
          if (nextLevel.length === 0) break;
          levels.push(nextLevel);
        }
        
        // Add unvisited nodes to last level
        const unvisited = nodes.filter(n => !visited.has(n.id));
        if (unvisited.length > 0) {
          levels.push(unvisited);
        }
        
        // Position: entry points at top, children below
        const levelHeight = config.height / (levels.length + 1);
        const padding = 50;
        
        levels.forEach((levelNodes, levelIndex) => {
          const y = padding + levelHeight * levelIndex;
          const availableWidth = config.width - padding * 2;
          const spacing = availableWidth / (levelNodes.length + 1);
          
          levelNodes.forEach((node, nodeIndex) => {
            node.targetX = padding + spacing * (nodeIndex + 1);
            node.targetY = y;
          });
        });
        
        animateToTarget(500);
      }
      
      /**
       * 6. FORCE-DIRECTED (improved physics)
       * Reset to physics simulation
       */
      function applyForceLayout() {
        // Clear fixed positions
        nodes.forEach(n => {
          n.fx = null;
          n.fy = null;
          n.vx = (Math.random() - 0.5) * 2;
          n.vy = (Math.random() - 0.5) * 2;
        });
        
        simulationRunning = true;
        frame = 0;
        tick();
      }
      
      /**
       * Animate nodes to their target positions
       */
      function animateToTarget(duration = 500) {
        simulationRunning = false;
        
        const startPositions = nodes.map(n => ({ x: n.x, y: n.y }));
        const startTime = performance.now();
        
        function step(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          
          nodes.forEach((node, i) => {
            if (node.targetX !== undefined) {
              node.x = startPositions[i].x + (node.targetX - startPositions[i].x) * ease;
              node.y = startPositions[i].y + (node.targetY - startPositions[i].y) * ease;
            }
          });
          
          updatePositions();
          
          if (progress < 1) {
            requestAnimationFrame(step);
          }
        }
        
        requestAnimationFrame(step);
      }
      
      /**
       * Apply selected layout
       */
      function applyLayout(layoutName) {
        currentLayout = layoutName;
        
        // Update button states
        document.querySelectorAll('.layout-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.layout === layoutName);
        });
        
        switch(layoutName) {
          case 'hierarchical':
            applyHierarchicalLayout();
            break;
          case 'radial':
            applyRadialLayout();
            break;
          case 'clustered':
            applyClusteredLayout();
            break;
          case 'circular':
            applyCircularLayout();
            break;
          case 'tree':
            applyTreeLayout();
            break;
          case 'force':
          default:
            applyForceLayout();
            break;
        }
      }
      links.forEach(l => {
        outgoingLinks.get(l.source.id)?.push(l.target.id);
        incomingLinks.get(l.target.id)?.push(l.source.id);
      });
      
      // ============================================
      // Create SVG Structure
      // ============================================
      container.innerHTML = '';
      container.style.position = 'relative';
      container.style.height = config.height + 'px';
      container.style.overflow = 'hidden';
      container.style.cursor = 'grab';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.display = 'block';
      
      // Defs for arrows and filters
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      
      // Arrow marker
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrow');
      marker.setAttribute('viewBox', '0 -5 10 10');
      marker.setAttribute('refX', 20);
      marker.setAttribute('refY', 0);
      marker.setAttribute('markerWidth', 6);
      marker.setAttribute('markerHeight', 6);
      marker.setAttribute('orient', 'auto');
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M0,-5L10,0L0,5');
      arrowPath.setAttribute('fill', 'var(--border-color)');
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
      
      // Highlighted arrow marker
      const markerHighlight = marker.cloneNode(true);
      markerHighlight.setAttribute('id', 'arrow-highlight');
      markerHighlight.querySelector('path').setAttribute('fill', 'var(--accent-cyan)');
      defs.appendChild(markerHighlight);
      
      // Glow filter
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', 'glow');
      filter.setAttribute('x', '-50%');
      filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '200%');
      filter.setAttribute('height', '200%');
      const feGaussian = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      feGaussian.setAttribute('stdDeviation', '3');
      feGaussian.setAttribute('result', 'coloredBlur');
      const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
      const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
      feMergeNode1.setAttribute('in', 'coloredBlur');
      const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
      feMergeNode2.setAttribute('in', 'SourceGraphic');
      feMerge.appendChild(feMergeNode1);
      feMerge.appendChild(feMergeNode2);
      filter.appendChild(feGaussian);
      filter.appendChild(feMerge);
      defs.appendChild(filter);
      
      svg.appendChild(defs);
      
      // Main group for transform
      const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      mainGroup.setAttribute('id', 'main-group');
      
      // Links group
      const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      linkGroup.setAttribute('class', 'links');
      
      // Nodes group
      const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nodeGroup.setAttribute('class', 'nodes');
      
      mainGroup.appendChild(linkGroup);
      mainGroup.appendChild(nodeGroup);
      svg.appendChild(mainGroup);
      container.appendChild(svg);
      
      // ============================================
      // Create Tooltip (enhanced)
      // ============================================
      const tooltipEl = document.createElement('div');
      tooltipEl.className = 'graph-tooltip-enhanced';
      tooltipEl.innerHTML = '<div class="tooltip-content"></div>';
      container.appendChild(tooltipEl);
      
      // ============================================
      // Create Controls Panel
      // ============================================
      const controlsHtml = \`
        <div class="graph-controls-panel">
          <div class="control-group">
            <input type="text" class="graph-search" placeholder="Search modules..." id="graph-search">
          </div>
          
          <div class="control-group layout-selector">
            <span class="control-label">Layout:</span>
            <div class="layout-buttons">
              <button class="layout-btn active" data-layout="force" title="Force-Directed: Physics simulation">
                <i data-lucide="share-2"></i>
                Force
              </button>
              <button class="layout-btn" data-layout="hierarchical" title="Hierarchical: Dependency layers top-to-bottom">
                <i data-lucide="git-branch"></i>
                Hierarchy
              </button>
              <button class="layout-btn" data-layout="radial" title="Radial: Most important node in center">
                <i data-lucide="target"></i>
                Radial
              </button>
              <button class="layout-btn" data-layout="clustered" title="Clustered: Grouped by module type">
                <i data-lucide="layout-grid"></i>
                Cluster
              </button>
              <button class="layout-btn" data-layout="circular" title="Circular: All nodes in a ring">
                <i data-lucide="circle-dot"></i>
                Circular
              </button>
              <button class="layout-btn" data-layout="tree" title="Tree: Radiating from entry points">
                <i data-lucide="network"></i>
                Tree
              </button>
            </div>
          </div>
          
          <div class="control-group control-buttons">
            <button class="graph-control-btn" id="zoom-in" title="Zoom In">
              <i data-lucide="zoom-in"></i>
            </button>
            <button class="graph-control-btn" id="zoom-out" title="Zoom Out">
              <i data-lucide="zoom-out"></i>
            </button>
            <button class="graph-control-btn" id="reset-view" title="Reset View">
              <i data-lucide="refresh-cw"></i>
            </button>
            <button class="graph-control-btn" id="toggle-sim" title="Play/Pause Simulation">
              <i data-lucide="pause"></i>
            </button>
            <button class="graph-control-btn" id="fullscreen" title="Fullscreen">
              <i data-lucide="maximize"></i>
            </button>
          </div>
          <div class="control-group zoom-indicator">
            <span id="zoom-level">100%</span>
          </div>
        </div>
      \`;
      container.insertAdjacentHTML('afterbegin', controlsHtml);
      
      // ============================================
      // Create Minimap
      // ============================================
      const minimapContainer = document.createElement('div');
      minimapContainer.className = 'graph-minimap';
      minimapContainer.innerHTML = \`
        <svg id="minimap-svg" viewBox="0 0 \${config.width} \${config.height}">
          <g id="minimap-nodes"></g>
          <rect id="minimap-viewport" fill="rgba(88, 166, 255, 0.2)" stroke="var(--accent-blue)" stroke-width="2"/>
        </svg>
      \`;
      container.appendChild(minimapContainer);
      
      const minimapSvg = minimapContainer.querySelector('#minimap-svg');
      const minimapNodes = minimapContainer.querySelector('#minimap-nodes');
      const minimapViewport = minimapContainer.querySelector('#minimap-viewport');
      
      // ============================================
      // Create Links
      // ============================================
      links.forEach(link => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('graph-link');
        line.dataset.source = link.source.id;
        line.dataset.target = link.target.id;
        line.setAttribute('marker-end', 'url(#arrow)');
        linkGroup.appendChild(line);
      });
      
      // ============================================
      // Create Nodes
      // ============================================
      nodes.forEach(node => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('graph-node');
        g.dataset.id = node.id;
        g.dataset.group = node.group;
        
        // Outer ring (for selection)
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('r', node.size + 4);
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', 'transparent');
        ring.setAttribute('stroke-width', '3');
        ring.classList.add('node-ring');
        g.appendChild(ring);
        
        // Main circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', node.size);
        circle.setAttribute('fill', groupColors[node.group] || groupColors.other);
        circle.classList.add('node-circle');
        g.appendChild(circle);
        
        // Inner badge for dep count
        if (node.deps > 0) {
          const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          badge.textContent = node.deps;
          badge.setAttribute('dy', '0.35em');
          badge.setAttribute('text-anchor', 'middle');
          badge.classList.add('node-badge');
          g.appendChild(badge);
        }
        
        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const label = node.id.split('/').pop() || node.id;
        text.textContent = label.length > 15 ? label.slice(0, 12) + '...' : label;
        text.setAttribute('dy', node.size + 14);
        text.setAttribute('text-anchor', 'middle');
        text.classList.add('node-label');
        g.appendChild(text);
        
        nodeGroup.appendChild(g);
        
        // Minimap node
        const miniNode = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        miniNode.setAttribute('r', 3);
        miniNode.setAttribute('fill', groupColors[node.group] || groupColors.other);
        miniNode.dataset.id = node.id;
        minimapNodes.appendChild(miniNode);
      });
      
      // ============================================
      // Update Functions
      // ============================================
      function updateTransform() {
        mainGroup.setAttribute('transform', 
          \`translate(\${transform.x}, \${transform.y}) scale(\${transform.k})\`);
        document.getElementById('zoom-level').textContent = Math.round(transform.k * 100) + '%';
        updateMinimap();
      }
      
      function updatePositions() {
        // Update node positions
        nodeGroup.querySelectorAll('.graph-node').forEach(g => {
          const node = nodeMap.get(g.dataset.id);
          if (node) {
            g.setAttribute('transform', \`translate(\${node.x}, \${node.y})\`);
          }
        });
        
        // Update link positions with curves
        linkGroup.querySelectorAll('.graph-link').forEach(path => {
          const source = nodeMap.get(path.dataset.source);
          const target = nodeMap.get(path.dataset.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Offset to not overlap with circles
            const sourceOffset = source.size + 2;
            const targetOffset = target.size + 8;
            
            const sx = source.x + (dx/dist) * sourceOffset;
            const sy = source.y + (dy/dist) * sourceOffset;
            const tx = target.x - (dx/dist) * targetOffset;
            const ty = target.y - (dy/dist) * targetOffset;
            
            // Slight curve
            const midX = (sx + tx) / 2;
            const midY = (sy + ty) / 2;
            const offset = Math.min(dist * 0.1, 30);
            const cx = midX - (dy/dist) * offset;
            const cy = midY + (dx/dist) * offset;
            
            path.setAttribute('d', \`M\${sx},\${sy} Q\${cx},\${cy} \${tx},\${ty}\`);
          }
        });
        
        // Update minimap
        minimapNodes.querySelectorAll('circle').forEach(c => {
          const node = nodeMap.get(c.dataset.id);
          if (node) {
            c.setAttribute('cx', node.x);
            c.setAttribute('cy', node.y);
          }
        });
      }
      
      function updateMinimap() {
        const viewWidth = config.width / transform.k;
        const viewHeight = config.height / transform.k;
        const viewX = -transform.x / transform.k;
        const viewY = -transform.y / transform.k;
        
        minimapViewport.setAttribute('x', viewX);
        minimapViewport.setAttribute('y', viewY);
        minimapViewport.setAttribute('width', viewWidth);
        minimapViewport.setAttribute('height', viewHeight);
      }
      
      // ============================================
      // Force Simulation
      // ============================================
      function simulate() {
        if (!simulationRunning) return;
        
        // Repulsion between nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            const minDist = nodes[i].size + nodes[j].size + 20;
            
            if (dist < minDist * 3) {
              const force = config.repulsion / (dist * dist);
              const fx = (dx/dist) * force;
              const fy = (dy/dist) * force;
              
              if (nodes[i].fx === null) {
                nodes[i].vx -= fx * 0.01;
                nodes[i].vy -= fy * 0.01;
              }
              if (nodes[j].fx === null) {
                nodes[j].vx += fx * 0.01;
                nodes[j].vy += fy * 0.01;
              }
            }
          }
        }
        
        // Attraction along links
        links.forEach(link => {
          if (!link.source || !link.target) return;
          const dx = link.target.x - link.source.x;
          const dy = link.target.y - link.source.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          const targetDist = config.linkDistance;
          const force = (dist - targetDist) * config.attraction;
          
          if (link.source.fx === null) {
            link.source.vx += (dx/dist) * force;
            link.source.vy += (dy/dist) * force;
          }
          if (link.target.fx === null) {
            link.target.vx -= (dx/dist) * force;
            link.target.vy -= (dy/dist) * force;
          }
        });
        
        // Center gravity & boundary
        nodes.forEach(n => {
          if (n.fx !== null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
            return;
          }
          
          n.vx += (config.width/2 - n.x) * config.centerGravity;
          n.vy += (config.height/2 - n.y) * config.centerGravity;
          
          n.vx *= config.damping;
          n.vy *= config.damping;
          
          n.x += n.vx;
          n.y += n.vy;
          
          // Soft boundaries
          const margin = 50;
          if (n.x < margin) n.vx += (margin - n.x) * 0.1;
          if (n.x > config.width - margin) n.vx -= (n.x - config.width + margin) * 0.1;
          if (n.y < margin) n.vy += (margin - n.y) * 0.1;
          if (n.y > config.height - margin) n.vy -= (n.y - config.height + margin) * 0.1;
        });
        
        updatePositions();
      }
      
      function tick() {
        simulate();
        frame++;
        if (frame < config.simulationIterations || simulationRunning) {
          requestAnimationFrame(tick);
        }
      }
      
      // ============================================
      // Event Handlers
      // ============================================
      
      // Zoom with mouse wheel
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoom = e.deltaY > 0 ? 0.9 : 1.1;
        const newK = Math.max(config.minZoom, Math.min(config.maxZoom, transform.k * zoom));
        
        // Zoom towards mouse position
        transform.x = mouseX - (mouseX - transform.x) * (newK / transform.k);
        transform.y = mouseY - (mouseY - transform.y) * (newK / transform.k);
        transform.k = newK;
        
        updateTransform();
      }, { passive: false });
      
      // Pan & Drag
      svg.addEventListener('mousedown', (e) => {
        const rect = container.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
        const mouseY = (e.clientY - rect.top - transform.y) / transform.k;
        
        // Check if clicking a node
        const clickedNode = nodes.find(n => {
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          return Math.sqrt(dx*dx + dy*dy) < n.size + 5;
        });
        
        if (clickedNode && e.button === 0) {
          isDragging = true;
          dragNode = clickedNode;
          dragNode.fx = dragNode.x;
          dragNode.fy = dragNode.y;
          dragOffset.x = mouseX - dragNode.x;
          dragOffset.y = mouseY - dragNode.y;
          container.style.cursor = 'grabbing';
        } else if (e.button === 0) {
          isPanning = true;
          panStart.x = e.clientX - transform.x;
          panStart.y = e.clientY - transform.y;
          container.style.cursor = 'grabbing';
        }
      });
      
      window.addEventListener('mousemove', (e) => {
        if (isDragging && dragNode) {
          const rect = container.getBoundingClientRect();
          const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
          const mouseY = (e.clientY - rect.top - transform.y) / transform.k;
          
          dragNode.fx = mouseX - dragOffset.x;
          dragNode.fy = mouseY - dragOffset.y;
          dragNode.x = dragNode.fx;
          dragNode.y = dragNode.fy;
          
          updatePositions();
        } else if (isPanning) {
          transform.x = e.clientX - panStart.x;
          transform.y = e.clientY - panStart.y;
          updateTransform();
        }
      });
      
      window.addEventListener('mouseup', () => {
        if (isDragging && dragNode) {
          // Keep node fixed after drag
          setTimeout(() => {
            if (dragNode) {
              dragNode.fx = null;
              dragNode.fy = null;
            }
          }, 100);
        }
        isDragging = false;
        isPanning = false;
        dragNode = null;
        container.style.cursor = 'grab';
      });
      
      // Node interactions
      nodeGroup.querySelectorAll('.graph-node').forEach(g => {
          const node = nodeMap.get(g.dataset.id);
        
        g.addEventListener('mouseenter', (e) => {
          if (isDragging) return;
          
          // Show tooltip
          const rect = container.getBoundingClientRect();
          const deps = outgoingLinks.get(node.id) || [];
          const usedBy = incomingLinks.get(node.id) || [];
          
          tooltipEl.querySelector('.tooltip-content').innerHTML = \`
            <div class="tooltip-header">
              <span class="tooltip-dot" style="background: \${groupColors[node.group] || groupColors.other}"></span>
              <strong>\${node.id}</strong>
            </div>
            <div class="tooltip-stats">
              <div class="tooltip-stat">
                <span class="stat-label">Dependencies</span>
                <span class="stat-value">\${node.deps}</span>
              </div>
              <div class="tooltip-stat">
                <span class="stat-label">Used by</span>
                <span class="stat-value">\${node.usedBy}</span>
              </div>
              <div class="tooltip-stat">
                <span class="stat-label">Group</span>
                <span class="stat-value">\${node.group}</span>
              </div>
            </div>
            \${deps.length > 0 ? \`
              <div class="tooltip-deps">
                <small>Depends on:</small>
                <div class="dep-list">\${deps.slice(0, 5).map(d => \`<span>\${d.split('/').pop()}</span>\`).join('')}\${deps.length > 5 ? \`<span>+\${deps.length - 5} more</span>\` : ''}</div>
              </div>
            \` : ''}
          \`;
          
          tooltipEl.classList.add('visible');
          tooltipEl.style.left = (e.clientX - rect.left + 15) + 'px';
          tooltipEl.style.top = (e.clientY - rect.top - 10) + 'px';
          
          // Highlight connected
          highlightConnections(node.id);
        });
        
        g.addEventListener('mouseleave', () => {
          if (isDragging) return;
          tooltipEl.classList.remove('visible');
          if (!selectedNode) clearHighlights();
        });
        
        g.addEventListener('click', (e) => {
          e.stopPropagation();
          if (selectedNode === node) {
            selectedNode = null;
            clearHighlights();
            g.classList.remove('selected');
          } else {
            nodeGroup.querySelectorAll('.graph-node').forEach(n => n.classList.remove('selected'));
            selectedNode = node;
            g.classList.add('selected');
            highlightConnections(node.id);
            
            // Center on node
            const targetX = config.width/2 - node.x * transform.k;
            const targetY = config.height/2 - node.y * transform.k;
            animateTransform(targetX, targetY, transform.k);
          }
        });
        
        g.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          // Zoom to node
          const targetK = 1.5;
          const targetX = config.width/2 - node.x * targetK;
          const targetY = config.height/2 - node.y * targetK;
          animateTransform(targetX, targetY, targetK);
        });
      });
      
      // Click on background to deselect
      svg.addEventListener('click', () => {
        if (!isDragging && !isPanning) {
          selectedNode = null;
          clearHighlights();
          nodeGroup.querySelectorAll('.graph-node').forEach(n => n.classList.remove('selected'));
        }
      });
      
      // ============================================
      // Highlighting Functions
      // ============================================
      function highlightConnections(nodeId) {
        const deps = outgoingLinks.get(nodeId) || [];
        const usedBy = incomingLinks.get(nodeId) || [];
        const connected = new Set([nodeId, ...deps, ...usedBy]);
        
        nodeGroup.querySelectorAll('.graph-node').forEach(g => {
          if (connected.has(g.dataset.id)) {
            g.classList.add('highlighted');
            g.classList.remove('dimmed');
          } else {
            g.classList.remove('highlighted');
            g.classList.add('dimmed');
          }
        });
        
        linkGroup.querySelectorAll('.graph-link').forEach(l => {
          if (l.dataset.source === nodeId || l.dataset.target === nodeId) {
            l.classList.add('highlighted');
            l.setAttribute('marker-end', 'url(#arrow-highlight)');
          } else {
            l.classList.remove('highlighted');
            l.classList.add('dimmed');
            l.setAttribute('marker-end', 'url(#arrow)');
          }
        });
      }
      
      function clearHighlights() {
        nodeGroup.querySelectorAll('.graph-node').forEach(g => {
          g.classList.remove('highlighted', 'dimmed');
        });
        linkGroup.querySelectorAll('.graph-link').forEach(l => {
          l.classList.remove('highlighted', 'dimmed');
          l.setAttribute('marker-end', 'url(#arrow)');
        });
      }
      
      // ============================================
      // Animation Helper
      // ============================================
      function animateTransform(targetX, targetY, targetK, duration = 300) {
        const startX = transform.x;
        const startY = transform.y;
        const startK = transform.k;
        const startTime = performance.now();
        
        function step(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          
          transform.x = startX + (targetX - startX) * ease;
          transform.y = startY + (targetY - startY) * ease;
          transform.k = startK + (targetK - startK) * ease;
          
          updateTransform();
          
          if (progress < 1) requestAnimationFrame(step);
        }
        
        requestAnimationFrame(step);
      }
      
      // ============================================
      // Search
      // ============================================
      const searchInput = document.getElementById('graph-search');
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        
        if (!searchQuery) {
          clearHighlights();
          return;
        }
        
        const matches = nodes.filter(n => n.id.toLowerCase().includes(searchQuery));
        
        if (matches.length === 0) {
          clearHighlights();
          return;
        }
        
        const matchIds = new Set(matches.map(n => n.id));
        
        nodeGroup.querySelectorAll('.graph-node').forEach(g => {
          if (matchIds.has(g.dataset.id)) {
            g.classList.add('search-match');
            g.classList.remove('dimmed');
          } else {
            g.classList.remove('search-match');
            g.classList.add('dimmed');
          }
        });
        
        // Center on first match
        if (matches.length === 1) {
          const node = matches[0];
          const targetX = config.width/2 - node.x * transform.k;
          const targetY = config.height/2 - node.y * transform.k;
          animateTransform(targetX, targetY, transform.k);
        }
      });
      
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          searchQuery = '';
          clearHighlights();
          nodeGroup.querySelectorAll('.graph-node').forEach(g => g.classList.remove('search-match'));
        }
      });
      
      // ============================================
      // Control Buttons
      // ============================================
      document.getElementById('zoom-in').addEventListener('click', () => {
        transform.k = Math.min(config.maxZoom, transform.k * 1.3);
        updateTransform();
      });
      
      document.getElementById('zoom-out').addEventListener('click', () => {
        transform.k = Math.max(config.minZoom, transform.k / 1.3);
        updateTransform();
      });
      
      document.getElementById('reset-view').addEventListener('click', () => {
        animateTransform(0, 0, 1);
        selectedNode = null;
        clearHighlights();
        searchInput.value = '';
        searchQuery = '';
        nodeGroup.querySelectorAll('.graph-node').forEach(g => {
          g.classList.remove('selected', 'search-match');
        });
      });
      
      document.getElementById('toggle-sim').addEventListener('click', function() {
        simulationRunning = !simulationRunning;
        this.innerHTML = simulationRunning
          ? '<i data-lucide="pause"></i>'
          : '<i data-lucide="play"></i>';
        lucide.createIcons();
        if (simulationRunning) tick();
      });
      
      document.getElementById('fullscreen').addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          container.requestFullscreen();
        }
      });
      
      // ============================================
      // Layout Buttons
      // ============================================
      document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const layout = btn.dataset.layout;
          applyLayout(layout);
        });
      });
      
      // ============================================
      // Filter Buttons (existing)
      // ============================================
      document.querySelectorAll('.graph-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.graph-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter;
          
          if (filter === 'all') {
            nodeGroup.querySelectorAll('.graph-node').forEach(g => {
              g.style.opacity = '1';
              g.style.pointerEvents = 'auto';
            });
            linkGroup.querySelectorAll('.graph-link').forEach(l => {
              l.style.opacity = '1';
            });
            } else {
            const visibleNodes = new Set();
            nodeGroup.querySelectorAll('.graph-node').forEach(g => {
              if (g.dataset.group === filter) {
                g.style.opacity = '1';
                g.style.pointerEvents = 'auto';
                visibleNodes.add(g.dataset.id);
              } else {
                g.style.opacity = '0.15';
                g.style.pointerEvents = 'none';
              }
            });
            linkGroup.querySelectorAll('.graph-link').forEach(l => {
              if (visibleNodes.has(l.dataset.source) || visibleNodes.has(l.dataset.target)) {
                l.style.opacity = '0.5';
              } else {
                l.style.opacity = '0.05';
              }
            });
          }
        });
      });
      
      // ============================================
      // Minimap Click Navigation
      // ============================================
      minimapContainer.addEventListener('click', (e) => {
        const rect = minimapContainer.getBoundingClientRect();
        const svgRect = minimapSvg.getBoundingClientRect();
        const scaleX = config.width / svgRect.width;
        const scaleY = config.height / svgRect.height;
        
        const clickX = (e.clientX - svgRect.left) * scaleX;
        const clickY = (e.clientY - svgRect.top) * scaleY;
        
        const targetX = config.width/2 - clickX * transform.k;
        const targetY = config.height/2 - clickY * transform.k;
        
        animateTransform(targetX, targetY, transform.k);
      });
      
      // ============================================
      // Keyboard Shortcuts
      // ============================================
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.key) {
          case '+':
          case '=':
            transform.k = Math.min(config.maxZoom, transform.k * 1.2);
            updateTransform();
            break;
          case '-':
            transform.k = Math.max(config.minZoom, transform.k / 1.2);
            updateTransform();
            break;
          case '0':
            animateTransform(0, 0, 1);
            break;
          case '/':
            e.preventDefault();
            searchInput.focus();
            break;
          case 'Escape':
            selectedNode = null;
            clearHighlights();
            nodeGroup.querySelectorAll('.graph-node').forEach(g => g.classList.remove('selected'));
            break;
        }
      });
      
      // ============================================
      // Initialize
      // ============================================
      updateTransform();
      tick();
      
      // Initialize Lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      // Resize handler
      window.addEventListener('resize', () => {
        config.width = container.clientWidth;
        minimapSvg.setAttribute('viewBox', \`0 0 \${config.width} \${config.height}\`);
        updateMinimap();
      });
      
    })();
  `;
}
