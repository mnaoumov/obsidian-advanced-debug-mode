/**
 * Native API wrappers to ignore in addition to the toolkit's shared defaults.
 */
export const ignoreListSources: readonly RegExp[] = [
  /(?:^|\/)webpack:\/\/eruda\//,
  /\/node_modules\/eruda\//,
  /\/src\/operations\/file-system-adapter-[^/]+-patch-component\.ts$/,
  /\/src\/long-stack-traces\/(?:add-long-stack-traces|event-target-remove-event-listener)-patch-component\.ts$/,
  /\/src\/long-stack-traces\/desktop-(?:async-)?long-stack-traces-component\.ts$/
];
