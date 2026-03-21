const ULD_TARE = {
    "AKE": 80,
    "AKN": 80,
    "PAG": 103,
    "PMC": 103,
    "PAJ": 103,
    "BLK": 0
};

function exportLayout() {

    if (!allLoadsValid()) {
        alert("Fill all ULD details before exporting.\n(ULD ID, Weight, BULK, Position)");
        return;
    }

    const flightNum = document.getElementById("flightNumber").value || "XX";
    const dest      = document.getElementById("flightDestination").value || "XXX";
    const aircraft  = window.aircraft;
    const reg       = aircraft.registration;

    // today day only
    const today = new Date();
    const day = today.getDate().toString().padStart(2, "0");

    let output = [];
    output.push("CPM");
    output.push(`${flightNum}/${day}.${reg}.${aircraft.ldm.seatCode}`);;

    // Map pos → load
    const loadsMap = {};
    for (const l of loads) loadsMap[l.position] = l;

    function isEmpty(pos) {
    const load = loadsMap[pos];
    if (!load) return true;

    // BLK is never empty
    if (load.type === "BLK") return false;

    // FKT is NOT empty
    if (load.bulk === "FKT") return false;

    // Normal ULD without ID → empty
    return !load.uldid;
    }

    /* ================================
       RULE 1 — BLOCKED POSITIONS
    =================================*/
    const blockedPositions = new Set();

    // pallet blocks containers
    for (const pallet in aircraft.palletBlocks) {
        if (!isEmpty(pallet)) {
            for (const pos of aircraft.palletBlocks[pallet])
                blockedPositions.add(pos);
        }
    }

    // container blocks pallet
    for (const pallet in aircraft.palletBlocks) {
        for (const pos of aircraft.palletBlocks[pallet]) {
            if (!isEmpty(pos)) {
                blockedPositions.add(pallet);
                break;
            }
        }
    }

    /* ================================
       RULE 2 — PALLET-ONLY EXPORT
    =================================*/
    const suppressedAKE = new Set();
    const palletOnly = new Set();

    for (const pallet of aircraft.palletPositions) {
        if (blockedPositions.has(pallet)) continue;

        const akes = aircraft.palletBlocks[pallet] || [];
        if (isEmpty(pallet) && akes.every(a => isEmpty(a))) {
            palletOnly.add(pallet);
            for (const a of akes) suppressedAKE.add(a);
        }
    }

    /* ================================
       RULE 3 — AKE PAIR EXPORT
    =================================*/
    function akePairAllowed(L, R) {
        if (blockedPositions.has(L) || blockedPositions.has(R)) return false;
        if (suppressedAKE.has(L) || suppressedAKE.has(R)) return false;
        return true;
    }

    /* ================================
       BUILD CPM LINES
    =================================*/
    let allLines = [];

    for (const pallet of palletOnly) {
        allLines.push({ pos: pallet, text: formatUld(pallet, loadsMap[pallet], dest) });
    }

    for (const [L, R] of aircraft.positionOrder) {
        if (!akePairAllowed(L, R)) continue;
        allLines.push({ pos: L, text: formatAKEPair(L, R, loadsMap, dest) });
    }

    const remainingPallets = aircraft.palletPositions.filter(
        p => !palletOnly.has(p) && !blockedPositions.has(p)
    );

    for (const pallet of remainingPallets) {
        const load = loadsMap[pallet];
        let line = (!load)
            ? `-${pallet}/N`
            : formatUld(pallet, load, dest);
        allLines.push({ pos: pallet, text: line });
    }

    // bulk 51–53
    for (const pos of ["51", "52", "53"]) {
        const load = loadsMap[pos];
        let line = (!load)
            ? `-${pos}/X`
            : formatUld(pos, load, dest);
        allLines.push({ pos, text: line });
    }

    allLines.sort((a, b) => parseInt(a.pos) - parseInt(b.pos));
    for (const e of allLines) output.push(e.text);

    /* ============================================
       TOTAL PIECES (UI) + NET CARGO WEIGHT
    ============================================ */
    const uiPieces = parseInt(document.getElementById("sumPieces").value || "0");

    let cargoTotalNet = 0;

    loads.forEach(l => {
        const gross = parseInt(l.weight) || 0;
        const tare  = ULD_TARE[l.type] || 0;
        const net   = Math.max(0, gross - tare);
        cargoTotalNet += net;
    });

    // FINAL CPM FOOTER  (NOW CORRECT)
    output.push(`SI CZL-${dest} C 0 M 0 B ${uiPieces}/${cargoTotalNet} O 0 T 0`);

    /* ============================
       SHOW MODAL
    ============================ */
    const txt = document.getElementById("export-output");
    txt.value = output.join("\n");

    const modal = document.querySelector(".modal-content");
    modal.style.width = "auto";
    modal.style.height = "auto";

    document.getElementById("exportModal").classList.remove("hidden");
}


/* =====================================================================
   FORMATTING HELPERS (BLK FIXED)
===================================================================== */

function formatUld(pos, load, dest) {

    // NO ULD INSTALLED
    if (!load) {
        // BLK empty → /X
        if (["51","52","53"].includes(pos)) {
            return `-${pos}/X`;
        }
        // normal positions → /N
        return `-${pos}/N`;
    }

    // BLK handling (special format)
    if (load.type === "BLK") {
        const weight = load.weight || 0;
        const bulk = load.bulk === "FKT" ? "E" : load.bulk;
        return `-${pos}/${weight}/${bulk}/${dest}`;
    }

    // FKT → always TYPE/E
    if (load.bulk === "FKT") {
        return `-${pos}/${load.type}${load.uldid}/${dest}/E`;
    }

    // EMPTY ULD → ULD installed but no cargo inside
    if (load.bulk === "EMPTY") {
        const idPart = load.uldid ? load.type + load.uldid : load.type;
        return `-${pos}/${idPart}/${dest}/X`;
    }

    // NORMAL ULD
    const idPart = load.uldid ? load.type + load.uldid : load.type;
    const weight = load.weight || "X";
    const bulk = load.bulk || "BY";

    return `-${pos}/${idPart}/${dest}/${weight}/${bulk}`;
}

function formatAKEPair(L, R, map, dest) {
    const left  = formatUld(L, map[L], dest);
    const right = formatUld(R, map[R], dest);

    // both empty → print nothing
    if (!left && !right) return "";

    // left only
    if (left && !right) return left;

    // right only
    if (!left && right) return right;

    // both exist
    return `${left}${right}`;
}
document.getElementById("closeModal").onclick = function () {
    document.getElementById("exportModal").classList.add("hidden");
};



