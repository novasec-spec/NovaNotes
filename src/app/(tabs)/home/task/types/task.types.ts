export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  tags: string[];
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  updatedAt?: string;
  reminderTime?: string;
  reminderSent?: boolean;
  projectId?: string;
  listId?: string;
  templateId?: string;
  parentTaskId?: string;
  subtasks: string[]; // IDs of subtasks
  attachments: Attachment[];
  comments: Comment[];
  assignees: string[];
  sharedWith: string[];
  isTemplate: boolean;
  recurring: RecurringPattern | null;
  progress: number; // 0-100
  priorityScore: number; // For smart sorting
  _synced?: boolean;
  _deleted?: boolean;
  _localOnly?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'link' | 'other';
  size?: number;
  uploadedAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: string;
  occurrences?: number;
}

export interface ActivityLog {
  id: string;
  taskId: string;
  userId: string;
  action: 'created' | 'updated' | 'completed' | 'deleted' | 'shared' | 'comment' | 'assigned' | 'status_change';
  details: any;
  timestamp: string;
  metadata?: any;
}

export interface TaskList {
  id: string;
  name: string;
  icon: string;
  color: string;
  tasks: string[]; // Task IDs
  isDefault: boolean;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  tasks: string[];
  lists: string[];
  startDate?: string;
  endDate?: string;
  progress: number;
  status: 'active' | 'completed' | 'archived';
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  category: string;
  tags: string[];
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
}

export type TaskFilter = 'all' | 'active' | 'completed' | 'overdue' | 'today' | 'upcoming' | 'assigned_to_me';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type SortOption = 'dueDate' | 'priority' | 'createdAt' | 'title' | 'progress';

export interface TaskStats {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  dueToday: number;
  byPriority: Record<TaskPriority, number>;
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
  completionRate: number;
  averageCompletionTime: number;
}

export interface TaskCreateDTO {
  title: string;
  description?: string;
  priority: TaskPriority;
  category?: string;
  tags?: string[];
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  projectId?: string;
  listId?: string;
  parentTaskId?: string;
  recurring?: RecurringPattern;
  assignees?: string[];
  reminderTime?: string;
}

export interface TaskUpdateDTO extends Partial<TaskCreateDTO> {
  completed?: boolean;
  progress?: number;
  completedAt?: string;
}
