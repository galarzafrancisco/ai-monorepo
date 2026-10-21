import { Route, Routes } from 'react-router-dom';
import { ProjectsProvider } from './ProjectsProvider';
import { ProjectsLayout } from './ProjectsLayout';
import { ProjectsPage } from './ProjectsPage';
import { ProjectCreatePage } from './ProjectCreatePage';
import { ProjectDetailPage } from './ProjectDetailPage';

export function ProjectsRoutes() {
  return (
    <ProjectsProvider>
      <Routes>
        <Route element={<ProjectsLayout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="/new" element={<ProjectCreatePage />} />
          <Route path="/project/:projectId" element={<ProjectDetailPage />} />
        </Route>
      </Routes>
    </ProjectsProvider>
  );
}
