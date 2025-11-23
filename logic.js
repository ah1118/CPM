/* ==========================================================
   GLOBAL STATE
========================================================== */

var loads = [];
var loadCounter = 1;

var containerPositions = [];
var palletPositions = [];
var palletBlocks = {};
var containerBlocks = {};

var draggingULD = null;
var isDragging = false;


/* ==========================================================
   ENABLE MAIN APP BUTTONS
========================================================== */

function enableAppButtons() {
    document.getElementById("addLoadBtn").addEventListener("click", addLoadRow);
    document.getElementById("export-btn").addEventListener("click", exportLayout);
    document.getElementById("clear-btn").addEventListener("click", clearAllLoads);
    document.getElementById("closeModal").addEventListener("click", () =>
        document.getElementById("exportModal").classList.add("hidden")
    );
}


/* ==========================================================
   LOAD AIRCRAFT PROFILE
========================================================== */

function loadAircraftProfile() {

    // Aircraft data from aircraft-ECNOG.js
    containerPositions = aircraft.containerPositions;
    palletPositions = aircraft.palletPositions;
    palletBlocks = aircraft.palletBlocks;

    // Reverse mapping for container → what pallet blocks it
    containerBlocks = {};
    Object.entries(palletBlocks).forEach(([pal, blockedList]) => {
        blockedList.forEach(c => {
            if (!containerBlocks[c]) containerBlocks[c] = [];
            containerBlocks[c].push(pal);
        });
    });

    // Build UI
    renderDeck(aircraft.layout);
    updateCargoDeck();
}


/* ==========================================================
   HELPERS
========================================================== */

function makeSlot(pos, type) {
    const d = document.createElement("div");
    d.className = `slot ${type}`;
    d.dataset.pos = pos;
    return d;
}

function isCorrectSlotType(type, pos) {
    const isPallet = pos.endsWith("P");
    const isBulk = ["51","52","53"].includes(pos);

    if (type === "BLK") return isBulk;
    if (["AKE","AKN"].includes(type)) return !isPallet && !isBulk;
    if (["PAG","PMC","PAJ"].includes(type)) return isPallet;

    return false;
}

function markDisabled(pos) {
    const slot = document.querySelector(`.slot[data-pos="${pos}"]`);
    if (slot) slot.classList.add("disabled");
}


/* ==========================================================
   RENDER CARGO DECK
========================================================== */

function renderDeck(layout) {
    const deck = document.getElementById("deckContainer");
    deck.innerHTML = "";

    deck.appendChild(makeHoldSection("FORWARD HOLD", layout.forward));
    deck.appendChild(makeHoldSection("AFT HOLD", layout.aft));
}

function makeHoldSection(name, cfg) {
    const wrap = document.createElement("section");
    wrap.className = "hold-section";
    wrap.innerHTML = `<h2>${name}</h2>`;

    const grid = document.createElement("div");
    grid.className = name.includes("AFT") ? "aft-grid-wrapper" : "deck-grid";

    // ========== AFT HOLD (with bulk) ==========
    if (name.includes("AFT")) {

        const leftCol = document.createElement("div");
        leftCol.className = "aft-left-col";

        const bulkColumn = document.createElement("div");
        bulkColumn.className = "bulk-column";

        ["53", "52", "51"].forEach(pos => {
            const d = document.createElement("div");
            d.className = `slot bulk-slot ${pos === "53" ? "bulk-53" : "bulk-small"}`;
            d.dataset.pos = pos;
            d.textContent = pos;

            if (pos === "53") bulkColumn.appendChild(d);
            else {
                if (!bulkColumn.smallStack) {
                    bulkColumn.smallStack = document.createElement("div");
                    bulkColumn.smallStack.className = "bulk-small-stack";
                    bulkColumn.appendChild(bulkColumn.smallStack);
                }
                bulkColumn.smallStack.appendChild(d);
            }
        });

        leftCol.appendChild(bulkColumn);

        const rightCol = document.createElement("div");
        rightCol.className = "aft-right-col";

        const L = document.createElement("div");
        L.className = "ake-row";
        cfg.akeLeft.forEach(p => L.appendChild(makeSlot(p, "ake")));
        rightCol.appendChild(L);

        const R = document.createElement("div");
        R.className = "ake-row";
        cfg.akeRight.forEach(p => R.appendChild(makeSlot(p, "ake")));
        rightCol.appendChild(R);

        const P = document.createElement("div");
        P.className = "pallet-row";
        cfg.pallet.forEach(p => P.appendChild(makeSlot(p, "pallet")));
        rightCol.appendChild(P);

        grid.appendChild(leftCol);
        grid.appendChild(rightCol);
    }

    // ========== FORWARD HOLD ==========
    else {
        const gridFwd = grid;

        const L = document.createElement("div");
        L.className = "ake-row";
        cfg.akeLeft.forEach(p => L.appendChild(makeSlot(p, "ake")));
        gridFwd.appendChild(L);

        const R = document.createElement("div");
        R.className = "ake-row";
        cfg.akeRight.forEach(p => R.appendChild(makeSlot(p, "ake")));
        gridFwd.appendChild(R);

        const P = document.createElement("div");
        P.className = "pallet-row";
        cfg.pallet.forEach(p => P.appendChild(makeSlot(p, "pallet")));
        gridFwd.appendChild(P);
    }

    wrap.appendChild(grid);
    return wrap;
}


