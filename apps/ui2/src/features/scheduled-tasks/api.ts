import { OpenAPI, TaskBlueprintsService, ScheduledTasksService } from '@taico/client';
import { BFF_BASE_URL } from '../../config/api';

OpenAPI.BASE = BFF_BASE_URL;

export { TaskBlueprintsService, ScheduledTasksService };

export const api = {
  taskBlueprints: TaskBlueprintsService,
  scheduledTasks: ScheduledTasksService,
};
