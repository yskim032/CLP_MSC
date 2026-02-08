// --- Configuration ---
const SCENE_WIDTH = 800;
const SCENE_HEIGHT = 400;

// --- DOM Elements ---
const itemListContainer = document.getElementById('item-list-container');
const btnCalculate = document.getElementById('btn-calculate');
const btnClearAll = document.getElementById('btn-clear-all');
const count20dv = document.getElementById('count-20dv');
const count40hc = document.getElementById('count-40hc');
const count40fr = document.getElementById('count-40fr');
const visualContainerSelect = document.getElementById('visual-container-select');
const btnResetView = document.getElementById('btn-reset-view');
const containerListDisplay = document.getElementById('container-list-display');
const currentViewLabel = document.getElementById('current-view-label');

const projectNameInput = document.getElementById('project-name');
const btnSaveProject = document.getElementById('btn-save-project');
const savedProjectList = document.getElementById('saved-project-list');
// const btnLoadProject = document.getElementById('btn-load-project');
// const loadModal = document.getElementById('load-modal');
// const projectList = document.getElementById('project-list');
// const btnCloseLoad = document.getElementById('btn-close-load');

const bulkInput = document.getElementById('bulk-input');
const btnParseBulk = document.getElementById('btn-parse-bulk');

console.log("Button elements:", { bulkInput, btnParseBulk });

const toast = document.getElementById('toast');

// --- Board Elements ---
const boardNickname = document.getElementById('board-nickname');
const boardText = document.getElementById('board-text');
const boardColor = document.getElementById('board-color');
const boardFontSize = document.getElementById('board-font-size');
const boardFontWeight = document.getElementById('board-font-weight');
const boardIsRTL = document.getElementById('board-is-rtl');
const boardSpeed = document.getElementById('board-speed');
const boardIsPinned = document.getElementById('board-is-pinned');
const btnBoardSave = document.getElementById('btn-board-save');
const boardList = document.getElementById('board-list');

// --- Three.js Globals ---
let scene, camera, renderer, controls;
let containerMesh, cargoGroup;

// --- State ---
let items = [];
let calculatedResults = { res20: 0, res40hc: 0, res40fr: 0, containers: [] };
let boardEntries = [];

// Container Specs (Internal mm)
const CNTR_SPECS = {
    '20dv': { l: 5898, w: 2352, h: 2393, vol: 33200000000, label: "20' DV" },
    '40hc': { l: 12032, w: 2352, h: 2698, vol: 76400000000, label: "40' HC" },
    '40fr': { l: 11650, w: 2400, h: 3000, vol: 83880000000, label: "40' FR" } // Simplified FR as box for now
};

// Pastel Colors for auto-assignment
const PASTEL_COLORS = [
    '#FFadad', '#FFd6a5', '#Fdffb6', '#Caffbf',
    '#9bf6ff', '#A0c4ff', '#Bdb2ff', '#Ffc6ff',
    '#eae4e9', '#fff1e6', '#fde2e4', '#fad2e1'
];

