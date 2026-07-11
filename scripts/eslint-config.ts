import type { Linter } from 'eslint';

import { defineConfig } from 'eslint/config';
import { defineEslintConfigs } from 'obsidian-dev-utils/script-utils/linters/eslint-config';

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs() {
    return defineConfig([
      {
        rules: {
          'obsidianmd/ui/sentence-case': [
            'error',
            {
              brands: ['Error']
            }
          ]
        }
      },
      {
        files: ['src/**/*-desktop-component.ts'],
        rules: {
          // These components execute only on desktop (guarded by Platform.isDesktop) and deliberately import Node.js built-ins; the rule cannot be disabled inline.
          'obsidianmd/no-nodejs-modules': 'off'
        }
      }
    ]);
  }
});
