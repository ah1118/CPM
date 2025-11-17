/* ==========================================================
   GLOBALS
========================================================== */

let loads = [];
let loadCounter = 1;
let draggingULD = null;

let activeAircraft = null;
let containerPositions = [];
let palletPositions = [];
let palletBlocks = {};
let containerBlocks = {};


/* ==========================================================
   LOAD AIRCRAFT FROM FILE
========================================================== */

async function loadAircraftProfile(name) {
    try {
        const module = await import(`./${name}.js`);

        // YOUR aircraft files export "aircraft"
        const ac = module.aircraft;

        activeAircraft = ac;
        containerPositions = ac.containerPositions;
        palletPositions = ac.palletPositions;
        palletBlocks = ac.palletBlocks;

        // Build reverse containerBlocks
        containerBlocks = {};
        for (const [p, list] of Object.entries(palletBlocks)) {
            list.forEach(c => {
                if (!containerBlocks[c]) containerBlocks[c] = [];
                containerBlocks[c].push(p);
            });
        }

        console.log("Loaded aircraft:", ac.registration);

        renderDeck(ac.layout);
        updateCargoDeck();

    } catch (err) {
        console.error("Aircraft loading error:", err);
    }
}


/* ==========================================================
   INITIALIZE
========================================================== */

window.addEventListener("DOMContentLoaded", () => {

    document.getElementById("aircraftSelect")
        .addEventListener("change", e => loadAircraftProfile(e.target.value));

    document.getElementById("addLoadBtn").addEventListener("click", addLoadRow);

    document.getElementById("export-btn").addEventListener("click", exportLayout);
    document.getElementById("clear-btn").addEventListener("click", clearAllLoads);
    document.getElementById("closeModal").addEventListener("click", () => {
        document.getElementById("exportModal").classList.add("hidden");
    });

    loadAircraftProfile("ec-nog");
});


/* ==========================================================
   DYNAMIC DECK GENERATION
========================================================== */

function renderDeck(layout) {
    const deck = document.getElementById("deckContainer");
    deck.innerHTML = "";

    deck.appendChild(makeHoldSection("FORWARD HOLD", layout.forward));
    deck.appendChild(makeHoldSection("AFT HOLD", layout.aft));
}


function makeHoldSection(title, cfg) {

    const wrap = document.createElement("section");
    wrap.className = "hold-section";

    wrap.innerHTML = `<h2>${title}</h2>`;

    const grid = document.createElement("div");
    grid.className = (title.includes("AFT")) ? "deck-grid aft-grid" : "deck-grid";

    const leftRow = document.createElement("div");
    leftRow.className = "ake-row";
    cfg.akeLeft.forEach(pos => leftRow.appendChild(makeSlot(pos, "ake")));
    grid.appendChild(leftRow);

    const rightRow = document.createElement("div");
    rightRow.className = "ake-row";
    cfg.akeRight.forEach(pos => rightRow.appendChild(makeSlot(pos, "ake")));
    grid.appendChild(rightRow);

    const palletRow = document.createElement("div");
    palletRow.className = "pallet-row";
    cfg.pallet.forEach(pos => palletRow.appendChild(makeSlot(pos, "pallet")));
    grid.appendChild(palletRow);

    wrap.appendChild(grid);
    return wrap;
}


function makeSlot(position, type) {
    const d = document.createElement("div");
    d.className = `slot ${type}`;
    d.dataset.pos = position;
    return d;
}


/* ==========================================================
   ADD LOAD ROW
========================================================== */

function addLoadRow() {
    const list = document.getElementById("loadList");

    const row = document.createElement("div");
    row.className = "load-row";
    row.dataset.loadid = loadCounter;

    row.innerHTML = `
        <select class="load-type">
            <option value="AKE">AKE</option>
            <option value="AKN">AKN</option>
            <option value="PAG">PAG</option>
            <option value="PMC">PMC</option>
            <option value="PAJ">PAJ</option>
        </select>

        <input type="text" class="load-uldid" placeholder="ULD">

        <select class="load-pos"></select>

        <button class="delete-load">X</button>
    `;

    list.appendChild(row);

    updatePositionDropdown(row, "AKE");

    row.querySelector(".load-type").addEventListener("change", onLoadTypeChange);
    row.querySelector(".load-pos").addEventListener("change", onLoadUpdate);
    row.querySelector(".load-uldid").addEventListener("input", onLoadUpdate);
    row.querySelector(".delete-load").addEventListener("click", () => deleteLoad(row.dataset.loadid));

    loads.push({ id: loadCounter, type: "AKE", uldid: "", position: "" });
    loadCounter++;
}