// --- Initialization ---
function init() {
    initInputRows(); // Prioritize UI Rendering
    try {
        setupThreeJS();
    } catch (e) {
        console.warn("ThreeJS Init Failed:", e);
    }
    if (typeof db !== 'undefined') {
        fetchAllRecords(); // Load Board if DB available
        fetchSavedProjects(); // Load Saved Projects
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// --- Item Management (20 Rows) ---
function initInputRows() {
    itemListContainer.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        createRow(i);
    }
}

function createRow(index, data = {}) {
    const row = document.createElement('div');
    row.className = 'free-text-row';
    row.dataset.idx = index;

    // Auto color
    const color = data.color || PASTEL_COLORS[index % PASTEL_COLORS.length];

    row.innerHTML = `
        <span style="width:20px; color:var(--text-dim); font-size:0.7rem;">${index + 1}</span>
        <input type="text" class="free-text-input" placeholder="e.g. 1000x500x500 10" value="${data.text || ''}">
        <select class="item-unit item-select" style="width:60px;">
            <option value="mm" ${data.unit === 'mm' ? 'selected' : ''}>mm</option>
            <option value="cm" ${data.unit === 'cm' ? 'selected' : ''}>cm</option>
            <option value="m" ${data.unit === 'm' ? 'selected' : ''}>m</option>
        </select>
        <input type="text" class="parsed-val parsed-l" placeholder="L" readonly style="width:50px;" value="${data.l || ''}">
        <input type="text" class="parsed-val parsed-w" placeholder="W" readonly style="width:50px;" value="${data.w || ''}">
        <input type="text" class="parsed-val parsed-h" placeholder="H" readonly style="width:50px;" value="${data.h || ''}">
        <input type="text" class="parsed-val parsed-qty" placeholder="Q" readonly style="width:40px;" value="${data.qty || ''}">
        <input type="color" class="item-color item-select" style="width:40px; padding:0;" value="${color}">
        <input type="text" class="parsed-container" placeholder="-" readonly value="${data.assigned || ''}">
    `;

    // Auto-parse on blur
    const input = row.querySelector('.free-text-input');
    input.addEventListener('blur', () => parseRow(row));
    input.addEventListener('input', () => {
        // Optional: Clear parsed if text cleared
        if (!input.value) clearRowParsed(row);
    });

    itemListContainer.appendChild(row);

    // Initial parse if data exists
    if (data.text) parseRow(row);
}

function clearRowParsed(row) {
    row.querySelector('.parsed-l').value = '';
    row.querySelector('.parsed-w').value = '';
    row.querySelector('.parsed-h').value = '';
    row.querySelector('.parsed-qty').value = '';
    row.querySelector('.parsed-container').value = '';
}

function parseRow(row) {
    const text = row.querySelector('.free-text-input').value.trim();
    if (!text) return;

    // Robust parsing: convert separators to space, then split
    // Handles: 100x200x300, 2.1X3X2, 100 200 300 5
    const cleanText = text.replace(/[xX\*횞]/g, ' ');
    const parts = cleanText.split(/\s+/).filter(p => !isNaN(parseFloat(p)));

    // Expect at least 3 parts for dims.
    if (parts.length >= 3) {
        row.querySelector('.parsed-l').value = parts[0];
        row.querySelector('.parsed-w').value = parts[1];
        row.querySelector('.parsed-h').value = parts[2];
        // If 4th part exists, use as qty. Else 1.
        row.querySelector('.parsed-qty').value = parts[3] ? Math.floor(parseFloat(parts[3])) : 1;
    }
}

btnClearAll?.addEventListener('click', () => {
    if (confirm("Clear all inputs?")) {
        initInputRows();
        calculatedResults = { res20: 0, res40hc: 0, res40fr: 0, containers: [] };
        updateResultsUI();
    }
});

// --- Calculation Logic ---
function calculateContainers() {
    const rows = Array.from(itemListContainer.querySelectorAll('.free-text-row'));
    let inputItems = [];

    rows.forEach(row => {
        parseRow(row); // Ensure parsed

        const l = parseFloat(row.querySelector('.parsed-l').value) || 0;
        const w = parseFloat(row.querySelector('.parsed-w').value) || 0;
        const h = parseFloat(row.querySelector('.parsed-h').value) || 0;
        const qty = parseInt(row.querySelector('.parsed-qty').value) || 0;
        const unit = row.querySelector('.item-unit').value;
        const color = row.querySelector('.item-color').value;

        if (l > 0 && w > 0 && h > 0 && qty > 0) {
            const factor = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1;
            const dimMm = [l * factor, w * factor, h * factor];

            for (let i = 0; i < qty; i++) {
                inputItems.push({
                    id: `item-${row.dataset.idx}-${i}`,
                    rowIdx: row.dataset.idx,
                    dim: dimMm,
                    vol: dimMm[0] * dimMm[1] * dimMm[2],
                    color: color
                });
            }
        }
    });

    if (inputItems.length === 0) {
        showToast("?좑툘 No valid items found to plan.");
        return;
    }

    // Sort by Volume Desc
    inputItems.sort((a, b) => b.vol - a.vol);

    let containers = [];

    inputItems.forEach(item => {
        let placed = false;

        // Try fit existing
        for (let cntr of containers) {
            const specs = CNTR_SPECS[cntr.type];
            const fitsDims = (item.dim[0] <= specs.l && item.dim[1] <= specs.w && item.dim[2] <= specs.h);

            if (fitsDims && (cntr.usedVol + item.vol <= specs.vol * 0.95)) { // 95% Vol efficiency cap
                cntr.items.push(item);
                cntr.usedVol += item.vol;
                placed = true;
                break;
            }
        }

        if (!placed) {
            // New Container
            let type = '20dv';
            // Simple rule: If big, go big.
            if (item.dim[0] > 12032 || item.dim[1] > 2352 || item.dim[2] > 2698) type = '40fr';
            else if (item.dim[0] > 5898 || item.dim[2] > 2393) type = '40hc';

            // Check volume efficiency? If item vol > 20dv vol, obviously 40hc.
            if (item.vol > CNTR_SPECS['20dv'].vol) type = '40hc';

            const newCntrId = `${type.toUpperCase()}-${containers.filter(c => c.type === type).length + 1}`;
            containers.push({
                type: type,
                id: newCntrId,
                items: [item],
                usedVol: item.vol
            });
        }
    });

    // Results
    let res20 = 0, res40hc = 0, res40fr = 0;
    const assignmentMap = {}; // rowIdx -> Set of container IDs

    containers.forEach(c => {
        if (c.type === '20dv') res20++;
        else if (c.type === '40hc') res40hc++;
        else if (c.type === '40fr') res40fr++;

        c.items.forEach(item => {
            if (!assignmentMap[item.rowIdx]) assignmentMap[item.rowIdx] = new Set();
            assignmentMap[item.rowIdx].add(c.id);
        });
    });

    calculatedResults = { res20, res40hc, res40fr, containers };
    updateResultsUI(assignmentMap);
}

function updateResultsUI(assignmentMap = {}) {
    count20dv.textContent = calculatedResults.res20;
    count40hc.textContent = calculatedResults.res40hc;
    count40fr.textContent = calculatedResults.res40fr;

    // Update List Rows
    const rows = Array.from(itemListContainer.querySelectorAll('.free-text-row'));
    rows.forEach(row => {
        const idx = row.dataset.idx;
        const assignedInput = row.querySelector('.parsed-container');
        if (assignmentMap[idx]) {
            const list = Array.from(assignmentMap[idx]).sort();
            assignedInput.value = list.length > 2 ? `${list[0]}...` : list.join(',');
            assignedInput.title = list.join(', ');
        } else {
            assignedInput.value = '';
        }
    });

    // Update Container List Panel
    containerListDisplay.innerHTML = '';
    if (calculatedResults.containers.length === 0) {
        containerListDisplay.innerHTML = '<div class="empty-placeholder">No containers used yet.</div>';
        return;
    }

    calculatedResults.containers.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    calculatedResults.containers.forEach(c => {
        const btn = document.createElement('div');
        btn.className = 'cntr-btn';
        btn.textContent = c.id;
        btn.onclick = () => {
            document.querySelectorAll('.cntr-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderContainer(c);
        };
        containerListDisplay.appendChild(btn);
    });

    // Auto-select first container
    if (calculatedResults.containers.length > 0) {
        // Trigger click on first one
        containerListDisplay.firstElementChild.click();
    }
}

btnCalculate.addEventListener('click', calculateContainers);

// --- 3D Visualization ---
function setupThreeJS() {
    const canvasContainer = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x334155);

    camera = new THREE.PerspectiveCamera(45, canvasContainer.offsetWidth / canvasContainer.offsetHeight, 10, 50000);
    camera.position.set(8000, 5000, 8000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
    canvasContainer.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5000, 10000, 5000);
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(20000, 20);
    scene.add(gridHelper);

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = canvasContainer.offsetWidth / canvasContainer.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

btnResetView.addEventListener('click', () => {
    camera.position.set(8000, 5000, 8000);
    controls.reset();
});

function renderContainer(cntr) {
    if (containerMesh) scene.remove(containerMesh);
    if (cargoGroup) scene.remove(cargoGroup);

    currentViewLabel.textContent = `VIEWING: ${cntr.id}`;

    cargoGroup = new THREE.Group();

    const specs = CNTR_SPECS[cntr.type];
    const l = specs.l;
    const w = specs.w;
    const h = specs.h;

    // Wireframe Container
    const geometry = new THREE.BoxGeometry(l, h, w);
    const edges = new THREE.EdgesGeometry(geometry);
    containerMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    scene.add(containerMesh);

    // Render Cargo (Stacked simply along X)
    let currentX = -l / 2;

    cntr.items.forEach(item => {
        const boxL = item.dim[0];
        const boxH = item.dim[2];
        const boxW = item.dim[1]; // Swap W/H for visual? No, Y is up. H -> Y.

        const itemGeo = new THREE.BoxGeometry(boxL, boxH, boxW);
        const itemMat = new THREE.MeshLambertMaterial({ color: item.color });
        const mesh = new THREE.Mesh(itemGeo, itemMat);

        mesh.position.set(currentX + boxL / 2, -h / 2 + boxH / 2, 0);

        const border = new THREE.LineSegments(
            new THREE.EdgesGeometry(itemGeo),
            new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true })
        );
        mesh.add(border);

        cargoGroup.add(mesh);
        currentX += boxL + 20;
    });

    scene.add(cargoGroup);
}

