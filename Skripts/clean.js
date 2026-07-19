const fs = require('fs');
const path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import FilterPanel from \"@/components/FilterPanel.vue\";", "import FilterGroup from \"@/components/FilterGroup.vue\";\nimport FilterDivider from \"@/components/ui-elements/FilterDivider.vue\";");
content = content.replace("import FilterDropdown from \"@/components/FilterDropdown.vue\";", "import ToolbarFilter from \"@/components/ui-elements/ToolbarFilter.vue\";");

content = content.replace("components: { FontAwesomeIcon, EmployeeCard, CustomTooltip, FilterPanel, FilterDropdown, FilterChip, ExportMitarbeiterModal, ImageCropModal, SearchBar, Toolbar }", "components: { FontAwesomeIcon, EmployeeCard, CustomTooltip, FilterGroup, FilterChip, FilterDivider, ToolbarFilter, ExportMitarbeiterModal, ImageCropModal, SearchBar, Toolbar }");

content = content.replace("filtersExpanded: true, // Filter standardmäßig ausgeklappt\n      searchExpanded: false,", "filterExpanded: false,\n      searchExpanded: false,");

const countRegex = /  computed: \{\n/g;
content = content.replace(countRegex, `  computed: {
    activeFilterCount() {
      let count = 0;
      if (this.filters.status !== 'Aktiv') count++;
      if (this.filters.location !== 'Alle') count++;
      if (this.filters.department !== 'Alle') count++;
      if (this.filters.asanaStatus !== 'Alle') count++;
      if (this.filters.personalnrStatus !== 'Alle') count++;
      if (this.filters.profilbildStatus !== 'Alle') count++;
      if (this.filters.teamleiter !== 'Alle') count++;
      if (this.filters.berufe.length > 0) count++;
      if (this.filters.qualifikationen.length > 0) count++;
      if (this.filters.persgruppe !== 'Alle') count++;
      return count;
    },\n`);

const tbCSS = /\/\/ People search toolbar \(hidden on mobile\)\n\.people-search-toolbar \{\n  \@media \(max-width: 768px\) \{\n    display: none;\n  \}\n\}\n\n\.filter-search-box \{\n  display: flex;\n  align-items: center;\n  position: relative;\n\n  \@media \(min-width: 769px\) \{\n    display: none;\n  \}\n\}/;

content = content.replace(tbCSS, `.people-search-toolbar {\n  margin-bottom: 12px;\n  overflow: visible;\n}\n\n.toolbar-inner {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex: 1;\n  min-width: 0;\n  overflow-x: auto;\n  scrollbar-width: none;\n  &::-webkit-scrollbar { display: none; }\n}`);

fs.writeFileSync(path, content);
