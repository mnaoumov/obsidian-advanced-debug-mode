# CHANGELOG

## 1.10.9

- chore(deps): sweep caret-ranged dependencies to latest
- fix(deps): move to obsidian-integration-testing 11 and obsidian-dev-utils 96.5.2
- fix(deps): drop the brace-expansion file: override that breaks a clean install
- docs: point plugin-directory links at community.obsidian.md

## 1.10.8

- test(advanced-debug-mode): open the in-page console with a trusted click instead of dispatchEvent

## 1.10.7

- docs(demo-vault): unwrap the notes so Obsidian stops rendering a break per line
- docs(readme): render the same in Obsidian's plugin page as on GitHub
- chore: update libs
- chore: update obsidian-dev-utils to 94.6.1
- chore: update obsidian-dev-utils to 94.6.0
- fix: override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx
- test: gate the demo vault by clicking every code button
- fix(screenshots): photograph the palette row the caption names
- feat(scripts): capture each platform's screenshots on its own
- chore: teach cspell the advisory wording
- chore: update libs
- docs(demo-vault): give the demo vault its code buttons
- docs: add store screenshots and surface them in the README

## 1.10.6

- docs(demo-vault): finish the placeholder rename that 1.10.5 missed

## 1.10.5

- docs(demo-vault): use NATO placeholders instead of foo and bar

## 1.10.4

- docs: describe debugging the way this plugin actually does it

## 1.10.3

- docs: make the demo vault the documentation, in the standard layout
- feat(demo-vault): migrate to obsidian-dev-utils 93.3.1 and adopt the authoring convention

## 1.10.2

- chore: update libs and adopt obsidian-integration-testing 10

## 1.10.1

- fix: add the long-running-tasks component only where the desktop adapter is real
- fix: load the settings before wiring the components that read them
- chore: update libs
- chore: update libs
- chore(vitest): adopt the shared Obsidian plugin vitest configuration

## 1.10.0

- test(settings): evaluate the desktop-only disabled predicates
- refactor(settings): move the settings tab onto the declarative settings API
- chore: update libs and clear the npm audit
- docs: fix the demo vault download instructions

## 1.9.24

- chore: update libs
- chore: update libs

## 1.9.23

- docs: fix command name

## 1.9.22

- chore: update libs

## 1.9.21

- chore: update libs
- chore(demo-vault): drop committed Invocables placeholder
- fix(demo-vault): export invoke() from startup script; add Invocables folder

## 1.9.20

- docs: standardize demo-vault README
- docs: drop per-plugin demo-vault setup notes (bootstrap covered by ODU harness)
- docs: unnumber demo-vault setup notes
- Merge branch 'T94': create the Advanced Debug Mode demo vault (S2)
- docs: update
- docs: migrate to AGENTS.md

## 1.9.19

- docs: fix url

## 1.9.18

- refactor: adopt pre-wired commandHandlerComponent
- chore: update libs

## 1.9.17

- chore: overexposed
- chore: update libs
- chore: update obsidian-dev-utils to 85.0.0
- refactor: pass params objects to long-stack-traces component methods
- build: lock typescript to 6.0.3
- test: wire integration-testing vitest-setup into integration projects
- chore: update libs
- chore: clean up tsconfig

## 1.9.16

- refactor: new template

## 1.9.15

- refactor: new template

## 1.9.14

- refactor: monkey around
- test: refactor
- chore: update libs
- chore: unify tsconfig
- test(plugin): fix onload mock to invoke onloadImpl
- refactor: patches
- fix: api

## 1.9.13

- chore: update template

## 1.9.12

- refactor: new template

## 1.9.10

- chore: update libs

## 1.9.9

- chore: update libs

## 1.9.8

- chore: lint
- chore: update libs
- chore: add typescript as explicit devDependency
- chore: remove stale tsconfig include for nonexistent file
- chore: use shorthand version refs in overrides

## 1.9.7

- refactor: new template

## 1.9.6

- refactor: new template

## 1.9.5

- chore: update template

## 1.9.4

- feat: extract commands

## 1.9.3

- chore: update libs

## 1.9.2

- chore: update libs

## 1.9.1

- chore: update libs

## 1.9.0

- chore: lint
- feat: disable desktop-only settings on mobile
- feat: emulate mobile mode
- chore: lint
- chore: enable markdownlint

## 1.8.6

- fix: build

## 1.8.5

- fix: build
- chore: update libs

## 1.8.4

- chore: enable conventional commits

## 1.8.3

- Minor changes

## 1.8.2

- Minor changes

## 1.8.1

- Minor changes

## 1.8.0

- Patch in all windows

## 1.7.11

- Minor changes

## 1.7.10

- Minor changes

## 1.7.9

- Minor changes

## 1.7.8

- Minor changes

## 1.7.7

- Minor changes

## 1.7.6

- Minor changes

## 1.7.5

- Minor changes

## 1.7.4

- Minor changes

## 1.7.3

- Minor changes

## 1.7.2

- Minor changes

## 1.7.1

- Minor changes

## 1.7.0

- Extract eruda to main window instead of side view

## 1.6.3

- Update link

## 1.6.2

- Fix casing

## 1.6.1

- Filter duplicated frame lines preserving title
- Ensure components are refreshed on settings changes

## 1.6.0

- Improve performance
- Ignore more internals

## 1.5.4

- Minor changes

## 1.5.3

- Minor changes

## 1.5.2

- Minor changes

## 1.5.1

- Switch to new template

## 1.5.0

- Log failing fn
- Use generic queue

## 1.4.0

- Desktop: Include timed out tasks details

## 1.3.0

- Control stack trace lines
- Fix parent init

## 1.2.5

- Ensure disabled components are not loaded

## 1.2.4

- Invert timeout setting logic

## 1.2.3

- Invert timeout setting logic

## 1.2.2

- Invert timeout setting logic

## 1.2.1

- Fix typo

## 1.2.0

- Long running tasks settings
- Add toggle for the Obsidian debug mode
- Allow disable long stacks

## 1.1.0

- Add support for async traces
- Toggle `shouldShowInternalStackFrames`
- Hide internal stack frames
- Refactor to patch Error classes once

## 1.0.1

- Update description

## 1.0.0

- Initial release
