# Output contract

`result.json` is the durable interchange object.

Top-level fields:

- `schemaVersion`: currently `1`.
- `generatedAt`: UTC timestamp.
- `source`: original URL, canonical URL, platform, content ID, title, author, publication time, duration, and available public statistics.
- `profile`: exact user-approved breakdown profile and version.
- `transcript.rawCues`: immutable downloader/ASR cue text and timestamps.
- `transcript.cleanedCues`: AI proposals with the same cue indexes and timestamps.
- `sections`: ordered semantic sections. Every cue must appear exactly once, with no gap or overlap.
- `provenance`: acquisition tool revision, analysis provider/model, and source-result path.

Every section contains its chosen profile category, copied category definition, inclusive start/end cue indexes, exact time range, concise summary, confidence, uncertainty, raw text, and cleaned text.

Downstream adapters should depend on this object rather than a provider response. Unknown fields should be preserved. A new incompatible contract requires a new `schemaVersion`.