// --- Firebase Project Save/Load ---
btnSaveProject.addEventListener('click', async () => {
    if (typeof db === 'undefined') { showToast("⚠️ Firebase not configured."); return; }

    const name = projectNameInput.value.trim();
    if (!name) { showToast("⚠️ Enter project name."); return; }

    // Gather current input state
    const rows = Array.from(itemListContainer.querySelectorAll('.free-text-row'));
    const currentItems = rows.map(row => ({
        text: row.querySelector('.free-text-input').value,
        l: row.querySelector('.parsed-l').value,
        w: row.querySelector('.parsed-w').value,
        h: row.querySelector('.parsed-h').value,
        qty: row.querySelector('.parsed-qty').value,
        unit: row.querySelector('.item-unit').value,
        color: row.querySelector('.item-color').value,
        assigned: row.querySelector('.parsed-container').value
    })); // Removed .filter(i => i.text) to save all 50 rows as requested

    const bulkText = bulkInput.value;
    const bulkUnit = document.querySelector('input[name="bulk-unit"]:checked')?.value || 'mm';

    if (currentItems.filter(i => i.text).length === 0 && !bulkText) {
        showToast("⚠️ Add items or bulk text first.");
        return;
    }

    try {
        await db.collection("clp_projects").doc(name).set({
            name: name,
            items: currentItems,
            bulkText: bulkText,
            bulkUnit: bulkUnit,
            calculatedResults: calculatedResults, // Save 3D Viz Results
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("✅ Project saved!");
    } catch (e) {
        console.error("Save Error:", e);
        showToast("❌ Save Error: " + e.message);
    }
});

// --- Real-time Saved Projects List ---
function fetchSavedProjects() {
    if (typeof db === 'undefined') return;

    db.collection("clp_projects")
        .orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            savedProjectList.innerHTML = "";
            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : 'Just now';

                const div = document.createElement('div');
                div.className = 'saved-project-item';
                div.innerHTML = `
                    <div class="project-info">
                        <span class="project-date">${date}</span>
                        <span class="project-name">${data.name}</span>
                    </div>
                    <button class="btn-small" style="padding: 2px 8px; font-size: 0.7rem;">LOAD</button>
                `;
                div.onclick = () => loadProjectFromData(data);
                savedProjectList.appendChild(div);
            });
        }, error => {
            console.error("Error fetching projects:", error);
            savedProjectList.innerHTML = "<div style='padding:10px; color:var(--text-dim)'>Error loading projects</div>";
        });
}

