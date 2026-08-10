# Indigo `AddJob` export — field mapping

Reference for the "Export manifest" integration. Source: *NPA Indigo Cloud API
Integration* PDF, `iWebService/V1/AddJob` endpoint.

**The call is made server-side**, from Horizon-Api, not from the browser:
Indigo's API has no CORS support (confirmed — a direct browser call gets
blocked with `No 'Access-Control-Allow-Origin' header is present`), and the
account credentials must never ship in the frontend bundle. Clicking "Export
manifest" in Horizon-Web calls our own backend
(`POST /hawb/manifests/{id}/indigo-export`), which builds the payload from
the manifest/jobs already in the database and calls Indigo itself.

- **Frontend:** `handleExport` in
  [`src/app/dashboard/manifests/[id]/page.tsx`](../src/app/dashboard/manifests/%5Bid%5D/page.tsx)
  calls `useIndigoExportManifestMutation` (`src/services/hawbApi.ts`), passing
  only `service_type` (the one Indigo-specific field not yet persisted — see
  below). Everything else needed for the payload is read from the manifest
  and its jobs by the backend directly.
- **Backend:** `indigo_export_manifest` in `Horizon-Api/app/routers/hawb.py`
  loads the manifest + jobs, groups same-route jobs, builds the payload, and
  calls Indigo — all in `Horizon-Api/app/services/indigo_export.py`, which is
  a straight Python port of the field mapping documented below.

## Endpoint

- **Method / path:** `POST /iWebService/V1/AddJob`
- **Base URL:** `https://apps.neilporterassociates.co.uk/iWebService/V1` — SPLTEST sandbox, for testing only.
- **Auth:** `X-Indigo-Access-Token` header = `Base64("username:password")`.
  Sandbox creds: username `SPLTEST`, password `SPLTest123!`, account number `SPL001`.
  Verified the computed token matches Indigo's own worked example exactly.
  Configured via `INDIGO_BASE_URL` / `INDIGO_USERNAME` / `INDIGO_PASSWORD` in
  Horizon-Api's settings (`app/core/config.py`) — override in `.env` with real
  credentials before this ever points at a live account.
- **Content-Type / Accept:** `application/json`
- **Body shape:** `{ "Jobs": { "Job": [ {...}, {...} ] } }` — bulk-capable,
  one call can submit every job in a manifest at once.
