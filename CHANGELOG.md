# CHANGELOG

## 1.16.0

This release has 2 new features and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add memory troubleshooting for renderer out-of-memory crashes
- make logging of failed queued file-system operations configurable

### Documentation

- **changelog:** regroup the published release notes for readers

## 1.15.2

This release has 1 fix and 2 documentation changes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- stop logging failures of queued file-system adapter functions

### Documentation

- make issue attachments optional and strongly encouraged
- link to the Obsidian resources page

## 1.15.1

This release has 1 fix.

### Fixed

- \[BUG\] "Report a bug" facility incorrectly lists non-enabled plugins (by not checking whether the plugin's folder still exists) (#5)

## 1.15.0

This release has 2 new features, 1 fix, 4 documentation changes and 1 other change. 12 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add a Report a bug command
- add plugin load delays

### Fixed

- stop DevTools naming this plugin as the source of other code's messages

### Documentation

- **readme:** point bug reports at the Report a bug command
- add issue-filing instructions for AI agents
- **readme:** combine related resources and plugin comparisons
- add a Similar plugins section to the README

### Other changes

- restore `obsidian-lib` 6.0 and the setPlaceholderValue test patch

## 1.14.2

This release has 3 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- rewrite a negative stored stackTraceLimit to the default on load
- merge keeping DOMException and pdf.js working with long stack traces on
- merge rendering the library debug namespace through appendCodeBlock

## 1.14.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- show plugin names as inline code in the notice, the Plugin debug messages view and the settings

## 1.14.0

This release has 1 new feature.

### New

- add a Plugin debug messages view with a checkbox per plugin

## 1.13.1

This release has 1 fix.

### Fixed

- keep AggregateError errors and message with long stack traces on

## 1.13.0

This release has 1 new feature and 1 documentation change.

### New

- toggle any plugin's debug messages from a command or a settings row

### Documentation

- mark plugin names as code

## 1.12.0

This release has 2 new features, 3 fixes and 1 documentation change. 6 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- list every registered debug switch in settings and keep them across reloads
- **settings:** add a working `typescript-lib` timeout row

### Fixed

- stop the saved stack trace limit drifting below zero
- **settings:** remove the dead Obsidian Dev Utils timeout row
- keep DevTools Console autocomplete working with async long stack traces

### Documentation

- mark plugin names as code across markdown and comments

## 1.11.3

This release has 1 fix.

### Fixed

- keep a caller's Error.prepareStackTrace working under long stack traces (re #4 - \[BUG\] Long stack traces break structured Error stacks and Local REST API loading)

## 1.11.2

This release has 1 fix.

### Fixed

- load `node:async_hooks` and `node:process` behind `Platform.isDesktop`

## 1.11.1

This release has 4 fixes and 4 documentation changes. 17 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **test:** merge the headless demo-vault toolkit install
- **deps:** restore the lockfile's missing resolved and integrity fields
- **deps:** float devalue to 5.9.4, clearing GHSA-9rgm-9g3h-6x36
- **deps:** move to `obsidian-dev-utils` 101

### Documentation

- replace the private rule-id citations with what they assert
- name the library and the sibling plugins so a reader can resolve them
- replace the private tracker references with what they pointed at
- name the unversioned demo-vault asset and the folder it unzips into

## 1.11.0

This release has 1 new feature and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- surface the shared abort controller as a command and a settings button

### Fixed

- **build:** wire build:compile to buildCompile and drop the duplicate leaf script

## 1.10.9

This release has 2 fixes and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **deps:** move to `obsidian-integration-testing` 11 and `obsidian-dev-utils` 96.5.2
- **deps:** drop the brace-expansion file: override that breaks a clean install

### Documentation

- point plugin-directory links at community.obsidian.md

## 1.10.8

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.10.7

This release has 1 new feature, 2 fixes and 4 documentation changes. 6 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **scripts:** capture each platform's screenshots on its own

### Fixed

- override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx
- **screenshots:** photograph the palette row the caption names

### Documentation

- **demo-vault:** unwrap the notes so Obsidian stops rendering a break per line
- **readme:** render the same in Obsidian's plugin page as on `GitHub`
- **demo-vault:** give the demo vault its code buttons
- add store screenshots and surface them in the README

## 1.10.6

This release has 1 documentation change.

### Documentation

- **demo-vault:** finish the placeholder rename that 1.10.5 missed

## 1.10.5

This release has 1 documentation change.

### Documentation

- **demo-vault:** use NATO placeholders instead of foo and bar

## 1.10.4

This release has 1 documentation change.

### Documentation

- describe debugging the way this plugin actually does it

## 1.10.3

This release has 1 new feature and 1 documentation change.

### New

- **demo-vault:** migrate to `obsidian-dev-utils` 93.3.1 and adopt the authoring convention

### Documentation

- make the demo vault the documentation, in the standard layout

## 1.10.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.10.1

This release has 2 fixes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- add the long-running-tasks component only where the desktop adapter is real
- load the settings before wiring the components that read them

## 1.10.0

This release has 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Documentation

- fix the demo vault download instructions

## 1.9.24

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 1.9.23

This release has 1 documentation change.

### Documentation

- fix command name

## 1.9.22

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.21

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **demo-vault:** export invoke() from startup script; add Invocables folder

## 1.9.20

This release has 6 documentation changes.

### Documentation

- standardize demo-vault README
- drop per-plugin demo-vault setup notes (bootstrap covered by the `obsidian-dev-utils` harness)
- unnumber demo-vault setup notes
- **demo-vault:** create the `Advanced Debug Mode` demo vault
- update
- migrate to AGENTS.md

## 1.9.19

This release has 1 documentation change.

### Documentation

- fix url

## 1.9.18

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 1.9.17

This release has maintenance changes only. 8 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 1.9.16

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.15

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.14

This release has 1 fix. 6 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- api

## 1.9.13

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.12

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.10

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.9

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.8

This release has maintenance changes only. 5 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 1.9.7

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.6

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.5

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.4

This release has 1 new feature.

### New

- extract commands

## 1.9.3

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.9.0

This release has 2 new features. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- disable desktop-only settings on mobile
- emulate mobile mode

## 1.8.6

This release has 1 fix.

### Fixed

- build

## 1.8.5

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- build

## 1.8.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.8.3

This release has 1 other change.

### Other changes

- Minor changes

## 1.8.2

This release has 1 other change.

### Other changes

- Minor changes

## 1.8.1

This release has 1 other change.

### Other changes

- Minor changes

## 1.8.0

This release has 1 other change.

### Other changes

- Patch in all windows

## 1.7.11

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.10

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.9

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.8

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.7

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.6

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.5

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.4

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.3

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.2

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.1

This release has 1 other change.

### Other changes

- Minor changes

## 1.7.0

This release has 1 other change.

### Other changes

- Extract eruda to main window instead of side view

## 1.6.3

This release has 1 other change.

### Other changes

- Update link

## 1.6.2

This release has 1 other change.

### Other changes

- Fix casing

## 1.6.1

This release has 2 other changes.

### Other changes

- Filter duplicated frame lines preserving title
- Ensure components are refreshed on settings changes

## 1.6.0

This release has 2 other changes.

### Other changes

- Improve performance
- Ignore more internals

## 1.5.4

This release has 1 other change.

### Other changes

- Minor changes

## 1.5.3

This release has 1 other change.

### Other changes

- Minor changes

## 1.5.2

This release has 1 other change.

### Other changes

- Minor changes

## 1.5.1

This release has 1 other change.

### Other changes

- Switch to new template

## 1.5.0

This release has 2 other changes.

### Other changes

- Log failing fn
- Use generic queue

## 1.4.0

This release has 1 other change.

### Other changes

- Include timed out tasks details

## 1.3.0

This release has 2 other changes.

### Other changes

- Control stack trace lines
- Fix parent init

## 1.2.5

This release has 1 other change.

### Other changes

- Ensure disabled components are not loaded

## 1.2.4

This release has 1 other change.

### Other changes

- Invert timeout setting logic

## 1.2.3

This release has 1 other change.

### Other changes

- Invert timeout setting logic

## 1.2.2

This release has 1 other change.

### Other changes

- Invert timeout setting logic

## 1.2.1

This release has 1 other change.

### Other changes

- Fix typo

## 1.2.0

This release has 3 other changes.

### Other changes

- Long running tasks settings
- Add toggle for the Obsidian debug mode
- Allow disable long stacks

## 1.1.0

This release has 4 other changes.

### Other changes

- Add support for async traces
- Toggle shouldShowInternalStackFrames
- Hide internal stack frames
- Refactor to patch Error classes once

## 1.0.1

This release has 1 other change.

### Other changes

- Update description

## 1.0.0

This release has 1 other change.

### Other changes

- Initial release
