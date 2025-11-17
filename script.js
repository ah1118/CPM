/* ==========================================================
   GLOBALS
========================================================== */

let loads = [];
let loadCounter = 1;
let draggingULD = null;

let activeAircraft = null; // loaded aircraft data
let containerPositions = [];
let palletPositions = [];
let palletBlocks = [];
let containerBlocks = [];


/* ==========================================================
   LOAD AIRCRAFT PROFILE
========================================================== */

async function loadAircraftProfile(name) {
    try {
        const module = await import(`./${name}.js`);

        activeAircraft = module.aircraft;
        containerPositions = module.containerPositions;
        palletPositions = module.palletPositions;
        palletBlocks = module.palletBlocks;
        containerBlocks = module.containerBlocks;

        console.log("Loaded aircraft:", activeAircraft.registration);

        updateCargoDeck();

    } catch (err) {
        console.error("Failed to load aircraft:", name, err);
    }
}


/* ==========================================================
   INITIALIZE
========================================================== */

window.addEventListener("DOMContentLoaded", () => {

    const aircraftSelect = document.getElementById("aircraftSelect");
    if (aircraftSelect) {
        aircraftSelect.addEventListener("change", () => {
            loadAircraftProfile(aircraftSelect.value);
        });
    }

    document.getElementById("addLoadBtn").addEventListener("click", addLoadRow);
    document.getElementById("clear-btn")?.addEventListener("click", clearAllLoads);
    document.getElementById("export-btn")?.addEventListener("click", exportLayout);

    loads = [];
    loadCounter = 1;

    loadAircraftProfile("ec-nog"); // default
});


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

        <input type="text" class="load-uldid" placeholder="ULD ID">

        <select class="load-pos"></select>
        <button class="delete-load">X</button>
    `;

    list.appendChild(row);

    updatePositionDropdown(row, "AKE");

    row.querySelector(".load-type").addEventListener("change", onLoadTypeChanged);
    row.querySelector(".load-pos").addEventListener("change", onLoadUpdated);
    row.querySelector(".load-uldid").addEventListener("input", onLoadUpdated);
    row.querySelector(".delete-load").addEventListener("click", () => {
        deleteLoad(row.dataset.loadid);
    });

    loads.push({
        id: loadCounter,
        type: "AKE",
        uldid: "",
        position: ""
    });

    loadCounter++;
}


/* ==========================================================
   UPDATE POSITION DROPDOWN
========================================================== */

function onLoadTypeChanged(e) {
    const row = e.target.closest(".load-row");
    const id = parseInt(row.dataset.loadid);
    const type = e.target.value;

    const load = loads.find(l => l.id === id);
    load.type = type;
    load.position = "";

    updatePositionDropdown(row, type);
    updateCargoDeck();
}

function updatePositionDropdown(row, type) {
    const select = row.querySelector(".load-pos");
    select.innerHTML = "";

    let positions = (type === "AKE" || type === "AKN") ? containerPositions : palletPositions;

    select.innerHTML = `
        <option value="">--POS--</option>
        ${positions.map(p => `<option value="${p}">${p}</option>`).join("")}
    `;
}


/* ==========================================================
   LOAD UPDATED
========================================================== */

function onLoadUpdated(e) {
    const row = e.target.closest(".load-row");
    const id = parseInt(row.dataset.loadid);

    const type = row.querySelector(".load-type").value;
    const uldid = row.querySelector(".load-uldid").value.toUpperCase().trim();
    const pos = row.querySelector(".load-pos").value;

    const load = loads.find(l => l.id === id);

    load.type = type;
    load.uldid = uldid;
    load.position = pos;

    if (pos && isPositionBlocked(load)) {
        alert(`Position ${pos} is blocked.`);
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

    if (["PAG", "PMC", "PAJ"].includes(load.type)) {
        return palletBlocks[load.position]?.some(x => slotOccupied(x)) || false;
    } else {
        return containerBlocks[load.position]?.some(x => slotOccupied(x)) || false;
    }
}

function slotOccupied(pos) {
    return loads.some(l => l.position === pos && l.uldid !== "");
}


/* ==========================================================
   RENDER CARGO DECK
========================================================== */

function updateCargoDeck() {
    document.querySelectorAll(".slot").forEach(s => {
        s.innerHTML = "";
        s.classList.remove("has-uld");
    });

    for (const load of loads) {
        if (!load.position || !load.uldid) continue;

        const slot = document.querySelector(`.slot[data-pos="${load.position}"]`);

        if (slot) {
            const box = document.createElement("div");
            box.className = "uld-box";
            box.textContent = load.uldid;
            box.dataset.position = load.position;
            box.dataset.uldType = load.type;

            slot.appendChild(box);
            slot.classList.add("has-uld");

            makeULDdraggable(box);
        }
    }

    applyBlockingVisuals();
}


/* ==========================================================
   APPLY BLOCKING VISUALS
========================================================== */

function applyBlockingVisuals() {
    document.querySelectorAll(".slot").forEach(s => s.classList.remove("disabled"));

    for (const load of loads) {
        if (!load.position) continue;

        if (["PAG", "PMC", "PAJ"].includes(load.type)) {
            palletBlocks[load.position]?.forEach(disableSlot);
        } else {
            containerBlocks[load.position]?.forEach(disableSlot);
        }
    }
}

function disableSlot(pos) {
    const s = document.querySelector(`.slot[data-pos="${pos}"]`);
    if (s) s.classList.add("disabled");
}


/* ==========================================================
   DRAGGING — PERFECT CURSOR LOCK
========================================================== */

function makeULDdraggable(box) {

    let offsetX = 0, offsetY = 0;

    box.addEventListener("mousedown", e => {

        draggingULD = box;
        box.classList.add("dragging");

        document.body.appendChild(box); // always drag relative to body

        const rect = box.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        highlightSlots(box.dataset.uldType);

        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
    });

    function dragMove(e) {
        draggingULD.style.position = "absolute";
        draggingULD.style.left = (e.pageX - offsetX) + "px";
        draggingULD.style.top = (e.pageY - offsetY) + "px";
    }

    function dragEnd(e) {
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);

        const targetSlot = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slot");

        if (!targetSlot) return resetDrag();

        const newPos = targetSlot.dataset.pos;
        const uType = draggingULD.dataset.uldType;

        if (!isValidSlotType(uType, newPos)) return resetDrag();
        if (targetSlot.classList.contains("has-uld")) return resetDrag();
        if (isBlocked(newPos, loads.map(l => l.position))) return resetDrag();

        moveULD(draggingULD, targetSlot);
        draggingULD.classList.remove("dragging");
        draggingULD = null;
        clearHighlights();
    }

    function resetDrag() {
        draggingULD.style.position = "relative";
        draggingULD.style.left = "0";
        draggingULD.style.top = "0";
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
        slot.style.outline = "none";
        slot.style.opacity = "1";

        const pos = slot.dataset.pos;
        const isP = pos.endsWith("P");

        if (slot.classList.contains("disabled")) {
            slot.style.outline = "2px solid #dc2626";
            slot.style.opacity = "0.25";
            return;
        }

        const valid = (["AKE", "AKN"].includes(type) && !isP) ||
                      (["PAG", "PMC", "PAJ"].includes(type) && isP);

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

function isValidSlotType(uldType, pos) {
    const isP = pos.endsWith("P");
    return (
        (["AKE", "AKN"].includes(uldType) && !isP) ||
        (["PAG", "PMC", "PAJ"].includes(uldType) && isP)
    );
}

function isBlocked(pos, occupied) {
    return palletBlocks[pos]?.some(p => occupied.includes(p)) || false;
}


/* ==========================================================
   MOVE ULD
========================================================== */

function moveULD(box, targetSlot) {
    const oldPos = box.dataset.position;

    const oldSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
    if (oldSlot) oldSlot.classList.remove("has-uld");

    targetSlot.appendChild(box);
    targetSlot.classList.add("has-uld");

    const load = loads.find(l => l.uldid === box.textContent);
    if (load) load.position = targetSlot.dataset.pos;

    box.style.position = "relative";
    box.style.left = "0";
    box.style.top = "0";
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
    let out = "LIR EXPORT\n====================\n\n";

    for (const l of loads) {
        if (l.uldid && l.position)
            out += `${l.position}: ${l.uldid}\n`;
    }

    navigator.clipboard.writeText(out);
    alert("Copied to clipboard!");
}
