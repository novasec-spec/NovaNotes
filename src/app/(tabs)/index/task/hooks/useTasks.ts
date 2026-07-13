import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { Task, TaskFilterType, TaskStats, TaskCreateDTO, TaskList, Project } from '../types/task.types';
import { TaskService } from '../services/taskService';
import { NotificationService } from '../services/notificationService';
import { ShareService } from '../services/shareService';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  const taskService = TaskService.getInstance();
  const notificationService = NotificationService.getInstance();

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all data
      const [localTasks, taskLists, taskProjects] = await Promise.all([
        taskService.getLocalTasks(),
        taskService.getTaskLists(),
        taskService.getProjects(),
      ]);

      const validTasks = localTasks.filter(t => t && t.id);
      setTasks(validTasks);
      setLists(taskLists);
      setProjects(taskProjects);

      // Initialize notifications
      await notificationService.initialize();

    } catch (err) {
      console.error('Load tasks error:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  // Add these getter functions
  const getLists = useCallback(() => {
    return lists;
  }, [lists]);

  const getProjects = useCallback(() => {
    return projects;
  }, [projects]);

  const addTask = useCallback(async (taskData: TaskCreateDTO) => {
    try {
      const newTask = await taskService.addTaskLocally(taskData);
      setTasks(prev => [newTask, ...prev]);
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
      return updated;
    } catch (err) {
      console.error('Toggle complete error:', err);
      setError('Failed to update task');
      throw err;
    }
  }, []);

  const createList = useCallback(async (name: string, icon: string, color: string) => {
    try {
      const newList = await taskService.createList(name, icon, color);
      setLists(prev => [...prev, newList]);
      return newList;
    } catch (err) {
      console.error('Create list error:', err);
      setError('Failed to create list');
      throw err;
    }
  }, []);

  const createProject = useCallback(async (data: any) => {
    try {
      const newProject = await taskService.createProject(data);
      setProjects(prev => [...prev, newProject]);
      return newProject;
    } catch (err) {
      console.error('Create project error:', err);
      setError('Failed to create project');
      throw err;
    }
  }, []);


// In useTasks hook
const shareTask = useCallback(async (taskId: string, userIds: string[], message?: string) => {
  try {
    const shareService = ShareService.getInstance();
    await shareService.shareTask(taskId, userIds, message);
    
    // Update local task
    const tasks = await taskService.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      await taskService.updateTaskLocally(taskId, {
        sharedWith: [...(task.sharedWith || []), ...userIds]
      });
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, sharedWith: [...(t.sharedWith || []), ...userIds] }
          : t
      ));
    }
  } catch (err) {
    console.error('Share task error:', err);
    setError('Failed to share task');
    throw err;
  }
}, []);

  const applyTemplate = useCallback(async (templateId: string) => {
    try {
      const newTasks = await taskService.applyTemplate(templateId);
      setTasks(prev => [...newTasks, ...prev]);
      return newTasks;
    } catch (err) {
      console.error('Apply template error:', err);
      setError('Failed to apply template');
      throw err;
    }
  }, []);

  const forceSync = useCallback(async () => {
    try {
      await taskService.performSync();
      const localTasks = await taskService.getLocalTasks();
      setTasks(localTasks);
    } catch (err) {
      console.error('Force sync error:', err);
      setError('Sync failed');
    }
  }, []);

  const getFilteredTasks = useCallback((filter: TaskFilterType) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    return tasks
      .filter(t => !t._deleted)
      .filter(t => {
        switch (filter) {
          case 'active': return !t.completed;
          case 'completed': return t.completed;
          case 'overdue': 
            return !t.completed && t.dueDate && new Date(t.dueDate) < now;
          case 'today':
            return t.dueDate && t.dueDate.split('T')[0] === today;
          case 'upcoming':
            return t.dueDate && new Date(t.dueDate) >= now && !t.completed;
          default: return true;
        }
      })
      .sort((a, b) => {
        // Sort by priority and date
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.priority !== b.priority) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks]);

  const getStats = useCallback((): TaskStats => {
    const activeTasks = tasks.filter(t => !t._deleted);
    const now = new Date();
    
    const stats: TaskStats = {
      total: activeTasks.length,
      completed: 0,
      active: 0,
      overdue: 0,
      dueToday: 0,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byCategory: {},
      byProject: {},
      completionRate: 0,
      averageCompletionTime: 0,
    };

    const today = now.toISOString().split('T')[0];
    let totalCompletionTime = 0;
    let completedTasks = 0;

    activeTasks.forEach(task => {
      if (task.completed) {
        stats.completed++;
        completedTasks++;
        if (task.completedAt && task.createdAt) {
          const time = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
          totalCompletionTime += time;
        }
      } else {
        stats.active++;
        if (task.dueDate && new Date(task.dueDate) < now) {
          stats.overdue++;
        }
        if (task.dueDate && task.dueDate.split('T')[0] === today) {
          stats.dueToday++;
        }
      }

      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
      
      if (task.category) {
        stats.byCategory[task.category] = (stats.byCategory[task.category] || 0) + 1;
      }
      if (task.projectId) {
        stats.byProject[task.projectId] = (stats.byProject[task.projectId] || 0) + 1;
      }
    });

    stats.completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
    stats.averageCompletionTime = completedTasks > 0 
      ? totalCompletionTime / completedTasks / (1000 * 60 * 60) 
      : 0;

    return stats;
  }, [tasks]);

  useEffect(() => {
    loadTasks();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        taskService.scheduleSync(1000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    tasks,
    loading,
    error,
    lists,
    projects,
    loadTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
    forceSync,
    getFilteredTasks,
    getStats,
    getLists,      // Add this
    getProjects,   // Add this
    createList,
    createProject,
    shareTask,
    applyTemplate,
  };
}
