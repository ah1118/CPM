/* ==========================================================
   BLOCKING LOGIC
========================================================== */

function isPosBlocked(load) {
    if (!load.position || load.type === "BLK") return false;

    // Pallet ULD → check containers inside pallet block
    if (["PAG","PMC","PAJ"].includes(load.type)) {
        return palletBlocks[load.position]?.some(c => isSlotUsed(c));
    }

    // Container ULD → check pallet positions that block it
    return containerBlocks[load.position]?.some(p => isSlotUsed(p));
}

function isSlotUsed(pos) {
    return loads.some(l => l.position === pos && (l.uldid || l.type === "BLK"));
}

function applyBlockingVisuals() {
    // 1. RESET everything
    document.querySelectorAll(".slot").forEach(s => {
        s.classList.remove("disabled");
    });

    // 2. Apply blocking ONLY for occupied slots
    for (const load of loads) {
        if (!load.position) continue;
        if (load.type === "BLK") continue;

        if (["PAG","PMC","PAJ"].includes(load.type)) {
            // Pallet-type ULD → block linked CONTAINERS
            const linked = palletBlocks[load.position] || [];
            linked.forEach(markDisabled);
        } else {
            // Container-type ULD → block linked PALLETS
            const linked = containerBlocks[load.position] || [];
            linked.forEach(markDisabled);
        }
    }
}

/* ==========================================================
   FILTER POS OPTIONS BEFORE OPENING DROPDOWN
========================================================== */

function rebuildPosOptions(selectEl, loadType, currentPos) {

    const used = new Set(
        loads
            .filter(l => l.position && l.position !== currentPos)
            .map(l => l.position)
    );

    selectEl.innerHTML = "";

    // ✅ Add "POS" placeholder at top
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "POS";
    selectEl.appendChild(placeholder);

    document.querySelectorAll(".slot").forEach(slot => {

        const pos = slot.dataset.pos;

        if (slot.classList.contains("disabled")) return;
        if (!isCorrectSlotType(loadType, pos)) return;
        if (used.has(pos)) return;

        const opt = document.createElement("option");
        opt.value = pos;
        opt.textContent = pos;
        selectEl.appendChild(opt);
    });

    if (currentPos && [...selectEl.options].some(o => o.value === currentPos)) {
        selectEl.value = currentPos;
    }
}





/* ==========================================================
   DRAGGING HIGHLIGHT
========================================================== */

function highlightSlots(type) {
    document.querySelectorAll(".slot").forEach(slot => {
        const pos = slot.dataset.pos;
        const valid = isCorrectSlotType(type, pos);

        slot.classList.remove("disabled","highlight","invalid");

        if (valid) slot.classList.add("highlight");
        else slot.classList.add("invalid");
    });
}


/* ==========================================================
   DRAG & DROP BEHAVIOR
========================================================== */

function makeULDdraggable(box) {

    box.addEventListener("mousedown", e => {
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;

        draggingULD = box;
        isDragging = false;
        draggingULD.oldPos = box.dataset.position;

        function startRealDrag(e2) {
            const dx = Math.abs(e2.clientX - startX);
            const dy = Math.abs(e2.clientY - startY);

            if (!isDragging && (dx > 5 || dy > 5)) {

                isDragging = true;

                const oldSlot = document.querySelector(`.slot[data-pos="${draggingULD.oldPos}"]`);
                if (oldSlot) oldSlot.removeChild(draggingULD);

                document.body.appendChild(draggingULD);

                draggingULD.classList.add("dragging");
                draggingULD.style.position = "fixed";
                draggingULD.style.left = e2.clientX + "px";
                draggingULD.style.top = e2.clientY + "px";
                draggingULD.style.transform = "translate(-50%, -50%)";

                highlightSlots(draggingULD.dataset.uldType);
            }

            if (isDragging) {
                draggingULD.style.left = e2.clientX + "px";
                draggingULD.style.top = e2.clientY + "px";
            }
        }

        function endDrag(e2) {
            document.removeEventListener("mousemove", startRealDrag);
            document.removeEventListener("mouseup", endDrag);

            if (!isDragging) {
                draggingULD = null;
                return;
            }

            dragEnd(e2);
        }

        document.addEventListener("mousemove", startRealDrag);
        document.addEventListener("mouseup", endDrag);
    });
}


function dragEnd(e) {
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

    if (
        best &&
        bestDist < 90 &&
        isCorrectSlotType(loadType, best.dataset.pos) &&
        !best.classList.contains("disabled")
    ) {
        // 🚫 PREVENT DROPPING INTO OCCUPIED SLOT
        if (best.querySelector(".uld-box")) {
            alert(`Position ${best.dataset.pos} already has a load.`);

            const returnSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
            if (returnSlot) moveULD(draggingULD, returnSlot);

            draggingULD.classList.remove("dragging");
            draggingULD.removeAttribute("style");
            draggingULD = null;
            isDragging = false;

            clearHighlights();
            updateCargoDeck();
            applyBlockingVisuals();
            return;
        }

        // ✅ Allowed drop
        moveULD(draggingULD, best);

    } else {
        const returnSlot = document.querySelector(`.slot[data-pos="${oldPos}"]`);
        if (returnSlot) moveULD(draggingULD, returnSlot);
    }

    draggingULD.classList.remove("dragging");
    draggingULD.removeAttribute("style");

    draggingULD = null;
    isDragging = false;

    clearHighlights();
    updateCargoDeck();
    applyBlockingVisuals();
    toggleExportButton();
}


