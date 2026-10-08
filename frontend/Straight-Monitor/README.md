# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Lohnarten in Monitorverwaltung

The **Lohn** tab in [UserManagement.vue](src/components/UserManagement.vue) displays all 24 fields imported by the backend's `POST /api/import/lohnart`, plus the stored `KB` field. `GET /api/import/lohnarten` supplies these values and the existing customer-condition links.

All value columns are searchable and sortable. The table scrolls horizontally to accommodate the complete field set. Imported codes and percentages remain unchanged; empty values appear as `-`, while zero values remain visible. The existing normal-hours highlighting and customer-price links are preserved.
