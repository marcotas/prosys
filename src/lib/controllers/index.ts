import { HabitController } from './habit-controller';
import { MemberController } from './member-controller';
import { TaskController } from './task-controller';
import { apiClient, offlineQueue, wsClient } from '$lib/infra';

export { HabitController } from './habit-controller';
export { MemberController } from './member-controller';
export { TaskController } from './task-controller';

export const habitController = new HabitController(apiClient, offlineQueue, wsClient);
export const memberController = new MemberController(apiClient, offlineQueue, wsClient);
export const taskController = new TaskController(apiClient, offlineQueue, wsClient);
