import api from './client';
import type {
  ApiResponse, LoginRequest, TokenResponse,
  OrgDto, UserDto, CreateUserRequest, UpdateUserRequest,
  ProjectDto, CreateProjectRequest, UpdateProjectRequest,
  TeamDto, ProjectMemberDto, AssignmentDto,
  WbsTaskDto, CreateWbsTaskRequest, UpdateWbsTaskRequest, UpdateProgressRequest,
  BaselineDto,
} from '@/types';

export const authApi = {
  login:   (d: LoginRequest) => api.post<ApiResponse<TokenResponse>>('/auth/login', d).then(r => r.data.data),
  logout:  ()                 => api.post<ApiResponse<null>>('/auth/logout').then(r => r.data),
  refresh: (token: string)    => api.post<ApiResponse<TokenResponse>>('/auth/refresh', {}, { headers: { 'X-Refresh-Token': token } }).then(r => r.data.data),
  me:      ()                 => api.get<ApiResponse<string>>('/auth/me').then(r => r.data.data),
};

export const orgApi = {
  findAll:  ()                               => api.get<ApiResponse<OrgDto[]>>('/orgs').then(r => r.data.data),
  create:   (d: Partial<OrgDto>)             => api.post<ApiResponse<OrgDto>>('/orgs', d).then(r => r.data.data),
  update:   (id: number, d: Partial<OrgDto>) => api.put<ApiResponse<OrgDto>>(`/orgs/${id}`, d).then(r => r.data.data),
  delete:   (id: number)                     => api.delete(`/orgs/${id}`),
};

export const userApi = {
  findAll:       ()                                 => api.get<ApiResponse<UserDto[]>>('/users').then(r => r.data.data),
  findById:      (id: number)                       => api.get<ApiResponse<UserDto>>(`/users/${id}`).then(r => r.data.data),
  create:        (d: CreateUserRequest)             => api.post<ApiResponse<UserDto>>('/users', d).then(r => r.data.data),
  update:        (id: number, d: UpdateUserRequest) => api.put<ApiResponse<UserDto>>(`/users/${id}`, d).then(r => r.data.data),
  changeStatus:  (id: number, status: string)       => api.patch<ApiResponse<UserDto>>(`/users/${id}/status`, { status }).then(r => r.data.data),
  resetPassword: (id: number)                       => api.patch(`/users/${id}/reset-password`),
  batchStatus:   (ids: number[], status: string)    => api.patch('/users/batch-status', { ids, status }),
  batchDelete:   (ids: number[])                    => api.delete('/users/batch', { data: { ids } }),
  delete:        (id: number)                       => api.delete(`/users/${id}`),
};

export const projectApi = {
  findAll:      ()                                    => api.get<ApiResponse<ProjectDto[]>>('/projects').then(r => r.data.data),
  findById:     (id: number)                          => api.get<ApiResponse<ProjectDto>>(`/projects/${id}`).then(r => r.data.data),
  create:       (d: CreateProjectRequest)             => api.post<ApiResponse<ProjectDto>>('/projects', d).then(r => r.data.data),
  update:       (id: number, d: UpdateProjectRequest) => api.put<ApiResponse<ProjectDto>>(`/projects/${id}`, d).then(r => r.data.data),
  changeStatus: (id: number, status: string)          => api.patch<ApiResponse<ProjectDto>>(`/projects/${id}/status`, { status }).then(r => r.data.data),
  delete:       (id: number)                          => api.delete(`/projects/${id}`),
};

export const teamApi = {
  getTeams:   (pid: number)                                                          => api.get<ApiResponse<TeamDto[]>>(`/projects/${pid}/teams`).then(r => r.data.data),
  createTeam: (pid: number, d: { name: string; color?: string; leadUserId?: number }) => api.post<ApiResponse<TeamDto>>(`/projects/${pid}/teams`, d).then(r => r.data.data),
  deleteTeam: (pid: number, tid: number)                                             => api.delete(`/projects/${pid}/teams/${tid}`),
};

