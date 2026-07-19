import re

file_path = 'frontend/Straight-Monitor/src/components/PeopleDocsModern.vue'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Ah! In the actual structure previously there was NO view-controls-right inside .controls for Toolbar usually, but maybe it should be inside .controls, or maybe .controls just wraps the toolbar AND the view-controls-right?
# In Dokumente.vue: 
#    <div class="controls">
#        <Toolbar class="docs-search-toolbar">...</Toolbar>
#        <div class="view-controls">...</div>
#    </div>

# Let's close the `<div class="controls">` AFTER `view-controls-right` instead of right after `<Toolbar>`.

# So we remove the `          </div>` that we just added after </Toolbar>
content = content.replace(
'''            </Toolbar>
          </div>''',
'''            </Toolbar>''')

# And we add `</div>` before `<!-- Table / List View -->`

content = content.replace(
'''        <!-- =======================
             TABLE / LIST VIEW
             ======================= -->''',
'''          </div> <!-- end controls -->
        <!-- =======================
             TABLE / LIST VIEW
             ======================= -->''')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
