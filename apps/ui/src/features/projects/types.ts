import type {
  CreateProjectDto,
  PatchProjectDto,
  ProjectResponseDto,
  TaskResponseDto,
} from '@taico/client/v2';

export type Project = ProjectResponseDto;
export type CreateProjectInput = CreateProjectDto;
export type UpdateProjectInput = PatchProjectDto;
export type ProjectTask = TaskResponseDto;
