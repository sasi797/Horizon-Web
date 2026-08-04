import { api } from './api';

export interface HawbPackageLine {
  supplier?: string | null;
  package_type?: string | null;
  weight_kg?: number | null;
  content_description?: string | null;
  temperature_range?: string | null;
  dimensions?: string | null;
}

export interface HawbJob {
  id: string;
  document_id: string;
  hawb_number: string;
  page_start: number | null;
  shipper: string | null;
  consignee: string | null;
  collection_at: string | null;
  delivery_at: string | null;
  package_qty: number | null;
  weight_kg: number | null;
  dangerous_goods: boolean;
  dangerous_goods_notes: string | null;
  client_account: string | null;
  package_sequence: string | null;
  shipper_contact: string | null;
  shipper_phone: string | null;
  shipper_reference: string | null;
  consignee_contact: string | null;
  consignee_phone: string | null;
  consignee_reference: string | null;
  temperature_range: string | null;
  dimensions: string | null;
  volumetric_weight_kg: number | null;
  declared_value: number | null;
  declared_value_currency: string | null;
  direction: string | null;
  special_handling: string | null;
  job_service_type: 'delivery' | 'collection' | 'collection_and_delivery' | null;
  indigo_job_number: string | null;
  packages: HawbPackageLine[];
  extracted_data: Record<string, unknown>;
  source_kind: 'plain' | 'blind';
  blind_document_id: string | null;
  blind_pdf_url?: string | null;
  status: 'pending_review' | 'ready_to_manifest' | 'manifested';
  manifest_id: string | null;
  manifest_sequence: number | null;
  locked: boolean;
  ready_at: string | null;
  manifested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HawbDocument {
  id: string;
  filename: string;
  sender_email: string | null;
  subject: string | null;
  received_at: string;
  job_count: number;
  status: string;
  error_message: string | null;
  source_kind: 'plain' | 'blind';
  email_body_text: string | null;
}

export interface HawbJobUpdate {
  shipper?: string | null;
  consignee?: string | null;
  collection_at?: string | null;
  delivery_at?: string | null;
  package_qty?: number | null;
  weight_kg?: number | null;
  dangerous_goods?: boolean;
  dangerous_goods_notes?: string | null;
  client_account?: string | null;
  package_sequence?: string | null;
  shipper_contact?: string | null;
  shipper_phone?: string | null;
  shipper_reference?: string | null;
  consignee_contact?: string | null;
  consignee_phone?: string | null;
  consignee_reference?: string | null;
  temperature_range?: string | null;
  dimensions?: string | null;
  volumetric_weight_kg?: number | null;
  declared_value?: number | null;
  declared_value_currency?: string | null;
  direction?: string | null;
  special_handling?: string | null;
  job_service_type?: 'delivery' | 'collection' | 'collection_and_delivery' | null;
  indigo_job_number?: string | null;
}

export interface HawbManifest {
  id: string;
  reference_number: string;
  job_count: number;
  total_weight_kg: number;
  status: 'pending_review' | 'open' | 'booked' | 'confirmed' | 'on_hold' | 'exported' | 'cancelled' | 'extracting' | 'failed' | 'ignored';
  exported_at: string | null;
  indigo_job_number: string | null;
  cancelled_at: string | null;
  start_point: string | null;
  end_point: string | null;
  job_reference: string | null;
  account_number: string | null;
  vehicle_size: string | null;
  created_by: string | null;
  created_by_name: string | null;
  source_kind: 'plain' | 'blind';
  created_at: string;
  hawb_numbers: string[];
  remarks: string | null;
}

// Indigo's AddJob response: one result per submitted job, in the same order
// jobs were sent — server-built, see Horizon-Api's app/services/indigo_export.py.
export interface IndigoJobResult {
  JobGuid?: string | null;
  JobNumber?: string | null;
  JobReference?: string | null;
  ErrorCode?: string | number | null;
  Errormessage?: string | null;
}

export interface IndigoExportResult {
  results: IndigoJobResult[];
  payload?: Record<string, unknown> | null;
}

export interface HawbManifestUpdate {
  start_point?: string | null;
  end_point?: string | null;
  job_reference?: string | null;
  account_number?: string | null;
  vehicle_size?: string | null;
}

export interface HawbManifestDetail extends HawbManifest {
  jobs: HawbJob[];
  document: HawbDocument;
  pdf_url: string;
}

export interface HawbJobPendingUpdate {
  id: string;
  job_id: string;
  reason: 'duplicate_resend' | 'blind_companion_merge';
  proposed_data: Record<string, unknown>;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
  job: HawbJob;
  source_document: HawbDocument;
}

export const hawbApi = api.injectEndpoints({
  endpoints: (build) => ({
    updateHawbJob: build.mutation<HawbJob, { id: string; body: HawbJobUpdate }>({
      query: ({ id, body }) => ({ url: `/hawb/jobs/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'HawbJob', id }, 'HawbJob'],
    }),
    getHawbManifests: build.query<HawbManifest[], void>({
      query: () => '/hawb/manifests',
      providesTags: ['HawbManifest'],
    }),
    getHawbManifest: build.query<HawbManifestDetail, string>({
      query: (id) => `/hawb/manifests/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'HawbManifest', id }],
    }),
    updateHawbManifest: build.mutation<HawbManifest, { id: string; body: HawbManifestUpdate }>({
      query: ({ id, body }) => ({ url: `/hawb/manifests/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'HawbManifest', id }, 'HawbManifest'],
    }),
    reorderManifestJobs: build.mutation<HawbJob[], { manifestId: string; job_ids: string[] }>({
      query: ({ manifestId, job_ids }) => ({ url: `/hawb/manifests/${manifestId}/jobs/reorder`, method: 'PATCH', body: { job_ids } }),
      invalidatesTags: (_r, _e, { manifestId }) => [{ type: 'HawbManifest', id: manifestId }],
    }),
    exportManifest: build.mutation<Blob, string>({
      query: (manifestId) => ({
        url: `/hawb/manifests/${manifestId}/export`,
        method: 'POST',
        responseHandler: (response) => response.blob(),
      }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }],
    }),
    indigoExportManifest: build.mutation<IndigoExportResult, { manifestId: string; service_type: string; dry_run?: boolean }>({
      query: ({ manifestId, service_type, dry_run }) => ({
        url: `/hawb/manifests/${manifestId}/indigo-export`,
        method: 'POST',
        body: { service_type, dry_run },
      }),
      // A dry run only builds and returns the payload — nothing on the
      // manifest/jobs actually changed, so nothing needs refetching.
      invalidatesTags: (_r, _e, { manifestId, dry_run }) =>
        dry_run ? [] : [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest', 'HawbJob'],
    }),
    confirmManifest: build.mutation<HawbManifest, string>({
      query: (manifestId) => ({ url: `/hawb/manifests/${manifestId}/confirm`, method: 'POST' }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest'],
    }),
    holdManifest: build.mutation<HawbManifest, string>({
      query: (manifestId) => ({ url: `/hawb/manifests/${manifestId}/hold`, method: 'POST' }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest'],
    }),
    markManifestExported: build.mutation<HawbManifest, string>({
      query: (manifestId) => ({ url: `/hawb/manifests/${manifestId}/mark-exported`, method: 'POST' }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest'],
    }),
    cancelManifest: build.mutation<HawbManifest, string>({
      query: (manifestId) => ({ url: `/hawb/manifests/${manifestId}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest', 'HawbJob'],
    }),
    reopenManifest: build.mutation<HawbManifest, string>({
      query: (manifestId) => ({ url: `/hawb/manifests/${manifestId}/reopen`, method: 'POST' }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest', 'HawbJob'],
    }),
    retryManifestExtraction: build.mutation<HawbManifest, string>({
      query: (manifestId) => ({ url: `/hawb/manifests/${manifestId}/retry-extraction`, method: 'POST' }),
      invalidatesTags: (_r, _e, manifestId) => [{ type: 'HawbManifest', id: manifestId }, 'HawbManifest'],
    }),
    getJobUpdates: build.query<HawbJobPendingUpdate[], string | void>({
      query: (status) => (status ? `/hawb/job-updates?status=${status}` : '/hawb/job-updates'),
      providesTags: ['HawbJobPendingUpdate'],
    }),
    getProcessingDocuments: build.query<HawbDocument[], void>({
      query: () => '/hawb/documents/processing',
    }),
    applyJobUpdate: build.mutation<HawbJob, string>({
      query: (id) => ({ url: `/hawb/job-updates/${id}/apply`, method: 'POST' }),
      invalidatesTags: ['HawbJobPendingUpdate', 'HawbJob', 'HawbManifest'],
    }),
    dismissJobUpdate: build.mutation<HawbJobPendingUpdate, string>({
      query: (id) => ({ url: `/hawb/job-updates/${id}/dismiss`, method: 'POST' }),
      invalidatesTags: ['HawbJobPendingUpdate'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useUpdateHawbJobMutation,
  useGetHawbManifestsQuery,
  useGetHawbManifestQuery,
  useUpdateHawbManifestMutation,
  useReorderManifestJobsMutation,
  useExportManifestMutation,
  useIndigoExportManifestMutation,
  useConfirmManifestMutation,
  useHoldManifestMutation,
  useMarkManifestExportedMutation,
  useCancelManifestMutation,
  useReopenManifestMutation,
  useRetryManifestExtractionMutation,
  useGetJobUpdatesQuery,
  useGetProcessingDocumentsQuery,
  useApplyJobUpdateMutation,
  useDismissJobUpdateMutation,
} = hawbApi;
