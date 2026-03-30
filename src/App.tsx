import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import koKR from 'antd/locale/ko_KR';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import RequireAuth from '@/components/common/RequireAuth';
import AppLayout from '@/components/common/AppLayout';
import { useAuthStore } from '@/store/authStore';

dayjs.locale('ko');

const LoginPage          = React.lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage      = React.lazy(() => import('@/pages/dashboard/DashboardPage'));
const ProjectListPage    = React.lazy(() => import('@/pages/wbs/ProjectListPage'));
const SchedulePage       = React.lazy(() => import('@/pages/wbs/SchedulePage'));
const ProgressPage       = React.lazy(() => import('@/pages/wbs/ProgressPage'));
const WorkloadPage       = React.lazy(() => import('@/pages/wbs/WorkloadPage'));
const UserManagementPage = React.lazy(() => import('@/pages/admin/UserManagementPage'));
const OrgManagementPage  = React.lazy(() => import('@/pages/admin/OrgManagementPage'));

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

/** 고객사 계정 여부 */
const useIsClientViewer = () => {
  const user = useAuthStore(s => s.user);
  return user?.userRole === 'CLIENT_VIEWER';
};

const App: React.FC = () => {
  const isClientViewer = useIsClientViewer();

  return (
    <ConfigProvider
      locale={koKR}
      theme={{
        token: { colorPrimary: '#2E75B6', borderRadius: 6 },
        components: {
          Menu:  { itemBg: '#1F4E79', itemColor: 'rgba(255,255,255,0.75)',
                   itemSelectedBg: '#2E75B6', itemSelectedColor: '#fff',
                   itemHoverBg: 'rgba(255,255,255,0.1)', itemHoverColor: '#fff' },
          Table: { headerBg: '#F0F5FF', headerColor: '#1F4E79' },
        },
      }}
    >
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>

              {/* 대시보드: CLIENT_VIEWER는 WBS 목록으로 리다이렉트 */}
              <Route index element={
                isClientViewer
                  ? <Navigate to="/wbs/schedule" replace />
                  : <DashboardPage />
              } />

              {/* WBS */}
              <Route path="wbs/schedule"            element={<ProjectListPage />} />
              <Route path="wbs/schedule/:projectId" element={<SchedulePage />} />
              <Route path="wbs/progress"            element={<ProgressPage />} />
              <Route path="wbs/workload"            element={<WorkloadPage />} />

              {/* Admin — CLIENT_VIEWER 접근 시 리다이렉트 */}
              <Route path="admin/users" element={
                isClientViewer ? <Navigate to="/wbs/schedule" replace /> : <UserManagementPage />
              } />
              <Route path="admin/orgs" element={
                isClientViewer ? <Navigate to="/wbs/schedule" replace /> : <OrgManagementPage />
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
