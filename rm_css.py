import re

file_path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\s*\.filter-chips\s*\{[^}]*\}', '', content, flags=re.DOTALL)
content = re.sub(r'\s*\.reset-chip :deep\(\.filter-chip\)\s*\{[^}]*\}', '', content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