function loadProjectFromData(data) {
    if (!confirm(`Load project "${data.name}"? Current unsaved changes will be lost.`)) return;

    console.log("Loading project:", data);

    // RESTORE BULK INPUT
    if (data.bulkText !== undefined) bulkInput.value = data.bulkText;
    if (data.bulkUnit) {
        const radio = document.querySelector(`input[name="bulk-unit"][value="${data.bulkUnit}"]`);
        if (radio) radio.checked = true;
    }

    // RESTORE INPUT ROWS
    initInputRows();
    const rows = itemListContainer.querySelectorAll('.free-text-row');

    // Clear existing
    rows.forEach(r => {
        r.querySelector('.free-text-input').value = "";
        parseRow(r); // reset fields
    });

    if (data.items && data.items.length > 0) {
        data.items.forEach((item, idx) => {
            if (idx >= 50) return;
            const row = rows[idx];
            row.querySelector('.free-text-input').value = item.text || "";

            // Override values with saved values
            if (item.l) row.querySelector('.parsed-l').value = item.l;
            if (item.w) row.querySelector('.parsed-w').value = item.w;
            if (item.h) row.querySelector('.parsed-h').value = item.h;
            if (item.qty) row.querySelector('.parsed-qty').value = item.qty;
            if (item.unit) row.querySelector('.item-unit').value = item.unit;
            if (item.color) row.querySelector('.item-color').value = item.color;
            if (item.assigned) row.querySelector('.parsed-container').value = item.assigned;
        });
    }

    // RESTORE 3D VISUALIZATION
    if (data.calculatedResults) {
        calculatedResults = data.calculatedResults;

        // Re-generate assignment map for the list
        const assignmentMap = {};
        calculatedResults.containers.forEach(cntr => {
            cntr.items.forEach(item => {
                if (!assignmentMap[item.originalIdx]) assignmentMap[item.originalIdx] = new Set();
                assignmentMap[item.originalIdx].add(cntr.id);
            });
        });

        updateResultsUI(assignmentMap);
    }

    projectNameInput.value = data.name;
    showToast(`📂 Loaded "${data.name}"`);
}

