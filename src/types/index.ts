// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest { username: string; password: string; }
export interface TokenResponse {
  accessToken: string; refreshToken: string; tokenType: string; user: UserDto;
}

// ─── Enums ────────────────────────────────────────────────────────────────────
export type UserRole     = 'SYSTEM_ADMIN' | 'PM' | 'TEAM_LEAD' | 'TEAM_MEMBER' | 'CLIENT_VIEWER';
export type UserStatus   = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';
export type ProjectRole  = 'PROJECT_MANAGER' | 'TEAM_LEAD' | 'DEVELOPER' | 'VIEWER' | 'REPORTER';

// ─── Organization ─────────────────────────────────────────────────────────────
export interface OrgDto {
  orgId: number; name: string; region?: string;
  contactEmail?: string; contactPhone?: string; notes?: string; active: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface UserDto {
  userId: number; username: string; displayName: string;
  email: string; phone?: string; department?: string; position?: string;
  userRole: UserRole; status: UserStatus;
  orgId?: number; orgName?: string;
  lastLoginAt?: string; createdAt: string;
}
export interface CreateUserRequest {
  username: string; displayName: string; password: string; email: string;
  department?: string; position?: string; userRole?: UserRole; orgId?: number;
}
export interface UpdateUserRequest {
  displayName?: string; email?: string; phone?: string;
  department?: string; position?: string;
  userRole?: UserRole; status?: UserStatus; orgId?: number; newPassword?: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────
export interface ProjectDto {
  projectId: number; name: string; description?: string;
  startDate: string; endDate: string; status: ProjectStatus; createdAt: string;
}
export interface CreateProjectRequest {
  name: string; description?: string; startDate: string; endDate: string;
}
export interface UpdateProjectRequest {
  name: string; description?: string; startDate: string; endDate: string;
  status?: ProjectStatus;
}

// ─── Team ─────────────────────────────────────────────────────────────────────
export interface TeamDto {
  teamId: number; projectId: number; name: string;
  color?: string; leadUserId?: number; leadDisplayName?: string;
}
export interface ProjectMemberDto {
  memberId: number; userId: number; username: string;
  displayName: string; email: string; role: ProjectRole;
}

// ─── WBS Task ─────────────────────────────────────────────────────────────────
export interface AssignmentDto {
  assignmentId: number; userId: number; displayName: string;
  teamId?: number; teamName?: string;
  assignRate: number; workload: number; roleLabel?: string;
}
export interface WbsTaskDto {
  taskId: number; parentTaskId?: number;
  wbsCode: string; wbsLevel: number; isGroup: boolean; taskName: string;
  plannedStart?: string; plannedEnd?: string;
  actualStart?: string; actualEnd?: string;
  totalWorkload: number; plannedWorkload: number; actualWorkload: number;
  planProgress: number; actualProgress: number; weight: number;
  deliverable?: string; notes?: string; displayOrder: number;
  jiraIssueKey?: string; assignments: AssignmentDto[];
  children: WbsTaskDto[]; updatedAt: string;
}
export interface CreateWbsTaskRequest {
  parentTaskId?: number; taskName: string; wbsCode?: string;
  isGroup?: boolean; plannedStart?: string; plannedEnd?: string;
  weight?: number; deliverable?: string; notes?: string;
}
export interface UpdateWbsTaskRequest {
  taskName: string; isGroup?: boolean;
  plannedStart?: string; plannedEnd?: string;
  actualStart?: string; actualEnd?: string;
  totalWorkload?: number; plannedWorkload?: number; actualWorkload?: number;
  planProgress?: number; actualProgress?: number; weight?: number;
  deliverable?: string; notes?: string;
}
export interface UpdateProgressRequest {
  actualProgress: number; actualStart?: string; actualEnd?: string;
  actualWorkload?: number; comment?: string;
}

// ─── Baseline ─────────────────────────────────────────────────────────────────
export interface BaselineTaskSnapshot {
  taskId: number; wbsCode: string; taskName: string;
  plannedStart?: string; plannedEnd?: string;
  totalWorkload: number; planProgress: number; wbsLevel: number;
}
export interface BaselineDto {
  baselineId: number; projectId: number;
  name: string; description?: string;
  createdAt: string; taskCount: number;
  tasks?: BaselineTaskSnapshot[];
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> { success: boolean; message?: string; data: T; }
