# BillFlow v0.4.3 — Recurring-invoice build

A dependency-free web prototype for solo sellers and micro-businesses. This is a product validation build, not yet a production-ready SaaS or a published Android app. Keep a backup before replacing an earlier folder. v0.3 is designed to import normal v0.2 JSON backups, but always retain the original backup file.

## v0.4 changes
- Uses the computer's local calendar date instead of UTC date slicing.
- Rejects discounts above subtotal plus tax, invalid tax rates, over-large initial payments, and due dates before issue dates.
- Validates payment amount/date and prevents recording more than the remaining balance.
- Validates imported backup structure and line-item/payment values before replacement.
- Handles local storage write failures with an explicit warning instead of silently claiming the data was saved.
- Escapes quantity output in the printable invoice.
- Adds recurring invoice generation for weekly, monthly, and yearly schedules when BillFlow is opened; generated occurrences are tracked against the recurring template to prevent duplicate generation.
- Uses sequential invoice numbering based on the highest existing number for the current year.

## Features implemented
- Business profile (name, contact details, address, currency, payment instructions)
- Invoices, quotes and receipts with line items, quantities, tax and discount
- Issue date and due date
- Payment recording and payment history; calculates balance and status
- Customer list built from created documents
- Search and status filters
- Printable document layout; browser print dialog can save as PDF
- WhatsApp share and reminder preparation; user reviews/sends manually
- Recurring invoice generation for weekly, monthly, and yearly schedules when BillFlow is opened; overdue occurrences are processed with a catch-up limit of 24 per run.
- Recurring templates display the next scheduled occurrence when available. Generated invoices are linked to their source template, and generated invoices start with empty       payment histories.
- Local browser persistence, JSON export/import backup
- PWA manifest and service worker foundation
- Starter privacy notice

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser. Core functions work locally.
3. For install/offline service-worker behavior, serve the folder over localhost or HTTPS. Example with Python: `python -m http.server 8080`, then visit `http://localhost:8080`.

No build step, npm packages, database, API key or paid service is required.

## Important limitations before commercial launch
- Data is stored in browser localStorage: no login, cloud sync, encryption-at-rest, team access, or cross-device recovery.
- WhatsApp and email reminders are prepared for a human to send; they are not automated.
- Recurrence is stored as a schedule preference only; there is no background scheduler or automatic invoice generation.
- PDF output uses the browser's print dialog rather than a dedicated PDF library.
- No payment gateway integration, tax/legal validation, analytics, subscription billing, support backend, or automated testing suite yet.
- PWA icons are not included. Add optimized icon assets before install promotion.
- The privacy page is a starter template and must be completed with the real operator's contact details and reviewed for target markets.
- Validate all calculations, date handling, import/export, mobile layouts, and browser compatibility before handling real customer data.

## Suggested validation plan
1. Test with synthetic data only; test totals, discounts, taxes, partial payments, overdue status, import/export, and print.
2. Interview 10–15 micro-business owners and observe them creating a real-world invoice.
3. Recruit a small pilot cohort; measure document completion, repeat use, and willingness to pay.
4. Only after validation, decide between a web-first paid product and Android release.
5. Add authentication/cloud sync, secure storage, privacy/data deletion workflows, backups, monitoring, and support before offering cloud accounts.

## Commercial model to test (not yet implemented)
- Free: limited monthly documents and basic templates.
- Pro: branded PDF, saved customers, multiple templates and export history.
- Later: cloud backup, recurring invoice automation and team access.

Do not promise automated reminders or recurring billing until those features are implemented and tested.


## Important recurring-invoice limitation
Recurring invoices are generated locally when BillFlow is opened. The browser must be open to run the recurrence processor; no background scheduler runs while the app is closed. Overdue occurrences are processed with a maximum catch-up of 24 per run, and any remaining overdue occurrences may require subsequent app openings. BillFlow does not automatically send invoices or reminders.


### v0.4.1 recurrence fix
The recurrence processor now handles overdue occurrences even when the app is opened for the first time after a scheduled date. The app must still be opened for local recurring invoices to be generated; this build does not run background jobs while closed.


### v0.4.2
Recurring invoice templates now display their next scheduled occurrence date on the dashboard and in document details when a date is available. If the date is missing, the details view says so explicitly. This is a visibility improvement; the local scheduler still runs only when the app opens.


### v0.4.3 recurrence preview
When an invoice is selected and a recurrence frequency is chosen, the form displays the next scheduled occurrence based on the issue date. The local scheduler still runs only when the app is opened; it does not run in the background while the browser is closed.