/* ==========================================================
   LOAD ROWS (LEFT SIDEBAR)
========================================================== */

function addLoadRow() {
    const list = document.getElementById("loadList");

    const row = document.createElement("div");
    row.className = "load-row";
    row.dataset.loadid = loadCounter;

    row.innerHTML = `
        <div class="cell">
            <select class="load-type">
                <option value="AKE">AKE</option>
                <option value="AKN">AKN</option>
                <option value="BLK">BLK</option>
                <option value="PAG">PAG</option>
                <option value="PMC">PMC</option>
                <option value="PAJ">PAJ</option>
            </select>
        </div>

        <div class="cell">
            <input type="text" class="load-uldid" placeholder="ULD ID">
        </div>

        <div class="cell">
            <select class="load-bulk">
                <option value="BY">BY</option>
                <option value="FKT">FKT</option>
            </select>
        </div>

        <div class="cell">
            <input type="number" class="load-weight" placeholder="KG" min="0">
        </div>

        <div class="cell">
            <select class="load-pos"></select>
        </div>

        <div class="cell">
            <button class="drag-load" title="Drag to deck" style="cursor:grab;">⠿</button>
        </div>
        <div class="cell">
            <button class="delete-load">X</button>
        </div>
    `;

    list.appendChild(row);

    // store in data
    loads.push({
        id: loadCounter,
        type: "AKE",
        uldid: "",
        weight: 0,
        bulk: "BY",
        position: ""
    });
    loadCounter++;

    updatePositionDropdown(row, "AKE");

    // --------------------------
    // ⭐⭐ NEW (REBUILD POS LIST BEFORE OPEN)
    // --------------------------
    const posSelect = row.querySelector(".load-pos");
    posSelect.addEventListener("mousedown", () => {
        const loadId = row.dataset.loadid;
        const loadObj = loads.find(l => l.id == loadId);
        rebuildPosOptions(posSelect, loadObj.type, loadObj.position);
    });
    // --------------------------

    row.querySelector(".load-type").addEventListener("change", onTypeChanged);
    row.querySelector(".load-uldid").addEventListener("input", onLoadEdited);
    row.querySelector(".load-bulk").addEventListener("change", onLoadEdited);
    row.querySelector(".load-weight").addEventListener("input", onLoadEdited);
    row.querySelector(".load-pos").addEventListener("change", onLoadEdited);

    row.querySelector(".delete-load").addEventListener("click", () =>
        deleteLoad(row.dataset.loadid)
    );

    // ⭐ Drag button
    row.querySelector(".drag-load").addEventListener("mousedown", function(e) {
        startSidebarULDdrag(row.dataset.loadid, row);
        e.preventDefault();
    });
}



function deleteLoad(id) {
    loads = loads.filter(l => l.id != id);
    document.querySelector(`.load-row[data-loadid="${id}"]`).remove();
    updateCargoDeck();
}


