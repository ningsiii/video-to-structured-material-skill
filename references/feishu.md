# Feishu spreadsheet destination

This adapter imports one finished `.xlsx` file as one new, ordinary Feishu spreadsheet. It does not append to an existing spreadsheet and does not create or update Feishu Bitable records.

Use the official open-source `@larksuite/cli`; do not implement or persist OAuth tokens in this Skill.

Install and initialize it only when the user selects Feishu:

```bash
npm install -g @larksuite/cli
lark-cli config init --new
lark-cli auth login --domain drive --domain sheets --no-wait --json
```

When authentication returns a verification URL, keep it byte-for-byte unchanged, generate a QR code with the official CLI, and show both the link and QR to the user:

```bash
lark-cli auth qrcode "<verification_url>" --output feishu-auth.png
```

Wait for the user to complete authorization, then verify it:

```bash
lark-cli auth status --json --verify
```

The wrapper imports the generated workbook as a Feishu spreadsheet with the command supported by the current published CLI:

```bash
lark-cli drive +import --type sheet --as user --file ./materials.xlsx
```

If an organization requires application approval or additional scopes, report the exact missing permission and stop. Do not request broader scopes than the destination needs.

For a persistent cross-video library, existing-sheet append, or Bitable workflow, build a separate destination adapter against `result.json`; do not imply that this import command already provides those behaviors.
