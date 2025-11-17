/* ==========================================================
   EMBEDDED AIRCRAFT — EC-NOG (A330-200F)
========================================================== */

const aircraft = {

    registration: "EC-NOG",
    type: "A330-200F",

    /* --------------  LAYOUT (visual rows) -------------- */
    layout: {

        forward: {
            akeLeft:  ["26L","25L","24L","23L","22L","21L","13L","12L","11L"],
            akeRight: ["26R","25R","24R","23R","22R","21R","13R","12R","11R"],
            pallet:   ["24P","23P","22P","21P","12P","11P"]
        },

        aft: {
            akeLeft:  ["43L","42L","41L","34L","33L","32L","31L"],
            akeRight: ["43R","42R","41R","34R","33R","32R","31R"],
            pallet:   ["42P","41P","33P","32P","31P"]
        }
    },

    /* --------------  POSITION LISTS -------------- */
    containerPositions: [
        "26L","25L","24L","23L","22L","21L","13L","12L","11L",
        "26R","25R","24R","23R","22R","21R","13R","12R","11R",
        "43L","42L","41L","34L","33L","32L","31L",
        "43R","42R","41R","34R","33R","32R","31R"
    ],

    palletPositions: [
        "24P","23P","22P","21P","12P","11P",
        "42P","41P","33P","32P","31P"
    ],

    /* --------------  BLOCKING LOGIC -------------- */
    palletBlocks: {
        "24P": ["26L","26R","25L","25R"],
        "23P": ["25L","25R","24L","24R"],
        "22P": ["23L","23R","22L","22R"],
        "21P": ["22L","22R","21L","21R"],
        "12P": ["13L","13R","12L","12R"],
        "11P": ["12L","12R","11L","11R"],

        "42P": ["43L","43R","42L","42R"],
        "41P": ["42L","42R","41L","41R"],
        "33P": ["34L","34R","33L","33R"],
        "32P": ["33L","33R","32L","32R"],
        "31P": ["31L","31R"]
    }
};


/* ==========================================================
   GLOBAL STATE
========================================================== */

let loads = [];
let loadCounter = 1;
let draggingULD = null;

let containerPositions = [];
let palletPositions = [];
let palletBlocks = {};
let containerBlocks = {};



/* ==========================================================
   INITIALIZE (LOAD EC-NOG DIRECTLY)
========================================================== */

window.addEventListener("DOMContentLoaded", () => {

    // AUTO-LOAD EC-NOG (NO IMPORTS)
    loadAircraftProfile();

    document.getElementById("addLoadBtn").addEventListener("click", addLoadRow);
    document.getElementById("export-btn").addEventListener("click", exportLayout);
    document.getElementById("clear-btn").addEventListener("click", clearAllLoads);
    document.getElementById("closeModal").addEventListener("click", () => {
        document.getElementById("exportModal").classList.add("hidden");
    });
});



/* ==========================================================
   LOAD AIRCRAFT (INTERNAL)
========================================================== */

function loadAircraftProfile() {

    const ac = aircraft;

    containerPositions = ac.containerPositions;
    palletPositions = ac.palletPositions;
    palletBlocks = ac.palletBlocks;

    // Reverse block map for AKE
    containerBlocks = {};
    for (const [p, list] of Object.entries(palletBlocks)) {
        list.forEach(c => {
            if (!containerBlocks[c]) containerBlocks[c] = [];
            containerBlocks[c].push(p);
        });
    }

    renderDeck(ac.layout);
    updateCargoDeck();
}



