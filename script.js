/* ==========================================================
   IMPORT AIRCRAFT FILE
========================================================== */
import { EC_NOG } from "./ec-nog.js";

/* ==========================================================
   GLOBAL DATA STORAGE
========================================================== */
let loads = [];
let loadCounter = 1;
let draggingULD = null;

/* ==========================================================
   EXTRACT AIRCRAFT DATA FROM ec-nog.js
========================================================== */
const layout = EC_NOG.layout;
const containerPositions = EC_NOG.containerPositions;
const palletPositions = EC_NOG.palletPositions;
const palletBlocks = EC_NOG.palletBlocks;

/* Reverse blocking: which pallets block a container? */
const containerBlocks = {};
for (const [pallet, contList] of Object.entries(palletBlocks)) {
  contList.forEach(c => {
    if (!containerBlocks[c]) containerBlocks[c] = [];
    containerBlocks[c].push(pallet);
  });
}

/* ==========================================================
   INITIALIZE
========================================================== */
window.addEventListener("DOMContentLoaded", () => {
  buildDeck();

  document.getElementById("addLoadBtn").addEventListener("click", addLoadRow);
  document.getElementById("clear-btn").addEventListener("click", clearAllLoads);
  document.getElementById("export-btn").addEventListener("click", exportLayout);

  updateCargoDeck();
});

/* ==========================================================
   BUILD FULL DECK FROM AIRCRAFT LAYOUT
========================================================== */
function buildDeck() {
  const deckContainer = document.getElementById("deckContainer");
  deckContainer.innerHTML = "";

  deckContainer.appendChild(buildSection("FORWARD HOLD", layout.forward));
  deckContainer.appendChild(buildSection("AFT HOLD", layout.aft));
}

function buildSection(title, sectionData) {
  const section = document.createElement("section");
  section.className = "hold-section";

  const h2 = document.createElement("h2");
  h2.innerText = title;
  section.appendChild(h2);

  const grid = document.createElement("div");
  grid.className = "deck-grid";
  section.appendChild(grid);

  grid.appendChild(buildRow(sectionData.akeLeft, "ake-row", "ake"));
  grid.appendChild(buildRow(sectionData.akeRight, "ake-row", "ake"));
  grid.appendChild(buildRow(sectionData.pallet, "pallet-row", "pallet"));

  return section;
}

function buildRow(positionList, rowClass, slotClass) {
  const row = document.createElement("div");
  row.className = rowClass;

  positionList.forEach(pos => {
    const slot = document.createElement("div");
    slot.className = `slot ${slotClass}`;
    slot.dataset.pos = pos;
    row.appendChild(slot);
  });

  return row;
}

/* ==========================================================
   ADD LOAD
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
   POSITION DROPDOWN UPDATE
========================================================== */
function updatePositionDropdown(row, type) {
  const posSelect = row.querySelector(".load-pos");
  posSelect.innerHTML = "";

  const options =
    (type === "AKE" || type === "AKN") ? containerPositions : palletPositions;

  posSelect.innerHTML = `
    <option value="">--POS--</option>
    ${options.map(p => `<option value="${p}">${p}</option>`).join("")}
  `;
}

function onLoadTypeChanged(e) {
  const row = e.target.closest(".load-row");
  const id = parseInt(row.dataset.loadid);
  const type = e.target.value;

  const load = loads.find(l => l.id === id);
  load.type = type;
  load.position = "";

  row.querySelector(".load-pos").value = "";
  updatePositionDropdown(row, type);

  updateCargoDeck();
}

/* ==========================================================
   LOAD UPDATED
========================================================== */
function onLoadUpdated(e) {
  const row = e.target.closest(".load-row");
  const id = parseInt(row.dataset.loadid);

  const type = row.querySelector(".load-type").value;
  const uldid = row.querySelector(".load-uldid").value.trim().toUpperCase();
  const pos = row.querySelector(".load-pos").value;

  const load = loads.find(l => l.id === id);

  load.type = type;
  load.uldid = uldid;
  load.position = pos;

  if (pos && isPositionBlocked(load)) {
    alert(`Position ${pos} is blocked by another ULD.`);
    row.querySelector(".load-pos").value = "";
    load.position = "";
  }

  updateCargoDeck();
}

