/*
 * Real receipts: photos with known year and place, played as bonus cases.
 * Mask coordinates are in pixels of the original photo (w x h; the file is
 * cut to `crop` [x0, y0, x1, y1]) and are
 * measured at the left edge of each band; bands are skewed by `skew`
 * degrees to follow the slant of the printed lines.
 * Private details (card number, transaction IDs, barcode, dates, manager
 * name) are blurred into the image file itself.
 */
(function () {
  window.RD_REAL = [
    {
      id: 'walmart-2021',
      image: 'real/walmart-2021.jpg',
      w: 1052, h: 1476, crop: [170, 90, 870, 1420], skew: -1.9,
      year: 2021, region: 'MW', state: 'MO', place: 'Cameron, Missouri',
      total: 29.02,
      credit: 'Photo shared by Jonah',
      // until: clue tier that uncovers the band (1-3), or 'done' for the final reveal
      masks: [
        { x0: 200, x1: 720, y0: 200, y1: 446, until: 'done', kind: 'blur' },   // store header
        { x0: 255, x1: 775, y0: 519, y1: 567, until: 1 },                      // deviled egg, cashews
        { x0: 255, x1: 775, y0: 567, y1: 612, until: 2 },                      // GV banana chips, Green Goodness
        { x0: 380, x1: 770, y0: 640, y1: 776, until: 2 },                      // subtotal, tax, total
        { x0: 262, x1: 800, y0: 776, y1: 1172, until: 3 },                     // payment block
        { x0: 200, x1: 860, y0: 1172, y1: 1380, until: 'done', kind: 'blur' }  // Walmart+ ad and slogan
      ],
      clues: [
        { type: 'year', text: 'Bananas at 46¢ a pound: banana prices barely moved for years, so they are a decoy.' },
        { type: 'year', text: 'Thermal paper, UPC codes on every line and a chip-card block ("AID", "No Signature Required") point to the late 2010s or later.' },
        { type: 'year', text: 'The "Introducing Walmart+" ad dates it to after Walmart+ launched in September 2020.' },
        { type: 'region', text: 'Groceries were taxed here (6.975% on the whole basket). Missouri is one of the few states that still taxes food.' },
        { type: 'region', text: 'Area code 816 covers the Kansas City area of northwest Missouri.' },
        { type: 'region', text: '"GV" is Great Value, Walmart\'s store brand, so the store itself doesn\'t narrow down the region.' }
      ]
    }
  ];
})();
