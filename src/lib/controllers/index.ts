import { apiClient, offlineQueue, wsClient } from '$lib/infra';
import { TaskController } from './task-controller';

export { TaskController } from './task-controller';

export const taskController = new TaskController(apiClient, offlineQueue, wsClient);
