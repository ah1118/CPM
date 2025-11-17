/* ==========================================================
   GLOBAL STATE
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
   LOAD AIRCRAFT PROFILE
========================================================== */

async function loadAircraftProfile(profile) {
    try {
        const module = await import(`./${profile}.js`);
        const ac = module.aircraft;

        activeAircraft = ac;
        containerPositions = ac.containerPositions;
        palletPositions = ac.palletPositions;
        palletBlocks = ac.palletBlocks;

        // Reverse-blocking map
        containerBlocks = {};
        for (const [pallet, list] of Object.entries(palletBlocks)) {
            list.forEach(c => {
                if (!containerBlocks[c]) containerBlocks[c] = [];
                containerBlocks[c].push(pallet);
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
   INITIALIZE APP
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

    // Default aircraft
    loadAircraftProfile("ec-nog");
});


/* ==========================================================
   BUILD THE CARGO DECK
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
    grid.className = title.includes("AFT") ? "deck-grid aft-grid" : "deck-grid";

    grid.appendChild(makeRow(cfg.akeLeft,  "ake"));
    grid.appendChild(makeRow(cfg.akeRight, "ake"));
    grid.appendChild(makeRow(cfg.pallet,   "pallet"));

    wrap.appendChild(grid);
    return wrap;
}

function makeRow(list, type) {
    const row = document.createElement("div");
    row.className = type === "ake" ? "ake-row" : "pallet-row";
    list.forEach(pos => row.appendChild(makeSlot(pos, type)));
    return row;
}

function makeSlot(pos, type) {
    const d = document.createElement("div");
    d.className = `slot ${type}`;
    d.dataset.pos = pos;
    return d;
}


/* ==========================================================
   ADD ROW IN LOAD BUILDER
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

    // Event bindings
    row.querySelector(".load-type").addEventListener("change", onLoadTypeChange);
    row.querySelector(".load-pos").addEventListener("change", onLoadUpdate);
    row.querySelector(".load-uldid").addEventListener("input", onLoadUpdate);
    row.querySelector(".delete-load").addEventListener("click", () => deleteLoad(row.dataset.loadid));

    loads.push({ id: loadCounter, type: "AKE", uldid: "", position: "" });
    loadCounter++;
}

function onLoadTypeChange(e) {
    const row = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    load.type = e.target.value;
    load.position = "";

    updatePositionDropdown(row, load.type);
    updateCargoDeck();
}

function updatePositionDropdown(row, type) {
    const s = row.querySelector(".load-pos");
    s.innerHTML = "";

    const list = (type === "AKE" || type === "AKN") ? containerPositions : palletPositions;

    s.innerHTML = `
        <option value="">--POS--</option>
        ${list.map(p => `<option value="${p}">${p}</option>`).join("")}
    `;
}


/* ==========================================================
   UPDATE LOAD ENTRY
========================================================== */

function onLoadUpdate(e) {
    const row = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    load.type = row.querySelector(".load-type").value;
    load.uldid = row.querySelector(".load-uldid").value.toUpperCase();
    load.position = row.querySelector(".load-pos").value;

    if (load.position && isPositionBlocked(load)) {
        alert(`Position ${load.position} is blocked.`);
        row.querySelector(".load-pos").value = "";
        load.position = "";
    }

    updateCargoDeck();
}


/* ==========================================================
   BLOCKING LOGIC
========================================================== */

function isPositionBlocked(load) {
    if (!load.position) return false;

    if (["PAG","PMC","PAJ"].includes(load.type)) {
        return palletBlocks[load.position]?.some(c => slotOccupied(c));
    } else {
        return containerBlocks[load.position]?.some(p => slotOccupied(p));
    }
}

function slotOccupied(pos) {
    return loads.some(l => l.position === pos && l.uldid);
}


/* ==========================================================
   UPDATE DECK
========================================================== */

function updateCargoDeck() {

    // Reset
    document.querySelectorAll(".slot").forEach(slot => {
        slot.innerHTML = "";
        slot.classList.remove("has-uld");
    });

    // Place ULDs
    for (const load of loads) {
        if (!load.position || !load.uldid) continue;

        const slot = document.querySelector(`.slot[data-pos="${load.position}"]`);
        if (!slot) continue;

        const box = document.createElement("div");
        box.className = "uld-box";
        box.textContent = load.uldid;
        box.dataset.uldType = load.type;
        box.dataset.position = load.position;

        slot.appendChild(box);
        slot.classList.add("has-uld");

        makeULDdraggable(box);
    }

    applyBlockingVisuals();
}


/* ==========================================================
   BLOCKING VISUAL RENDER
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
   PERFECT DRAGGING (NO DRIFT) — FINAL VERSION
========================================================== */

function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        e.preventDefault();

        draggingULD = box;
        box.classList.add("dragging");

        // Capture initial offset
        const rect = box.getBoundingClientRect();
        draggingULD._offX = e.clientX - rect.left;
        draggingULD._offY = e.clientY - rect.top;

        // Move to body
        document.body.appendChild(box);

        highlightSlots(box.dataset.uldType);

        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
    });


    function dragMove(e) {
        draggingULD.style.position = "fixed";
        draggingULD.style.left = `${e.clientX - draggingULD._offX}px`;
        draggingULD.style.top = `${e.clientY - draggingULD._offY}px`;
        draggingULD.style.pointerEvents = "none";
    }


    function dragEnd(e) {
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);

        draggingULD.style.pointerEvents = "auto";

        // Find nearest slot
        let nearest = null;
        let minDist = Infinity;

        document.querySelectorAll(".slot").forEach(slot => {
            const r = slot.getBoundingClientRect();
            const cx = r.left + r.width/2;
            const cy = r.top + r.height/2;

            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            const d = Math.sqrt(dx*dx + dy*dy);

            if (d < minDist) {
                minDist = d;
                nearest = slot;
            }
        });

        if (
            nearest &&
            minDist < 85 &&
            !nearest.classList.contains("disabled") &&
            isValidSlotType(draggingULD.dataset.uldType, nearest.dataset.pos)
        ) {
            moveULD(draggingULD, nearest);
        }

        resetDrag();
    }


    function resetDrag() {
        if (!draggingULD) return;

        draggingULD.style.position = "";
        draggingULD.style.left = "";
        draggingULD.style.top = "";

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
    document.querySelectorAll(".slot").forEach(s => {
        s.style.outline = "none";
        s.style.opacity = "1";
    });
}

