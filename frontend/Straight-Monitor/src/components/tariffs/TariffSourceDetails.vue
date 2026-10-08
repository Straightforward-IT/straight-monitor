<template>
  <details v-if="source" class="tariff-source">
    <summary>{{ label }}<span v-if="source.filename"> · {{ source.filename }}<template v-if="source.sheet"> / {{ source.sheet }}</template><template v-if="source.row"> · Zeile {{ source.row }}</template></span></summary>
    <div class="tariff-scroll">
      <table><thead><tr><th>Quellspalte</th><th>Originalwert</th></tr></thead><tbody>
        <tr v-for="(value, key) in source.raw || {}" :key="key"><th scope="row">{{ key }}</th><td>{{ sourceValue(value) }}</td></tr>
      </tbody></table>
    </div>
  </details>
</template>

<script setup>
import { sourceValue } from './tariffDisplay';
defineProps({ source: { type: Object, default: null }, label: { type: String, default: 'Quelldaten' } });
</script>
