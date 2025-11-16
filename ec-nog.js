/* ==========================================================
   AIRCRAFT PROFILE – A330-200  EC-NOG
   ========================================================== */

export const aircraft = {
  registration: 'EC-NOG',
  type: 'A330-223F',          // optional, human readable
  maxGrossWeight: 233000,     // kg – not used yet, ready for W&B
};

/* -------------  POSITION LISTS  --------------------------- */

export const containerPositions = [
  /* Forward hold */
  '26L','25L','24L','23L','22L','21L','13L','12L','11L',
  '26R','25R','24R','23R','22R','21R','13R','12R','11R',
  /* Aft hold */
  '43L','42L','41L','34L','33L','32L','31L',
  '43R','42R','41R','34R','33R','32R','31R'
];

export const palletPositions = [
  /* Forward */
  '24P','23P','22P','21P','12P','11P',
  /* Aft */
  '42P','41P','33P','32P','31P'
];

/* -------------  BLOCKING RULES  --------------------------- */
/* Same logic you already had, just owned by the profile now */

export const palletBlocks = {
  /* ---- Forward ---- */
  '24P': ['26L','26R','25L','25R'],
  '23P': ['25L','25R','24L','24R'],
  '22P': ['23L','23R','22L','22R'],
  '21P': ['22L','22R','21L','21R'],
  '12P': ['13L','13R','12L','12R'],
  '11P': ['12L','12R','11L','11R'],

  /* ---- Aft ---- */
  '42P': ['43L','43R','42L','42R'],
  '41P': ['42L','42R','41L','41R'],
  '33P': ['34L','34R','33L','33R'],
  '32P': ['33L','33R','32L','32R'],
  '31P': ['31L','31R']
};

/* -------------  REVERSE LOOKUP (auto-generated) --------- */
export const containerBlocks = {};

for (const [p, contList] of Object.entries(palletBlocks)) {
  contList.forEach(c => {
    if (!containerBlocks[c]) containerBlocks[c] = [];
    containerBlocks[c].push(p);
  });
}
