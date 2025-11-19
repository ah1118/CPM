/* ==========================================================
   AIRCRAFT — EC-NOG (A330-200F)
========================================================== */

const aircraft = {
    registration: "EC-NOG",
    type: "A330-200F",

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

    containerPositions: [
        "26L","25L","24L","23L","22L","21L","13L","12L","11L",
        "26R","25R","24R","23R","22R","21R","13R","12R","11R",
        "43L","42L","41L","34L","33L","32L","31L",
        "43R","42R","41R","34L","33L","32L","31L"
    ],

    palletPositions: [
        "24P","23P","22P","21P","12P","11P",
        "42P","41P","33P","32P","31P"
    ],

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

let containerPositions = [];
let palletPositions = [];
let palletBlocks = {};
let containerBlocks = {};

let draggingULD = null;


/* ==========================================================
   INITIALIZE
========================================================== */

window.addEventListener("DOMContentLoaded", () => {
    loadAircraftProfile();

    document.getElementById("addLoadBtn").addEventListener("click", addLoadRow);
    document.getElementById("export-btn").addEventListener("click", exportLayout);
    document.getElementById("clear-btn").addEventListener("click", clearAllLoads);
    document.getElementById("closeModal").addEventListener("click", () =>
        document.getElementById("exportModal").classList.add("hidden")
    );
});


/* ==========================================================
   LOAD AIRCRAFT
========================================================== */

function loadAircraftProfile() {
    containerPositions = aircraft.containerPositions;
    palletPositions = aircraft.palletPositions;
    palletBlocks = aircraft.palletBlocks;

    containerBlocks = {};
    for (const [p, list] of Object.entries(palletBlocks)) {
        list.forEach(c => {
            if (!containerBlocks[c]) containerBlocks[c] = [];
            containerBlocks[c].push(p);
        });
    }

    renderDeck(aircraft.layout);
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

    /* MAIN GRID */
    const grid = document.createElement("div");
    grid.className = name.includes("AFT") ? "aft-grid-wrapper" : "deck-grid";

    /* ===========================
       AFT HOLD (with 53 / 52 / 51)
    ============================== */
    if (name.includes("AFT")) {

        const leftCol = document.createElement("div");
        leftCol.className = "aft-left-col";

        /* ===== REAL BULK LAYOUT (53 tall, 52 top, 51 bottom) ===== */
        const bulkColumn = document.createElement("div");
        bulkColumn.className = "bulk-column";

        /* --- 53 (tall box) --- */
        const box53 = document.createElement("div");
        box53.className = "bulk-53";
        box53.textContent = "53";   // <-- ADDED

        /* --- 52 + 51 stack --- */
        const smallStack = document.createElement("div");
        smallStack.className = "bulk-small-stack";

        const box52 = document.createElement("div");
        box52.className = "bulk-small";
        box52.textContent = "52";   // <-- ADDED

        const box51 = document.createElement("div");
        box51.className = "bulk-small";
        box51.textContent = "51";   // <-- ADDED

        smallStack.appendChild(box52);
        smallStack.appendChild(box51);

        bulkColumn.appendChild(box53);
        bulkColumn.appendChild(smallStack);

        leftCol.appendChild(bulkColumn);

        /* RIGHT GRID (AKE L / AKE R / PALLETS) */
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
        wrap.appendChild(grid);

        return wrap;
    }

    /* ===========================
       FORWARD HOLD (unchanged)
    ============================== */

    const gridFwd = document.createElement("div");
    gridFwd.className = "deck-grid";

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

    wrap.appendChild(gridFwd);
    return wrap;
}
    /* ===========================
       FORWARD HOLD (unchanged)
    ============================== */

    const gridFwd = document.createElement("div");
    gridFwd.className = "deck-grid";

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

    wrap.appendChild(gridFwd);
    return wrap;
}

function makeSlot(pos, type) {
    const d = document.createElement("div");
    d.className = `slot ${type}`;
    d.dataset.pos = pos;
    return d;
}


