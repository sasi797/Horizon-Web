import { api } from './api';

export interface UserRoleRef {
  id: string;
  name: string;
  key: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role: UserRoleRef;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role_id: string;
  is_active?: boolean;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  role_id?: string;
  is_active?: boolean;
}

export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<AppUser[], void>({
      query: () => '/users',
      providesTags: ['User'],
    }),
    createUser: build.mutation<AppUser, UserCreate>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User', 'Role'],
    }),
    updateUser: build.mutation<AppUser, { id: string; body: UserUpdate }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PUT', body }),
      invalidatesTags: ['User', 'Role'],
    }),
    deactivateUser: build.mutation<void, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
} = usersApi;
