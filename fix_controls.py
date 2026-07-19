import re

file_path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I see what I did wrong. The previous script tried to replace:
#             </ToolbarFilter>
#           </Toolbar>
# with adding </div>, but there is <div class="toolbar-inner"> after ToolbarFilter!
# So the add_controls.py missed the end because </ToolbarFilter> is not immediately followed by </Toolbar>.

# So let's replace </Toolbar> with </Toolbar>\n          </div>
content = content.replace(
'''            </Toolbar>''',
'''            </Toolbar>
          </div>''')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