- **Response shape:** one result object per submitted job, each with its own
  `JobGuid`, `JobNumber` (Indigo's ID, on success), `ErrorCode`,
  `Errormessage` — so partial success/failure across a manifest is possible.
  Horizon-Api returns this as-is (`{ "results": [...] }`) to the frontend.

## UI: "Indigo booking details"

`ServiceType` no longer has its own dedicated card — it's now one field in
the same row as the manifest's existing `Account number` / `Vehicle size` /
`Job reference` fields, in that order: **Account number, Vehicle size,
Service type, Job reference**. `CustomerNumber` and `VehicleType` are **not**
separate inputs — the client confirmed these are the same values as
`Account number` and `Vehicle size`, so the backend payload builder reads
those directly off the manifest instead of duplicating them.

`BookedBy` and `RequestedBy` are **not** editable fields at all — sent as
hardcoded constants (`''` and `'Horizon Web'`). `JobReference2` was dropped
entirely too (always sent as `''`) — no separate use for it.

`ServiceType` is the one remaining local-only value (`indigoFields`,
currently just `{ service_type }`) with no backend column yet — resets on
page reload, and is sent fresh from the frontend on every export rather than
being read from the database. It's a dropdown backed by
`INDIGO_SERVICE_TYPE_OPTIONS` (`Sameday`, `Overnight Parcels`) — the real
codes, provided by the client.

## Merged HAWBs on export

`AdditionalDrops` is the "Merge" run-order view, one drop per row on screen, in
the same order — what the user merged and reordered on the manifest is exactly
what gets booked. `group_jobs_by_merge` server-side mirrors the frontend's
`routeGroups` (same-To first, then same-shipper-contact among what's left; a key
only one HAWB matched isn't a merge). **The two rules have to change together** —
they drifted apart once already, the backend grouping on the (shipper, consignee)
pair while the frontend grouped on the To, and one manifest reported 4 stops on
screen while 7 drops went to Indigo. `Packs`/`Weight` are summed across a group;
`DateTime` is the **earliest** of its members, since the driver makes one visit
and has to satisfy the tightest constraint.

The merge rule keys on paperwork, not geography, so two guards run before the
payload is built (both 409, both listing the HAWB numbers):

- **Blank Del/Coll.** The leg decides which end of a HAWB the driver visits — a
  collection stops at the `From`, a delivery at the `To`. With it unset there's
  no address to book, and defaulting it would silently pick a country.
- **A group that can't resolve to one address.** Members must agree on the leg
  *and* on the address that leg stops at. Neither is implied by the merge rule:
  a group keyed on the To whose members are collections is keyed on somewhere
  nobody visits, and its pickups can sit in different countries. Unchecked, the
  drop takes whichever HAWB sorted first and the rest vanish from the payload —
  a driver sent to California for a run out of St. Mary's.

Note the second guard means a valid merge is one where the merge key and the
Del/Coll leg agree: a **Same To** group wants Deliveries, a **Same Shipper
Contact** group wants Collections. Set the legs from the UK end of each route
(what `defaultServiceType` does) and that holds automatically.

Two groups can legitimately resolve to the same address — e.g. St. Mary's
HAWBs split across a Same Shipper Contact group and a Same To group — and that
books as two drops at one postcode. That's the Merge view's shape being honoured
rather than second-guessed.

Since Indigo's schema has no field for "one job, multiple consignments",
`JobReference`/`ConsignmentNo` on a merged job carry only the *first* HAWB
in the group. `SpecialInsts` is the deduplicated union of every member's
`special_handling` (so an identical note shared by the whole group isn't
repeated) — confirmed with the client this applies even when a note says
"DO NOT CONSOLIDATE"; that phrase refers to how the physical goods are
packed, not whether the jobs get booked together.

## Status legend

- ✅ Solid — confident mapping, no known issue.
- ⚠️ Works, but has an edge case — should be guarded before we actually call the API.
- ❌ Blocked — no real value available yet; currently exports as `''`/`0` and will fail Indigo's own mandatory-field validation.

## Job identifiers

| Field | Indigo spec | We send | Status |
|---|---|---|---|
| `JobGuid` | Mandatory, 32-char unique string | `uuid.uuid4().hex` | ✅ |
| `CustomerNumber` | Mandatory, STRING(8) | `manifest.account_number` — same value as the manifest's "Account number" field, confirmed with client | ⚠️ Confirm real values never exceed 8 chars |
| `ServiceType` | Mandatory, code from Indigo's list | `service_type` from the request body (dropdown: `Sameday` / `Overnight Parcels`, local-only) | ✅ |
| `VehicleType` | Mandatory, code from Indigo's list | `manifest.vehicle_size` — same value as the manifest's "Vehicle size" field, confirmed with client | ⚠️ Sends our internal codes (`small_van` etc.), not necessarily Indigo's own vehicle/tariff codes — worth confirming these match |
| `JobReference` | "Your unique reference, cross-referenced in the response" | `job.hawb_number` | ✅ HAWB is naturally unique per job |
| `JobReference2` | Optional | `''` — dropped, no separate use for it | — |
| `BookedBy` | Optional, STRING(3) | `''` — hardcoded, no UI field | — |
| `RequestedBy` | "Your system identifier" | `'Horizon Web'` — hardcoded, no UI field | ✅ |

## Collection (`Col*`)

| Field | Indigo spec | We send | Status |
|---|---|---|---|
| `ColDateTime` | **Mandatory**, `YYYY-MM-DDTHH:MM:SS` | formatted `job.collection_at` | ⚠️ If a job has no collection time set, exports `''` against a mandatory field |
| `ColCompany` | Mandatory | first line of `job.shipper` | ✅ |
| `ColContact` | Optional | `job.shipper_contact` | ✅ |
| `ColAddress1` | Optional, STRING(35) | **all** remaining shipper lines joined | ⚠️ Can exceed 35 chars and get truncated/rejected — would need splitting across `ColAddress1`/`2`/`3` to fully fix |
| `ColAddress2` / `ColAddress3` | Optional | `''` | Unused — see above |
| `ColTown` | **Mandatory**, STRING(25) | `city_and_postcode_line(job.shipper).town` | ✅ Extracted from the "Town, Postcode" line that sits just before the country line |
| `ColPostcode` | Mandatory, STRING(8) | `city_and_postcode_line(job.shipper).postcode` | ✅ Fixed a real bug: previously matched a street number (e.g. `28454` from `"28454 Livingston Ave"`) instead of the real postcode — now searches from the last line backward |
| `ColCountry` | Optional | `address_country(job.shipper)` — last line of the address blob | ✅ Confirmed correct for the sample data reviewed (last line = country) |
| `ColTelephone` | Optional | `job.shipper_phone` | ✅ |
| `ColEmail` / `ColInsts` / `ColReadyAt` / `ColPremisesClose` | Optional | `''` | No such data captured today |

## Delivery (`Del*`)

Mirrors `Col*` exactly (`DelContact` ← `job.consignee_contact`, `DelTelephone`
← `job.consignee_phone`, `DelCountry` ← `address_country(job.consignee)`),
same statuses, except:

- `DelDateTime` is **optional** per the doc ("calculated from collection
  date/service/tariff if not supplied") — sending `''` here is fine, unlike
  `ColDateTime`.
- `DelTown`/`DelPostcode` use the same `city_and_postcode_line()` extraction as `Col*`.

## Package / other

| Field | Indigo spec | We send | Status |
|---|---|---|---|
| `Packs` | "At least 1 parcel/pallet qty **must** be passed" | `job.package_qty or 0` | ⚠️ If unset, sends `0` — violates their stated minimum |
| `Weight` | Total parcel weight | `job.weight_kg or 0` | ⚠️ Same risk if unset |
| `SpecialInsts` | Optional | `job.special_handling` (or the combined-HAWBs note on a merged job — see "Merged HAWBs on export" above) | ✅ |
| `Length` / `Width` / `Height` | Optional, cm | `parse_dimensions(job.dimensions)` — pulls up to 3 numbers out of the free-text field in order | ⚠️ Best-effort; depends on `dimensions` being entered as e.g. `"30 x 20 x 15"` |
| `Fragile` | 0/1 | hardcoded `0` | No such flag exists in our data model |
| `Security` | 0/1 | hardcoded `0` | Same |
| `ConsignmentNo` | Optional, 3rd-party ref | `job.hawb_number` | ✅ |
| `Insurance` | 0/1 | hardcoded `0` | Confirmed with client: leave at `0` (not wired to `declared_value`) |
| `InsuranceValue` | Currency | hardcoded `0` | Same — confirmed staying `0` |

## Known gaps not represented anywhere in the Indigo schema

- **Dangerous goods** — `job.dangerous_goods` / `dangerous_goods_notes` have
  nowhere to go. Indigo's `AddJob` has no hazmat field at all. Worth raising
  with the client directly.

## Persisting Indigo's `JobNumber` against each HAWB

Per client feedback: "The Indigo JobNumber is our unique reference, so I
would suggest that you persist that job number against each HAWB."

- `HawbJob.indigo_job_number` (backend model + `HawbJobOut`/`HawbJobUpdate`
  schemas, `Horizon-Api/app/models/hawb.py` and `app/schemas/hawb.py`) — new
  column, **DB migration not yet applied** (no Alembic/migration tooling in
  this repo; needs a manual `ALTER TABLE hawb_jobs ADD COLUMN
  indigo_job_number VARCHAR(50);` against each environment before an export
  will succeed — Indigo's own request will still go through and book the job
  even if this fails, since the DB write happens after the AddJob call).
- `indigo_export_manifest` (the `/indigo-export` router handler) sets
  `job.indigo_job_number` directly on every HAWB in a merged group — since
  they were all booked as that one Indigo Job — and commits it in the same
  request that calls Indigo, right after a successful response.
- Frontend type: `HawbJob.indigo_job_number` / `HawbJobUpdate.indigo_job_number`
  in `src/services/hawbApi.ts`. The `indigoExportManifest` mutation
  invalidates the manifest/job RTK Query tags, so the UI refetches and picks
  up the new value automatically.
- Read-only "Indigo Job #" badge next to the MF-PCS PDF link in the expanded
  HAWB panel, shown once `job.indigo_job_number` is set.

## Before this can go to production

1. Real (non-SPLTEST) Indigo credentials, set via Horizon-Api's `.env`
   (`INDIGO_BASE_URL` / `INDIGO_USERNAME` / `INDIGO_PASSWORD`).
2. Confirm our `Vehicle size` values (`small_van`/`short_wheel_base`/`long_wheel_base`) actually match Indigo's `VehicleType` codes — if not, this needs a mapping table rather than sending them straight through.
3. Backend support to persist `indigoFields.service_type` against the manifest (new column/migration) — currently local-only, sent fresh from the frontend on every export.
4. Run the `indigo_job_number` migration (see above) against every environment.
5. Pre-export validation so a job missing a mandatory field (collection date, packages/weight, or a `Town`/`Postcode` that `city_and_postcode_line()` failed to extract) is caught in the UI before a bulk `AddJob` call is attempted, rather than failing at Indigo.
