import { create } from 'zustand';
import { ProjectDto, WbsTaskDto } from '@/types';

interface ProjectState {
  projects: ProjectDto[];
  currentProject: ProjectDto | null;
  tasks: WbsTaskDto[];
  loading: boolean;
  setProjects: (projects: ProjectDto[]) => void;
  setCurrentProject: (project: ProjectDto | null) => void;
  setTasks: (tasks: WbsTaskDto[]) => void;
  setLoading: (loading: boolean) => void;
  updateTask: (updated: WbsTaskDto) => void;
  addTask: (task: WbsTaskDto) => void;
  removeTask: (taskId: number) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  tasks: [],
  loading: false,

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setTasks: (tasks) => set({ tasks }),
  setLoading: (loading) => set({ loading }),

  updateTask: (updated) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.taskId === updated.taskId ? updated : t)),
    })),

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  removeTask: (taskId) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.taskId !== taskId) })),
}));
