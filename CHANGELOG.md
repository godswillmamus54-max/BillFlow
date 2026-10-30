# Changelog

## v0.3 — Validation hardening
- Added validation for tax rate, discount, initial payment, and due-date ordering.
- Prevented discount amounts from exceeding subtotal plus tax.
- Added payment date/amount validation and outstanding-balance protection.
- Added structural validation for imported JSON backups.
- Added local-storage write-failure handling.
- Corrected local date generation to use local calendar fields.
- Removed the nested duplicate starter project from the release ZIP to reduce folder confusion.

## Known limitations
- Browser-local storage only; no account, cloud sync, or server-side backup.
- Recurring invoices are generated locally when the app opens; no background scheduler runs while the app is closed.
- Reminders are prepared for a human to send, not sent automatically.
- No automated end-to-end test suite or payment gateway yet.

## v0.4 — Recurring invoice generation
- Generate weekly, monthly, and yearly invoice occurrences when the app opens and a schedule is due, processing up to 24 overdue occurrences per run.
- Store the next scheduled date on the recurring template and tag generated occurrences to prevent them from generating their own duplicates.
- Preserve the due-date offset from the original issue date.
- Generate sequential yearly invoice numbers based on existing document numbers.
- Important: generation runs only when the local app is opened; it is not a background scheduler.


## v0.4.1
- Fixed first-run recurrence processing so overdue occurrences are generated rather than skipped when the app was not opened before the first scheduled date.


## v0.4.2
- Shows the next scheduled date for recurring invoice templates in the dashboard and document details.
- Makes a missing next recurring date explicit in document details.


## v0.4.3
- Adds a live next-occurrence date preview in the create-document form when Weekly, Monthly, or Yearly recurrence is selected.
- Refreshes the preview when recurrence frequency, issue date, or document type changes.
- Bumps the service-worker cache name to avoid stale cached assets after updating.
