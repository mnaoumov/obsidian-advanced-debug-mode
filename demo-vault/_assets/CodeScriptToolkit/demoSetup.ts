import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import {
  enableCommunityPlugin,
  installCommunityPlugin
} from 'obsidian-dev-utils/obsidian/community-plugins';

// Advanced Debug Mode enriches the DevTools console (longer stack traces, debug namespaces, relaxed
// Timeouts), so its interactive demo is a code-button that throws an error and lets you read the enriched
// Stack trace in DevTools - that button's code lives inline in the note. The only helper this vault needs
// Here is the shared CodeScript Toolkit installer used by the prerequisite note's button.
export async function installAndEnable(app: App, pluginId: string): Promise<void> {
  await installCommunityPlugin({ app, pluginId });
  await enableCommunityPlugin({ app, pluginId });
  new Notice(`Installed and enabled: ${pluginId}`);
}
