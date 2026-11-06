# Professional license expiration and renewal

This workflow is a **frontend simulation**, not backend authorization or document verification. Existing account activation and professional onboarding remain independent of license validity. No service records are deleted or reset.

## Policy

- The original approved `professionalApplications` record supplies the initial license number, optional expiration and document. Missing expiration means no recorded expiry, preserving existing accounts.
- `users.professionalLicense` contains the most recently **Admin-approved** renewal. An uploaded or pending document never changes this approved snapshot.
- Expiration dates are valid through the indicated calendar day in `Asia/Amman`. Malformed dates fail closed. No-expiration renewals require an explicit checkbox.
- Expired Doctors cannot receive new appointments; expired Nurses are excluded from selection and cannot accept new care requests or start visits; expired Pharmacies cannot receive or accept new orders. Existing records remain accessible. Dashboard login is not changed by license expiry.
- A pending or rejected renewal leaves the existing approved license in effect until its original expiration. After expiration, restrictions remain until approval.
- `IsActive`, legacy `isActive` / `accountStatus`, and initial `verificationStatus` are checked independently. Renewal approval changes none of them.

## Reused screens

Professional dashboards contain a license status panel and a `Renew License` dialog using the existing document store. Primary license uploads in the profile document section route to this review workflow. Other document types retain their existing behavior.

Admin's main dashboard and existing Doctor, Nurse and Pharmacy management screens contain a renewal queue, uploaded-document preview, approval and rejection with a reason. Filters include completed reviews. The original application and each renewal are preserved for history.

## Data and future SQL Server integration

`licenseRenewals` is an additive collection: `id`, `userId`, `role`, `licenseNumber`, nullable `licenseExpiry`, `noExpiry`, document metadata, `status` (`Pending`, `Approved`, `Rejected`), submission/review timestamps, reviewer and reason. `users.professionalLicense` stores the approved snapshot and `sourceRenewalId`.

For a backend, map these to `ProfessionalLicenses`, `LicenseRenewalRequests`, and the existing document table, with FKs to users and documents. Keep activation on the account, verification on the professional application, and license state on the license. Approval must update the approved license and renewal status in one SQL transaction with a pending-status / row-version check. Retain old documents and reviews.

Replace the API-shaped `CarePlusLicenses` methods with authenticated endpoints. Server-side booking, assignment and pharmacy acceptance endpoints must independently enforce the same policy and trusted clock. Enforce one pending renewal per professional, role authorization, upload size/content checks, malware scanning, protected document access, and audit ownership on the server. Browser flags and MIME types are not security evidence.

The frontend data adapter commits review changes together and rolls them back on persistence failure. Simulated notifications point Admin to the renewal queue and professionals to their dashboard. Date checks run on each service action; dashboard status refreshes every minute.

## Validation

`tests/professional-licenses.test.mjs` exports `runLicenseTests()`. It runs the real shared data adapter and license policy in an isolated browser mock, covering all three roles, optional dates, expiration boundaries, review authorization, rejection/resubmission, activation independence, service guards, preservation and failed approval rollback.

From the `Master-piece` directory, run:

```sh
node -e "import('./tests/professional-licenses.test.mjs').then(async t => console.log(await t.runLicenseTests()))"
```
