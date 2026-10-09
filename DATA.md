# Data and publication notes

This static review prototype reads `public/data/explorer-data.json` (schema version 2).

- Agriculture: six crop groups, 364 crop/province records, with source, crop-year and units from OAE data.
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
