# Data and publication notes

This static review prototype reads `public/data/explorer-data.json` (schema version 2), `factory-tags.json`, and `bio-resources.json` (schema version 1). The counts below describe the original snapshot; the 30 October 2026 resource extension is documented separately below.

## Biological resources extension — 30 October 2026, local review

Fresh XLSX exports of these native Google Sheets supplied the extension:

- [Additional crops](https://docs.google.com/spreadsheets/d/1mIpJl-2z2Lx6MUx7Y5dAD9foOb9Q-giOWcV0B66Iqt4/edit): 98 additional products with statistics, including 9 fruits, 83 herbs/spices and 6 industrial/processing crops. Together with the original six, the website offers 104 crop entries.
- [Fisheries](https://docs.google.com/spreadsheets/d/1JoTWw_Y6OWeh4_3YW564w9Gj84KFIkRHJ8KbUbjPwTU/edit): 39 aquaculture product groups; this snapshot does not represent wild capture fisheries.
- [Livestock](https://docs.google.com/spreadsheets/d/1H_YJRw72yT7tq-kBcJjnLfkf6uqeHi7giDjeZ-En7RA/edit): 13 entries, including overlapping stock classifications, milk and eggs. Entry counts are not counts of disjoint species.

`bio-resources.json` contains 150 added products, 497 series, 40,670 grouped province rows and 320 grouped country rows. The row counts include derived aquaculture totals across methods, so they are not counts of raw observations. Original crop, factory, research and estate files remain unchanged. `bio-import-report.json` records export SHA-256 hashes and exclusions.

The data grain is `(series_id, year, province_id)` with a metric map. Each series identifies a product, source, geographic scope, supported metrics, units and years; fish series also identify culture method. Country rows are stored separately. Product IDs from the new Sheets and existing `PROV_XX` joins are preserved. Each metric retains its observation ID, source locator, status and reference date where supplied. Series IDs for the new crop/fish views are deterministic; livestock series IDs are retained from the source workbook.

Display rules:

- A selected product uses one source series and year throughout the map. Missing provinces are not filled from another series/year. The default prefers a provincial series; the series selector exposes national and alternative source series separately.
- All crops totals/shares include only provincial production recorded in tonnes. Country-only totals and coconut counts in fruit are excluded. The default uses the latest year for each product and labels the mixed periods explicitly; this is not a single-year official national total.
- All fisheries/livestock maps show the number of product entries with data. The detail list uses each entry's own unit/year. It does not add livestock totals to subtypes, animal stock to milk/egg flows, or different units together.
- Aquaculture totals across methods sum production and value only, within one product/source/year/province. Farm counts and farm areas are available only on individual method series to avoid double counting. The dataset includes farmed freshwater and coastal species only.
- Country-only products can show a national card but never receive invented province allocations. Rates/prices/yields are not summed; choose a province or a separately supplied country measure.
- Null/missing symbols stay null; reported zero stays zero. Source-rounded zeros retain their warning. Missing data does not mean absence of production.
- Crop review queue rows (181), one catalogue-only crop without statistics, held fisheries rows (41) and non-provincial fisheries geography rows (8) are not mapped. No estimates were created to fill these gaps.
- New resource selection does not imply a factory uses that input, or a research work concerns it. Existing explicit joins remain the only basis for research relevance. Factory tags and province/estate filters retain their existing behavior.

To update, export the three maintained Sheets to an external input directory as `crops.xlsx`, `fisheries.xlsx`, and `livestock.xlsx` (do not put workbooks in `public/`), then run:

```sh
python scripts/import-bio-resources.py /path/to/exports
npm run validate
npm test
npm start
```

Python requires `openpyxl`. The importer checks source IDs, joins, units, numeric values and duplicate observation grains. Inspect the report and control totals before publishing. The browser fetches only static JSON from its host; it never requests Google Sheets. Import and local review do not deploy the site.

Control checks read independently from the source workbooks: durian 2568 = 1,573,851.69 tonnes (67 provinces); tilapia 2567 = 275,958 tonnes (77 provinces); pigs 2569 = 11,636,358 head (75 numeric provinces; two source rows are missing); raw milk 2567 = 1,032,421 tonnes (70 provinces); duck eggs 2567 = 2,226,048,620 eggs (77 provinces).

## Original snapshot

- Original agriculture: six crop groups, 364 crop/province records, with source, crop-year and units from OAE data.
- Industry: 8,604 normal-status records in the IEAT source dated 23 September 2569 BE. Counts are source rows, not deduplicated factories. This is not a national factory census.
- Research: 36 works, with DOI, summaries, evidence links and review status. All are currently pending review. Eleven have no link to the six mapped crop groups and remain available in the research library.
- Estate geometry: inherited IEAT Estate Atlas snapshot. Map markers represent estates/offices, not individual factory coordinates. Five estate offices await boundaries.

Data uses stable product, province, industry and research IDs. The exported website snapshot joins relational source tables for display. Editing source spreadsheets does not update the website until a new snapshot is imported and published.

## Update

Export the four maintained source workbooks to a local directory as `factories.xlsx`, `agriculture.xlsx`, `reference.xlsx`, `research.xlsx`. Keep these exports outside the repository and website. With Python and openpyxl available:

```sh
python scripts/import-sheets.py /path/to/exports
npm run validate
npm test
```

Review changes to `public/data/explorer-data.json` before committing. The current contract permits one crop-year/source per crop/province and rejects ambiguous aggregation. Update regression baselines only after reconciling changed data with its source.

The browser reads static JSON on the same host; it does not call Google Sheets or use a database. Basemap tiles and glyphs come from OpenFreeMap. Research relevance does not establish industrial adoption, commercial readiness or an actual supply relationship.

The sample `agriculture.json` and `factories.json` datasets are legacy test fixtures; the current entrypoint does not load them.
