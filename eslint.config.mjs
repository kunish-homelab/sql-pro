import antfu from '@antfu/eslint-config';

export default antfu({
  // Enable React support
  react: true,

  // Enable TypeScript support
  typescript: true,

  // Disable all formatters (use Prettier instead)
  formatters: false,

  // Disable stylistic rules (formatting handled by Prettier)
  stylistic: false,

  // Ignore patterns
  ignores: [
    '.claude/**',
    '**/*.md',
    'out/**',
    'dist/**',
    'plugin-sdk/**',
    'node_modules/**',
  ],
});