/* ==========================================================
   BLOCKING CHECK
========================================================== */
function isPositionBlocked(load) {
  if (!load.position) return false;

  const pos = load.position;

  if (["PAG","PMC","PAJ"].includes(load.type)) {
    return (palletBlocks[pos] || []).some(c => slotOccupied(c));
  }

  if (["AKE","AKN"].includes(load.type)) {
    return (containerBlocks[pos] || []).some(p => slotOccupied(p));
  }

  return false;
}

function slotOccupied(position) {
  return loads.some(l => l.position === position && l.uldid);
}

/* ==========================================================
   RENDER DECK
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
    box.innerText = load.uldid;
    box.dataset.position = load.position;
    box.dataset.uldType = load.type;

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
      (palletBlocks[load.position] || []).forEach(disableSlot);
    } else {
      (containerBlocks[load.position] || []).forEach(disableSlot);
    }
  }
}

function disableSlot(pos) {
  const slot = document.querySelector(`.slot[data-pos="${pos}"]`);
  if (slot) slot.classList.add("disabled");
}

/* ==========================================================
   DELETE LOAD
========================================================== */
function deleteLoad(id) {
  loads = loads.filter(l => l.id !== parseInt(id));
  document.querySelector(`.load-row[data-loadid="${id}"]`).remove();
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
  let text = "LIR EXPORT\n====================\n\n";

  for (const l of loads) {
    if (l.position && l.uldid) text += `${l.position}: ${l.uldid}\n`;
  }

  navigator.clipboard.writeText(text);
  alert("Copied to clipboard");
}

/* ==========================================================
   DRAG & DROP
========================================================== */
function makeULDdraggable(box) {

  let offsetX = 0;
  let offsetY = 0;

  box.addEventListener("mousedown", e => {
    draggingULD = box;

    const rect = box.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    box.classList.add("dragging");
    highlightSlots(box.dataset.uldType);

    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);
  });

  function dragMove(e) {
    const container = document.querySelector(".cargo-area");
    const crect = container.getBoundingClientRect();

    draggingULD.style.position = "absolute";
    draggingULD.style.left = (e.clientX - crect.left - offsetX) + "px";
    draggingULD.style.top  = (e.clientY - crect.top  - offsetY) + "px";
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
   DRAG HIGHLIGHTING
========================================================== */
function highlightSlots(type) {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.style.outline = "none";
    slot.style.opacity = "1";

    if (!isValidSlot(type, slot.dataset.pos)) {
      slot.style.opacity = "0.25";
      return;
    }

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

/* ==========================================================
   VALIDATION HELPERS
========================================================== */
function isValidSlot(type, pos) {
  const isP = pos.endsWith("P");
  const isC = !isP;

  if (["AKE", "AKN"].includes(type) && isC) return true;
  if (["PAG", "PMC", "PAJ"].includes(type) && isP) return true;
  return false;
}

function isBlocked(pos, occupied) {
  const blockedByP = (palletBlocks[pos] || []).some(p => occupied.includes(p));
  const blockedByC = (containerBlocks[pos] || []).some(c => occupied.includes(c));
  return blockedByP || blockedByC;
}

/* ==========================================================
   MOVE ULD
========================================================== */
function moveULD(box, targetSlot) {
  const oldPos = box.dataset.position;

  const oldSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
  if (oldSlot) oldSlot.classList.remove("has-uld");

  targetSlot.classList.add("has-uld");
  box.dataset.position = targetSlot.dataset.pos;
  targetSlot.appendChild(box);

  const load = loads.find(l => l.uldid === box.innerText);
  if (load) load.position = box.dataset.position;

  box.style.position = "relative";
  box.style.left = "0";
  box.style.top = "0";
}