console.log("Bulk Input Script Loaded");

if (!btnParseBulk) {
    console.error("CRITICAL: btn-parse-bulk not found!");
} else if (!bulkInput) {
    console.error("CRITICAL: bulk-input not found!");
} else {
    console.log("Attaching event listener to btnParseBulk...");
    btnParseBulk.addEventListener('click', () => {
        try {
            console.log("Parse button clicked");
            const text = bulkInput.value.trim();
            if (!text) {
                showToast("?좑툘 Please paste data first.");
                return;
            }

            const lines = text.split('\n').filter(l => l.trim() !== '');
            console.log("Lines to parse:", lines);
            if (lines.length === 0) return;

            let sourceUnit = 'mm';
            const checkedRadio = document.querySelector('input[name="bulk-unit"]:checked');
            if (checkedRadio) {
                sourceUnit = checkedRadio.value;
            } else {
                console.warn("No unit selected, defaulting to mm");
            }

            let factor = 1;
            if (sourceUnit === 'mm') factor = 0.001;
            else if (sourceUnit === 'cm') factor = 0.01;
            else if (sourceUnit === 'm') factor = 1;

            initInputRows();

            const rows = itemListContainer.querySelectorAll('.free-text-row');

            let filledCount = 0;
            lines.forEach((line, idx) => {
                if (idx >= 50) return;

                const row = rows[idx];
                const input = row.querySelector('.free-text-input');
                input.value = line.trim();
                parseRow(row);

                // Convert and Overwrite Parsed Value
                const lVal = parseFloat(row.querySelector('.parsed-l').value);
                const wVal = parseFloat(row.querySelector('.parsed-w').value);
                const hVal = parseFloat(row.querySelector('.parsed-h').value);

                if (!isNaN(lVal) && !isNaN(wVal) && !isNaN(hVal)) {
                    // Convert to meters
                    const lM = (lVal * factor).toFixed(1);
                    const wM = (wVal * factor).toFixed(1);
                    const hM = (hVal * factor).toFixed(1);

                    row.querySelector('.parsed-l').value = lM;
                    row.querySelector('.parsed-w').value = wM;
                    row.querySelector('.parsed-h').value = hM;

                    // Set Unit to 'm'
                    row.querySelector('.item-unit').value = 'm';
                }

                filledCount++;
            });

            if (lines.length > 50) {
                showToast(`⚠️ Only first 50 items loaded.`);
            } else {
                showToast(`✅ Loaded ${filledCount} items (Converted to m).`);
            }
        } catch (e) {
            console.error("Bulk Parse Error:", e);
            showToast("❌ Error: " + e.message);
        }
    });
}

// btnCloseLoad logic removed

// --- Board Logic ---
let activeReplyId = null;

async function fetchAllRecords() {
    db.collection("clp_board_messages")
        .orderBy("timestamp", "desc")
        .limit(50)
        .onSnapshot(snapshot => {
            boardEntries = [];
            snapshot.docs.forEach(doc => boardEntries.push({ ...doc.data(), id: doc.id }));
            renderBoard();
            renderTicker();
        });
}

