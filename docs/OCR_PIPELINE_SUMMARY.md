# OCR Pipeline Summary

This public version does not include raw screenshot OCR outputs.

The original MVP used a lightweight OCR workflow to convert game-rule screenshots into structured knowledge-base drafts:

1. Collect rule screenshots from a sample game scenario.
2. Run OCR on selected screenshots and export text rows with confidence scores.
3. Group extracted text by feature area, rule type, and review status.
4. Manually review high-value rules before adding them to the Agent knowledge base.
5. Keep uncertain OCR results out of deterministic answers and route edge cases to feedback collection.

Public repository boundary:

- Raw screenshots are not included.
- Raw OCR CSV/Markdown outputs are not included.
- Knowledge-base entries are anonymized examples for demonstrating the product workflow.
- The OCR script is kept as a reusable example and requires callers to provide their own local image directory.