/* ==========================================================
   ADD LOAD ROW — NEW .cell HTML
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
                <option value="PAG">PAG</option>
                <option value="PMC">PMC</option>
                <option value="PAJ">PAJ</option>
            </select>
        </div>

        <div class="cell">
            <input type="text" class="load-uldid" placeholder="ULD">
        </div>

        <div class="cell">
            <select class="load-bulk">
                <option value="BY">BY</option>
                <option value="FKT">FKT</option>
            </select>
        </div>

        <div class="cell">
            <select class="load-pos"></select>
        </div>

        <div class="cell">
            <button class="delete-load">X</button>
        </div>
    `;

    list.appendChild(row);

    loads.push({
        id: loadCounter,
        type: "AKE",
        uldid: "",
        bulk: "BY",
        position: ""
    });

    loadCounter++;

    updatePositionDropdown(row, "AKE");

    row.querySelector(".load-type").addEventListener("change", onTypeChanged);
    row.querySelector(".load-uldid").addEventListener("input", onLoadEdited);
    row.querySelector(".load-bulk").addEventListener("change", onLoadEdited);
    row.querySelector(".load-pos").addEventListener("change", onLoadEdited);

    row.querySelector(".delete-load").addEventListener("click", () =>
        deleteLoad(row.dataset.loadid)
    );
}


/* ==========================================================
   LOAD EDIT HANDLER
========================================================== */

function onLoadEdited(e) {
    const row = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    load.type = row.querySelector(".load-type").value;
    load.uldid = row.querySelector(".load-uldid").value.toUpperCase().trim();
    load.bulk = row.querySelector(".load-bulk").value;
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
    const type = e.target.value;

    const load = loads.find(l => l.id == row.dataset.loadid);
    load.type = type;
    load.position = "";

    updatePositionDropdown(row, type);
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
   BLOCKING LOGIC
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
   RENDER ULDs
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
   VISUAL BLOCKING
========================================================== */

function applyBlockingVisuals() {
    document.querySelectorAll(".slot").forEach(s =>
        s.classList.remove("disabled")
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
    const slot = document.querySelector(`.slot[data-pos="${pos}"]`);
    if (slot) slot.classList.add("disabled");
}


/* ==========================================================
   DRAG & DROP LOGIC
========================================================== */

function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        e.preventDefault();
        draggingULD = box;

        const oldPos = box.dataset.position;

        const oldSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
        if (oldSlot) oldSlot.removeChild(box);

        document.body.appendChild(box);

        box.classList.add("dragging");
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

        let best = null, bestDist = Infinity;

        document.querySelectorAll(".slot").forEach(slot => {
            const r = slot.getBoundingClientRect();
            const cx = r.left + r.width/2;
            const cy = r.top + r.height/2;

            const d = Math.hypot(e.clientX - cx, e.clientY - cy);
            if (d < bestDist) bestDist = d, best = slot;
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
        draggingULD.removeAttribute("style");
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
   MOVE ULD
========================================================== */

function moveULD(box, slot) {
    slot.appendChild(box);
    slot.classList.add("has-uld");

    const load = loads.find(l => l.uldid === box.textContent);
    if (load) load.position = slot.dataset.pos;

    box.dataset.position = slot.dataset.pos;
}


/* ==========================================================
   SLOT HIGHLIGHTING
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

        if (!valid) { slot.style.opacity = "0.25"; return; }

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
   DELETE LOAD
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
   EXPORT LIR
========================================================== */

function exportLayout() {
    let txt = `LIR EXPORT — ${aircraft.registration}\n===========================\n\n`;

    loads.forEach(l => {
        if (l.uldid && l.position)
            txt += `${l.position}: ${l.uldid} (${l.bulk})\n`;
    });

    const out = document.getElementById("export-output");
    out.value = txt;

    document.getElementById("exportModal").classList.remove("hidden");

    navigator.clipboard.writeText(txt);
}
