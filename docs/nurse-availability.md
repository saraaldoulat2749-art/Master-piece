# Nurse availability

`CarePlusNurseAvailability` is shared by care selection, request creation, and acceptance. It checks the entire requested duration against the nurse's configured `workSchedule` and existing assigned requests. Times use Asia/Amman (UTC+03).

Nurse profiles now store `workSchedule: { days: [0..6], start: "HH:mm", end: "HH:mm", fullDay: boolean }`. Sunday is 0. End before start means an overnight shift; full-day availability is explicit. Recognizable legacy availability text is read without rewriting existing records. Unknown or missing hours do not imply availability.

Pending requests reserve the interval, along with accepted and in-progress visits. Rejected, cancelled, completed, closed and expired requests do not. Back-to-back visits are allowed. Daily and weekly recurrence is respected from the original start date; the current forms have no recurrence end date, so these repeat indefinitely until closed or cancelled.

The picker updates while open, and selection is revalidated at submission and nurse acceptance. Changing a request's nurse, date, time, duration or recurrence also rechecks conflicts. Existing records are preserved, and changing working hours does not delete existing visits.

This is frontend simulation. A future backend must perform these same checks inside an assignment/booking transaction, using the database's authoritative schedule and bookings to prevent cross-client race conditions.

Run the isolated integration checks from `Master-piece`:

```sh
node -e "import('./tests/nurse-availability.test.mjs').then(async t => console.log(await t.runNurseScheduleTests()))"
```