function moveULD(box, slot) {
    slot.appendChild(box);
    slot.classList.add("has-uld");

    const load = loads.find(l => l.id == box.dataset.loadId);
    if (load) {
        load.position = slot.dataset.pos;

        // ✅ Sync sidebar dropdown
        const row = document.querySelector(`.load-row[data-loadid="${load.id}"]`);
        if (row) {
            const posSelect = row.querySelector(".load-pos");
            if (posSelect) posSelect.value = load.position;
        }
    }

    box.dataset.position = slot.dataset.pos;
}

function clearHighlights() {
    document.querySelectorAll(".slot").forEach(s => {
        s.classList.remove("highlight");
        s.classList.remove("invalid");
        s.style.outline = "none";
        s.style.opacity = "1";
    });
}


function startSidebarULDdrag(loadId, rowEl) {
    const load = loads.find(l => l.id == loadId);
    if (!load) return;

    // ------------------------------
    //  Create the draggable ULD box
    // ------------------------------
    const box = document.createElement("div");
    box.className = "uld-box dragging";
    box.textContent =
        (load.uldid ? load.uldid : load.type) +
        (load.weight ? "\n" + load.weight + " KG" : "");

    box.dataset.loadId = load.id;
    box.dataset.uldType = load.type;
    box.style.position = "fixed";
    box.style.left = "-9999px";

    document.body.appendChild(box);

    draggingULD = box;
    isDragging = true;

    highlightSlots(load.type);

    // ------------------------------
    //  Mouse movement
    // ------------------------------
    function onMove(e) {
        draggingULD.style.left = e.clientX + "px";
        draggingULD.style.top = e.clientY + "px";
        draggingULD.style.transform = "translate(-50%, -50%)";
    }

    // ------------------------------
    //  Mouse up → drop
    // ------------------------------
    function onUp(e) {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        let best = null, bestDist = Infinity;

        // find nearest slot center
        document.querySelectorAll(".slot").forEach(slot => {
            const r = slot.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const d = Math.hypot(e.clientX - cx, e.clientY - cy);

            if (d < bestDist) bestDist = d, best = slot;
        });

        // ----------------------------------------
        //  Valid drop?
        // ----------------------------------------
        if (
            best &&
            bestDist < 90 &&
            isCorrectSlotType(load.type, best.dataset.pos) &&
            !best.classList.contains("disabled")
        ) {

            // ❌ Slot occupied
            if (best.querySelector(".uld-box")) {
                alert(`Position ${best.dataset.pos} already has a load.`);

                draggingULD.remove();
                draggingULD = null;
                isDragging = false;
                clearHighlights();
                return;
            }

            // ✅ Apply new position
            load.position = best.dataset.pos;

            // ⭐ AUTO-UPDATE SIDEBAR POS DROPDOWN
            const row = document.querySelector(`.load-row[data-loadid="${load.id}"]`);
            if (row) {
                const posSelect = row.querySelector(".load-pos");
                if (posSelect) posSelect.value = load.position;
            }

            updateCargoDeck();
            applyBlockingVisuals();
            toggleExportButton();   // <<< FIX ADDED HERE
        }

        // ------------------------------
        //  cleanup
        // ------------------------------
        if (draggingULD) draggingULD.remove();
        draggingULD = null;
        isDragging = false;

        clearHighlights();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}


// =======================================================
//  KEYBOARD: MOVE LOAD ROW UP/DOWN (Arrow Keys)
// =======================================================

document.addEventListener("keydown", function (e) {

    const focused = document.activeElement;
    if (!focused) return;

    const row = focused.closest(".load-row");
    if (!row) return;

    const rows = [...document.querySelectorAll(".load-row")];
    const rowIndex = rows.indexOf(row);

    // All inputs/selects inside this row
    const fields = [...row.querySelectorAll("input, select")];
    const indexInRow = fields.indexOf(focused);

    /* ────────────────────────────────────────────────
       PREVENT SELECT overwriting on LEFT/RIGHT
    ───────────────────────────────────────────────── */
    if (focused.tagName === "SELECT" &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
    }

    /* ────────────────────────────────────────────────
       MOVE WITH LEFT / RIGHT
    ───────────────────────────────────────────────── */
    if (e.key === "ArrowLeft") {
        if (indexInRow > 0) {
            e.preventDefault();
            fields[indexInRow - 1].focus();
        }
        return;
    }

    if (e.key === "ArrowRight") {
        if (indexInRow < fields.length - 1) {
            e.preventDefault();
            fields[indexInRow + 1].focus();
        }
        return;
    }

    /* ────────────────────────────────────────────────
       MOVE WITH UP / DOWN (within same column)
    ───────────────────────────────────────────────── */

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();

        let targetRowIndex = rowIndex + (e.key === "ArrowUp" ? -1 : 1);

        // If there is a row above/below → focus same column field  
        if (targetRowIndex >= 0 && targetRowIndex < rows.length) {
            const targetRow = rows[targetRowIndex];
            const targetFields = [...targetRow.querySelectorAll("input, select")];

            if (targetFields[indexInRow]) {
                targetFields[indexInRow].focus();
                return;
            }
        }

        // If no row above/below → DO NOT MOVE THE WHOLE ROW
        // Just ignore
        return;
    }
});



