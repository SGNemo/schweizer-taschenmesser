import type { Strings } from '@/strings';

export const groups: Strings['groups'] = {
  overdue: 'Overdue',
  waiting: 'Still waiting',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  none: 'No date',
  due: 'Due',
  paid: 'Paid',
  open: 'Open',
  done: 'Done',
  collapse: (label: string) => `Collapse ${label}`,
  expand: (label: string) => `Expand ${label}`,
  count: (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
};
