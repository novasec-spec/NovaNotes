import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Task, TaskFilterType, TaskStats } from '../types/task.types';
import { TaskService } from '../services/taskService';
import { NotificationService } from '../services/NotificationService';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  
  const taskService = TaskService.getInstance();
  const notificationService = NotificationService.getInstance();
  const appState = useRef(AppState.currentState);

const loadTasks = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    // Load local tasks immediately
    const localTasks = await taskService.getLocalTasks();

    // Ensure all tasks have IDs and are valid objects
    const validTasks = localTasks.filter(task => {
      if (!task) return false;
      if (!task.id && !task._id) return false;
      // Ensure id is set
      if (!task.id) {
        task.id = task._id || `task_${Date.now()}_${Math.random()}`;
      }
      return true;
    });

    if (validTasks.length > 0) {
      setTasks(validTasks);
      // Save back cleaned data
      await taskService.saveLocalTasks(validTasks);
    } else {
      setTasks([]);
    }

    // Check pending sync count
    const pending = await taskService.getPendingSyncCount();
    if (pending > 0) {
      setSyncCount(pending);
      // Trigger background sync
      taskService.scheduleSync(2000);
    }

    // Start notification checks
    await notificationService.scheduleTaskNotifications();

  } catch (err) {
    console.error('Load tasks error:', err);
    setError('Failed to load tasks');
  } finally {
    setLoading(false);
  }
}, []);

  // Listen to app state changes for background sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground - checking sync');
        const pending = await taskService.getPendingSyncCount();
        if (pending > 0) {
          setSyncCount(pending);
          taskService.scheduleSync(1000);
        }
        await notificationService.checkAndNotifyTasks();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | '_synced' | '_deleted'>) => {
    try {
      const newTask = await taskService.addTaskLocally(taskData);
      setTasks(prev => [newTask, ...prev]);
      setSyncCount(prev => prev + 1);
      
      // Notify
      await notificationService.notifyTaskCreated(newTask);
      
      return newTask;
    } catch (err) {
      console.error('Add task error:', err);
      setError('Failed to add task');
      throw err;
    }
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const updated = await taskService.updateTaskLocally(taskId, updates);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      setSyncCount(prev => prev + 1);
      
      // Notify if completed
      if (updates.completed === true) {
        await notificationService.notifyTaskCompleted(updated);
      }
      
      return updated;
    } catch (err) {
      console.error('Update task error:', err);
      setError('Failed to update task');
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await taskService.deleteTaskLocally(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSyncCount(prev => prev + 1);
    } catch (err) {
      console.error('Delete task error:', err);
      setError('Failed to delete task');
      throw err;
    }
  }, []);

  const toggleComplete = useCallback(async (taskId: string) => {
    try {
      const updated = await taskService.toggleCompleteLocally(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      setSyncCount(prev => prev + 1);
      
      if (updated.completed) {
        await notificationService.notifyTaskCompleted(updated);
      }
      
      return updated;
    } catch (err) {
      console.error('Toggle complete error:', err);
      setError('Failed to update task');
      throw err;
    }
  }, []);

  const forceSync = useCallback(async () => {
    try {
      setSyncing(true);
      await taskService.performSync();
      
      // Reload tasks after sync
      const localTasks = await taskService.getLocalTasks();
      setTasks(localTasks);
      
      const pending = await taskService.getPendingSyncCount();
      setSyncCount(pending);
      
      // Notify sync status
      await notificationService.notifySyncStatus(pending === 0, pending);
      
    } catch (err) {
      console.error('Force sync error:', err);
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  const getFilteredTasks = useCallback((filter: TaskFilterType) => {
    return tasks
      .filter(t => !t._deleted)
      .filter(t => {
        if (filter === 'active') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
      })
      .sort((a, b) => {
        // Priority sorting: high > medium > low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.priority !== b.priority) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks]);

  const getStats = useCallback((): TaskStats => {
    const activeTasks = tasks.filter(t => !t._deleted);
    const stats: TaskStats = {
      total: activeTasks.length,
      completed: 0,
      active: 0,
      overdue: 0,
      byPriority: { low: 0, medium: 0, high: 0 },
      byCategory: {},
    };

    activeTasks.forEach(task => {
      if (task.completed) {
        stats.completed++;
      } else {
        stats.active++;
        
        if (task.dueDate && new Date(task.dueDate) < new Date()) {
          stats.overdue++;
        }
      }

      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
      
      if (task.category) {
        stats.byCategory[task.category] = (stats.byCategory[task.category] || 0) + 1;
      }
    });

    return stats;
  }, [tasks]);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
    
    // Periodic sync every hour
    const syncInterval = setInterval(() => {
      taskService.scheduleSync(100);
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  return {
    tasks,
    loading,
    syncing,
    error,
    syncCount,
    loadTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
    forceSync,
    getFilteredTasks,
    getStats,
  };
}
