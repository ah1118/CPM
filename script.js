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
            akeRight: ["43R","42R","41R","34R","33R","32L","31R"],
            pallet:   ["42P","41P","33P","32P","31P"]
        }
    },

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

let isDragging = false;   // <--- FIX FLAG


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
   LOAD AIRCRAFT PROFILE
========================================================== */

function loadAircraftProfile() {
    containerPositions = aircraft.containerPositions;
    palletPositions = aircraft.palletPositions;
    palletBlocks = aircraft.palletBlocks;

    containerBlocks = {};
    Object.entries(palletBlocks).forEach(([pal, blocked]) => {
        blocked.forEach(c => {
            if (!containerBlocks[c]) containerBlocks[c] = [];
            containerBlocks[c].push(pal);
        });
    });

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

    const grid = document.createElement("div");
    grid.className = name.includes("AFT") ? "aft-grid-wrapper" : "deck-grid";

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
    } else {
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

function makeSlot(pos, type) {
    const d = document.createElement("div");
    d.className = `slot ${type}`;
    d.dataset.pos = pos;
    return d;
}


/* ==========================================================
   ADD LOAD ROWS
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
            <button class="delete-load">X</button>
        </div>
    `;

    list.appendChild(row);

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

    row.querySelector(".load-type").addEventListener("change", onTypeChanged);
    row.querySelector(".load-uldid").addEventListener("input", onLoadEdited);
    row.querySelector(".load-bulk").addEventListener("change", onLoadEdited);
    row.querySelector(".load-weight").addEventListener("input", onLoadEdited);
    row.querySelector(".load-pos").addEventListener("change", onLoadEdited);
    row.querySelector(".delete-load").addEventListener("click", () =>
        deleteLoad(row.dataset.loadid)
    );
}


/* ==========================================================
   TYPE CHANGE
========================================================== */

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
}

function updatePositionDropdown(row, type) {
    const sel = row.querySelector(".load-pos");

    let list;
    if (type === "BLK") list = ["51", "52", "53"];
    else if (type === "AKE" || type === "AKN") list = containerPositions;
    else list = palletPositions;

    sel.innerHTML = `
        <option value="">--POS--</option>
        ${list.map(p => `<option value="${p}">${p}</option>`).join("")}
    `;
}


/* ==========================================================
   LOAD EDIT
========================================================== */

function onLoadEdited(e) {
    const row = e.target.closest(".load-row");
    const load = loads.find(l => l.id == row.dataset.loadid);

    load.type = row.querySelector(".load-type").value;
    load.uldid = row.querySelector(".load-uldid").value.toUpperCase().trim();
    load.weight = parseInt(row.querySelector(".load-weight").value || "0");
    load.bulk = row.querySelector(".load-bulk").value;
    load.position = row.querySelector(".load-pos").value;

    if (
        e.target.classList.contains("load-pos") &&
        load.type === "BLK" &&
        !["51", "52", "53"].includes(load.position)
    ) {
        alert("BLK must be placed ONLY in 51 • 52 • 53.");
        load.position = "";
        row.querySelector(".load-pos").value = "";
    }

    if (load.position && isPosBlocked(load)) {
        alert(`Position ${load.position} is blocked.`);
        load.position = "";
        row.querySelector(".load-pos").value = "";
    }

    updateCargoDeck();
}


/* ==========================================================
   BLOCKING
========================================================== */

function isPosBlocked(load) {
    if (!load.position || load.type === "BLK") return false;

    if (["PAG","PMC","PAJ"].includes(load.type)) {
        return palletBlocks[load.position]?.some(c => isSlotUsed(c));
    }

    return containerBlocks[load.position]?.some(p => isSlotUsed(p));
}

function isSlotUsed(pos) {
    return loads.some(l => l.position === pos && (l.uldid || l.type === "BLK"));
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
            box.innerHTML = `${load.bulk}<br>${load.weight} KG`;
        } else {
            if (!load.uldid) continue;
            box.innerHTML = `${load.uldid}<br>${load.weight} KG`;
        }

        slot.appendChild(box);
        slot.classList.add("has-uld");

        makeULDdraggable(box);
    }

    if (!isDragging) {       // <--- IMPORTANT FIX
        applyBlockingVisuals();
    }
}


/* ==========================================================
   BLOCKING VISUALS
========================================================== */

function applyBlockingVisuals() {
    document.querySelectorAll(".slot").forEach(s => s.classList.remove("disabled"));

    for (const load of loads) {
        if (!load.position || load.type === "BLK") continue;

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
   DRAG & DROP — FIXED
========================================================== */

function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        e.preventDefault();
        draggingULD = box;
        isDragging = true;   // <--- FIXED

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
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;

        const d = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (d < bestDist) bestDist = d, best = slot;
    });

    const loadType = draggingULD.dataset.uldType;
    const oldPos = draggingULD.oldPos;

    // VALID DROP?
    if (
        best &&
        bestDist < 90 &&
        isCorrectSlotType(loadType, best.dataset.pos) &&
        !best.classList.contains("disabled")
    ) {
        moveULD(draggingULD, best);
    }
    else {
        // ⬅ INVALID DROP → return to original slot
        const returnSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
        if (returnSlot) moveULD(draggingULD, returnSlot);
    }

    draggingULD.classList.remove("dragging");
    draggingULD.removeAttribute("style");
    draggingULD = null;

    clearHighlights();
    updateCargoDeck();
}
}


/* ==========================================================
   TYPE VALIDATION
========================================================== */

function isCorrectSlotType(type, pos) {

    const isPallet = pos.endsWith("P");
    const isBulk   = ["51","52","53"].includes(pos);

    if (type === "BLK") return isBulk;
    if (["AKE","AKN"].includes(type)) return !isPallet && !isBulk;
    if (["PAG","PMC","PAJ"].includes(type)) return isPallet;

    return false;
}


/* ==========================================================
   MOVE ULD
========================================================== */

function moveULD(box, slot) {
    slot.appendChild(box);
    slot.classList.add("has-uld");

    const load = loads.find(l => l.id == box.dataset.loadId);
    if (load) load.position = slot.dataset.pos;

    box.dataset.position = slot.dataset.pos;
}


/* ==========================================================
   HIGHLIGHT / CLEAR
========================================================== */

function highlightSlots(type) {
    document.querySelectorAll(".slot").forEach(slot => {

        slot.style.outline = "none";
        slot.style.opacity = "1";

        const valid = isCorrectSlotType(type, slot.dataset.pos);

        if (!valid) { 
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


/* ==========================================================
   DELETE, CLEAR, EXPORT
========================================================== */

function deleteLoad(id) {
    loads = loads.filter(l => l.id != id);
    document.querySelector(`.load-row[data-loadid="${id}"]`)?.remove();
    updateCargoDeck();
}

function clearAllLoads() {
    if (!confirm("Clear ALL loads?")) return;
    loads = [];
    document.getElementById("loadList").innerHTML = "";
    updateCargoDeck();
}

function exportLayout() {
    let txt = `LIR EXPORT — ${aircraft.registration}\n===========================\n\n`;

    loads.forEach(l => {
        if (!l.position) return;

        if (l.type === "BLK") {
            txt += `${l.position}: ${l.bulk} - ${l.weight}KG (BLK)\n`;
        } else if (l.uldid) {
            txt += `${l.position}: ${l.uldid} - ${l.weight}KG (${l.bulk})\n`;
        }
    });

    const out = document.getElementById("export-output");
    out.value = txt;

    document.getElementById("exportModal").classList.remove("hidden");
    navigator.clipboard.writeText(txt);
}
