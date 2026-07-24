# Indigo `AddJob` export — field mapping

Reference for the "Export manifest" integration. Source: *NPA Indigo Cloud API
Integration* PDF, `iWebService/V1/AddJob` endpoint. Payload is built in
`buildIndigoAddJobPayload` in
[`src/app/dashboard/manifests/[id]/page.tsx`](../src/app/dashboard/manifests/%5Bid%5D/page.tsx).

## Endpoint

- **Method / path:** `POST /iWebService/V1/AddJob`
- **Base URL:** `https://apps.neilporterassociates.co.uk/iWebService/V1` — SPLTEST sandbox, for testing only.
- **Auth:** `X-Indigo-Access-Token` header = `Base64("username:password")`.
  Sandbox creds: username `SPLTEST`, password `SPLTest123!`, account number `SPL001`.
  Verified the computed token matches Indigo's own worked example exactly.
- **Content-Type / Accept:** `application/json`
- **Body shape:** `{ "Jobs": { "Job": [ {...}, {...} ] } }` — bulk-capable,
  one call can submit every job in a manifest at once.
- **Response shape:** one result object per submitted job, each with its own
  `JobGuid`, `JobNumber` (Indigo's ID, on success), `ErrorCode`,
  `Errormessage` — so partial success/failure across a manifest is possible.

## Reviewing the request (URL + auth header) before going live

There's no base URL/username/password form on the page — those aren't
rendered as UI fields or stored in React state, since nothing here is wired
up to an actual `fetch` yet.

**Clicking "Export manifest"** now logs three separate, clearly labeled
console lines automatically — `payload:`, `url:`, `token:` — computed using
the `INDIGO_TEST_CONNECTION` sandbox constant (SPLTEST) hardcoded near
`buildIndigoAccessToken`. That constant is temporary: it exists so testing
doesn't require retyping credentials every time, and must be removed/replaced
before this ever points at a real account.

**To test with different credentials** without touching code, `handleExport`
also attaches a console-only helper to `window`:

```
horizonIndigoRequest("https://apps.neilporterassociates.co.uk/iWebService/V1", "SPLTEST", "SPLTest123!")
```

Run that in the browser DevTools console — it logs the same three labeled
lines (`payload:`/`url:`/`token:`) using whatever base URL/username/password
you pass in, computing `X-Indigo-Access-Token` as `Base64("username:password")`
per the doc. Either way, nothing is sent over the network — this only builds
and logs what *would* be sent, for review/sign-off before anyone wires up a
live call.

## UI: "Indigo booking details"

`ServiceType` no longer has its own dedicated card — it's now one field in
the same row as the manifest's existing `Account number` / `Vehicle size` /
`Job reference` fields, in that order: **Account number, Vehicle size,
Service type, Job reference**. `CustomerNumber` and `VehicleType` are **not**
separate inputs — the client confirmed these are the same values as
`Account number` and `Vehicle size`, so `buildIndigoAddJobPayload` reads
those directly (`manifestFields.account_number` /
`manifestFields.vehicle_size`) instead of duplicating them.

`BookedBy` and `RequestedBy` are **not** editable fields at all — sent as
hardcoded constants (`''` and `'Horizon Web'`) directly in
`buildIndigoAddJobPayload`. `JobReference2` was dropped entirely too (always
sent as `''`) — no separate use for it.

`ServiceType` is the one remaining local-only value (`indigoFields`,
currently just `{ service_type }`) with no backend column yet — resets on
page reload until the backend adds real storage for it. It's a dropdown
backed by `INDIGO_SERVICE_TYPE_OPTIONS` (`Sameday`, `Overnight Parcels`) —
the real codes, provided by the client.

## Merged HAWBs on export

Jobs sharing the exact same collection *and* delivery address (`routeGroups`
— also what drives the "Merge" run-order view) collapse into **one** Indigo
`Job` on export, with `Packs`/`Weight` summed across the group. This applies
regardless of whether List or Merge view is currently selected — it's a fact
about the physical run, not a display preference.

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
| `JobGuid` | Mandatory, 32-char unique string | `crypto.randomUUID()` with dashes stripped | ✅ |
| `CustomerNumber` | Mandatory, STRING(8) | `manifestFields.account_number` — same value as the manifest's "Account number" field, confirmed with client | ⚠️ Confirm real values never exceed 8 chars |
| `ServiceType` | Mandatory, code from Indigo's list | `indigoFields.service_type` (dropdown: `Sameday` / `Overnight Parcels`, local-only) | ✅ |
| `VehicleType` | Mandatory, code from Indigo's list | `manifestFields.vehicle_size` — same value as the manifest's "Vehicle size" field, confirmed with client | ⚠️ Sends our internal codes (`small_van` etc.), not necessarily Indigo's own vehicle/tariff codes — worth confirming these match |
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
| `ColTown` | **Mandatory**, STRING(25) | `cityAndPostcodeLine(job.shipper).town` | ✅ Extracted from the "Town, Postcode" line that sits just before the country line |
| `ColPostcode` | Mandatory, STRING(8) | `cityAndPostcodeLine(job.shipper).postcode` | ✅ Fixed a real bug: previously matched a street number (e.g. `28454` from `"28454 Livingston Ave"`) instead of the real postcode — now searches from the last line backward |
| `ColCountry` | Optional | `addressCountry(job.shipper)` — last line of the address blob | ✅ Confirmed correct for the sample data reviewed (last line = country) |
| `ColTelephone` | Optional | `job.shipper_phone` | ✅ |
| `ColEmail` / `ColInsts` / `ColReadyAt` / `ColPremisesClose` | Optional | `''` | No such data captured today |

## Delivery (`Del*`)

Mirrors `Col*` exactly (`DelContact` ← `job.consignee_contact`, `DelTelephone`
← `job.consignee_phone`, `DelCountry` ← `addressCountry(job.consignee)`),
same statuses, except:

- `DelDateTime` is **optional** per the doc ("calculated from collection
  date/service/tariff if not supplied") — sending `''` here is fine, unlike
  `ColDateTime`.
- `DelTown`/`DelPostcode` use the same `cityAndPostcodeLine()` extraction as `Col*`.

## Package / other

| Field | Indigo spec | We send | Status |
|---|---|---|---|
| `Packs` | "At least 1 parcel/pallet qty **must** be passed" | `job.package_qty ?? 0` | ⚠️ If unset, sends `0` — violates their stated minimum |
| `Weight` | Total parcel weight | `job.weight_kg ?? 0` | ⚠️ Same risk if unset |
| `SpecialInsts` | Optional | `job.special_handling` (or the combined-HAWBs note on a merged job — see "Merged HAWBs on export" above) | ✅ |
| `Length` / `Width` / `Height` | Optional, cm | `parseDimensions(job.dimensions)` — pulls up to 3 numbers out of the free-text field in order | ⚠️ Best-effort; depends on `dimensions` being entered as e.g. `"30 x 20 x 15"` |
| `Fragile` | 0/1 | hardcoded `0` | No such flag exists in our data model |
| `Security` | 0/1 | hardcoded `0` | Same |
| `ConsignmentNo` | Optional, 3rd-party ref | `job.hawb_number` | ✅ |
| `Insurance` | 0/1 | hardcoded `0` | Confirmed with client: leave at `0` (not wired to `declared_value`) |
| `InsuranceValue` | Currency | hardcoded `0` | Same — confirmed staying `0` |

## Known gaps not represented anywhere in the Indigo schema

- **Dangerous goods** — `job.dangerous_goods` / `dangerous_goods_notes` have
  nowhere to go. Indigo's `AddJob` has no hazmat field at all. Worth raising
  with the client directly.

## Before this can actually be wired up (live call)

1. ~~Base URL + username/password for `X-Indigo-Access-Token`~~ — have SPLTEST sandbox creds; still need production credentials before going live.
2. Confirm our `Vehicle size` values (`small_van`/`short_wheel_base`/`long_wheel_base`) actually match Indigo's `VehicleType` codes — if not, this needs a mapping table rather than sending them straight through.
3. Backend support to persist `indigoFields.service_type` against the manifest (new column/migration) — currently local-only and lost on reload.
4. Pre-export validation so a job missing a mandatory field (collection date, packages/weight, or a `Town`/`Postcode` that `cityAndPostcodeLine()` failed to extract) is caught in the UI before a bulk `AddJob` call is attempted, rather than failing at Indigo.
