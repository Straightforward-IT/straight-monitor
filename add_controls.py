import re

file_path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to wrap <Toolbar ...> ... </Toolbar> in <div class="controls">
# Let's check if it exists:
if '<Toolbar class="people-search-toolbar">' in content and '<div class="controls">' not in content:
    content = content.replace(
        '<Toolbar class="people-search-toolbar">',
        '<div class="controls">\n          <Toolbar class="people-search-toolbar">'
    )
    content = content.replace(
        '</ToolbarFilter>\n          </Toolbar>',
        '</ToolbarFilter>\n          </Toolbar>\n          </div>'
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
