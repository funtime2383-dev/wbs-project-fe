import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Space, Tag } from 'antd';
import {
  DashboardOutlined, ProjectOutlined, UserOutlined,
  LogoutOutlined, SettingOutlined, BellOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BarChartOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api';
import type { UserRole } from '@/types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const ROLE_TAG: Record<UserRole, { label: string; color: string }> = {
  SYSTEM_ADMIN:  { label: '관리자', color: 'red'    },
  PM:            { label: 'PM',    color: 'purple' },
  TEAM_LEAD:     { label: '팀장',  color: 'blue'   },
  TEAM_MEMBER:   { label: '팀원',  color: 'cyan'   },
  CLIENT_VIEWER: { label: '고객사', color: 'green' },
};

/** 키별 접근 허용 역할 목록 — 없으면 전체 허용 */
const MENU_ROLES: Record<string, UserRole[]> = {
  '/':             ['SYSTEM_ADMIN', 'PM', 'TEAM_LEAD', 'TEAM_MEMBER'], // 대시보드 — CLIENT_VIEWER 제외
  '/wbs/progress': ['SYSTEM_ADMIN', 'PM', 'TEAM_LEAD', 'TEAM_MEMBER'],
  '/wbs/workload': ['SYSTEM_ADMIN', 'PM', 'TEAM_LEAD', 'TEAM_MEMBER'],
  '/admin':        ['SYSTEM_ADMIN', 'PM'],
  '/admin/users':  ['SYSTEM_ADMIN'],
  '/admin/orgs':   ['SYSTEM_ADMIN'],
};

type MenuItem = NonNullable<MenuProps['items']>[number];

const ALL_MENUS: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '대시보드' },
  {
    key: '/wbs', icon: <ProjectOutlined />, label: 'WBS 관리',
    children: [
      { key: '/wbs/schedule', label: '일정 관리' },
      { key: '/wbs/progress', label: '담당자별 진행율' },
      { key: '/wbs/workload', label: '워크로드 분석' },
    ],
  },
  {
    key: '/admin', icon: <SettingOutlined />, label: '시스템 관리',
    children: [
      { key: '/admin/users', label: '사용자 관리', icon: <UserOutlined /> },
      { key: '/admin/orgs',  label: '지자체 관리', icon: <BankOutlined /> },
    ],
  },
];

function filterMenus(menus: MenuItem[], role: UserRole): MenuItem[] {
  return menus.reduce<MenuItem[]>((acc, item) => {
    if (!item) return acc;
    const key     = (item as { key?: string }).key as string;
    const allowed = MENU_ROLES[key];
    if (allowed && !allowed.includes(role)) return acc;
    const children = (item as { children?: MenuItem[] }).children;
    if (children) {
      const filtered = filterMenus(children, role);
      if (filtered.length === 0) return acc;
      acc.push({ ...item, children: filtered } as MenuItem);
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
}

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, clearAuth } = useAuthStore();

  const role     = (user?.userRole ?? 'TEAM_MEMBER') as UserRole;
  const roleInfo = ROLE_TAG[role];
  const menus    = filterMenus(ALL_MENUS, role);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const userMenu: MenuProps['items'] = [
    { key: 'logout', icon: <LogoutOutlined />, label: '로그아웃', danger: true },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={210}
        style={{ background: '#1F4E79', boxShadow: '2px 0 8px rgba(0,0,0,0.15)' }}>

        <div style={{
          height: 56, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 18px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}>
          <BarChartOutlined style={{ fontSize: 20, color: '#fff', flexShrink: 0 }} />
          {!collapsed && (
            <Text strong style={{ color: '#fff', marginLeft: 10, fontSize: 13, whiteSpace: 'nowrap' }}>
              WBS 관리시스템
            </Text>
          )}
        </div>

        {!collapsed && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Space>
              <Avatar size={26} style={{ background: '#2E75B6', fontSize: 12, flexShrink: 0 }}>
                {user?.displayName?.[0]}
              </Avatar>
              <div>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{user?.displayName}</div>
                <Tag color={roleInfo.color} style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '16px' }}>
                  {roleInfo.label}
                </Tag>
              </div>
            </Space>
          </div>
        )}

        <Menu theme="dark" mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['/wbs', '/admin']}
          items={menus}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#1F4E79', borderRight: 0, marginTop: 4 }} />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 20px', height: 52,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
        }}>
          <Space>
            {collapsed
              ? <MenuUnfoldOutlined style={{ fontSize: 17, cursor: 'pointer', color: '#555' }} onClick={() => setCollapsed(false)} />
              : <MenuFoldOutlined   style={{ fontSize: 17, cursor: 'pointer', color: '#555' }} onClick={() => setCollapsed(true)} />
            }
          </Space>
          <Space size={14}>
            <Badge count={0} showZero={false}>
              <BellOutlined style={{ fontSize: 17, color: '#555', cursor: 'pointer' }} />
            </Badge>
            <Dropdown
              menu={{ items: userMenu, onClick: ({ key }) => key === 'logout' && handleLogout() }}
              placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size={30} style={{ background: '#2E75B6' }}>
                  {user?.displayName?.[0] ?? <UserOutlined />}
                </Avatar>
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.displayName}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{user?.email}</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          margin: '14px 18px', padding: '20px 24px',
          background: '#fff', borderRadius: 8,
          minHeight: 'calc(100vh - 80px)', overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
