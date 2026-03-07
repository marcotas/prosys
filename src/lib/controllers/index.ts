import { TaskController } from './task-controller';
import { apiClient, offlineQueue, wsClient } from '$lib/infra';

export { TaskController } from './task-controller';

export const taskController = new TaskController(apiClient, offlineQueue, wsClient);
