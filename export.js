function exportLayout() {
    const flightNum = document.getElementById("flightNumber").value || "XX";
    const dest      = document.getElementById("flightDestination").value || "XXX";
    const aircraft  = window.aircraft; 
    const reg       = aircraft.registration;


    // get today day only
    const today = new Date();
    const day = today.getDate().toString().padStart(2, "0");

    let output = [];
    output.push("CPM");
    output.push(`${flightNum}/${day}.${reg} ${dest}`);

    // Map pos → load
    const loadsMap = {};
    for (const l of loads) loadsMap[l.position] = l;

    function isEmpty(pos) {
        if (!loadsMap[pos]) return true;
        if (loadsMap[pos].type === "BLK") return false; // BLK counts as filled
        return !loadsMap[pos].uldid;
    }

    /* ================================
       RULE 1 — BLOCKED POSITIONS
    =================================*/
    const blockedPositions = new Set();

    // 1A pallet blocks containers
    for (const pallet in aircraft.palletBlocks) {
        if (!isEmpty(pallet)) {
            for (const pos of aircraft.palletBlocks[pallet])
                blockedPositions.add(pos);
        }
    }

    // 1B container blocks pallet
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

    // pallet-only entries
    for (const pallet of palletOnly) {
        allLines.push({ pos: pallet, text: formatUld(pallet, loadsMap[pallet], dest) });
    }

    // AKE pairs
    for (const [L, R] of aircraft.positionOrder) {
        if (!akePairAllowed(L, R)) continue;
        allLines.push({ pos: L, text: formatAKEPair(L, R, loadsMap, dest) });
    }

    // remaining pallets
    const remainingPallets = aircraft.palletPositions.filter(
        p => !palletOnly.has(p) && !blockedPositions.has(p)
    );

    for (const pallet of remainingPallets) {
        const load = loadsMap[pallet];
        let line = (!load)
            ? `-${pallet}/X`
            : formatUld(pallet, load, dest);
        allLines.push({ pos: pallet, text: line });
    }

    // bulk 51 / 52 / 53
    for (const pos of ["51", "52", "53"]) {
        const load = loadsMap[pos];
        let line = (!load)
            ? `-${pos}/X`
            : formatUld(pos, load, dest);
        allLines.push({ pos, text: line });
    }

    /* ================================
       SORT + OUTPUT
    =================================*/
    allLines.sort((a, b) => parseInt(a.pos) - parseInt(b.pos));
    for (const e of allLines) output.push(e.text);

    /* ============================================
       TOTAL PIECES = SUM OF ALL WEIGHTS
    ============================================ */
    const totalPieces = loads.reduce(
        (sum, l) => sum + (parseInt(l.weight) || 0),
        0
    );

    output.push(`SI CZL-${dest} C 0 M 0 Total Pieces/${totalPieces} O 0 T 0`);

    /* ================================
       APPLY TO TEXTAREA + MODAL
    =================================*/
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

    if (!load) return `-${pos}/X`;

    // ============================
    //  BLK (KEEP SAME AS BEFORE)
    // ============================
    if (load.type === "BLK") {
        const weight = load.weight || 0;
        const bulk   = load.bulk === "FKT" ? "E" : (load.bulk || "BY");
        return `-${pos}/${weight}/${bulk}/${dest}`;
    }

    // ============================
    //  SPECIAL RULE FOR FKT
    // ============================
    if (load.bulk === "FKT") {
        // FKT → E and REMOVE ULDID + WEIGHT
        return `-${pos}/${load.type}/E/${dest}`;
    }

    // ============================
    //  NORMAL ULD FORMAT
    // ============================
    if (!load.uldid) return `-${pos}/X`;

    const weight = load.weight || "X";
    const bulk   = load.bulk === "FKT" ? "E" : (load.bulk || "BY");
    const typeWithId = `${load.type}${load.uldid}`;

    return `-${pos}/${typeWithId}/${weight}/${bulk}/${dest}`;
}



function formatAKEPair(L, R, map, dest) {
    const left  = formatUld(L, map[L], dest);
    const right = formatUld(R, map[R], dest);
    return `${left}${right}`;
}


document.getElementById("closeModal").onclick = function () {
    document.getElementById("exportModal").classList.add("hidden");
};
