import { Routes, Route } from 'react-router-dom';
import { ScheduledTasksProvider } from './ScheduledTasksProvider';
import { ScheduledTasksLayout } from './ScheduledTasksLayout';
import { ScheduledTasksPage } from './ScheduledTasksPage';
import { ScheduledTaskDetailPage } from './ScheduledTaskDetailPage';

export function ScheduledTasksRoutes() {
  return (
    <ScheduledTasksProvider>
      <Routes>
        <Route element={<ScheduledTasksLayout />}>
          <Route index element={<ScheduledTasksPage />} />
          <Route path=":scheduleId" element={<ScheduledTaskDetailPage />} />
        </Route>
      </Routes>
    </ScheduledTasksProvider>
  );
}