function renderTicker() {
    const tickerTrack = document.getElementById('ticker-track');
    if (!tickerTrack) return;

    // Use latest 10 messages for ticker
    const tickerMessages = boardEntries.slice(0, 10).map(e => e.text);
    if (tickerMessages.length === 0) {
        tickerTrack.innerHTML = '<span class="ticker-item">Welcome to CLP MSC Live Board!</span>';
        return;
    }

    const content = tickerMessages.map(msg => `<span class="ticker-item">${msg}</span>`).join('');
    // Duplicate content for seamless loop
    tickerTrack.innerHTML = content + content;
}


function renderBoard() {
    // Separate parents and children
    const parents = boardEntries.filter(e => !e.parentId);
    const children = boardEntries.filter(e => e.parentId);

    // Map to group children by parentId
    const replyMap = {};
    children.forEach(c => {
        if (!replyMap[c.parentId]) replyMap[c.parentId] = [];
        replyMap[c.parentId].push(c);
    });

    boardList.innerHTML = parents.map(entry => {
        const time = entry.timestamp ? new Date(entry.timestamp.toDate()).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';

        // Dynamic style for message
        const style = `color:${entry.color || '#fff'}; font-size:${entry.fontSize || '1.1rem'}; font-weight:${entry.fontWeight || '700'};`;

        const messageContent = entry.isRTL ?
            `<marquee scrollamount="${entry.speed || 5}" behavior="scroll" direction="left" style="width:100%">${entry.text}</marquee>` :
            `<span class="static-text">${entry.text}</span>`;

        const replies = replyMap[entry.id] || [];

        // Detect "NEW" replies (within last 5 minutes)
        const hasRecentReply = replies.some(r => {
            if (!r.timestamp) return false;
            return (Date.now() - r.timestamp.toDate().getTime()) < 300000;
        });

        const replyHtml = replies.map(r => {
            const rTime = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';
            return `
                <div class="board-item is-reply" id="msg-${r.id}">
                    <div class="bubble-content">
                        <div class="bubble-header">
                            <span class="nickname">${r.nickname}</span>
                            <span class="item-time">${rTime}</span>
                        </div>
                        <div class="message-bubble">${r.text}</div>
                        <div class="bubble-footer">
                            <button class="btn-sub-action" onclick="prepareReply('${entry.id}', '${r.nickname}')">R</button>
                            <button class="btn-sub-action" onclick="deleteMessage('${r.id}')">x</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Inline Reply Form (Yellow Bubble)
        const inlineFormHtml = (activeReplyId === entry.id) ? `
            <div class="board-item is-reply inline-reply-editor">
                <div class="bubble-content">
                    <div class="bubble-header">
                        <span class="nickname">${boardNickname.value || 'Me'}</span>
                        <span class="item-time">Typing...</span>
                    </div>
                    <textarea id="inline-reply-text-${entry.id}" class="inline-reply-textarea" placeholder="Write a reply..."></textarea>
                    <div class="bubble-footer">
                        <button class="btn-sub-action active" onclick="submitInlineReply('${entry.id}')">Send</button>
                        <button class="btn-sub-action" onclick="cancelInlineReply()">Cancel</button>
                    </div>
                </div>
            </div>
        ` : '';

        const toggleIcon = (replies.length > 0 || activeReplyId === entry.id) ? (document.getElementById(`replies-${entry.id}`)?.style.display === 'none' ? '+' : '-') : '';

        return `
            <div class="board-container">
                <div class="board-item ${entry.isPinned ? 'pinned' : ''}" id="msg-${entry.id}">
                    <div class="item-header">
                        <span class="nickname">${entry.nickname.length > 15 ? entry.nickname.substring(0, 15) + '...' : entry.nickname}</span>
                        <span class="item-time">${time}</span>
                    </div>
                    
                    <div class="message-content-area">
                        ${entry.isRTL ?
                `<marquee scrollamount="${entry.speed || 5}" behavior="scroll" direction="left" style="${style}; width:100%">${entry.text}</marquee>` :
                `<div class="message-bubble" style="${style}">${entry.text}</div>`
            }
                    </div>

                    <div class="item-actions">
                        <button class="btn-item-action r" onclick="prepareReply('${entry.id}', '${entry.nickname}')">R</button>
                        <button class="btn-item-action t" id="toggle-btn-${entry.id}" onclick="toggleReplies('${entry.id}')">${toggleIcon}</button>
                        <span class="reply-count">(${replies.length})</span>
                        ${hasRecentReply ? '<span class="new-indicator">NEW</span>' : ''}
                        <button class="btn-item-action x" onclick="deleteMessage('${entry.id}')">x</button>
                    </div>
                </div>
                <div class="replies-wrapper" id="replies-${entry.id}" style="display: ${replies.length > 0 || activeReplyId === entry.id ? 'flex' : 'none'}">
                    ${replyHtml}
                    ${inlineFormHtml}
                </div>
            </div>
        `;
    }).join('');
}

window.toggleReplies = (id) => {
    const el = document.getElementById(`replies-${id}`);
    const btn = document.getElementById(`toggle-btn-${id}`);
    if (el) {
        const isHidden = el.style.display === 'none';
        el.style.display = isHidden ? 'flex' : 'none';
        if (btn) btn.textContent = isHidden ? '-' : '+';
    }
};

window.prepareReply = (id, nickname) => {
    activeReplyId = id;
    renderBoard(); // Re-render to show inline form
    setTimeout(() => {
        const area = document.getElementById(`inline-reply-text-${id}`);
        if (area) area.focus();
    }, 50);
};

window.cancelInlineReply = () => {
    activeReplyId = null;
    renderBoard();
};

window.submitInlineReply = async (parentId) => {
    const textEl = document.getElementById(`inline-reply-text-${parentId}`);
    if (!textEl || !textEl.value.trim()) return;
    if (!boardNickname.value) return showToast("⚠️ Enter nickname at the top first!");

    try {
        await db.collection("clp_board_messages").add({
            nickname: boardNickname.value,
            text: textEl.value.trim(),
            isReply: true,
            parentId: parentId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        activeReplyId = null;
        showToast("✅ Reply posted");
    } catch (e) {
        showToast("❌ Error posting reply");
    }
};

window.deleteMessage = async (id) => {
    if (!confirm("Delete this message?")) return;
    try {
        await db.collection("clp_board_messages").doc(id).delete();
        showToast("Message deleted");
    } catch (e) {
        showToast("Delete failed");
    }
};

btnBoardSave.addEventListener('click', async () => {
    if (typeof db === 'undefined') { showToast("⚠️ Firebase not configured."); return; }
    if (!boardNickname.value || !boardText.value) return showToast("⚠️ Input nickname & message");

    const isReply = boardText.value.startsWith('@') && activeReplyId;

    // Get extended controls
    const color = boardColor.value;
    const fontSize = boardFontSize.value;
    const fontWeight = boardFontWeight.value;
    const isRTL = boardIsRTL ? boardIsRTL.checked : false;
    const speed = boardSpeed ? boardSpeed.value / 10 : 5;
    const isPinned = boardIsPinned ? boardIsPinned.checked : false;

    try {
        await db.collection("clp_board_messages").add({
            nickname: boardNickname.value,
            text: boardText.value,
            isReply: !!isReply,
            parentId: activeReplyId || null,
            color: color,
            fontSize: fontSize,
            fontWeight: fontWeight,
            isRTL: isRTL,
            speed: speed,
            isPinned: isPinned,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        boardText.value = "";
        activeReplyId = null;
        showToast("✅ Message posted");
    } catch (e) {
        console.error("Board Save Error:", e);
        showToast("❌ Error posting message");
    }
});

// Setup Modal Logic
const setupModal = document.getElementById('setup-modal');


const btnCloseSetup = document.getElementById('btn-close-setup');
if (btnCloseSetup) {
    btnCloseSetup.onclick = () => setupModal && setupModal.classList.add('hidden');
}

const btnSaveSetup = document.getElementById('btn-save-setup');
if (btnSaveSetup) {
    btnSaveSetup.onclick = () => {
        const config = {
            apiKey: document.getElementById('cfg-apiKey').value,
            projectId: document.getElementById('cfg-projectId').value,
            authDomain: document.getElementById('cfg-authDomain').value,
            storageBucket: document.getElementById('cfg-storageBucket').value,
            messagingSenderId: document.getElementById('cfg-messagingSenderId').value,
            appId: document.getElementById('cfg-appId').value
        };
        localStorage.setItem('clp_msc_firebase_config', JSON.stringify(config));
        location.reload();
    };
}

init();


