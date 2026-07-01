export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  _synced?: boolean;
  _deleted?: boolean;
}

export type TaskFilter = 'all' | 'active' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskStats {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  byPriority: Record<TaskPriority, number>;
  byCategory: Record<string, number>;
}

export interface TaskCreateDTO {
  title: string;
  description?: string;
  priority: TaskPriority;
  category?: string;
  dueDate?: string;
}

export interface TaskUpdateDTO extends Partial<TaskCreateDTO> {
  completed?: boolean;
}
