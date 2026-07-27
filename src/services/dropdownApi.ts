import { api } from './api';

export interface DropdownValue {
  id: string;
  value: string;
  label: string;
  order_index: number;
  is_active: boolean;
}

export interface DropdownField {
  id: string;
  module: string;
  field_name: string;
  field_label: string;
  is_active: boolean;
  values: DropdownValue[];
}

export interface DropdownFieldCreate {
  module: string;
  field_name: string;
  field_label: string;
}

export interface DropdownFieldUpdate {
  field_label?: string;
  is_active?: boolean;
}

export interface DropdownValueCreate {
  value: string;
  label: string;
  order_index?: number;
  is_active?: boolean;
}

export interface DropdownValueUpdate {
  value?: string;
  label?: string;
  order_index?: number;
  is_active?: boolean;
}

export const dropdownApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDropdownFields: build.query<DropdownField[], { module?: string } | void>({
      query: (params) => ({ url: '/dropdown/fields', params: params?.module ? { module: params.module } : undefined }),
      providesTags: ['DropdownField'],
    }),
    getDropdownField: build.query<DropdownField, string>({
      query: (id) => `/dropdown/fields/${id}`,
      providesTags: ['DropdownField'],
    }),
    // Used by any dropdown in the app that wants its options driven by the
    // dropdown00/dropdown01 master tables instead of a hardcoded constant —
    // e.g. manifest Account Number / Vehicle Size / Service Type.
    getDropdownValues: build.query<DropdownValue[], { module: string; field_name: string }>({
      query: ({ module, field_name }) => ({ url: '/dropdown/values', params: { module, field_name } }),
      providesTags: ['DropdownField'],
    }),
    createDropdownField: build.mutation<DropdownField, DropdownFieldCreate>({
      query: (body) => ({ url: '/dropdown/fields', method: 'POST', body }),
      invalidatesTags: ['DropdownField'],
    }),
    updateDropdownField: build.mutation<DropdownField, { id: string; body: DropdownFieldUpdate }>({
      query: ({ id, body }) => ({ url: `/dropdown/fields/${id}`, method: 'PUT', body }),
      invalidatesTags: ['DropdownField'],
    }),
    deleteDropdownField: build.mutation<void, string>({
      query: (id) => ({ url: `/dropdown/fields/${id}`, method: 'DELETE' }),
      invalidatesTags: ['DropdownField'],
    }),
    createDropdownValue: build.mutation<DropdownValue, { fieldId: string; body: DropdownValueCreate }>({
      query: ({ fieldId, body }) => ({ url: `/dropdown/fields/${fieldId}/values`, method: 'POST', body }),
      invalidatesTags: ['DropdownField'],
    }),
    updateDropdownValue: build.mutation<DropdownValue, { id: string; body: DropdownValueUpdate }>({
      query: ({ id, body }) => ({ url: `/dropdown/values/${id}`, method: 'PUT', body }),
      invalidatesTags: ['DropdownField'],
    }),
    deleteDropdownValue: build.mutation<void, string>({
      query: (id) => ({ url: `/dropdown/values/${id}`, method: 'DELETE' }),
      invalidatesTags: ['DropdownField'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDropdownFieldsQuery,
  useGetDropdownFieldQuery,
  useGetDropdownValuesQuery,
  useCreateDropdownFieldMutation,
  useUpdateDropdownFieldMutation,
  useDeleteDropdownFieldMutation,
  useCreateDropdownValueMutation,
  useUpdateDropdownValueMutation,
  useDeleteDropdownValueMutation,
} = dropdownApi;