export const memberApi = {
  getMembers:   (pid: number)                               => api.get<ApiResponse<ProjectMemberDto[]>>(`/projects/${pid}/members`).then(r => r.data.data),
  addMember:    (pid: number, userId: number, role: string) => api.post<ApiResponse<ProjectMemberDto>>(`/projects/${pid}/members`, { userId, role }).then(r => r.data.data),
  changeRole:   (pid: number, userId: number, role: string) => api.patch<ApiResponse<ProjectMemberDto>>(`/projects/${pid}/members/${userId}/role`, { role }).then(r => r.data.data),
  removeMember: (pid: number, userId: number)               => api.delete(`/projects/${pid}/members/${userId}`),
};

export const wbsApi = {
  getTree:        (pid: number)                                          => api.get<ApiResponse<WbsTaskDto[]>>(`/projects/${pid}/tasks/tree`).then(r => r.data.data),
  getList:        (pid: number)                                          => api.get<ApiResponse<WbsTaskDto[]>>(`/projects/${pid}/tasks`).then(r => r.data.data),
  createTask:     (pid: number, d: CreateWbsTaskRequest)                 => api.post<ApiResponse<WbsTaskDto>>(`/projects/${pid}/tasks`, d).then(r => r.data.data),
  updateTask:     (pid: number, tid: number, d: UpdateWbsTaskRequest)    => api.put<ApiResponse<WbsTaskDto>>(`/projects/${pid}/tasks/${tid}`, d).then(r => r.data.data),
  updateProgress: (pid: number, tid: number, d: UpdateProgressRequest)   => api.put<ApiResponse<WbsTaskDto>>(`/projects/${pid}/tasks/${tid}/progress`, d).then(r => r.data.data),
  deleteTask:     (pid: number, tid: number)                             => api.delete(`/projects/${pid}/tasks/${tid}`),
  moveTask:       (pid: number, tid: number, direction: 'up' | 'down')   => api.put(`/projects/${pid}/tasks/${tid}/move?direction=${direction}`),
  reparentTask:   (pid: number, tid: number, newParentId: number | null) => api.put(`/projects/${pid}/tasks/${tid}/reparent`, { newParentId }),
  copyTask:       (pid: number, tid: number, targetParentId?: number | null) =>
    api.post<ApiResponse<WbsTaskDto>>(`/projects/${pid}/tasks/${tid}/copy`, { targetParentId: targetParentId ?? null }).then(r => r.data.data),
  reorderCodes:   (pid: number)                                          => api.post(`/projects/${pid}/tasks/reorder-codes`),
  applyTemplate:  (pid: number, tplKey: string)                          => api.post<ApiResponse<string>>(`/projects/${pid}/template/${tplKey}`).then(r => r.data),
};

export const assignApi = {
  getAssignments: (pid: number, tid: number)              => api.get<ApiResponse<AssignmentDto[]>>(`/projects/${pid}/tasks/${tid}/assignments`).then(r => r.data.data),
  assign:         (pid: number, tid: number, d: object)   => api.post<ApiResponse<AssignmentDto>>(`/projects/${pid}/tasks/${tid}/assignments`, d).then(r => r.data.data),
  unassign:       (pid: number, tid: number, uid: number) => api.delete(`/projects/${pid}/tasks/${tid}/assignments/${uid}`),
};

export const analysisApi = {
  getByAssignee: (pid: number) => api.get(`/projects/${pid}/analysis/by-assignee`).then(r => r.data.data),
};

// ★ Baseline API
export const baselineApi = {
  getList:   (pid: number)                                            => api.get<ApiResponse<BaselineDto[]>>(`/projects/${pid}/baselines`).then(r => r.data.data),
  save:      (pid: number, d: { name?: string; description?: string }) => api.post<ApiResponse<BaselineDto>>(`/projects/${pid}/baselines`, d).then(r => r.data.data),
  getDetail: (pid: number, bid: number)                               => api.get<ApiResponse<BaselineDto>>(`/projects/${pid}/baselines/${bid}`).then(r => r.data.data),
  delete:    (pid: number, bid: number)                               => api.delete(`/projects/${pid}/baselines/${bid}`),
};

export const excelApi = {
  importXlGantt: (pid: number, file: File) => {
    const form = new FormData(); form.append('file', file);
    return api.post(`/projects/${pid}/excel/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  exportExcel: (pid: number, filename?: string) =>
    api.get(`/projects/${pid}/excel/export`, { responseType: 'blob' }).then(res => {
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `${filename ?? 'WBS'}_export.xlsx`);
      document.body.appendChild(link); link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    }),
};
