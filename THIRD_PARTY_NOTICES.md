# Third-party notices

## video-batch-download

- Project: https://github.com/ljb1020/video-batch-download
- Pinned revision: `be5e41cf7e95b3c3388790bcce91b8becb942ef1`
- License: MIT
- Use: optional public-video acquisition and local transcription runtime installed under `.runtime/`

The setup script clones the upstream project instead of copying its source into this repository. It verifies the pinned upstream `LICENSE` SHA-256 before installing runtime dependencies.

## Lark CLI

- Project: https://github.com/larksuite/cli
- Package: `@larksuite/cli`
- License: MIT
- Use: optional Feishu authentication and Excel-to-Feishu spreadsheet import

Lark CLI is installed separately and owns its authentication state. This repository does not store its OAuth tokens.