function onLoadTypeChange(e) {
    const row = e.target.closest(".load-row");
    const type = e.target.value;

    const load = loads.find(l => l.id == row.dataset.loadid);
    load.type = type;
    load.position = "";

    updatePositionDropdown(row, type);
    updateCargoDeck();
}


function updatePositionDropdown(row, type) {
    const select = row.querySelector(".load-pos");
    select.innerHTML = "";

    const list = (type === "AKE" || type === "AKN") ? containerPositions : palletPositions;

    select.innerHTML = `
        <option value="">--POS--</option>
        ${list.map(p => `<option value="${p}">${p}</option>`).join("")}
    `;
}


/* ==========================================================
   LOAD UPDATE
========================================================== */

function onLoadUpdate(e) {
    const row = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    load.type = row.querySelector(".load-type").value;
    load.uldid = row.querySelector(".load-uldid").value.toUpperCase().trim();
    load.position = row.querySelector(".load-pos").value;

    if (load.position && isPositionBlocked(load)) {
        alert(`Position ${load.position} is blocked.`);
        row.querySelector(".load-pos").value = "";
        load.position = "";
    }

    updateCargoDeck();
}


/* ==========================================================
   POSITION BLOCKING
========================================================== */

function isPositionBlocked(load) {
    if (!load.position) return false;

    if (["PAG","PMC","PAJ"].includes(load.type)) {
        return palletBlocks[load.position]?.some(c => slotOccupied(c));
    } else {
        return containerBlocks[load.position]?.some(p => slotOccupied(p));
    }
}

function slotOccupied(position) {
    return loads.some(l => l.position === position && l.uldid);
}


/* ==========================================================
   RENDER SLOTS
========================================================== */

function updateCargoDeck() {

    document.querySelectorAll(".slot").forEach(slot => {
        slot.innerHTML = "";
        slot.classList.remove("has-uld");
    });

    for (const load of loads) {
        if (!load.position || !load.uldid) continue;

        const slot = document.querySelector(`.slot[data-pos="${load.position}"]`);
        if (!slot) continue;

        const box = document.createElement("div");
        box.className = "uld-box";
        box.dataset.position = load.position;
        box.dataset.uldType = load.type;
        box.textContent = load.uldid;

        slot.appendChild(box);
        slot.classList.add("has-uld");

        makeULDdraggable(box);
    }

    applyBlockingVisuals();
}


/* ==========================================================
   BLOCKING VISUALS
========================================================== */

function applyBlockingVisuals() {
    document.querySelectorAll(".slot").forEach(s => s.classList.remove("disabled"));

    for (const load of loads) {
        if (!load.position) continue;

        if (["PAG","PMC","PAJ"].includes(load.type)) {
            palletBlocks[load.position]?.forEach(disableSlot);
        } else {
            containerBlocks[load.position]?.forEach(disableSlot);
        }
    }
}

function disableSlot(pos) {
    const slot = document.querySelector(`.slot[data-pos="${pos}"]`);
    if (slot) slot.classList.add("disabled");
}


/* ==========================================================
   PERFECT DRAGGING (NO OFFSET)
========================================================== */

