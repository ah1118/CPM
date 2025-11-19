/* ==========================================================
   STARTUP SCREEN — Load Aircraft & Flight Setup
========================================================== */

window.addEventListener("DOMContentLoaded", () => {

    const loadBtn = document.getElementById("loadAircraftPopupBtn");

    loadBtn.addEventListener("click", () => {

        // -----------------------------------------
        // GET USER INPUT
        // -----------------------------------------
        const acft = document.getElementById("aircraftSelect").value;
        const flightNo = document.getElementById("flightNumber").value.trim();
        const dest = document.getElementById("flightDestination").value;

        // -----------------------------------------
        // VALIDATION
        // -----------------------------------------
        if (!acft) return alert("Select an aircraft.");
        if (!flightNo) return alert("Enter flight number.");
        if (!dest) return alert("Select a destination.");

        // -----------------------------------------
        // LOAD AIRCRAFT PROFILE
        // -----------------------------------------
        switch (acft) {
            case "EC-NOG":
                window.aircraft = aircraft_ECNOG;
                break;

            default:
                alert("Aircraft profile missing.");
                return;
        }

        // -----------------------------------------
        // STORE FLIGHT DATA (PASSENGERS REMOVED)
        // -----------------------------------------
        window.flightData = {
            flightNo,
            destination: dest
        };

        // -----------------------------------------
        // SHOW MAIN UI
        // -----------------------------------------
        document.getElementById("aircraftPopup").classList.add("hidden");
        document.getElementById("appWrapper").classList.remove("hidden");

        // -----------------------------------------
        // UPDATE HEADER LABELS
        // -----------------------------------------
        document.getElementById("aircraftNameBox").innerText =
            `${window.aircraft.registration} (${window.aircraft.type})`;

        document.getElementById("deckTitle").innerText =
            `${flightNo} → ${dest} — ${window.aircraft.registration}`;

        // -----------------------------------------
        // RENDER CARGO DECK & ENABLE UI BUTTONS
        // -----------------------------------------
        loadAircraftProfile(); 
        enableAppButtons();    
    });
});