function isValidSlotType(type, pos) {
    return pos.endsWith("P")
        ? ["PAG","PMC","PAJ"].includes(type)
        : ["AKE","AKN"].includes(type);
}


/* ==========================================================
   MOVE ULD
========================================================== */

function moveULD(box, slot) {

    const old = box.dataset.position;
    const oldSlot = document.querySelector(`.slot[data-pos="${old}"]`);
    if (oldSlot) oldSlot.classList.remove("has-uld");

    slot.appendChild(box);
    slot.classList.add("has-uld");

    const load = loads.find(l => l.uldid === box.textContent);
    if (load) load.position = slot.dataset.pos;

    box.dataset.position = slot.dataset.pos;

    updateCargoDeck();
}


/* ==========================================================
   CLEAR & EXPORT
========================================================== */

function clearAllLoads() {
    if (!confirm("Clear ALL loads?")) return;
    loads = [];
    document.getElementById("loadList").innerHTML = "";
    updateCargoDeck();
}

function exportLayout() {
    let text = `LIR EXPORT — ${activeAircraft.registration}\n\n`;

    loads.forEach(l => {
        if (l.uldid && l.position) text += `${l.position}: ${l.uldid}\n`;
    });

    document.getElementById("export-output").value = text;
    document.getElementById("exportModal").classList.remove("hidden");

    navigator.clipboard.writeText(text);
}