function onTypeChanged(e) {
    const row = e.target.closest(".load-row");
    const type = e.target.value;

    const load = loads.find(l => l.id == row.dataset.loadid);
    load.type = type;
    load.position = "";

    const descField = row.querySelector(".load-uldid");

    if (type === "BLK") {
        descField.disabled = true;
        descField.value = "";
        descField.placeholder = "DESC";
    } else {
        descField.disabled = false;
        descField.placeholder = "ULD ID";
    }

    updatePositionDropdown(row, type);
    updateCargoDeck();

    // ⭐ IMPORTANT — re-check duplicates after type change
    checkDuplicateULDIDs();
}



function getBlockedPositionsForUI(currentLoadId) {
    const blocked = new Set();

    // 1A — pallet loaded → block AKEs
    for (const pallet in palletBlocks) {
        const load = loads.find(l => l.position === pallet && l.uldid);
        if (load) {
            for (const pos of palletBlocks[pallet]) {
                blocked.add(pos);
            }
        }
    }

    // 1B — AKE loaded → block its parent pallet(s)
    for (const pallet in palletBlocks) {
        for (const pos of palletBlocks[pallet]) {
            const load = loads.find(l => l.position === pos && l.uldid);
            if (load) {
                blocked.add(pallet);
                break;
            }
        }
    }

    // 1C — already occupied positions must be excluded  
    for (const l of loads) {
        if (!l.position) continue;

        // IMPORTANT:
        // don't block the position if it belongs to the current load row
        if (l.id == currentLoadId) continue;

        blocked.add(l.position);
    }

    return blocked;
}


function updatePositionDropdown(row, type) {
    const sel = row.querySelector(".load-pos");
    const loadId = parseInt(row.dataset.loadid);

    let list;
    if (type === "BLK") list = ["51","52","53"];
    else if (type === "AKE" || type === "AKN") list = containerPositions;
    else list = palletPositions;

    // Compute dynamic blocked list
    const blocked = getBlockedPositionsForUI(loadId);

    // Keep the current selected position if it exists
    const currentPos = sel.value;

    sel.innerHTML = `
        <option value="">POS</option>
        ${list
            .filter(p => !blocked.has(p) || p === currentPos)
            .map(p => `<option value="${p}">${p}</option>`)
            .join("")}
    `;

    // restore current selection
    if (currentPos && !blocked.has(currentPos)) {
        sel.value = currentPos;
    }
}



function onLoadEdited(e) {
    const row  = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    const oldPos = load.position;

    // update fields
    load.type   = row.querySelector(".load-type").value;
    load.uldid  = row.querySelector(".load-uldid").value.toUpperCase().trim();
    load.bulk   = row.querySelector(".load-bulk").value;
    load.weight = parseInt(row.querySelector(".load-weight").value || "0");
    load.position = row.querySelector(".load-pos").value;

    // ============================
    //  ⭐ FKT SPECIAL CASE
    // ============================
    const weightField = row.querySelector(".load-weight");

    if (load.bulk === "FKT") {
        weightField.disabled = true;
        weightField.value = "";
        load.weight = 0;
    } else {
        weightField.disabled = false;
    }

    // BLK validation
    if (e.target.classList.contains("load-pos")) {
        if (load.type === "BLK" && !["51","52","53"].includes(load.position)) {
            alert("BLK must be placed ONLY in 51 • 52 • 53.");
            load.position = oldPos;
            row.querySelector(".load-pos").value = oldPos;
            return;
        }

        if (load.position && isPosBlocked(load)) {
            alert(`Position ${load.position} is blocked.`);
            load.position = oldPos;
            row.querySelector(".load-pos").value = oldPos;
            return;
        }
    }

    checkDuplicateULDIDs();
    updateCargoDeck();
    toggleExportButton();
}


function toggleExportButton() {
    const btn = document.getElementById("export-btn");
    if (allLoadsValid()) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.4";
        btn.style.cursor = "not-allowed";
    }
}


function checkDuplicateULDIDs() {
    const used = {};
    const duplicates = new Set();

    // Build combined-key duplicates
    loads.forEach(l => {
        if (!l.uldid) return;

        const key = `${l.type}_${l.uldid}`;

        if (used[key]) duplicates.add(key);
        used[key] = true;
    });

    // Highlight in UI
    document.querySelectorAll(".load-row").forEach(row => {
        const type = row.querySelector(".load-type").value;
        const id   = row.querySelector(".load-uldid").value.trim().toUpperCase();
        const inp  = row.querySelector(".load-uldid");

        const key = `${type}_${id}`;

        // UPDATED LINE: no duplicate highlight if ID is empty
        if (id && duplicates.has(key)) {
            inp.style.border = "2px solid #ff3333";
            inp.style.backgroundColor = "rgba(255,0,0,0.12)";
        } else {
            inp.style.border = "";
            inp.style.backgroundColor = "";
        }
    });

    return duplicates.size > 0;
}