/* ==========================================================
   PERFECT DRAGGABLE ULD SYSTEM (FINAL VERSION)
========================================================== */
function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        e.preventDefault();

        draggingULD = box;
        box.classList.add("dragging");

        // Move to body so it's free of slot constraints
        document.body.appendChild(box);

        highlightSlots(box.dataset.uldType);

        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
    });


    /* -----------------------------
       DRAG MOVEMENT (PERFECT FOLLOW)
    ------------------------------ */
    function dragMove(e) {
        const x = e.clientX;
        const y = e.clientY;

        draggingULD.style.position = "fixed";
        draggingULD.style.left = x + "px";
        draggingULD.style.top = y + "px";

        // Center ULD under cursor
        draggingULD.style.transform = "translate(-50%, -50%)";
    }


    /* -----------------------------
       DROP HANDLING — NEAREST SLOT LOGIC (NEW)
    ------------------------------ */
    function dragEnd(e) {
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);

        if (!draggingULD) return;

        let bestSlot = null;
        let bestDist = 999999;

        document.querySelectorAll(".slot").forEach(slot => {
            const rect = slot.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < bestDist) {
                bestDist = dist;
                bestSlot = slot;
            }
        });

        // Accept drop only if cursor is close enough
        if (
            bestSlot &&
            bestDist < 90 &&  // drop radius
            isValidSlotType(draggingULD.dataset.uldType, bestSlot.dataset.pos) &&
            !bestSlot.classList.contains("disabled")
        ) {
            moveULD(draggingULD, bestSlot);
        }

        resetDrag();
    }


    /* -----------------------------
       CLEAN RESET
    ------------------------------ */
    function resetDrag() {
        if (!draggingULD) return;

        draggingULD.style.position = "relative";
        draggingULD.style.left = "0";
        draggingULD.style.top = "0";
        draggingULD.style.transform = "none";

        draggingULD.classList.remove("dragging");

        clearHighlights();

        draggingULD = null;
    }
}

/* ==========================================================
   DRAG HELPERS
========================================================== */

function highlightSlots(type) {
    document.querySelectorAll(".slot").forEach(slot => {

        const pos = slot.dataset.pos;
        const isP = pos.endsWith("P");

        const valid =
            (["AKE","AKN"].includes(type) && !isP) ||
            (["PAG","PMC","PAJ"].includes(type) && isP);

        slot.style.outline = "none";
        slot.style.opacity = valid ? "1" : "0.25";

        if (!valid) return;

        if (slot.classList.contains("disabled")) {
            slot.style.outline = "2px solid #dc2626";
            slot.style.opacity = "0.25";
            return;
        }

        if (!slot.classList.contains("has-uld")) {
            slot.style.outline = "2px solid #22c55e";
        }
    });
}

function clearHighlights() {
    document.querySelectorAll(".slot").forEach(slot => {
        slot.style.outline = "none";
        slot.style.opacity = "1";
    });
}

function isValidSlotType(uldType, pos) {
    const isP = pos.endsWith("P");

    return (
        (["AKE","AKN"].includes(uldType) && !isP) ||
        (["PAG","PMC","PAJ"].includes(uldType) && isP)
    );
}


/* ==========================================================
   MOVE ULD TO NEW SLOT
========================================================== */

function moveULD(box, targetSlot) {

    const oldPos = box.dataset.position;
    const oldSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
    if (oldSlot) oldSlot.classList.remove("has-uld");

    targetSlot.appendChild(box);
    targetSlot.classList.add("has-uld");

    const load = loads.find(l => l.uldid === box.textContent);
    if (load) load.position = targetSlot.dataset.pos;

    box.dataset.position = targetSlot.dataset.pos;

    box.style.position = "";
    box.style.left = "";
    box.style.top = "";
    box.style.transform = "";

    updateCargoDeck();
}


/* ==========================================================
   CLEAR ALL
========================================================== */

function clearAllLoads() {
    if (!confirm("Clear ALL loads?")) return;

    loads = [];
    document.getElementById("loadList").innerHTML = "";

    updateCargoDeck();
}


/* ==========================================================
   EXPORT
========================================================== */

function exportLayout() {
    let out = `LIR EXPORT — ${activeAircraft?.registration}\n===========================\n\n`;

    for (const l of loads) {
        if (l.uldid && l.position)
            out += `${l.position}: ${l.uldid}\n`;
    }

    document.getElementById("export-output").value = out;
    document.getElementById("exportModal").classList.remove("hidden");

    navigator.clipboard.writeText(out);
}
