# Documentation

This directory is organized with the Diataxis framework. The goal is to help a
new developer learn the codebase without mixing learning material, task recipes,
reference facts, and design explanation into one long README.

## Recommended Reading Order

1. [New Developer Onboarding](ONBOARDING.md)
2. [Run the app locally](tutorials/getting-started-local-dev.md)
3. [Architecture](explanation/architecture.md)
4. [Annotation anchoring](explanation/annotation-anchoring.md)
5. [Sync and auth](explanation/sync-and-auth.md)
6. [Frame proxy and page cache](explanation/frame-proxy-and-cache.md)
7. [Project map](reference/project-map.md)
8. [Data model](reference/data-model.md)
9. [Routes and runtime](reference/routes-and-runtime.md)

## Tutorials

Tutorials are learning-oriented. They walk you through a safe first experience.

- [Run the app locally](tutorials/getting-started-local-dev.md)

## How-To Guides

How-to guides are task-oriented. Use them when you already know roughly what you
need to change.

- [Run checks](how-to/run-checks.md)
- [Change annotation behavior](how-to/change-annotation-behavior.md)
- [Change synced data](how-to/change-synced-data.md)
- [Debug a page that will not load](how-to/debug-page-loading.md)

## Reference

Reference pages are fact-oriented. They should stay concise and easy to scan.

- [Project map](reference/project-map.md)
- [Data model](reference/data-model.md)
- [Routes and runtime](reference/routes-and-runtime.md)
- [Commands](reference/commands.md)

## Explanation

Explanations describe why the system is shaped the way it is.

- [Architecture](explanation/architecture.md)
- [Annotation anchoring](explanation/annotation-anchoring.md)
- [Frame proxy and page cache](explanation/frame-proxy-and-cache.md)
- [Sync and auth](explanation/sync-and-auth.md)

## Writing New Docs

Before adding a page, decide what reader need it serves:

- Learning by doing: tutorial
- Completing a specific task: how-to
- Looking up exact facts: reference
- Understanding a design or tradeoff: explanation

Keep those modes separate. A tutorial can link to an explanation instead of
teaching every underlying concept inline.

## Architecture Decision Records

- [ADR index](adr/README.md)
