import { api } from './api';

export interface NexusOptions {
  roles: string[];
  shifts: string[];
}

export interface NexusEmployeeRequest {
  full_name: string;
  email: string;
  password: string;
  role: string;
  shift: string;
  /** Fill the form but stop before submitting, so no employee is created. */
  dry_run: boolean;
  /** Show the browser window. Only works when the API runs on a desktop. */
  headless: boolean;
}

export interface NexusPushResult {
  submitted: boolean;
  url: string;
  screenshot: string;
}

export const nexusApi = api.injectEndpoints({
  endpoints: (build) => ({
    getNexusOptions: build.query<NexusOptions, void>({
      query: () => '/nexus/options',
    }),
    createNexusEmployee: build.mutation<NexusPushResult, NexusEmployeeRequest>({
      query: (body) => ({ url: '/nexus/employees', method: 'POST', body }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetNexusOptionsQuery, useCreateNexusEmployeeMutation } = nexusApi;
