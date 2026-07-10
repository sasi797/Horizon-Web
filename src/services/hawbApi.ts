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
  packages: HawbPackageLine[];
  extracted_data: Record<string, unknown>;
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
}

export interface HawbManifest {
  id: string;
  reference_number: string;
  job_count: number;
  total_weight_kg: number;
  status: 'draft' | 'exported';
  exported_at: string | null;
  start_point: string | null;
  end_point: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface HawbManifestUpdate {
  start_point?: string | null;
  end_point?: string | null;
}

export interface HawbManifestDetail extends HawbManifest {
  jobs: HawbJob[];
  document: HawbDocument;
  pdf_url: string;
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
} = hawbApi;
