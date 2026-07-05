import { TaskPriority } from '../types/task.types';

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#D32F2F',
  high: '#F44336',
  medium: '#FF9800',
  low: '#4CAF50',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const DEFAULT_CATEGORIES = [
  'Work',
  'Personal',
  'Shopping',
  'Health',
  'Finance',
  'Education',
  'Social',
  'Other'
];

export const DEFAULT_TAGS = [
  'urgent',
  'important',
  'meeting',
  'call',
  'email',
  'review',
  'follow-up',
  'waiting'
];

export const REMINDER_TIMES = [
  'At time of task',
  '5 minutes before',
  '10 minutes before',
  '15 minutes before',
  '30 minutes before',
  '1 hour before',
  '2 hours before',
  '1 day before'
];

export const RECURRING_OPTIONS = [
  'None',
  'Daily',
  'Weekly',
  'Bi-weekly',
  'Monthly',
  'Quarterly',
  'Yearly',
  'Custom'
];
