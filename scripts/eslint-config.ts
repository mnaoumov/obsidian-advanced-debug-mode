import type { Linter } from 'eslint';

import { defineEslintConfigs } from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';
import { defineConfig } from 'eslint/config';

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
