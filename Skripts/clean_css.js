const fs = require('fs');

const path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue';
let content = fs.readFileSync(path, 'utf8');

// Replace these exact specific matches to avoid breaking any other block.

content = content.replace(/\/\* Filter Chips \*\/[\s\S]*?(?=\.divider \{)/, '');

const chipRegex = /\.chip-group\s*\{[\s\S]*?\}\n\n\.chip-label\s*\{[\s\S]*?\}\n\n\.chip\s*\{[\s\S]*?\}[\s\S]*?\}\n\n\.divider\s*\{/g;
content = content.replace(chipRegex, '.divider {\n');

fs.writeFileSync(path, content);
