import { api } from './api';

export interface HawbPackageLine {
  supplier?: string | null;
  package_type?: string | null;
  weight_kg?: number | null;
  content_description?: string | null;
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
  packages: HawbPackageLine[];
  extracted_data: Record<string, unknown>;
  status: 'pending_review' | 'ready_to_manifest' | 'manifested';
  manifest_id: string | null;
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
}

export interface HawbJobDetail extends HawbJob {
  document: HawbDocument;
  pdf_url: string;
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
}

export interface HawbJobPage {
  items: HawbJob[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HawbJobListParams {
  status?: string;
  search?: string;
  document_id?: string;
  page?: number;
  page_size?: number;
}

export interface HawbManifest {
  id: string;
  reference_number: string;
  job_count: number;
  total_weight_kg: number;
  created_by: string;
  created_at: string;
}

export interface HawbManifestDetail extends HawbManifest {
  jobs: HawbJob[];
}

export const hawbApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHawbJobs: build.query<HawbJobPage, HawbJobListParams>({
      query: (params) => ({ url: '/hawb/jobs', params }),
      providesTags: ['HawbJob'],
    }),
    getHawbJob: build.query<HawbJobDetail, string>({
      query: (id) => `/hawb/jobs/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'HawbJob', id }],
    }),
    updateHawbJob: build.mutation<HawbJob, { id: string; body: HawbJobUpdate }>({
      query: ({ id, body }) => ({ url: `/hawb/jobs/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'HawbJob', id }, 'HawbJob'],
    }),
    markHawbJobReady: build.mutation<HawbJob, string>({
      query: (id) => ({ url: `/hawb/jobs/${id}/ready`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'HawbJob', id }, 'HawbJob'],
    }),
    getHawbManifests: build.query<HawbManifest[], void>({
      query: () => '/hawb/manifests',
      providesTags: ['HawbManifest'],
    }),
    getHawbManifest: build.query<HawbManifestDetail, string>({
      query: (id) => `/hawb/manifests/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'HawbManifest', id }],
    }),
    createHawbManifest: build.mutation<HawbManifestDetail, string[]>({
      query: (job_ids) => ({ url: '/hawb/manifests', method: 'POST', body: { job_ids } }),
      invalidatesTags: ['HawbManifest', 'HawbJob'],
    }),
    removeHawbJobFromManifest: build.mutation<HawbJob, { manifestId: string; jobId: string }>({
      query: ({ manifestId, jobId }) => ({ url: `/hawb/manifests/${manifestId}/jobs/${jobId}/remove`, method: 'POST' }),
      invalidatesTags: (_r, _e, { manifestId, jobId }) => [
        { type: 'HawbManifest', id: manifestId }, 'HawbManifest',
        { type: 'HawbJob', id: jobId }, 'HawbJob',
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetHawbJobsQuery,
  useGetHawbJobQuery,
  useUpdateHawbJobMutation,
  useMarkHawbJobReadyMutation,
  useGetHawbManifestsQuery,
  useGetHawbManifestQuery,
  useCreateHawbManifestMutation,
  useRemoveHawbJobFromManifestMutation,
} = hawbApi;
