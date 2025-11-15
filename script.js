// ======================================================
//  GLOBAL DATA
// ======================================================

// All cargo slots
const slots = document.querySelectorAll(".slot");

// Store all ULD objects created in the left panel
let ULD_LIST = [];

// Currently dragged ULD box
let draggingULD = null;


// ======================================================
//  POSITION RULES (AKE vs Pallets)
// ======================================================

// AKE & AKN use AKE containers (L/R positions)
// PAG/PMC/PAJ use pallet (P) positions

function isValidSlot(uldType, pos) {
    const isPalletULD = ["PAG", "PMC", "PAJ"].includes(uldType);
    const isAKEULD = ["AKE", "AKN"].includes(uldType);

    const isPalletSlot = pos.endsWith("P");
    const isAKEslot = !pos.endsWith("P");

    return (
        (isAKEULD && isAKEslot) ||
        (isPalletULD && isPalletSlot)
    );
}


// ======================================================
//  BLOCKING RULES MAP (Forward + Aft)
// ======================================================

const blockingRules = {
    // FORWARD HOLD
    "24P": ["26L", "26R", "25L", "25R"],
    "23P": ["25L", "25R", "24L", "24R"],
    "22P": ["23L", "23R", "22L", "22R"],
    "21P": ["22L", "22R", "21L", "21R"],
    "12P": ["13L", "13R", "12L", "12R"],
    "11P": ["12L", "12R", "11L", "11R"],

    // AFT HOLD
    "42P": ["43L", "43R", "42L", "42R"],
    "41P": ["42L", "42R", "41L", "41R"],
    "33P": ["34L", "34R", "33L", "33R"],
    "32P": ["33L", "33R", "32L", "32R"],
    "31P": ["31L", "31R"]
};

function isBlockedPosition(pos, occupied) {
    if (!blockingRules[pos]) return false;
    return blockingRules[pos].some(p => occupied.includes(p));
}


// ======================================================
//  CREATE ULD (from sidebar)
// ======================================================

function createULD(uldType, uldNum, position) {
    const slot = document.querySelector(`.slot[data-pos="${position}"]`);

    if (!slot) {
        alert("Invalid position.");
        return;
    }

    if (!isValidSlot(uldType, position)) {
        alert("ULD type does not match this position.");
        return;
    }

    if (slot.classList.contains("has-uld")) {
        alert("This position is already occupied.");
        return;
    }

    // Check blocking rules
    const allOccupied = [...document.querySelectorAll('.slot.has-uld')].map(s => s.dataset.pos);

    if (isBlockedPosition(position, allOccupied)) {
        alert("This position is blocked by another pallet.");
        return;
    }

    // Build ULD box
    const box = document.createElement("div");
    box.className = "uld-box";
    box.innerText = `${uldType}${uldNum}`;
    box.dataset.uldType = uldType;
    box.dataset.position = position;

    // Place into slot
    slot.classList.add("has-uld");
    slot.appendChild(box);

    // Make draggable
    makeULDdraggable(box);

    // Store
    ULD_LIST.push({
        type: uldType,
        number: uldNum,
        position: position
    });
}


// ======================================================
//  HIGHLIGHT VALID POSITIONS WHEN DRAGGING
// ======================================================

function highlightSlots(uldType) {
    slots.forEach(slot => {
        const pos = slot.dataset.pos;
        const isBlocked = slot.dataset.blocked === "1";
        const hasULD = slot.classList.contains("has-uld");

        if (isBlocked) {
            slot.style.outline = "2px solid #dc2626";
            slot.style.opacity = "0.2";
            return;
        }

        // wrong type
        if (!isValidSlot(uldType, pos)) {
            slot.style.opacity = "0.25";
            return;
        }

        // Valid and empty → glow green
        if (!hasULD) {
            slot.style.outline = "2px solid #22c55e";
        }
    });
}

function clearHighlights() {
    slots.forEach(slot => {
        slot.style.outline = "none";
        slot.style.opacity = "1";
    });
}


// ======================================================
//  DRAG & DROP ENGINE (A1 MODE)
// ======================================================

function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        draggingULD = box;
        box.style.zIndex = "999";

        highlightSlots(box.dataset.uldType);

        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
    });

    function dragMove(e) {
        draggingULD.style.position = "absolute";
        draggingULD.style.left = e.pageX - 40 + "px";
        draggingULD.style.top = e.pageY - 20 + "px";
    }

    function dragEnd(e) {
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);

        const targetSlot = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slot");

        if (!targetSlot) {
            return resetBox();
        }

        const newPos = targetSlot.dataset.pos;
        const uldType = draggingULD.dataset.uldType;

        // 1) Check type compatibility
        if (!isValidSlot(uldType, newPos)) {
            return resetBox();
        }

        // 2) Check empty
        if (targetSlot.classList.contains("has-uld")) {
            return resetBox();
        }

        // 3) Check block logic
        const occupied = [...document.querySelectorAll(".slot.has-uld")].map(s => s.dataset.pos);

        if (isBlockedPosition(newPos, occupied)) {
            return resetBox();
        }

        // Move ULD
        moveULD(draggingULD, targetSlot);

        clearHighlights();
        draggingULD = null;
    }

    function resetBox() {
        draggingULD.style.position = "relative";
        draggingULD.style.left = "0";
        draggingULD.style.top = "0";
        clearHighlights();
        draggingULD = null;
    }
}


// ======================================================
//  MOVE ULD TO NEW POSITION
// ======================================================

function moveULD(box, newSlot) {
    const oldPos = box.dataset.position;
    const oldSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
    if (oldSlot) oldSlot.classList.remove("has-uld");

    box.dataset.position = newSlot.dataset.pos;
    newSlot.classList.add("has-uld");

    newSlot.appendChild(box);
    box.style.position = "relative";
    box.style.left = "0";
    box.style.top = "0";
}


// ======================================================
//  EXPORT SUMMARY
// ======================================================

document.getElementById("export-btn")?.addEventListener("click", () => {
    const output = document.getElementById("export-output");
    let text = "";

    document.querySelectorAll(".slot.has-uld").forEach(slot => {
        const box = slot.querySelector(".uld-box");
        text += `${box.innerText} → ${slot.dataset.pos}\n`;
    });

    output.value = text;
});


// ======================================================
//  CLEAR ALL BUTTON
// ======================================================

document.getElementById("clear-btn")?.addEventListener("click", () => {
    document.querySelectorAll(".slot.has-uld").forEach(slot => {
        slot.classList.remove("has-uld");
        slot.innerHTML = "";
    });
});
