import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../../../config/supabase';
import { Task, TaskCreateDTO, TaskUpdateDTO } from '../types/task.types';

const TASKS_STORAGE_KEY = 'tasks_data';
const PENDING_SYNC_KEY = 'pending_sync_tasks';
const SYNC_STATUS_KEY = 'last_sync_time';

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

  // ============ LOCAL STORAGE OPERATIONS ============
  
  async getLocalTasks(): Promise<Task[]> {
    try {
      const cached = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  async saveLocalTasks(tasks: Task[]): Promise<void> {
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }

  async getPendingSync(): Promise<Task[]> {
    try {
      const pending = await AsyncStorage.getItem(PENDING_SYNC_KEY);
      return pending ? JSON.parse(pending) : [];
    } catch {
      return [];
    }
  }


// Add to TaskService
async cleanInvalidTasks(): Promise<void> {
  try {
    const tasks = await this.getLocalTasks();
    const validTasks = tasks.filter(task => task && task.id);
    
    if (validTasks.length !== tasks.length) {
      console.log(`🧹 Cleaned ${tasks.length - validTasks.length} invalid tasks`);
      await this.saveLocalTasks(validTasks);
    }
  } catch (error) {
    console.error('Clean invalid tasks error:', error);
  }
}

  async savePendingSync(tasks: Task[]): Promise<void> {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(tasks));
  }

  async clearPendingSync(): Promise<void> {
    await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  }

  async getLastSyncTime(): Promise<number | null> {
    try {
      const time = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      return time ? parseInt(time, 10) : null;
    } catch {
      return null;
    }
  }

  async updateLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(SYNC_STATUS_KEY, Date.now().toString());
  }

  // ============ CRUD OPERATIONS (Offline-First) ============

  async addTaskLocally(taskData: TaskCreateDTO): Promise<Task> {
    const newTask: Task = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...taskData,
      completed: false,
      createdAt: new Date().toISOString(),
      _synced: false,
      _deleted: false,
    };

    const tasks = await this.getLocalTasks();
    const updated = [newTask, ...tasks];
    await this.saveLocalTasks(updated);

    // Add to pending sync
    const pending = await this.getPendingSync();
    pending.push(newTask);
    await this.savePendingSync(pending);

    // Schedule background sync
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

    tasks[index] = updatedTask;
    await this.saveLocalTasks(tasks);

    // Add to pending sync
    const pending = await this.getPendingSync();
    const pendingIndex = pending.findIndex(t => t.id === taskId);
    if (pendingIndex !== -1) {
      pending[pendingIndex] = updatedTask;
    } else {
      pending.push(updatedTask);
    }
    await this.savePendingSync(pending);

    // Schedule background sync
    this.scheduleSync();

    return updatedTask;
  }

  async deleteTaskLocally(taskId: string): Promise<void> {
    const tasks = await this.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;

    // If it's a local task that was never synced, just remove it
    if (task.id.startsWith('local_') && !task._synced) {
      const updated = tasks.filter(t => t.id !== taskId);
      await this.saveLocalTasks(updated);
      
      // Remove from pending sync
      const pending = await this.getPendingSync();
      await this.savePendingSync(pending.filter(t => t.id !== taskId));
      return;
    }

    // Otherwise mark for deletion
    const updated = tasks.map(t => 
      t.id === taskId ? { ...t, _deleted: true, _synced: false } : t
    );
    await this.saveLocalTasks(updated);

    // Add to pending sync
    const pending = await this.getPendingSync();
    const pendingIndex = pending.findIndex(t => t.id === taskId);
    if (pendingIndex !== -1) {
      pending[pendingIndex] = { ...task, _deleted: true, _synced: false };
    } else {
      pending.push({ ...task, _deleted: true, _synced: false });
    }
    await this.savePendingSync(pending);

    // Schedule background sync
    this.scheduleSync();
  }

  async toggleCompleteLocally(taskId: string): Promise<Task> {
    const tasks = await this.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    return this.updateTaskLocally(taskId, { completed: !task.completed });
  }

  // ============ SYNC OPERATIONS ============

  scheduleSync(delay: number = 5000): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.performSync();
    }, delay);
  }

  async performSync(): Promise<void> {
    if (this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      const pending = await this.getPendingSync();
      
      if (pending.length === 0) {
        // Still check for remote updates
        await this.syncFromRemote();
        return;
      }

      console.log(`🔄 Syncing ${pending.length} tasks...`);

      // Group tasks by operation
      const toDelete = pending.filter(t => t._deleted);
      const toUpdate = pending.filter(t => !t._deleted && t.id && !t.id.startsWith('local_'));
      const toCreate = pending.filter(t => !t._deleted && t.id && t.id.startsWith('local_'));

      // Process deletes
      for (const task of toDelete) {
        try {
          await supabase.from('tasks').delete().eq('id', task.id);
        } catch (error) {
          console.error('Delete sync error:', error);
        }
      }

      // Process updates
      for (const task of toUpdate) {
        try {
          const { error } = await supabase
            .from('tasks')
            .update({
              title: task.title,
              description: task.description,
              completed: task.completed,
              priority: task.priority,
              category: task.category,
              due_date: task.dueDate,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          if (error) throw error;
        } catch (error) {
          console.error('Update sync error:', error);
        }
      }

      // Process creates
      for (const task of toCreate) {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .insert({
              title: task.title,
              description: task.description,
              completed: task.completed,
              priority: task.priority,
              category: task.category,
              due_date: task.dueDate,
              created_at: task.createdAt,
            })
            .select()
            .single();

          if (error) throw error;

          if (data) {
            // Update local task with server ID
            const tasks = await this.getLocalTasks();
            const updated = tasks.map(t => 
              t.id === task.id ? { 
                ...t, 
                id: data.id, 
                _synced: true,
                _deleted: false,
                createdAt: data.created_at,
              } : t
            );
            await this.saveLocalTasks(updated);
          }
        } catch (error) {
          console.error('Create sync error:', error);
        }
      }

      // Clear pending sync for successfully synced items
      const remainingPending = pending.filter(t => {
        if (t._deleted) return false;
        if (t.id.startsWith('local_')) {
          // Check if it was successfully synced
          const tasks = this.getLocalTasks();
          const task = tasks.find(t => t.id === t.id);
          return task?._synced === false;
        }
        return false;
      });

      await this.savePendingSync(remainingPending);
      await this.updateLastSyncTime();

      console.log('✅ Sync completed successfully');

      // Fetch latest from remote
      await this.syncFromRemote();

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
          dueDate: t.due_date,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          _synced: true,
          _deleted: false,
        }));

        // Merge with local tasks (keep local unsynced changes)
        const localTasks = await this.getLocalTasks();
        const merged = this.mergeTasks(localTasks, remoteTasks);
        await this.saveLocalTasks(merged);
        await this.updateLastSyncTime();
      }
    } catch (error) {
      console.error('Remote sync error:', error);
    }
  }

  private mergeTasks(local: Task[], remote: Task[]): Task[] {
    const map = new Map<string, Task>();
    
    // Add remote tasks
    remote.forEach(t => map.set(t.id, t));
    
    // Merge local tasks (keep local unsynced changes)
    local.forEach(localTask => {
      if (!localTask._synced || localTask._deleted) {
        map.set(localTask.id, localTask);
      } else {
        // If synced, keep remote version but preserve local metadata
        const remoteTask = map.get(localTask.id);
        if (remoteTask) {
          map.set(localTask.id, {
            ...remoteTask,
            _synced: true,
            _deleted: false,
          });
        }
      }
    });

    return Array.from(map.values());
  }

  // ============ NOTIFICATION HELPERS ============

  async getTasksDueSoon(): Promise<Task[]> {
    const tasks = await this.getLocalTasks();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= tomorrow;
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

  async getTaskCount(): Promise<number> {
    const tasks = await this.getLocalTasks();
    return tasks.length;
  }

  async getPendingSyncCount(): Promise<number> {
    const pending = await this.getPendingSync();
    return pending.length;
  }
}
