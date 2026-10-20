# Intune Checker

Look up a list of Windows hostnames against an Intune devices export and record which ones are active. The check runs in your browser. It does not sign in to Microsoft, call Microsoft Graph, scrape the Intune portal, or ask for Global Admin or any new permission.

You already need access to export devices from the Intune admin center. This app only reads the CSV you download from there.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:47231](http://127.0.0.1:47231).

`npm test` checks the matching rules. `npm run lint` runs ESLint.

## How to check a list

1. Paste hostnames, or upload a `.txt` or `.csv` list. One name per line is enough. A column headed Hostname, Device name, or Computer name is used when the file has one.
2. Set the check-in window. The default is 30 days.
3. In Intune admin center, go to **Devices → Windows → Export** and upload that CSV.
4. Run the check. Download the results as CSV when you want to keep them.

**Load demo** fills a small example with dates relative to today, so you can try the app with no files. **Load 3,000-name demo** does the same at a larger size. Matching stays in the browser; the table shows 50 rows at a time.

## Active and inactive

A hostname is **active** when all of this is true:

- A row matches the hostname on the device-name column. Matching ignores capitalization and surrounding spaces. The names are otherwise exact.
- If the export has an OS column, that row is Windows. A blank OS is kept. Other operating systems are ignored. If there is no OS column, every row is treated as Windows.
- The row has a last check-in that can be read as a date.
- That check-in is within the window, measured back from the moment you run the check: `check-in >= now − (days × 24 hours)`. A check-in exactly on the cutoff is active. A timestamp in the future is active.

A hostname is **inactive** when any of this is true:

- No Windows row matches the device name.
- The last check-in is older than the window.
- The last check-in is blank, or the cell is not a date (that counts as missing).

If the same device name appears on more than one Windows row, the latest check-in is kept.

The results table shows last check-in, compliance, and primary user when the export has those columns.

## CSV columns

Headers are matched without regard to case, hyphens, or extra spaces. The first recognized header in each group is used.

| Field | Headers accepted, in priority order |
| --- | --- |
| Device name (required) | Device name, Computer name, Host name, Hostname, Managed device name, Device display name, Device, Name |
| Last check-in | Last check-in, Last check-in time, Last check-in date, Last check-in date time, Last sync date time, Last sync, Last contact, Last online |
| Compliance | Compliance, Compliance state, Compliance status, Device compliance |
| Primary user | Primary user UPN, User principal name, Primary user email address, Primary user email, UPN, Primary user, Primary user display name, User display name |
| OS | OS, Operating system, OS description, Platform |

Comma, semicolon, and tab separators are detected. A `sep=,` hint and a UTF-8 or UTF-16 BOM are accepted. Quoted fields can contain commas and line breaks.

Numeric dates such as `8/31/2026 8:05 AM` are read as month/day/year when both numbers are 12 or less. Switch **Ambiguous numeric dates** to day/month/year for exports written that way. `31/8/2026` is always day-first because 31 cannot be a month. ISO dates (`2026-10-18 15:04`) and dates with a month name are read either way. Values such as blank, `N/A`, and `Never` are a missing check-in.

The results CSV columns are Hostname, Status, Device name, Last check-in, Days since check-in, Compliance, Primary user, OS, and Reason.