/* ==========================================================
   UPDATE CARGO DECK
========================================================== */

function updateCargoDeck() {
    document.querySelectorAll(".slot").forEach(s => {
        s.innerHTML = "";
        s.classList.remove("has-uld");
    });

    for (const load of loads) {
        if (!load.position) continue;

        const slot = document.querySelector(`.slot[data-pos="${load.position}"]`);
        if (!slot) continue;

        const box = document.createElement("div");
        box.className = "uld-box";
        box.dataset.position = load.position;
        box.dataset.loadId = load.id;
        box.dataset.uldType = load.type;

        if (load.type === "BLK") {
            const weightTxt = load.weight ? `${load.weight} KG` : "";
            box.innerHTML = load.bulk + (weightTxt ? "<br>" + weightTxt : "");
        } else {
            const label = load.uldid || load.type;  // use ULDID if present, otherwise AKE/PAG/...
            const weightTxt = load.weight ? `${load.weight} KG` : "";
            box.innerHTML = label + (weightTxt ? "<br>" + weightTxt : "");
        }

        slot.appendChild(box);
        slot.classList.add("has-uld");

        makeULDdraggable(box); // <-- comes from dragdrop.js
    }

    if (!isDragging) applyBlockingVisuals(); // from dragdrop.js
}

function startSidebarULDdrag(loadId, rowEl) {
    // 1. Find the load object
    const load = loads.find(l => l.id == loadId);
    if (!load) return;

    // 2. Create a drag box visually
    const box = document.createElement("div");
    box.className = "uld-box dragging";
    box.textContent = (load.uldid ? load.uldid : load.type) + (load.weight ? "\n" + load.weight + " KG" : "");
    box.dataset.loadId = load.id;
    box.dataset.uldType = load.type;
    box.style.position = "fixed";
    box.style.left = "-9999px";
    document.body.appendChild(box);

    draggingULD = box;
    isDragging = true;

    highlightSlots(load.type);

    function onMove(e) {
        draggingULD.style.left = e.clientX + "px";
        draggingULD.style.top = e.clientY + "px";
        draggingULD.style.transform = "translate(-50%, -50%)";
    }

    function onUp(e) {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        // Try to drop on deck slot
        let best = null, bestDist = Infinity;
        document.querySelectorAll(".slot").forEach(slot => {
            const r = slot.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const d = Math.hypot(e.clientX - cx, e.clientY - cy);
            if (d < bestDist) bestDist = d, best = slot;
        });

        if (
            best &&
            bestDist < 90 &&
            isCorrectSlotType(load.type, best.dataset.pos) &&
            !best.classList.contains("disabled")
        ) {
            // Assign ULD to that position
            load.position = best.dataset.pos;
            // Remove sidebar row
            // Redraw deck
            updateCargoDeck();
            applyBlockingVisuals();
        }
        // Remove ghost box in any case
        if (draggingULD) draggingULD.remove();
        draggingULD = null;
        isDragging = false;
        clearHighlights();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}

// AUTO-UPPERCASE for all ULD ID inputs
document.addEventListener("input", function (e) {
    if (e.target.classList.contains("load-uldid")) {
        e.target.value = e.target.value.toUpperCase();
    }
});

function allLoadsValid() {
    for (const l of loads) {

        // FKT loads – need only position
        if (l.bulk === "FKT") {
            if (!l.position) return false;
            continue;
        }

        // BLK loads – must have weight + position
        if (l.type === "BLK") {
            if (!l.position) return false;
            if (!l.weight || l.weight <= 0) return false;
            continue;
        }

        // ULD loads (AKE/AKN/PAG/PMC/PAJ)
        // NEW RULE: ID and WEIGHT are OPTIONAL
        if (!l.position) return false;
    }

    return true;
}
