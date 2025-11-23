function calculateLDMCargo() {
    let compartments = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    let totalNet = 0;

    for (const l of loads) {
        if (!l.position) continue;

        const comp = parseInt(l.position.charAt(0));
        const gross = parseInt(l.weight) || 0;
        const tare  = ULD_TARE[l.type] || 0;

        let net = gross - tare;
        if (net < 0) net = 0;

        // FKT = zero always
        if (l.bulk === "FKT") {
            net = 0;
        }

        // BLK = full weight
        if (l.type === "BLK") {
            net = gross;
        }

        // ADD NET
        compartments[comp] += net;
        totalNet += net;

        // ⭐ FIX: DO NOT add tare for FKT loads
        if (l.type !== "BLK" && l.bulk !== "FKT") {
            compartments[comp] += tare;
        }
    }

    return {
        compTotals: compartments,
        total: compartments[1] + compartments[2] + compartments[3] + compartments[4] + compartments[5],
        netCargo: totalNet
    };
}



function exportLDM() {

    if (!allLoadsValid()) {
        alert("Fill all ULD details before exporting.\n(ULD ID, Weight, BULK, Position)");
        return;
    }

    const flight = document.getElementById("flightNumber").value || "XX000";
    const dest   = document.getElementById("flightDestination").value || "XXX";
    const ac     = window.aircraft;
    const reg    = ac.registration;
    const day = new Date().getDate().toString().padStart(2, "0");

    // SUMMARY COUNTS
    const M = parseInt(document.getElementById("sumMale").value   || 0);
    const F = parseInt(document.getElementById("sumFemale").value || 0);
    const C = parseInt(document.getElementById("sumChild").value  || 0);
    const I = parseInt(document.getElementById("sumInfant").value || 0);
    const totalPieces = parseInt(document.getElementById("sumPieces").value || 0);
    const totalPAX = M + F + C;

    // NEW CALCULATIONS
    const cargo = calculateLDMCargo();
    const comp = cargo.compTotals;
    const Ttotal = cargo.total;
    const cargoTotalNet = cargo.netCargo;

    // COMPACT COMPARTMENT STRING (skip zeros)
    let compString = "";
    for (let i = 1; i <= 5; i++) {
        if (comp[i] > 0) {
            compString += `${i}/${comp[i]}.`;
        }
    }

    // BUILD OUTPUT
    const out = [];

    out.push("LDM");
    out.push(`${flight}/${day}.${reg}.${ac.ldm.station}.${ac.ldm.seatTotal}.${ac.ldm.seatConfig}`);

    // second line compact, NO SPACES
    out.push(
        `${dest}.` +
        `${M}/${F}/${C}/${I}.` +
        `T${Ttotal}.` +
        compString +
        `PAX/${totalPAX}.` +
        `PAD/0`
    );

    // Third line stays same format
    out.push(`${dest} C 0 M 0 B ${totalPieces}/${cargoTotalNet} 0`);

    // SHOW OUTPUT
    const txt = document.getElementById("export-output");
    txt.value = out.join("\n");
    document.getElementById("exportModal").classList.remove("hidden");
}


