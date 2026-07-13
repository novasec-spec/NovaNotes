import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../../../config/supabase';
import { 
  Task, 
  TaskCreateDTO, 
  TaskUpdateDTO,
  TaskList,
  Project,
  ActivityLog,
  TaskTemplate 
} from '../types/task.types';

const STORAGE_KEYS = {
  TASKS: 'tasks_data',
  LISTS: 'task_lists',
  PROJECTS: 'task_projects',
  TEMPLATES: 'task_templates',
  ACTIVITY: 'task_activity',
  PENDING_SYNC: 'pending_sync_tasks',
  SYNC_STATUS: 'last_sync_time',
};

export class TaskService {
  private static instance: TaskService;
  private syncTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;

  static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  // ============ LOCAL STORAGE ============
  
  async getLocalTasks(): Promise<Task[]> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  async saveLocalTasks(tasks: Task[]): Promise<void> {
    const validTasks = tasks.filter(t => t && t.id);
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(validTasks));
  }

  async getTaskLists(): Promise<TaskList[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LISTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveTaskLists(lists: TaskList[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(lists));
  }

  async getProjects(): Promise<Project[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveProjects(projects: Project[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  }

  async getTemplates(): Promise<TaskTemplate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveTemplates(templates: TaskTemplate[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  }

  async getActivityLog(taskId?: string): Promise<ActivityLog[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVITY);
      const logs: ActivityLog[] = data ? JSON.parse(data) : [];
      return taskId ? logs.filter(log => log.taskId === taskId) : logs;
    } catch {
      return [];
    }
  }

  async addActivityLog(log: ActivityLog): Promise<void> {
    try {
      const logs = await this.getActivityLog();
      logs.unshift(log);
      // Keep last 1000 logs
      while (logs.length > 1000) logs.pop();
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(logs));
    } catch (error) {
      console.error('Add activity log error:', error);
    }
  }

  // ============ TASK CRUD OPERATIONS (OFFLINE-FIRST) ============

  async addTaskLocally(taskData: TaskCreateDTO): Promise<Task> {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: taskData.title,
      description: taskData.description || '',
      completed: false,
      priority: taskData.priority || 'medium',
      category: taskData.category || '',
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || '',
      dueTime: taskData.dueTime || '',
      estimatedHours: taskData.estimatedHours || 0,
      actualHours: 0,
      createdAt: now,
      subtasks: [],
      attachments: [],
      comments: [],
      assignees: taskData.assignees || [],
      sharedWith: [],
      isTemplate: false,
      recurring: taskData.recurring || null,
      progress: 0,
      priorityScore: this.calculatePriorityScore(taskData),
      projectId: taskData.projectId,
      listId: taskData.listId,
      parentTaskId: taskData.parentTaskId,
      reminderTime: taskData.reminderTime,
      reminderSent: false,
      _synced: false,
      _deleted: false,
    };

    const tasks = await this.getLocalTasks();
    const updated = [newTask, ...tasks];
    await this.saveLocalTasks(updated);

    // Add to activity log
    await this.addActivityLog({
      id: `act_${Date.now()}`,
      taskId: newTask.id,
      userId: 'local_user',
      action: 'created',
      details: { title: newTask.title },
      timestamp: now,
    });

    // Add to pending sync
    await this.addPendingSync(newTask);
    this.scheduleSync();

    return newTask;
  }

  async updateTaskLocally(taskId: string, updates: TaskUpdateDTO): Promise<Task> {
    const tasks = await this.getLocalTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    
    if (index === -1) {
      throw new Error('Task not found');
    }

    const updatedTask = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      _synced: false,
    };

    if (updates.completed && !tasks[index].completed) {
      updatedTask.completedAt = new Date().toISOString();
      updatedTask.progress = 100;
      updatedTask.actualHours = this.calculateActualHours(tasks[index]);
    }

    tasks[index] = updatedTask;
    await this.saveLocalTasks(tasks);

    // Add activity log
    await this.addActivityLog({
      id: `act_${Date.now()}`,
      taskId: updatedTask.id,
      userId: 'local_user',
      action: 'updated',
      details: { updates },
      timestamp: new Date().toISOString(),
    });

    await this.addPendingSync(updatedTask);
    this.scheduleSync();

    return updatedTask;
  }

  async deleteTaskLocally(taskId: string): Promise<void> {
    const tasks = await this.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;

    // If local only, just remove
    if (task.id.startsWith('local_') && !task._synced) {
      const updated = tasks.filter(t => t.id !== taskId);
      await this.saveLocalTasks(updated);
      await this.removePendingSync(taskId);
      return;
    }

    // Otherwise mark for deletion
    const updated = tasks.map(t => 
      t.id === taskId ? { ...t, _deleted: true, _synced: false } : t
    );
    await this.saveLocalTasks(updated);

    await this.addPendingSync({ ...task, _deleted: true, _synced: false });
    this.scheduleSync();
  }

  async toggleCompleteLocally(taskId: string): Promise<Task> {
    const tasks = await this.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    
    return this.updateTaskLocally(taskId, { 
      completed: !task.completed,
      progress: !task.completed ? 100 : 0,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
    });
  }

  // ============ LIST AND PROJECT OPERATIONS ============

  async createList(name: string, icon: string, color: string): Promise<TaskList> {
    const lists = await this.getTaskLists();
    const newList: TaskList = {
      id: `list_${Date.now()}`,
      name,
      icon,
      color,
      tasks: [],
      isDefault: lists.length === 0,
      order: lists.length,
    };
    
    lists.push(newList);
    await this.saveTaskLists(lists);
    return newList;
  }

  async createProject(data: Omit<Project, 'id' | 'progress'>): Promise<Project> {
    const projects = await this.getProjects();
    const newProject: Project = {
      ...data,
      id: `proj_${Date.now()}`,
      progress: 0,
      status: 'active',
    };
    
    projects.push(newProject);
    await this.saveProjects(projects);
    return newProject;
  }

  // ============ TEMPLATE OPERATIONS ============

  async createTemplate(name: string, tasks: Task[], category: string): Promise<TaskTemplate> {
    const templates = await this.getTemplates();
    const newTemplate: TaskTemplate = {
      id: `tpl_${Date.now()}`,
      name,
      description: '',
      tasks: tasks.map(t => ({ ...t, isTemplate: true })),
      category,
      tags: [],
      isPublic: false,
      createdBy: 'local_user',
      usageCount: 0,
    };
    
    templates.push(newTemplate);
    await this.saveTemplates(templates);
    return newTemplate;
  }

  async applyTemplate(templateId: string): Promise<Task[]> {
    const templates = await this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) throw new Error('Template not found');

    const createdTasks: Task[] = [];
    for (const task of template.tasks) {
      const newTask = await this.addTaskLocally({
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        tags: task.tags,
        estimatedHours: task.estimatedHours,
      });
      createdTasks.push(newTask);
    }

    // Update template usage
    template.usageCount++;
    await this.saveTemplates(templates);

    return createdTasks;
  }

  // ============ SHARING OPERATIONS ============

  async shareTask(taskId: string, userIds: string[]): Promise<Task> {
    const tasks = await this.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const updatedTask = {
      ...task,
      sharedWith: [...new Set([...task.sharedWith, ...userIds])],
      _synced: false,
    };

    await this.updateTaskLocally(taskId, { sharedWith: updatedTask.sharedWith });
    
    // Log sharing activity
    await this.addActivityLog({
      id: `act_${Date.now()}`,
      taskId: taskId,
      userId: 'local_user',
      action: 'shared',
      details: { sharedWith: userIds },
      timestamp: new Date().toISOString(),
    });

    return updatedTask;
  }

  // ============ SYNC OPERATIONS ============

  private async addPendingSync(task: Task): Promise<void> {
    try {
      const pending = await this.getPendingSync();
      const index = pending.findIndex(t => t.id === task.id);
      if (index !== -1) {
        pending[index] = task;
      } else {
        pending.push(task);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
    } catch (error) {
      console.error('Add pending sync error:', error);
    }
  }

  private async removePendingSync(taskId: string): Promise<void> {
    try {
      const pending = await this.getPendingSync();
      const filtered = pending.filter(t => t.id !== taskId);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(filtered));
    } catch (error) {
      console.error('Remove pending sync error:', error);
    }
  }

  async getPendingSync(): Promise<Task[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async getPendingSyncCount(): Promise<number> {
    const pending = await this.getPendingSync();
    return pending.length;
  }

  scheduleSync(delay: number = 5000): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => this.performSync(), delay);
  }

  async performSync(): Promise<void> {
    if (this.isSyncing) return;
    try {
      this.isSyncing = true;
      const pending = await this.getPendingSync();
      if (pending.length === 0) {
        await this.syncFromRemote();
        return;
      }

      console.log(`🔄 Syncing ${pending.length} tasks...`);

      for (const task of pending) {
        try {
          if (task._deleted) {
            await supabase.from('tasks').delete().eq('id', task.id);
          } else if (task.id.startsWith('local_')) {
            // Create new
            const { data, error } = await supabase
              .from('tasks')
              .insert({
               id: task.id,
                title: task.title,
                description: task.description,
                completed: task.completed,
                priority: task.priority,
                category: task.category,
                tags: task.tags,
                due_date: task.dueDate,
                due_time: task.dueTime,
                estimated_hours: task.estimatedHours,
                project_id: task.projectId,
                list_id: task.listId,
                parent_task_id: task.parentTaskId,
                created_at: task.createdAt,
              })
              .select()
              .single();

            if (error) throw error;
            if (data) {
              // Update local with server ID
              const tasks = await this.getLocalTasks();
              const updated = tasks.map(t => 
                t.id === task.id ? { ...t, id: data.id, _synced: true } : t
              );
              await this.saveLocalTasks(updated);
            }
          } else {
            // Update existing
            await supabase
              .from('tasks')
              .update({
               id: task.id,
                 title: task.title,
                description: task.description,
                completed: task.completed,
                priority: task.priority,
                category: task.category,
                tags: task.tags,
                due_date: task.dueDate,
                due_time: task.dueTime,
                estimated_hours: task.estimatedHours,
                actual_hours: task.actualHours,
                progress: task.progress,
                project_id: task.projectId,
                list_id: task.listId,
                parent_task_id: task.parentTaskId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', task.id);
          }
        } catch (error) {
          console.error('Sync error for task:', task.id, error);
        }
      }

      await this.clearPendingSync();
      await this.syncFromRemote();
      console.log('✅ Sync completed');

    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
      this.syncTimeout = null;
    }
  }

  async syncFromRemote(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const remoteTasks = data.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          category: t.category,
          tags: t.tags || [],
          dueDate: t.due_date,
          dueTime: t.due_time,
          estimatedHours: t.estimated_hours,
          actualHours: t.actual_hours,
          progress: t.progress || 0,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          projectId: t.project_id,
          listId: t.list_id,
          parentTaskId: t.parent_task_id,
          subtasks: t.subtasks || [],
          attachments: t.attachments || [],
          comments: t.comments || [],
          assignees: t.assignees || [],
          sharedWith: t.shared_with || [],
          isTemplate: t.is_template || false,
          recurring: t.recurring || null,
          reminderTime: t.reminder_time,
          reminderSent: t.reminder_sent || false,
          _synced: true,
          _deleted: false,
        }));

        const localTasks = await this.getLocalTasks();
        const merged = this.mergeTasks(localTasks, remoteTasks);
        await this.saveLocalTasks(merged);
      }
    } catch (error) {
      console.error('Remote sync error:', error);
    }
  }

  private mergeTasks(local: Task[], remote: Task[]): Task[] {
    const map = new Map<string, Task>();
    remote.forEach(t => map.set(t.id, t));
    
    local.forEach(localTask => {
      if (!localTask._synced || localTask._deleted) {
        map.set(localTask.id, localTask);
      }
    });

    return Array.from(map.values());
  }

  private async clearPendingSync(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
  }

  // ============ UTILITY FUNCTIONS ============

  private calculatePriorityScore(taskData: TaskCreateDTO): number {
    let score = 0;
    if (taskData.priority === 'critical') score += 100;
    else if (taskData.priority === 'high') score += 75;
    else if (taskData.priority === 'medium') score += 50;
    else score += 25;

    if (taskData.dueDate) {
      const daysUntilDue = Math.ceil(
        (new Date(taskData.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue <= 0) score += 50;
      else if (daysUntilDue <= 1) score += 40;
      else if (daysUntilDue <= 3) score += 30;
      else if (daysUntilDue <= 7) score += 20;
      else score += 10;
    }

    if (taskData.tags?.includes('urgent')) score += 25;
    if (taskData.tags?.includes('important')) score += 15;

    return Math.min(score, 100);
  }

  private calculateActualHours(task: Task): number {
    if (!task.estimatedHours) return 0;
    const completedAt = task.completedAt ? new Date(task.completedAt) : new Date();
    const createdAt = new Date(task.createdAt);
    const hours = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10;
  }

  // ============ NOTIFICATION HELPERS ============

  async getTasksDueToday(): Promise<Task[]> {
    const tasks = await this.getLocalTasks();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    return tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      return task.dueDate.split('T')[0] === todayStr;
    });
  }

  async getTasksDueSoon(hours: number = 24): Promise<Task[]> {
    const tasks = await this.getLocalTasks();
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    
    return tasks.filter(task => {
      if (!task.dueDate || task.completed || task.reminderSent) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= future;
    });
  }

  async getOverdueTasks(): Promise<Task[]> {
    const tasks = await this.getLocalTasks();
    const now = new Date();
    return tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      return new Date(task.dueDate) < now;
    });
  }

  async markReminderSent(taskId: string): Promise<void> {
    const tasks = await this.getLocalTasks();
    const updated = tasks.map(t => 
      t.id === taskId ? { ...t, reminderSent: true } : t
    );
    await this.saveLocalTasks(updated);
  }
}