/* ==========================================================
   RENDER DECK
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
    grid.className = name.includes("AFT") ? "deck-grid aft-grid" : "deck-grid";

    const L = document.createElement("div");
    L.className = "ake-row";
    cfg.akeLeft.forEach(p => L.appendChild(makeSlot(p, "ake")));
    grid.appendChild(L);

    const R = document.createElement("div");
    R.className = "ake-row";
    cfg.akeRight.forEach(p => R.appendChild(makeSlot(p, "ake")));
    grid.appendChild(R);

    const P = document.createElement("div");
    P.className = "pallet-row";
    cfg.pallet.forEach(p => P.appendChild(makeSlot(p, "pallet")));
    grid.appendChild(P);

    wrap.appendChild(grid);
    return wrap;
}

function makeSlot(pos, type) {
    const d = document.createElement("div");
    d.className = `slot ${type}`;
    d.dataset.pos = pos;
    return d;
}



/* ==========================================================
   SIDEBAR ROW MANAGEMENT
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

        <!-- NEW FIELD -->
        <select class="load-bulk">
            <option value="BY" selected>BY</option>
            <option value="FKT">FKT</option>
        </select>

        <select class="load-pos"></select>

        <button class="delete-load">X</button>
    `;

    list.appendChild(row);

    updatePositionDropdown(row, "AKE");

    row.querySelector(".load-type").addEventListener("change", onTypeChanged);
    row.querySelector(".load-uldid").addEventListener("input", onLoadEdited);
    row.querySelector(".load-bulk").addEventListener("change", onLoadEdited); // NEW
    row.querySelector(".load-pos").addEventListener("change", onLoadEdited);

    row.querySelector(".delete-load").addEventListener("click", () =>
        deleteLoad(row.dataset.loadid)
    );

    loads.push({ 
        id: loadCounter, 
        type: "AKE", 
        uldid: "", 
        bulk: "BY",       // NEW
        position: "" 
    });

    loadCounter++;
}


    const row = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    load.type = row.querySelector(".load-type").value;
    load.uldid = row.querySelector(".load-uldid").value.toUpperCase().trim();
    load.bulk = row.querySelector(".load-bulk").value;   // NEW
    load.position = row.querySelector(".load-pos").value;

    if (load.position && isPosBlocked(load)) {
        alert(`Position ${load.position} is blocked.`);
        row.querySelector(".load-pos").value = "";
        load.position = "";
    }

    updateCargoDeck();
}

function onTypeChanged(e) {
    const row = e.target.closest(".load-row");
    const t = e.target.value;

    const load = loads.find(l => l.id == row.dataset.loadid);
    load.type = t;
    load.position = "";

    updatePositionDropdown(row, t);
    updateCargoDeck();
}

function updatePositionDropdown(row, type) {
    const sel = row.querySelector(".load-pos");

    const list = (type === "AKE" || type === "AKN")
        ? containerPositions
        : palletPositions;

    sel.innerHTML = `
        <option value="">--POS--</option>
        ${list.map(p => `<option value="${p}">${p}</option>`).join("")}
    `;
}



/* ==========================================================
   LOAD UPDATE + BLOCKING
========================================================== */

function isPosBlocked(load) {
    if (!load.position) return false;

    if (["PAG","PMC","PAJ"].includes(load.type)) {
        return palletBlocks[load.position]?.some(c => isSlotUsed(c));
    }
    return containerBlocks[load.position]?.some(p => isSlotUsed(p));
}

function isSlotUsed(pos) {
    return loads.some(l => l.position === pos && l.uldid);
}



/* ==========================================================
   RENDER ULDs INSIDE SLOTS
========================================================== */

