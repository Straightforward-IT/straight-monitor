import pluginVue from 'eslint-plugin-vue';

export default [
  {
    ignores: ['dist/', 'node_modules/'],
  },
  ...pluginVue.configs['flat/recommended'],
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
];