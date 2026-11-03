/*
 * Receipt Detective: price and product data.
 *
 * STAPLES: approximate US city-average retail prices, anchored on BLS
 * "Average Price Data" series (CPI program) and historical summaries.
 * Years between anchors are interpolated on a log scale. Values are
 * approximations meant to feel right, not exact BLS figures; swap in the
 * real series (e.g. APU0000708111 for eggs) when refining.
 *
 * SPECIALS: branded items. Each has a launch/retire window, an optional
 * region, and a 2025 shelf price that is scaled back by CPI for older years.
 */
(function () {
  const CPI = {
    1950: 24.1, 1951: 26.0, 1952: 26.5, 1953: 26.7, 1954: 26.9, 1955: 26.8, 1956: 27.2, 1957: 28.1,
    1958: 28.9, 1959: 29.1, 1960: 29.6, 1961: 29.9, 1962: 30.2, 1963: 30.6, 1964: 31.0, 1965: 31.5,
    1966: 32.4, 1967: 33.4, 1968: 34.8, 1969: 36.7, 1970: 38.8, 1971: 40.5, 1972: 41.8, 1973: 44.4,
    1974: 49.3, 1975: 53.8, 1976: 56.9, 1977: 60.6, 1978: 65.2, 1979: 72.6, 1980: 82.4, 1981: 90.9,
    1982: 96.5, 1983: 99.6, 1984: 103.9, 1985: 107.6, 1986: 109.6, 1987: 113.6, 1988: 118.3,
    1989: 124.0, 1990: 130.7, 1991: 136.2, 1992: 140.3, 1993: 144.5, 1994: 148.2, 1995: 152.4,
    1996: 156.9, 1997: 160.5, 1998: 163.0, 1999: 166.6, 2000: 172.2, 2001: 177.1, 2002: 179.9,
    2003: 184.0, 2004: 188.9, 2005: 195.3, 2006: 201.6, 2007: 207.3, 2008: 215.3, 2009: 214.5,
    2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233.0, 2014: 236.7, 2015: 237.0, 2016: 240.0,
    2017: 245.1, 2018: 251.1, 2019: 255.7, 2020: 258.8, 2021: 271.0, 2022: 292.7, 2023: 304.7,
    2024: 313.7, 2025: 322.0
  };

  const REGION_FACTOR = { NE: 1.06, MW: 0.96, S: 0.97, W: 1.04 };

  // sizes: [fromYear, name label, price factor, receipt label, clue]
  const STAPLES = [
    { id: 'eggs', n: 'Grade A large eggs', a: 'LG EGGS', dept: 'DY', reg: { NE: 1.06, MW: 0.92, S: 0.98, W: 1.1 },
      sizes: [[1950, 'dozen', 1, 'DZ']],
      p: { 1950: .60, 1955: .61, 1960: .57, 1965: .53, 1970: .61, 1973: .78, 1975: .77, 1980: .84, 1985: .80, 1990: 1.00, 1995: .86, 2000: .96, 2005: 1.22, 2010: 1.66, 2014: 2.00, 2015: 2.47, 2016: 1.68, 2019: 1.40, 2020: 1.51, 2021: 1.67, 2022: 2.86, 2023: 2.70, 2024: 3.17, 2025: 4.50 },
      events: [[2015, 2015, 'Bird flu pushed egg prices up in 2015.'], [2022, 2025, 'Bird flu sent egg prices soaring from 2022 on.']] },
    { id: 'milk', n: 'Whole milk', a: 'WHOLE MILK', dept: 'DY', reg: { NE: 1.06, MW: 0.92, S: 1.02, W: 1.0 },
      sizes: [[1950, '½ gal', 0.5, '1/2 GAL', 'Milk came in half-gallon bottles until plastic gallon jugs took over in the 1960s.'], [1964, 'gallon', 1, 'GAL']],
      p: { 1950: .82, 1955: .92, 1960: 1.04, 1965: 1.06, 1970: 1.32, 1975: 1.57, 1980: 2.05, 1985: 2.25, 1990: 2.45, 1995: 2.48, 2000: 2.78, 2005: 3.19, 2008: 3.80, 2010: 3.32, 2014: 3.69, 2015: 3.42, 2018: 2.90, 2020: 3.32, 2022: 4.10, 2023: 3.95, 2025: 4.15 } },
    { id: 'bread', n: 'White bread', a: 'WHITE BREAD', dept: 'BK', reg: { NE: 1.08, MW: 0.95, S: 0.95, W: 1.04 },
      sizes: [[1950, '1 lb loaf', 1, '']],
      p: { 1950: .14, 1955: .18, 1960: .20, 1965: .21, 1970: .24, 1975: .36, 1980: .51, 1985: .55, 1990: .70, 1995: .84, 2000: .92, 2005: 1.05, 2010: 1.39, 2015: 1.42, 2020: 1.47, 2022: 1.70, 2024: 2.00, 2025: 1.95 } },
    { id: 'beef', n: 'Ground beef', a: 'GRND BEEF', dept: 'MT', w: [1, 2.8], reg: { NE: 1.08, MW: 0.95, S: 0.96, W: 1.04 },
      p: { 1950: .53, 1955: .40, 1960: .53, 1965: .50, 1970: .66, 1973: .92, 1975: .88, 1979: 1.40, 1980: 1.39, 1985: 1.25, 1990: 1.63, 1995: 1.40, 2000: 1.63, 2005: 2.30, 2010: 2.38, 2014: 3.80, 2015: 4.16, 2017: 3.60, 2020: 4.30, 2022: 4.80, 2024: 5.50, 2025: 6.10 },
      events: [[2014, 2015, 'Beef hit record highs in 2014–15 after drought shrank herds.'], [2024, 2025, 'Ground beef set new records in 2024–25.']] },
    { id: 'coffee', n: 'Ground coffee', a: 'GRND COFFEE', dept: 'GR', reg: { NE: 1.03, MW: 0.98, S: 0.98, W: 1.02 },
      sizes: [[1950, '1 lb can', 1, '1LB'], [1989, '13 oz can', 0.8125, '13OZ', 'The "pound" of coffee quietly shrank to 13 oz around 1989.'], [2008, '11.3 oz can', 0.706, '11.3OZ', 'Coffee cans shrank again to 11.3 oz around 2008.']],
      p: { 1950: .79, 1954: 1.10, 1955: .93, 1960: .75, 1965: .83, 1970: .91, 1975: 1.33, 1976: 1.90, 1977: 3.10, 1980: 2.97, 1985: 2.65, 1990: 2.94, 1995: 3.68, 2000: 3.40, 2005: 3.30, 2010: 3.90, 2012: 5.50, 2015: 4.50, 2020: 4.40, 2022: 5.90, 2024: 6.30, 2025: 8.00 },
      events: [[1976, 1978, 'A 1975 Brazilian frost made coffee prices jump in 1976–78.'], [2025, 2025, 'Coffee hit record prices in 2025.']] },
    { id: 'bananas', n: 'Bananas', a: 'BANANAS', dept: 'PR', w: [1.4, 3.4], reg: { NE: 1.04, MW: 1.0, S: 0.98, W: 0.98 },
      p: { 1950: .16, 1960: .16, 1970: .12, 1975: .20, 1980: .34, 1985: .37, 1990: .43, 1995: .46, 2000: .50, 2005: .49, 2010: .58, 2015: .58, 2020: .58, 2022: .63, 2025: .65 },
      events: [[2005, 2025, 'Bananas barely changed price for decades, so they make a sneaky decoy.']] },
    { id: 'sugar', n: 'Sugar', a: 'SUGAR', dept: 'GR',
      sizes: [[1950, '5 lb bag', 1, '5LB']],
      p: { 1950: .49, 1960: .58, 1970: .65, 1973: .75, 1974: 1.90, 1975: 1.85, 1976: 1.20, 1979: 1.40, 1980: 2.00, 1981: 1.80, 1985: 1.75, 1990: 2.00, 1995: 2.00, 2000: 2.15, 2005: 2.10, 2010: 3.00, 2012: 3.40, 2015: 3.20, 2020: 3.10, 2022: 3.80, 2024: 4.20, 2025: 4.30 },
      events: [[1974, 1975, 'Sugar prices spiked in 1974–75.']] },
    { id: 'butter', n: 'Butter', a: 'BUTTER', dept: 'DY',
      sizes: [[1950, '1 lb', 1, '1LB']],
      p: { 1950: .73, 1960: .75, 1970: .87, 1975: 1.07, 1980: 1.88, 1985: 2.10, 1990: 1.90, 1995: 1.70, 1998: 3.00, 2000: 2.80, 2005: 3.10, 2010: 3.40, 2015: 3.80, 2020: 3.80, 2022: 4.70, 2024: 4.70, 2025: 4.60 } },
    { id: 'potatoes', n: 'Russet potatoes', a: 'POTATOES', dept: 'PR',
      sizes: [[1950, '10 lb bag', 1, '10LB'], [1985, '5 lb bag', 0.55, '5LB']],
      p: { 1950: .46, 1960: .72, 1970: .90, 1975: 1.30, 1980: 2.20, 1985: 2.40, 1990: 3.20, 1995: 3.80, 2000: 3.50, 2005: 5.00, 2010: 5.70, 2015: 6.90, 2020: 7.80, 2022: 9.00, 2025: 9.50 } },
    { id: 'chicken', n: 'Whole fryer chicken', a: 'WHOLE FRYER', dept: 'MT', w: [3, 4.6],
      p: { 1950: .59, 1955: .46, 1960: .43, 1970: .41, 1975: .63, 1980: .72, 1985: .76, 1990: .86, 1995: .95, 2000: 1.08, 2005: 1.05, 2010: 1.27, 2015: 1.48, 2020: 1.55, 2022: 1.90, 2025: 2.05 },
      events: [[1955, 1972, 'Factory farming made chicken cheaper per pound in the 1960s than in 1950.']] },
    { id: 'flour', n: 'All-purpose flour', a: 'FLOUR', dept: 'GR',
      sizes: [[1950, '5 lb bag', 1, '5LB']],
      p: { 1950: .49, 1960: .55, 1970: .58, 1974: 1.00, 1975: .95, 1980: 1.00, 1985: 1.10, 1990: 1.20, 1995: 1.20, 2000: 1.40, 2005: 1.50, 2008: 2.30, 2010: 2.20, 2015: 2.50, 2020: 2.30, 2022: 2.80, 2025: 3.00 } },
    { id: 'bacon', n: 'Sliced bacon', a: 'BACON', dept: 'MT',
      sizes: [[1950, '1 lb', 1, '1LB'], [2005, '12 oz', 0.78, '12OZ', 'Bacon packages shrank from a pound to 12 oz in the 2000s.']],
      p: { 1950: .64, 1960: .66, 1970: .95, 1975: 1.86, 1980: 1.46, 1985: 1.85, 1990: 2.28, 1995: 2.17, 2000: 3.03, 2005: 3.30, 2010: 4.20, 2015: 5.60, 2020: 5.70, 2022: 7.30, 2024: 6.90, 2025: 7.10 } }
  ];

  // S(slot, name, receipt abbr, from, to, regions, 2025 price, clue, nonfood, fixedPrice)
  const S = (slot, n, a, f, t, r, p, c, nonfood, fixed) => ({ slot, n, a, f, t, r: r ? r.split(',') : null, p, c: c || null, nonfood: !!nonfood, fixed: fixed || null });

  // P(slot, name, abbr, from, to, {year: nominal price}, clue): non-food items whose
  // prices did not track CPI (appliances and electronics mostly got cheaper).
  const P = (slot, n, a, f, t, pa, c) => Object.assign(S(slot, n, a, f, t, null, 0, c, true), { pa });

  const SPECIALS = [
    // Soda
    S('soda', 'Coca-Cola 6-pk', 'COCA-COLA 6PK', 1950, 1984, null, 4.49),
    S('soda', 'Coca-Cola 6-pk', 'COCA-COLA 6PK', 2009, 2025, null, 4.49),
    S('soda', 'Coca-Cola Classic 6-pk', 'COKE CLASSIC 6PK', 1985, 2008, null, 4.49, 'After the 1985 New Coke flop, the original was sold as "Coca-Cola Classic" until 2009.'),
    S('soda', 'New Coke 6-pk', 'NEW COKE 6PK', 1985, 1985, null, 4.49, 'New Coke replaced the original formula for just a few months in 1985.'),
    S('soda', 'Diet Coke 6-pk', 'DIET COKE 6PK', 1982, 2025, null, 4.49, 'Diet Coke launched in 1982.'),
    S('soda', 'Tab 6-pk', 'TAB 6PK', 1963, 1984, null, 4.49, 'Tab (1963) was Coca-Cola\'s diet soda before Diet Coke arrived.'),
    S('soda', 'Pepsi-Cola 6-pk', 'PEPSI 6PK', 1950, 2025, null, 4.49),
    S('soda', 'Diet Pepsi 6-pk', 'DIET PEPSI 6PK', 1964, 2025, null, 4.49, 'Diet Pepsi debuted in 1964.'),
    S('soda', 'Crystal Pepsi 6-pk', 'CRYSTAL PEPSI 6PK', 1992, 1993, null, 4.49, 'Crystal Pepsi, the clear cola, was only sold in 1992–93.'),
    S('soda', 'Surge 6-pk', 'SURGE 6PK', 1997, 2002, null, 4.49, 'Surge was Coca-Cola\'s citrus soda from 1997 to 2002.'),
    S('soda', 'Coke Zero 6-pk', 'COKE ZERO 6PK', 2005, 2016, null, 4.49, 'Coke Zero launched in 2005.'),
    S('soda', 'Coke Zero Sugar 6-pk', 'COKE ZERO SGR 6PK', 2017, 2025, null, 4.49, 'Coke Zero was renamed Coke Zero Sugar in 2017.'),
    S('soda', 'RC Cola 6-pk', 'RC COLA 6PK', 1950, 1989, null, 3.99),
    S('soda', 'Faygo pop 6-pk', 'FAYGO 6PK', 1950, 2025, 'MW', 3.49, 'Faygo is Detroit\'s own pop.'),
    S('soda', 'Vernors ginger ale 6-pk', 'VERNORS 6PK', 1950, 2025, 'MW', 4.29, 'Vernors ginger ale is a Michigan classic.'),
    S('soda', 'LaCroix sparkling water 8-pk', 'LACROIX 8PK', 1981, 2013, 'MW', 5.49, 'LaCroix was a Wisconsin brand before its national boom in the mid-2010s.'),
    S('soda', 'LaCroix sparkling water 8-pk', 'LACROIX 8PK', 2014, 2025, null, 5.49, 'LaCroix went from Midwest brand to national craze in the mid-2010s.'),
    S('soda', 'Cheerwine 6-pk', 'CHEERWINE 6PK', 1950, 2025, 'S', 4.49, 'Cheerwine is a cherry soda from North Carolina.'),
    S('soda', 'Big Red 6-pk', 'BIG RED 6PK', 1950, 2025, 'S', 3.99, 'Big Red is a Texas soda.'),
    S('soda', 'Sun Drop 6-pk', 'SUN DROP 6PK', 1953, 2025, 'S', 3.99, 'Sun Drop is a Southern citrus soda.'),
    S('soda', 'Moxie 6-pk', 'MOXIE 6PK', 1950, 2025, 'NE', 4.99, 'Moxie is New England\'s famously bitter soda.'),
    S('soda', 'Polar seltzer 8-pk', 'POLAR SELTZER 8PK', 1985, 2025, 'NE', 4.49, 'Polar is a Massachusetts seltzer maker.'),
    S('soda', 'Hansen\'s natural soda 6-pk', 'HANSENS SODA 6PK', 1978, 2025, 'W', 4.49, 'Hansen\'s natural sodas started in Southern California in 1978.'),

    // Chips
    S('chips', 'Lay\'s potato chips', 'LAYS POT CHIPS', 1950, 2025, null, 5.49),
    S('chips', 'Ruffles potato chips', 'RUFFLES', 1958, 2025, null, 5.49, 'Ruffles appeared in 1958.'),
    S('chips', 'Doritos', 'DORITOS', 1966, 2025, null, 5.49, 'Doritos went national in 1966.'),
    S('chips', 'Pringles', 'PRINGLES', 1975, 2025, null, 2.79, 'Pringles went national in 1975.'),
    S('chips', 'Baked Lay\'s', 'BAKED LAYS', 1996, 2025, null, 5.49, 'Baked Lay\'s arrived in 1996.'),
    S('chips', 'WOW! fat-free chips', 'WOW CHIPS', 1998, 2003, null, 5.49, 'Fat-free Olestra "WOW!" chips were a 1998–2003 fad.'),
    S('chips', 'Takis Fuego', 'TAKIS FUEGO', 2012, 2025, null, 4.99, 'Takis spread to stores nationwide in the 2010s.'),
    S('chips', 'Utz potato chips', 'UTZ CHIPS', 1950, 2025, 'NE', 4.99, 'Utz is a Pennsylvania chip maker.'),
    S('chips', 'Wise potato chips', 'WISE CHIPS', 1950, 2025, 'NE', 4.49, 'Wise chips are an East Coast brand.'),
    S('chips', 'Jays potato chips', 'JAYS CHIPS', 1950, 2025, 'MW', 4.49, 'Jays chips are from Chicago.'),
    S('chips', 'Old Dutch potato chips', 'OLD DUTCH CHIPS', 1950, 2025, 'MW', 4.49, 'Old Dutch is a Minnesota chip brand.'),
    S('chips', 'Better Made potato chips', 'BETTER MADE CHIPS', 1950, 2025, 'MW', 4.49, 'Better Made chips are from Detroit.'),
    S('chips', 'Zapp\'s kettle chips', 'ZAPPS CHIPS', 1985, 2025, 'S', 4.49, 'Zapp\'s kettle chips come from Louisiana (since 1985).'),
    S('chips', 'Golden Flake potato chips', 'GOLDEN FLAKE', 1950, 2025, 'S', 4.29, 'Golden Flake is from Birmingham, Alabama.'),
    S('chips', 'Laura Scudder\'s potato chips', 'LAURA SCUDDERS', 1950, 1999, 'W', 4.49, 'Laura Scudder\'s was a California chip brand.'),
    S('chips', 'Granny Goose potato chips', 'GRANNY GOOSE', 1950, 2005, 'W', 4.49, 'Granny Goose chips were from Oakland, California.'),
    S('chips', 'Tim\'s Cascade chips', 'TIMS CASCADE', 1986, 2025, 'W', 4.49, 'Tim\'s Cascade chips are from Washington State (1986).'),

    // Cereal
    S('cereal', 'Cheerios', 'CHEERIOS', 1950, 2025, null, 5.29),
    S('cereal', 'Kellogg\'s Corn Flakes', 'CORN FLAKES', 1950, 2025, null, 4.79),
    S('cereal', 'Wheaties', 'WHEATIES', 1950, 2025, null, 5.29),
    S('cereal', 'Kix', 'KIX', 1950, 2025, null, 5.29),
    S('cereal', 'Sugar Frosted Flakes', 'SGR FROSTED FLAKES', 1952, 1982, null, 4.99, 'It was "Sugar Frosted Flakes" until Kellogg\'s dropped the "Sugar" in 1983.'),
    S('cereal', 'Frosted Flakes', 'FROSTED FLAKES', 1983, 2025, null, 4.99),
    S('cereal', 'Trix', 'TRIX', 1954, 2025, null, 5.29, 'Trix debuted in 1954.'),
    S('cereal', 'Special K', 'SPECIAL K', 1955, 2025, null, 5.49, 'Special K debuted in 1955.'),
    S('cereal', 'Cap\'n Crunch', 'CAPN CRUNCH', 1963, 2025, null, 4.99, 'Cap\'n Crunch debuted in 1963.'),
    S('cereal', 'Froot Loops', 'FROOT LOOPS', 1963, 2025, null, 4.99, 'Froot Loops debuted in 1963.'),
    S('cereal', 'Lucky Charms', 'LUCKY CHARMS', 1964, 2025, null, 5.29, 'Lucky Charms debuted in 1964.'),
    S('cereal', 'Count Chocula', 'COUNT CHOCULA', 1971, 2009, null, 4.99, 'Count Chocula arrived in 1971 (and went Halloween-only around 2010).'),
    S('cereal', 'Honey Nut Cheerios', 'HONEY NUT CHEERIOS', 1979, 2025, null, 5.29, 'Honey Nut Cheerios launched in 1979.'),
    S('cereal', 'Cinnamon Toast Crunch', 'CINN TOAST CRUNCH', 1984, 2025, null, 5.29, 'Cinnamon Toast Crunch launched in 1984.'),

    // Mayo
    S('mayo', 'Hellmann\'s mayonnaise', 'HELLMANNS MAYO', 1950, 2025, 'NE,MW,S', 6.49, 'Hellmann\'s is sold east of the Rockies; out West the same mayo is Best Foods.'),
    S('mayo', 'Best Foods mayonnaise', 'BEST FOODS MAYO', 1950, 2025, 'W', 6.49, 'Best Foods is the Western name for Hellmann\'s.'),
    S('mayo', 'Duke\'s mayonnaise', 'DUKES MAYO', 1950, 2025, 'S', 5.99, 'Duke\'s mayo is a Southern staple.'),
    S('mayo', 'Blue Plate mayonnaise', 'BLUE PLATE MAYO', 1950, 2025, 'S', 5.49, 'Blue Plate mayo is from New Orleans.'),
    S('mayo', 'Miracle Whip', 'MIRACLE WHIP', 1950, 2025, null, 5.49),

    // Ice cream ({s} becomes the carton size)
    S('icecream', 'Breyers ice cream {s}', 'BREYERS {S}', 1950, 2025, null, 5.99),
    S('icecream', 'Edy\'s ice cream {s}', 'EDYS {S}', 1950, 2025, 'NE,MW,S', 5.99, 'East of the Rockies, Dreyer\'s ice cream is sold as Edy\'s.'),
    S('icecream', 'Dreyer\'s ice cream {s}', 'DREYERS {S}', 1950, 2025, 'W', 5.99, 'Dreyer\'s is the Western name for Edy\'s.'),
    S('icecream', 'Blue Bell ice cream {s}', 'BLUE BELL {S}', 1950, 2025, 'S', 6.99, 'Blue Bell ice cream is from Brenham, Texas.'),
    S('icecream', 'Tillamook ice cream {s}', 'TILLAMOOK {S}', 1950, 2025, 'W', 6.49, 'Tillamook is an Oregon dairy co-op.'),
    S('icecream', 'Hood ice cream {s}', 'HOOD {S}', 1950, 2025, 'NE', 5.99, 'Hood is New England\'s big dairy.'),
    S('icecream', 'Turkey Hill ice cream {s}', 'TURKEY HILL {S}', 1950, 2025, 'NE', 5.49, 'Turkey Hill is a Pennsylvania dairy.'),
    S('icecream', 'Kemps ice cream {s}', 'KEMPS {S}', 1950, 2025, 'MW', 5.49, 'Kemps is a Minnesota dairy.'),
    S('icecream', 'Blue Bunny ice cream {s}', 'BLUE BUNNY {S}', 1950, 2025, 'MW', 5.49, 'Blue Bunny is made in Le Mars, Iowa.'),
    S('icecream', 'Mayfield ice cream {s}', 'MAYFIELD {S}', 1950, 2025, 'S', 5.49, 'Mayfield Dairy is from Tennessee.'),

    // Cheese
    S('cheese', 'Tillamook cheddar 2 lb', 'TILLAMOOK CHED 2LB', 1950, 2025, 'W', 11.99, 'Tillamook cheddar is from Oregon.'),
    S('cheese', 'Cabot sharp cheddar', 'CABOT CHEDDAR', 1950, 2025, 'NE', 3.99, 'Cabot is a Vermont creamery.'),
    S('cheese', 'Kraft Singles', 'KRAFT SINGLES', 1965, 2025, null, 3.99, 'Individually wrapped Kraft Singles arrived in 1965.'),
    S('cheese', 'Velveeta 2 lb', 'VELVEETA 2LB', 1950, 2025, null, 9.99),

    // Bakery
    S('bakery', 'Thomas\' English muffins', 'THOMAS ENG MUFFIN', 1950, 2025, null, 3.99),
    S('bakery', 'Franz hamburger buns', 'FRANZ BUNS', 1950, 2025, 'W', 3.99, 'Franz is a Pacific Northwest bakery.'),
    S('bakery', 'Arnold whole wheat bread', 'ARNOLD WHEAT', 1950, 2025, 'NE', 4.99, 'Arnold bread is a Northeast brand.'),
    S('bakery', 'Bunny Bread buns', 'BUNNY BUNS', 1950, 2025, 'S,MW', 2.99, 'Bunny Bread is sold in the South and lower Midwest.'),
    S('bakery', 'Nature\'s Own honey wheat', 'NATURES OWN', 1978, 2025, 'S', 3.49, 'Nature\'s Own (1978) comes from Georgia\'s Flowers Foods.'),
    S('bakery', 'Dave\'s Killer Bread', 'DAVES KILLER BRD', 2005, 2014, 'W', 6.49, 'Dave\'s Killer Bread started in Oregon in 2005.'),
    S('bakery', 'Dave\'s Killer Bread', 'DAVES KILLER BRD', 2015, 2025, null, 6.49, 'Dave\'s Killer Bread went national around 2015.'),

    // Snacks
    S('snack', 'Oreo cookies', 'OREO', 1950, 2025, null, 5.49),
    S('snack', 'Cheez-It crackers', 'CHEEZ-IT', 1950, 2025, null, 5.29),
    S('snack', 'Hostess Twinkies', 'TWINKIES', 1950, 2025, null, 4.49),
    S('snack', 'Goldfish crackers', 'GOLDFISH', 1962, 2025, null, 3.49, 'Goldfish crackers came to the US in 1962.'),
    S('snack', 'Chips Ahoy!', 'CHIPS AHOY', 1963, 2025, null, 5.29, 'Chips Ahoy! launched in 1963.'),
    S('snack', 'Pop-Tarts', 'POP-TARTS', 1964, 2025, null, 4.29, 'Pop-Tarts launched in 1964.'),
    S('snack', 'Little Debbie Oatmeal Creme Pies', 'LTL DEBBIE OATML', 1960, 2025, null, 2.99, 'Little Debbie snack cakes started in 1960.'),
    S('snack', 'Teddy Grahams', 'TEDDY GRAHAMS', 1988, 2025, null, 4.49, 'Teddy Grahams launched in 1988.'),
    S('snack', 'SnackWell\'s cookies', 'SNACKWELLS', 1992, 2025, null, 4.29, 'SnackWell\'s rode the early-\'90s low-fat craze.'),
    S('snack', 'Clif Bar', 'CLIF BAR', 1992, 2025, null, 1.79, 'Clif Bar launched in 1992.'),
    S('snack', 'Kind bar', 'KIND BAR', 2004, 2025, null, 1.99, 'Kind bars launched in 2004.'),
    S('snack', 'Tastykake Butterscotch Krimpets', 'TASTYKAKE', 1950, 2025, 'NE', 4.49, 'Tastykake is a Philadelphia bakery.'),
    S('snack', 'Drake\'s coffee cakes', 'DRAKES CAKES', 1950, 2025, 'NE', 4.49, 'Drake\'s cakes are a New York-area classic.'),
    S('snack', 'Moon Pie', 'MOON PIE', 1950, 2025, 'S', 3.99, 'Moon Pies come from Chattanooga, Tennessee.'),

    // Frozen
    S('frozen', 'Swanson TV Dinner', 'SWANSON TV DINNER', 1953, 1962, null, 3.49, 'Swanson\'s "TV Dinner" debuted in 1953.'),
    S('frozen', 'Swanson frozen dinner', 'SWANSON DINNER', 1963, 2025, null, 3.49),
    S('frozen', 'Birds Eye frozen peas', 'BIRDS EYE PEAS', 1950, 2025, null, 2.49),
    S('frozen', 'Eggo waffles', 'EGGO WAFFLES', 1955, 2025, null, 3.99, 'Eggo frozen waffles appeared in 1955.'),
    S('frozen', 'Ore-Ida Tater Tots', 'TATER TOTS', 1956, 2025, null, 4.99, 'Ore-Ida introduced Tater Tots in 1956.'),
    S('frozen', 'Cool Whip', 'COOL WHIP', 1966, 2025, null, 2.99, 'Cool Whip appeared in 1966.'),
    S('frozen', 'Totino\'s Pizza Rolls', 'PIZZA ROLLS', 1968, 2025, null, 5.99, 'Pizza Rolls appeared in 1968.'),
    S('frozen', 'Lean Cuisine entrée', 'LEAN CUISINE', 1981, 2025, null, 3.99, 'Lean Cuisine launched in 1981.'),
    S('frozen', 'Hot Pockets', 'HOT POCKETS', 1983, 2025, null, 3.49, 'Hot Pockets launched in 1983.'),
    S('frozen', 'Bagel Bites', 'BAGEL BITES', 1985, 2025, null, 4.49, 'Bagel Bites launched in 1985.'),
    S('frozen', 'DiGiorno pizza', 'DIGIORNO PIZZA', 1995, 2025, null, 8.99, 'DiGiorno launched in 1995.'),
    S('frozen', 'Beyond Burger 2-pk', 'BEYOND BURGER', 2016, 2025, null, 6.99, 'Beyond Burger hit grocery meat cases in 2016.'),

    // Pantry
    S('pantry', 'Kraft Macaroni & Cheese', 'KRAFT MAC&CHS', 1950, 2025, null, 1.49),
    S('pantry', 'Campbell\'s tomato soup', 'CAMPBELL TOM SOUP', 1950, 2025, null, 1.29),
    S('pantry', 'Jell-O gelatin', 'JELL-O', 1950, 2025, null, 1.49),
    S('pantry', 'Spam', 'SPAM', 1950, 2025, null, 4.49),
    S('pantry', 'Jif peanut butter', 'JIF PNT BTR', 1958, 2025, null, 3.99, 'Jif peanut butter launched in 1958.'),
    S('pantry', 'Rice-A-Roni', 'RICE-A-RONI', 1958, 2025, null, 1.79, 'Rice-A-Roni launched in 1958.'),
    S('pantry', 'Tang drink mix', 'TANG', 1959, 2025, null, 4.49, 'Tang hit shelves in 1959.'),
    S('pantry', 'Orville Redenbacher\'s popcorn', 'ORVILLE POPCORN', 1970, 2025, null, 4.99, 'Orville Redenbacher\'s popcorn launched in 1970.'),
    S('pantry', 'Hamburger Helper', 'HAMBURGER HELPER', 1971, 2025, null, 2.29, 'Hamburger Helper launched in 1971.'),
    S('pantry', 'Stove Top stuffing', 'STOVE TOP', 1972, 2025, null, 2.49, 'Stove Top stuffing launched in 1972.'),
    S('pantry', 'Hidden Valley Ranch', 'HIDDEN VALLEY RANCH', 1983, 2025, null, 4.29, 'Bottled Hidden Valley Ranch hit stores in 1983.'),
    S('pantry', 'Pop Secret microwave popcorn', 'POP SECRET', 1985, 2025, null, 4.29, 'Pop Secret microwave popcorn launched in 1985.'),
    S('pantry', 'Easy Mac cups', 'EASY MAC', 1999, 2025, null, 4.49, 'Easy Mac launched in 1999.'),
    S('pantry', 'Sriracha hot chili sauce', 'SRIRACHA', 2009, 2025, null, 4.99, 'Sriracha went mainstream around 2010.'),
    S('pantry', 'Quinoa', 'QUINOA', 2011, 2025, null, 4.99, 'Quinoa hit mainstream grocery shelves in the 2010s.'),
    S('pantry', 'Marshmallow Fluff', 'MARSHMALLOW FLUFF', 1950, 2025, 'NE', 2.99, 'Marshmallow Fluff is a Massachusetts classic.'),
    S('pantry', 'B&M baked beans', 'B&M BEANS', 1950, 2025, 'NE', 3.49, 'B&M baked beans are from Portland, Maine.'),
    S('pantry', 'Marzetti slaw dressing', 'MARZETTI DRSG', 1950, 2025, 'MW', 3.99, 'Marzetti is an Ohio dressing brand.'),
    S('pantry', 'Skyline Chili', 'SKYLINE CHILI', 1950, 2025, 'MW', 3.49, 'Skyline Chili is a Cincinnati institution.'),
    S('pantry', 'Johnsonville brats', 'JOHNSONVILLE BRATS', 1950, 2025, 'MW', 6.49, 'Johnsonville brats come from Wisconsin.'),
    S('pantry', 'Jim Dandy quick grits', 'JIM DANDY GRITS', 1950, 2025, 'S', 3.29, 'Grits are a Southern breakfast staple.'),
    S('pantry', 'White Lily self-rising flour', 'WHITE LILY SR FLOUR', 1950, 2025, 'S', 4.99, 'White Lily flour is a Southern biscuit staple.'),
    S('pantry', 'Luzianne tea bags', 'LUZIANNE TEA', 1950, 2025, 'S', 3.99, 'Luzianne tea is a Southern iced-tea favorite.'),
    S('pantry', 'Tapatío hot sauce', 'TAPATIO', 1971, 2025, 'W', 2.49, 'Tapatío hot sauce is from Southern California (1971).'),
    S('pantry', 'Bob\'s Red Mill rolled oats', 'BOBS RED MILL OATS', 1978, 2025, 'W', 5.49, 'Bob\'s Red Mill is from Oregon (1978).'),

    // Coffee brands (separate slot from the coffee staple)
    S('coffeebrand', 'Community Coffee', 'COMMUNITY COFFEE', 1950, 2025, 'S', 7.99, 'Community Coffee is from Baton Rouge, Louisiana.'),
    S('coffeebrand', 'Hills Bros. coffee', 'HILLS BROS COFFEE', 1950, 1990, 'W', 5.99, 'Hills Bros. was a San Francisco coffee roaster.'),
    S('coffeebrand', 'Folgers coffee', 'FOLGERS COFFEE', 1950, 1958, 'W', 5.99, 'Folgers was a Western brand until it went national in the 1960s.'),
    S('coffeebrand', 'Chock full o\'Nuts coffee', 'CHOCK FULL O NUTS', 1953, 2025, 'NE', 6.99, 'Chock full o\'Nuts is a New York coffee.'),
    S('coffeebrand', 'Sanka decaf', 'SANKA', 1950, 1999, null, 6.99),
    S('coffeebrand', 'Taster\'s Choice instant', 'TASTERS CHOICE', 1966, 2025, null, 7.99, 'Taster\'s Choice freeze-dried coffee launched in 1966.'),

    // Dairy case
    S('dairy', 'Dannon yogurt', 'DANNON YOGURT', 1950, 2025, null, 1.29),
    S('dairy', 'Yoplait yogurt', 'YOPLAIT', 1977, 2025, null, 0.99, 'Yoplait came to the US in 1977.'),
    S('dairy', 'Egg Beaters', 'EGG BEATERS', 1973, 2025, null, 3.99, 'Egg Beaters launched in 1973.'),
    S('dairy', 'I Can\'t Believe It\'s Not Butter!', 'ICBINB SPREAD', 1981, 2025, null, 4.49, '"I Can\'t Believe It\'s Not Butter!" launched in 1981.'),
    S('dairy', 'Go-Gurt', 'GO-GURT', 1999, 2025, null, 3.99, 'Go-Gurt launched in 1999.'),
    S('dairy', 'Chobani Greek yogurt', 'CHOBANI GREEK', 2009, 2025, null, 1.39, 'Chobani made Greek yogurt mainstream around 2009.'),
    S('dairy', 'Silk almond milk', 'SILK ALMOND MLK', 2010, 2025, null, 3.99, 'Almond milk boomed in the 2010s.'),
    S('dairy', 'Oatly oat milk', 'OATLY OAT MILK', 2017, 2025, null, 5.49, 'Oat milk went mainstream in the US around 2017.'),
    S('dairy', 'Darigold cottage cheese', 'DARIGOLD COTTAGE', 1950, 2025, 'W', 3.99, 'Darigold is a Washington State dairy co-op.'),
    S('dairy', 'Knudsen sour cream', 'KNUDSEN SR CREAM', 1950, 2025, 'W', 2.99, 'Knudsen is a California dairy.'),
    S('dairy', 'Prairie Farms cottage cheese', 'PRAIRIE FARMS COTT', 1950, 2025, 'MW', 3.49, 'Prairie Farms is an Illinois dairy co-op.'),
    S('dairy', 'Dean\'s French onion dip', 'DEANS DIP', 1950, 2025, 'MW', 2.79, 'Dean\'s French onion dip is a Midwest party staple.'),
    S('dairy', 'Hood cottage cheese', 'HOOD COTTAGE', 1950, 2025, 'NE', 3.49, 'Hood is New England\'s big dairy.'),
    S('dairy', 'Mayfield buttermilk', 'MAYFIELD BTRMLK', 1950, 2025, 'S', 2.99, 'Mayfield Dairy is from Tennessee, and buttermilk sells best in the South.'),

    // Drinks
    S('drink', 'Tropicana orange juice', 'TROPICANA OJ', 1954, 2025, null, 4.99, 'Tropicana started selling chilled juice in cartons in 1954.'),
    S('drink', 'Hi-C fruit drink', 'HI-C', 1950, 2025, null, 2.99),
    S('drink', 'Kool-Aid', 'KOOL-AID', 1950, 2025, null, 0.69),
    S('drink', 'Gatorade', 'GATORADE', 1970, 2025, null, 2.29, 'Gatorade reached grocery shelves around 1970.'),
    S('drink', 'Capri Sun 10-pk', 'CAPRI SUN', 1981, 2025, null, 4.29, 'Capri Sun came to the US in 1981.'),
    S('drink', 'Snapple iced tea', 'SNAPPLE', 1987, 2025, null, 1.99, 'Snapple iced tea launched in 1987.'),
    S('drink', 'AriZona iced tea', 'ARIZONA TEA', 1992, 2025, null, 0.99, 'AriZona has kept its 99¢ can price since 1992, so it tells you nothing about the year!', false, 0.99),
    S('drink', 'Red Bull 4-pk', 'RED BULL 4PK', 1997, 2025, null, 8.99, 'Red Bull came to the US in 1997.'),
    S('drink', 'Dasani water 6-pk', 'DASANI 6PK', 1999, 2025, null, 4.49, 'Dasani bottled water launched in 1999.'),
    S('drink', 'vitaminwater', 'VITAMINWATER', 2000, 2025, null, 2.29, 'vitaminwater launched in 2000.'),

    // Health & beauty (non-food)
    S('health', 'Bayer aspirin 100 ct', 'BAYER ASPIRIN', 1950, 2025, null, 9.99, null, true),
    S('health', 'Tylenol 50 ct', 'TYLENOL', 1960, 2025, null, 9.99, 'Tylenol went over the counter in 1960.', true),
    S('health', 'Advil 50 ct', 'ADVIL', 1984, 2025, null, 9.99, 'Advil went over the counter in 1984.', true),
    S('health', 'Aleve 50 ct', 'ALEVE', 1994, 2025, null, 9.99, 'Aleve went over the counter in 1994.', true),
    S('health', 'Claritin 10 ct', 'CLARITIN', 2003, 2025, null, 14.99, 'Claritin went over the counter at the end of 2002.', true),
    S('health', 'Band-Aid bandages', 'BAND-AID', 1950, 2025, null, 4.99, null, true),
    S('health', 'Pepto-Bismol', 'PEPTO-BISMOL', 1950, 2025, null, 7.99, null, true),
    S('health', 'Alka-Seltzer', 'ALKA-SELTZER', 1950, 2025, null, 6.99, null, true),
    S('health', 'Vicks VapoRub', 'VICKS VAPORUB', 1950, 2025, null, 7.99, null, true),
    S('health', 'Crest toothpaste', 'CREST TPASTE', 1955, 2025, null, 3.99, 'Crest launched in 1955.', true),
    S('health', 'Colgate toothpaste', 'COLGATE TPASTE', 1950, 2025, null, 3.99, null, true),
    S('health', 'Flintstones vitamins', 'FLINTSTONES VIT', 1968, 2025, null, 10.99, 'Flintstones vitamins launched in 1968.', true),
    S('health', 'Gillette Trac II blades', 'TRAC II BLADES', 1971, 1997, null, 12.99, 'Gillette Trac II, the first twin-blade razor, launched in 1971.', true),
    S('health', 'Gillette Mach3 blades', 'MACH3 BLADES', 1998, 2025, null, 19.99, 'Gillette Mach3 launched in 1998.', true),
    S('health', 'Nicorette gum', 'NICORETTE', 1996, 2025, null, 39.99, 'Nicorette gum went over the counter in 1996.', true),
    P('health', 'At-home COVID test 2-pk', 'COVID TEST 2PK', 2021, 2025, { 2021: 23.99, 2023: 19.99, 2025: 15.99 }, 'At-home COVID tests hit pharmacy shelves in 2021.'),

    // Small appliances (prices fell in real terms)
    P('appliance', 'Pop-up toaster', 'TOASTER', 1950, 2025, { 1950: 17.95, 1960: 16.95, 1970: 14.95, 1980: 19.99, 1990: 19.99, 2010: 19.99, 2025: 24.99 }),
    P('appliance', 'Electric percolator', 'PERCOLATOR', 1950, 1979, { 1950: 14.95, 1965: 16.95, 1979: 24.99 }, 'Electric percolators were the coffee maker until drip machines took over in the \'70s.'),
    P('appliance', 'Mr. Coffee drip coffee maker', 'MR COFFEE MAKER', 1972, 2025, { 1972: 29.95, 1980: 29.99, 1990: 24.99, 2000: 19.99, 2010: 24.99, 2025: 34.99 }, 'Mr. Coffee\'s home drip machine launched in 1972.'),
    P('appliance', 'Electric can opener', 'ELEC CAN OPENER', 1956, 2025, { 1956: 14.95, 1970: 12.95, 1990: 14.99, 2025: 19.99 }, 'Electric can openers appeared in 1956.'),
    P('appliance', 'Hand mixer', 'HAND MIXER', 1950, 2025, { 1950: 19.95, 1970: 14.95, 1990: 16.99, 2010: 19.99, 2025: 24.99 }),
    P('appliance', 'Crock-Pot slow cooker', 'CROCK-POT', 1971, 2025, { 1971: 24.95, 1980: 24.99, 1995: 24.99, 2010: 29.99, 2025: 39.99 }, 'Rival\'s Crock-Pot launched in 1971.'),
    P('appliance', 'Microwave oven', 'MICROWAVE OVEN', 1978, 2025, { 1978: 299.0, 1985: 199.0, 1990: 149.0, 2000: 89.99, 2010: 79.99, 2025: 99.99 }, 'Countertop microwaves went mainstream from the late \'70s, and their price kept falling.'),
    P('appliance', 'Keurig coffee brewer', 'KEURIG BREWER', 2004, 2025, { 2004: 149.99, 2010: 119.99, 2015: 99.99, 2025: 89.99 }, 'Keurig home brewers arrived in 2004.'),
    P('appliance', 'Instant Pot', 'INSTANT POT', 2010, 2025, { 2010: 139.99, 2016: 99.99, 2020: 79.99, 2025: 79.99 }, 'The Instant Pot launched in 2010.'),
    P('appliance', 'Air fryer', 'AIR FRYER', 2017, 2025, { 2017: 99.99, 2020: 69.99, 2025: 59.99 }, 'Air fryers took off around 2017.'),
    P('appliance', 'Box fan', 'BOX FAN', 1950, 2025, { 1950: 24.95, 1970: 19.95, 1990: 19.99, 2010: 19.99, 2025: 29.99 }),

    // Electronics & media
    P('electronics', 'Kodak 35mm film, 24 exp', 'KODAK 35MM FILM', 1955, 2012, { 1955: 0.85, 1965: 1.29, 1975: 1.79, 1985: 3.29, 1995: 3.99, 2005: 4.49, 2012: 5.99 }, 'Film for cameras was a checkout staple until digital cameras won out in the 2000s.'),
    P('electronics', 'Kodak Instamatic 126 film', 'KODAK 126 FILM', 1963, 1995, { 1963: 0.95, 1975: 1.79, 1985: 2.99, 1995: 3.99 }, 'Instamatic 126 film cartridges date from 1963 to the \'90s.'),
    P('electronics', 'Flashcubes 3-pk', 'FLASHCUBES', 1965, 1985, { 1965: 1.39, 1975: 1.99, 1985: 2.79 }, 'Flashcubes for cameras were a \'60s and \'70s item.'),
    P('electronics', 'Disposable camera', 'DISPOSABLE CAMERA', 1987, 2025, { 1987: 9.95, 1995: 7.99, 2005: 6.99, 2012: 9.99, 2025: 14.99 }, 'Disposable cameras arrived in 1987.'),
    P('electronics', 'Blank cassette tape', 'BLANK CASSETTE', 1966, 2005, { 1966: 2.49, 1980: 2.99, 1990: 1.99, 2000: 1.49, 2005: 1.99 }, 'Blank cassettes were sold from the late \'60s into the 2000s.'),
    P('electronics', 'Blank VHS tape', 'BLANK VHS T-120', 1977, 2006, { 1977: 19.95, 1985: 7.99, 1990: 4.99, 1995: 2.99, 2000: 2.49, 2006: 2.99 }, 'Blank VHS tapes date it between 1977 and the mid-2000s.'),
    P('electronics', '3.5" floppy disks 10-pk', 'FLOPPY DISKS 10PK', 1985, 2005, { 1985: 39.95, 1990: 14.99, 1995: 7.99, 2000: 5.99, 2005: 6.99 }, '3.5-inch floppy disks were sold from the mid-\'80s to the mid-2000s.'),
    P('electronics', 'Blank CD-R 10-pk', 'CD-R 10PK', 1997, 2015, { 1997: 29.99, 2000: 9.99, 2005: 7.99, 2010: 8.99, 2015: 9.99 }, 'Blank CD-Rs were a late-\'90s and 2000s item.'),
    P('electronics', 'USB flash drive', 'USB FLASH DRIVE', 2002, 2025, { 2002: 49.99, 2005: 24.99, 2010: 12.99, 2015: 7.99, 2025: 9.99 }, 'USB flash drives arrived around 2001.'),
    P('electronics', 'iTunes gift card', 'ITUNES GIFT CARD', 2004, 2019, { 2004: 15, 2019: 15 }, 'iTunes gift cards were sold from 2004 until Apple rebranded them in 2019.'),

    // Household
    P('household', 'Light bulbs 60W 4-pk', 'LIGHT BULBS 60W', 1950, 2013, { 1950: 0.99, 1970: 1.49, 1990: 2.49, 2010: 2.99, 2013: 3.49 }, 'Ordinary 60-watt bulbs were phased out in 2014.'),
    P('household', 'LED light bulbs 4-pk', 'LED BULBS 4PK', 2012, 2025, { 2012: 24.99, 2015: 9.99, 2020: 5.99, 2025: 5.99 }, 'LED bulbs replaced incandescents in the 2010s and got cheap fast.'),
    P('household', 'Eveready D batteries 2-pk', 'EVEREADY D 2PK', 1950, 2025, { 1950: 0.30, 1970: 0.89, 1990: 2.49, 2010: 3.99, 2025: 5.99 }),
    P('household', 'Duracell AA batteries 4-pk', 'DURACELL AA 4PK', 1964, 2025, { 1964: 1.29, 1980: 2.99, 1990: 3.49, 2000: 3.99, 2010: 5.49, 2025: 7.99 }, 'The Duracell brand dates from 1964.'),
    P('household', 'TV Guide', 'TV GUIDE', 1953, 2025, { 1953: 0.15, 1970: 0.15, 1975: 0.25, 1980: 0.50, 1990: 0.89, 2000: 1.99, 2010: 2.99, 2025: 4.99 }, 'TV Guide cost 15¢ from 1953 into the early \'70s.'),

    // Non-food (taxed almost everywhere)
    S('paper', 'Scott paper towels', 'SCOTT TOWELS', 1950, 2025, null, 2.49, null, true),
    S('paper', 'Charmin bath tissue', 'CHARMIN 4RL', 1950, 2025, null, 4.99, null, true),
    S('paper', 'Bounty paper towels', 'BOUNTY TOWELS', 1965, 2025, null, 2.99, 'Bounty paper towels launched in 1965.', true),
    S('paper', 'Brawny paper towels', 'BRAWNY TOWELS', 1974, 2025, null, 2.79, 'Brawny paper towels launched in 1974.', true),
    S('paper', 'Pampers diapers', 'PAMPERS', 1961, 2025, null, 12.99, 'Pampers disposable diapers launched in 1961.', true),
    S('paper', 'Huggies diapers', 'HUGGIES', 1978, 2025, null, 12.99, 'Huggies launched in 1978.', true),
    S('clean', 'Tide detergent', 'TIDE DETERGENT', 1950, 2025, null, 12.99, null, true),
    S('clean', 'Joy dish soap', 'JOY DISH SOAP', 1950, 2025, null, 2.99, null, true),
    S('clean', 'Clorox bleach', 'CLOROX BLEACH', 1950, 2025, null, 3.99, null, true),
    S('clean', 'Dawn dish soap', 'DAWN DISH', 1973, 2025, null, 3.49, 'Dawn dish soap launched in 1973.', true),
    S('clean', 'Swiffer refills', 'SWIFFER REFILL', 1999, 2025, null, 7.99, 'Swiffer arrived in 1999.', true),
    S('clean', 'Tide Pods', 'TIDE PODS', 2012, 2025, null, 13.99, 'Tide Pods launched in 2012.', true)
  ];

  /*
   * States used for receipts. rate = modern general sales tax (%),
   * food = modern grocery tax (%), since = year the state sales tax began
   * (null = no sales tax), fh = [year, grocery rate] history overrides.
   * Older rates are scaled down roughly; these are approximations.
   */
  const STATES = {
    NY: { n: 'New York', region: 'NE', rate: 4, food: 0, since: 1965 },
    MA: { n: 'Massachusetts', region: 'NE', rate: 6.25, food: 0, since: 1966 },
    PA: { n: 'Pennsylvania', region: 'NE', rate: 6, food: 0, since: 1953 },
    NJ: { n: 'New Jersey', region: 'NE', rate: 6.625, food: 0, since: 1966 },
    NH: { n: 'New Hampshire', region: 'NE', rate: 0, food: 0, since: null },
    VT: { n: 'Vermont', region: 'NE', rate: 6, food: 0, since: 1969 },
    ME: { n: 'Maine', region: 'NE', rate: 5.5, food: 0, since: 1951 },
    CT: { n: 'Connecticut', region: 'NE', rate: 6.35, food: 0, since: 1947 },
    IL: { n: 'Illinois', region: 'MW', rate: 6.25, food: 1, since: 1933 },
    OH: { n: 'Ohio', region: 'MW', rate: 5.75, food: 0, since: 1935 },
    MI: { n: 'Michigan', region: 'MW', rate: 6, food: 0, since: 1933, fh: [[1950, 4], [1975, 0]] },
    MN: { n: 'Minnesota', region: 'MW', rate: 6.875, food: 0, since: 1967 },
    WI: { n: 'Wisconsin', region: 'MW', rate: 5, food: 0, since: 1962 },
    MO: { n: 'Missouri', region: 'MW', rate: 4.225, food: 1.225, since: 1934, fh: [[1950, 4.225], [1997, 1.225]] },
    IA: { n: 'Iowa', region: 'MW', rate: 6, food: 0, since: 1934, fh: [[1950, 4], [1974, 0]] },
    KS: { n: 'Kansas', region: 'MW', rate: 6.5, food: 6.5, since: 1937, fh: [[1950, 6.5], [2023, 4], [2024, 2], [2025, 0]] },
    IN: { n: 'Indiana', region: 'MW', rate: 7, food: 0, since: 1963, fh: [[1950, 4], [1973, 0]] },
    SD: { n: 'South Dakota', region: 'MW', rate: 4.2, food: 4.2, since: 1935 },
    TX: { n: 'Texas', region: 'S', rate: 6.25, food: 0, since: 1961 },
    GA: { n: 'Georgia', region: 'S', rate: 4, food: 4, since: 1951, fh: [[1950, 4], [1998, 0]] },
    FL: { n: 'Florida', region: 'S', rate: 6, food: 0, since: 1949 },
    NC: { n: 'North Carolina', region: 'S', rate: 4.75, food: 0, since: 1933, fh: [[1950, 4], [2006, 0]] },
    TN: { n: 'Tennessee', region: 'S', rate: 7, food: 4, since: 1947 },
    AL: { n: 'Alabama', region: 'S', rate: 4, food: 4, since: 1936, fh: [[1950, 4], [2023, 3], [2025, 2]] },
    MS: { n: 'Mississippi', region: 'S', rate: 7, food: 7, since: 1932, fh: [[1950, 7], [2025, 5]] },
    LA: { n: 'Louisiana', region: 'S', rate: 4.45, food: 0, since: 1938 },
    VA: { n: 'Virginia', region: 'S', rate: 5.3, food: 2.5, since: 1966 },
    OK: { n: 'Oklahoma', region: 'S', rate: 4.5, food: 4.5, since: 1933, fh: [[1950, 4.5], [2024, 0]] },
    CA: { n: 'California', region: 'W', rate: 7.25, food: 0, since: 1933, bag: [2017, 0.10] },
    WA: { n: 'Washington', region: 'W', rate: 6.5, food: 0, since: 1935, fh: [[1950, 4], [1978, 0]], bag: [2021, 0.08] },
    OR: { n: 'Oregon', region: 'W', rate: 0, food: 0, since: null, bag: [2020, 0.05] },
    AZ: { n: 'Arizona', region: 'W', rate: 5.6, food: 0, since: 1933, fh: [[1950, 3], [1980, 0]] },
    CO: { n: 'Colorado', region: 'W', rate: 2.9, food: 0, since: 1935, fh: [[1950, 2], [1980, 0]] },
    UT: { n: 'Utah', region: 'W', rate: 4.85, food: 1.75, since: 1933, fh: [[1950, 4.85], [2007, 1.75]] },
    ID: { n: 'Idaho', region: 'W', rate: 6, food: 6, since: 1965 },
    NV: { n: 'Nevada', region: 'W', rate: 6.85, food: 0, since: 1955 },
    NM: { n: 'New Mexico', region: 'W', rate: 5, food: 0, since: 1933, fh: [[1950, 4], [2005, 0]] }
  };

  const STORE_NAMES = ['Mapleview Market', 'Golden Cart Foods', 'Hilltop Grocery', 'Penny Wise Foods', 'Bluebird Market',
    'Main Street Grocers', 'Sunny Acres Market', 'Thrift Basket', 'Corner Pantry', 'Valley Fresh Foods', 'Harvest Hall', 'Lucky Lane Market'];

  window.RD_DATA = { CPI, REGION_FACTOR, STAPLES, SPECIALS, STATES, STORE_NAMES };
})();