function updateCargoDeck() {

    document.querySelectorAll(".slot").forEach(s => {
        s.innerHTML = "";
        s.classList.remove("has-uld");
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

    document.querySelectorAll(".slot").forEach(
        s => s.classList.remove("disabled")
    );

    for (const load of loads) {
        if (!load.position) continue;

        if (["PAG","PMC","PAJ"].includes(load.type)) {
            palletBlocks[load.position]?.forEach(markDisabled);
        } else {
            containerBlocks[load.position]?.forEach(markDisabled);
        }
    }
}

function markDisabled(pos) {
    const s = document.querySelector(`.slot[data-pos="${pos}"]`);
    if (s) s.classList.add("disabled");
}



/* ==========================================================
   DRAGGING SYSTEM — PERFECT CURSOR CENTERED
========================================================== */

function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        e.preventDefault();

        draggingULD = box;

        const oldPos = box.dataset.position;

        /* ----------------------------------------------
           🔥 HARD FIX for flicker:
           Remove from slot BEFORE any DOM movement
        ---------------------------------------------- */
        const oldSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
        if (oldSlot && oldSlot.contains(box)) {
            oldSlot.removeChild(box);
            oldSlot.classList.remove("has-uld");
        }

        /* ----------------------------------------------
           Now add to BODY BEFORE positioning
        ---------------------------------------------- */
        document.body.appendChild(box);

        box.classList.add("dragging");

        // Start exactly at cursor immediately
        box.style.position = "fixed";
        box.style.left = e.clientX + "px";
        box.style.top = e.clientY + "px";
        box.style.transform = "translate(-50%, -50%)";

        highlightSlots(box.dataset.uldType);

        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
    });

    function dragMove(e) {
        draggingULD.style.left = e.clientX + "px";
        draggingULD.style.top = e.clientY + "px";
    }

    function dragEnd(e) {
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);

        if (!draggingULD) return;

        let best = null;
        let bestDist = Infinity;

        document.querySelectorAll(".slot").forEach(slot => {
            const r = slot.getBoundingClientRect();
            const cx = r.left + r.width/2;
            const cy = r.top + r.height/2;

            const d = Math.hypot(e.clientX - cx, e.clientY - cy);
            if (d < bestDist) {
                bestDist = d;
                best = slot;
            }
        });

        if (
            best &&
            bestDist < 90 &&
            isCorrectSlotType(draggingULD.dataset.uldType, best.dataset.pos) &&
            !best.classList.contains("disabled")
        ) {
            moveULD(draggingULD, best);
        }

        draggingULD.classList.remove("dragging");

        draggingULD.style.position = "";
        draggingULD.style.left = "";
        draggingULD.style.top = "";
        draggingULD.style.transform = "";

        draggingULD = null;

        clearHighlights();
        updateCargoDeck();
    }
}

/* ==========================================================
   SLOT TYPE VALIDATION
========================================================== */

function isCorrectSlotType(type, pos) {
    const isP = pos.endsWith("P");

    return (
        (["AKE","AKN"].includes(type) && !isP) ||
        (["PAG","PMC","PAJ"].includes(type) && isP)
    );
}



/* ==========================================================
   MOVE ULD TO NEW SLOT
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
}



/* ==========================================================
   HIGHLIGHT SLOTS
========================================================== */

function highlightSlots(type) {

    document.querySelectorAll(".slot").forEach(slot => {

        slot.style.outline = "none";
        slot.style.opacity = "1";

        const pos = slot.dataset.pos;
        const isP = pos.endsWith("P");

        const valid =
            (["AKE","AKN"].includes(type) && !isP) ||
            (["PAG","PMC","PAJ"].includes(type) && isP);

        if (!valid) {
            slot.style.opacity = "0.25";
            return;
        }

        if (slot.classList.contains("disabled")) {
            slot.style.opacity = "0.25";
            slot.style.outline = "2px solid red";
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



/* ==========================================================
   DELETE LOAD ROW
========================================================== */

function deleteLoad(id) {
    loads = loads.filter(l => l.id != id);
    document.querySelector(`.load-row[data-loadid="${id}"]`)?.remove();
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
   EXPORT LIR FORMAT
========================================================== */

function exportLayout() {
    let txt = `LIR EXPORT — ${aircraft.registration}\n===========================\n\n`;

    loads.forEach(l => {
        if (l.uldid && l.position)
            txt += `${l.position}: ${l.uldid}\n`;
    });

    const out = document.getElementById("export-output");
    out.value = txt;

    document.getElementById("exportModal").classList.remove("hidden");

    navigator.clipboard.writeText(txt);
}
