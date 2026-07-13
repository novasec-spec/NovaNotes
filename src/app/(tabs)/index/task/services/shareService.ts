import { supabase } from '../../../../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types/task.types';
import { TaskService } from './taskService';
import { NotificationService } from './notificationService';

export interface ShareNotification {
  id: string;
  taskId: string;
  sharedBy: string;
  sharedWith: string[];
  taskData: Task;
  message?: string;
  createdAt: string;
  read: boolean;
}

export class ShareService {
  private static instance: ShareService;
  private taskService = TaskService.getInstance();
  private notificationService = NotificationService.getInstance();
  private currentUserId: string | null = null;

  static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }

  // Set current user ID from auth
  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
  }

  // ============ GET REAL USERS FROM SUPABASE ============

  async getAvailableUsers(): Promise<any[]> {
    try {
      // Get current user from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found');
        return [];
      }

      // Fetch all users except the current user
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', user.id)
        .order('username', { ascending: true });

      if (error) {
        console.error('Supabase error fetching users:', error);
        // If users table doesn't exist, try auth users
        return await this.getUsersFromAuth();
      }

      return data || [];
    } catch (error) {
      console.error('Get users error:', error);
      // Fallback to auth users
      return await this.getUsersFromAuth();
    }
  }

  // Fallback: Get users from auth if users table doesn't exist
  private async getUsersFromAuth(): Promise<any[]> {
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      return users
        .filter(u => u.id !== currentUser?.id)
        .map(u => ({
          id: u.id,
          name: u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          email: u.email || '',
          avatar_url: u.user_metadata?.avatar_url || null,
        }));
    } catch (error) {
      console.error('Get users from auth error:', error);
      return [];
    }
  }

  // ============ SHARE TASK ============

  async shareTask(taskId: string, userIds: string[], message?: string): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get current user's name
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      const userName = userData?.name || user.email?.split('@')[0] || 'User';

      // Get the task
      const tasks = await this.taskService.getLocalTasks();
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');

      // Create share records in Supabase
      const sharePromises = userIds.map(userId => 
        supabase
          .from('task_shares')
          .insert({
            task_id: taskId,
            shared_by: user.id,
            shared_by_name: userName,
            shared_with: userId,
            task_data: task,
            message: message || '',
            read: false,
            created_at: new Date().toISOString(),
          })
      );

      await Promise.all(sharePromises);

      // Update local task with sharedWith
      await this.taskService.updateTaskLocally(taskId, {
        sharedWith: [...(task.sharedWith || []), ...userIds]
      });

      // Send notifications to each user
      for (const userId of userIds) {
        await this.notificationService.sendShareNotification({
          taskId: task.id,
          taskTitle: task.title,
          sharedBy: userName,
          sharedWith: userId,
          message: message || '',
          taskData: task,
        });
      }

      // Log activity
      await this.taskService.addActivityLog({
        id: `act_${Date.now()}`,
        taskId: taskId,
        userId: user.id,
        action: 'shared',
        details: { sharedWith: userIds, message },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Share task error:', error);
      throw error;
    }
  }

  // ============ RECEIVE SHARED TASK ============

  async receiveSharedTask(shareData: any): Promise<Task> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Check if task already exists locally
      const tasks = await this.taskService.getLocalTasks();
      const existingTask = tasks.find(t => t.id === shareData.task_id);
      
      if (existingTask) {
        // Update existing task with share info
        const updated = await this.taskService.updateTaskLocally(
          existingTask.id,
          {
            sharedWith: [...(existingTask.sharedWith || []), shareData.shared_by]
          }
        );
        // Mark share as read
        await supabase
          .from('task_shares')
          .update({ read: true })
          .eq('id', shareData.id);
        return updated;
      }

      // Create a new task from shared data
      const taskData = shareData.task_data;
      const newTask: Task = {
        ...taskData,
        id: shareData.task_id,
        _synced: true,
        _deleted: false,
        sharedWith: [shareData.shared_by],
        // Keep original creation date but mark as shared
      };

      // Save locally
      const allTasks = await this.taskService.getLocalTasks();
      const updatedTasks = [newTask, ...allTasks.filter(t => t.id !== shareData.task_id)];
      await this.taskService.saveLocalTasks(updatedTasks);

      // Mark share as read
      await supabase
        .from('task_shares')
        .update({ read: true })
        .eq('id', shareData.id);

      return newTask;

    } catch (error) {
      console.error('Receive shared task error:', error);
      throw error;
    }
  }

  // ============ FETCH SHARED TASKS ============

  async fetchSharedTasks(): Promise<ShareNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('task_shares')
        .select('*')
        .eq('shared_with', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Fetch shared tasks error:', error);
      return [];
    }
  }

  // ============ CHECK FOR NEW SHARES ============

  async checkForNewShares(): Promise<ShareNotification[]> {
    try {
      const shares = await this.fetchSharedTasks();
      
      for (const share of shares) {
        // Receive each new share
        await this.receiveSharedTask(share);
      }
      
      return shares;
    } catch (error) {
      console.error('Check for new shares error:', error);
      return [];
    }
  }
}
