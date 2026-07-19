import re

file_path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace <Toolbar class="people-search-toolbar"> with wrapper
content = content.replace(
'''          <!-- Toolbar with ToolbarFilter -->
          <Toolbar class="people-search-toolbar">''', 
'''          <div class="controls">
          <!-- Toolbar with ToolbarFilter -->
          <Toolbar class="people-search-toolbar">''')

content = content.replace(
'''            </ToolbarFilter>
          </Toolbar>''', 
'''            </ToolbarFilter>
          </Toolbar>
          </div>''')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
