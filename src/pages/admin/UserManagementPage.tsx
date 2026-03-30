import React, { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Space, Typography, Tag, Form, Input,
  Select, message, Popconfirm, Row, Col, Drawer,
  Avatar, Divider, Badge, Tooltip, Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  LockOutlined, UnlockOutlined, UserOutlined,
  BankOutlined, TeamOutlined, CrownOutlined,
  EyeOutlined, ReloadOutlined, SearchOutlined,
  StarOutlined, CloseCircleOutlined, KeyOutlined,
  DownOutlined, CheckSquareOutlined,
} from '@ant-design/icons';
import { userApi, orgApi } from '@/api';
import type { UserDto, CreateUserRequest, UpdateUserRequest, OrgDto, UserRole, UserStatus } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ROLE_CFG: Record<UserRole, { label: string; color: string; icon: React.ReactNode; desc: string; order: number }> = {
  SYSTEM_ADMIN:  { label: '시스템 관리자', color: 'red',    icon: <CrownOutlined />,  desc: '전체 시스템 관리',   order: 1 },
  PM:            { label: 'PM',           color: 'purple', icon: <TeamOutlined />,   desc: '프로젝트 생성/관리', order: 2 },
  TEAM_LEAD:     { label: '팀장',         color: 'blue',   icon: <StarOutlined />,   desc: '팀 관리·작업 배분', order: 3 },
  TEAM_MEMBER:   { label: '팀원',         color: 'cyan',   icon: <UserOutlined />,   desc: '작업 진척 입력',    order: 4 },
  CLIENT_VIEWER: { label: '고객사 열람',  color: 'green',  icon: <EyeOutlined />,    desc: '프로젝트 조회만',   order: 5 },
};

const STATUS_CFG: Record<UserStatus, { label: string; badge: 'success' | 'default' | 'error'; order: number }> = {
  ACTIVE:   { label: '활성',   badge: 'success', order: 1 },
  INACTIVE: { label: '비활성', badge: 'default', order: 2 },
  LOCKED:   { label: '잠김',   badge: 'error',   order: 3 },
};

const KPI_PALETTE: Record<string, { main: string }> = {
  all:           { main: '#2E75B6' },
  ACTIVE:        { main: '#52c41a' },
  TEAM_LEAD:     { main: '#1677ff' },
  TEAM_MEMBER:   { main: '#13c2c2' },
  CLIENT_VIEWER: { main: '#389e0d' },
};

const apiErr = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류 발생';

interface SearchState { keyword: string; roles: UserRole[]; statuses: UserStatus[]; }
const INIT_SEARCH: SearchState = { keyword: '', roles: [], statuses: [] };

/* ── KPI 필터 카드 ── */
const KpiCard: React.FC<{
  label: string; value: number; active: boolean;
  colorKey: string; icon: React.ReactNode; onClick: () => void;
}> = ({ label, value, active, colorKey, icon, onClick }) => {
  const { main } = KPI_PALETTE[colorKey] ?? KPI_PALETTE.all;
  return (
    <div onClick={onClick} style={{
      cursor: 'pointer',
      background: active ? main : '#fff',
      border: `2px solid ${active ? main : '#E8EDF5'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 88,
      textAlign: 'center', userSelect: 'none',
      transition: 'all 0.16s ease',
      boxShadow: active ? `0 4px 14px ${main}45` : '0 1px 4px rgba(0,0,0,0.06)',
      transform: active ? 'translateY(-2px)' : 'none',
    }}>
      <div style={{ fontSize: 15, color: active ? '#fff' : main, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: active ? '#fff' : main, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════ */
const UserManagementPage: React.FC = () => {
  const [users,       setUsers]       = useState<UserDto[]>([]);
  const [orgs,        setOrgs]        = useState<OrgDto[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [editUser,    setEditUser]    = useState<UserDto | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [addForm]     = Form.useForm<CreateUserRequest>();
  const [editForm]    = Form.useForm<UpdateUserRequest>();
  const [addRole,     setAddRole]     = useState<UserRole>('TEAM_MEMBER');
  const [editRole,    setEditRole]    = useState<UserRole>('TEAM_MEMBER');
  const [search,      setSearch]      = useState<SearchState>(INIT_SEARCH);
  // 일괄 처리용 선택
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const load = () => {
    setLoading(true);
    setSelectedIds([]);
    Promise.all([userApi.findAll(), orgApi.findAll()])
      .then(([u, o]) => { setUsers(u); setOrgs(o); })
      .catch(() => message.error('데이터 로드 실패'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  /* ── 필터링 ── */
  const filtered = useMemo(() => users.filter(u => {
    if (search.keyword) {
      const kw = search.keyword.toLowerCase();
      if (![u.displayName, u.username, u.email, u.department ?? '', u.position ?? '']
        .some(v => v.toLowerCase().includes(kw))) return false;
    }
    if (search.roles.length && !search.roles.includes(u.userRole)) return false;
    if (search.statuses.length && !search.statuses.includes(u.status)) return false;
    return true;
  }), [users, search]);

  const hasFilter = !!(search.keyword || search.roles.length || search.statuses.length);

  /* ── KPI 카드 토글 ── */
  const isAllActive  = !hasFilter;
  const isStatusOnly = (st: UserStatus) =>
    search.statuses.length === 1 && search.statuses[0] === st && !search.roles.length && !search.keyword;
  const isRoleOnly = (r: UserRole) =>
    search.roles.length === 1 && search.roles[0] === r && !search.statuses.length && !search.keyword;

  const kpiCards = [
    { key: 'all',           label: '전체',   icon: <UserOutlined />,           value: users.length,                                             active: isAllActive,               colorKey: 'all',           onClick: () => setSearch(INIT_SEARCH) },
    { key: 'ACTIVE',        label: '활성',   icon: <Badge status="success" />, value: users.filter(u => u.status === 'ACTIVE').length,          active: isStatusOnly('ACTIVE'),    colorKey: 'ACTIVE',        onClick: () => isStatusOnly('ACTIVE')        ? setSearch(INIT_SEARCH) : setSearch({ keyword: '', roles: [], statuses: ['ACTIVE'] }) },
    { key: 'TEAM_LEAD',     label: '팀장',   icon: <StarOutlined />,           value: users.filter(u => u.userRole === 'TEAM_LEAD').length,      active: isRoleOnly('TEAM_LEAD'),   colorKey: 'TEAM_LEAD',     onClick: () => isRoleOnly('TEAM_LEAD')       ? setSearch(INIT_SEARCH) : setSearch({ keyword: '', statuses: [], roles: ['TEAM_LEAD'] }) },
    { key: 'TEAM_MEMBER',   label: '팀원',   icon: <TeamOutlined />,           value: users.filter(u => u.userRole === 'TEAM_MEMBER').length,    active: isRoleOnly('TEAM_MEMBER'), colorKey: 'TEAM_MEMBER',   onClick: () => isRoleOnly('TEAM_MEMBER')     ? setSearch(INIT_SEARCH) : setSearch({ keyword: '', statuses: [], roles: ['TEAM_MEMBER'] }) },
    { key: 'CLIENT_VIEWER', label: '고객사', icon: <BankOutlined />,           value: users.filter(u => u.userRole === 'CLIENT_VIEWER').length,  active: isRoleOnly('CLIENT_VIEWER'), colorKey: 'CLIENT_VIEWER', onClick: () => isRoleOnly('CLIENT_VIEWER')   ? setSearch(INIT_SEARCH) : setSearch({ keyword: '', statuses: [], roles: ['CLIENT_VIEWER'] }) },
  ];

  /* ── CRUD ── */
  const handleCreate = async (v: CreateUserRequest) => {
    setSaving(true);
    try {
      await userApi.create(v);
      message.success(`✅ ${v.displayName} 계정 생성 완료`);
      setAddOpen(false); addForm.resetFields(); load();
    } catch (e) { message.error(apiErr(e)); }
    finally { setSaving(false); }
  };

  const openEdit = (u: UserDto) => {
    setEditUser(u); setEditRole(u.userRole);
    editForm.setFieldsValue({
      displayName: u.displayName, email: u.email,
      department: u.department ?? '', position: u.position ?? '',
      userRole: u.userRole, status: u.status, orgId: u.orgId,
    });
    setEditOpen(true);
  };

  const handleEdit = async (v: UpdateUserRequest) => {
    if (!editUser) return;
    setSaving(true);
    try {
      const req = { ...v };
      if (!req.newPassword) delete req.newPassword;
      await userApi.update(editUser.userId, req);
      message.success('✅ 수정 완료');
      setEditOpen(false); load();
    } catch (e) { message.error(apiErr(e)); }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (u: UserDto) => {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await userApi.changeStatus(u.userId, next);
      message.success(`${u.displayName} → ${STATUS_CFG[next as UserStatus].label}`);
      load();
    } catch (e) { message.error(apiErr(e)); }
  };

  /* ── 비밀번호 초기화 ── */
  const handleResetPassword = async (u: UserDto) => {
    try {
      await userApi.resetPassword(u.userId);
      message.success(`🔑 ${u.displayName} 비밀번호가 초기화되었습니다.`);
    } catch (e) { message.error(apiErr(e)); }
  };

  const handleDelete = async (u: UserDto) => {
    try {
      await userApi.delete(u.userId);
      message.success('삭제 완료');
      load();
    } catch (e) { message.error(apiErr(e)); }
  };

  /* ── 일괄 처리 ── */
  const handleBatchStatus = async (status: UserStatus) => {
    if (!selectedIds.length) return;
    try {
      await userApi.batchStatus(selectedIds, status);
      message.success(`${selectedIds.length}명 → ${STATUS_CFG[status].label} 처리 완료`);
      load();
    } catch (e) { message.error(apiErr(e)); }
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await userApi.batchDelete(selectedIds);
      message.success(`${selectedIds.length}명 삭제 완료`);
      load();
    } catch (e) { message.error(apiErr(e)); }
  };

  /* ── 테이블 컬럼 ── */
  const columns: ColumnsType<UserDto> = [
    {
      title: '사용자', key: 'user', width: 210, fixed: 'left',
      sorter: (a, b) => a.displayName.localeCompare(b.displayName, 'ko'),
      showSorterTooltip: { title: '이름 정렬' },
      render: (_, r) => {
        const cfg = ROLE_CFG[r.userRole];
        return (
          <Space>
            <Avatar size={34} style={{ background: r.status === 'ACTIVE' ? '#2E75B6' : '#ccc', flexShrink: 0 }}>
              {r.displayName[0]}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {r.displayName}
                <Tag color={cfg.color} style={{ marginLeft: 6, fontSize: 10 }}>{cfg.label}</Tag>
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>@{r.username}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: '이메일', dataIndex: 'email', key: 'email', width: 200,
      sorter: (a, b) => a.email.localeCompare(b.email),
      showSorterTooltip: { title: '이메일 정렬' },
      render: v => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '소속 / 직책', key: 'dept', width: 140,
      sorter: (a, b) => (a.department ?? '').localeCompare(b.department ?? '', 'ko'),
      showSorterTooltip: { title: '소속 정렬' },
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12 }}>{r.department ?? '-'}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{r.position ?? ''}</div>
        </div>
      ),
    },
    {
      title: '고객사', key: 'org', width: 115,
      sorter: (a, b) => (a.orgName ?? '').localeCompare(b.orgName ?? '', 'ko'),
      showSorterTooltip: { title: '고객사 정렬' },
      render: (_, r) => r.orgName
        ? <Tag color="cyan" icon={<BankOutlined />}>{r.orgName}</Tag>
        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
    {
      title: '역할', key: 'role', width: 105,
      sorter: (a, b) => (ROLE_CFG[a.userRole]?.order ?? 99) - (ROLE_CFG[b.userRole]?.order ?? 99),
      showSorterTooltip: { title: '역할 정렬' },
      render: (_, r) => {
        const cfg = ROLE_CFG[r.userRole];
        return <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: '상태', dataIndex: 'status', key: 'status', width: 75, align: 'center' as const,
      sorter: (a, b) => (STATUS_CFG[a.status]?.order ?? 99) - (STATUS_CFG[b.status]?.order ?? 99),
      showSorterTooltip: { title: '상태 정렬' },
      render: (v: UserStatus) => <Badge status={STATUS_CFG[v].badge} text={STATUS_CFG[v].label} />,
    },
    {
      title: '생성일', dataIndex: 'createdAt', key: 'createdAt', width: 100,
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      showSorterTooltip: { title: '생성일 정렬' },
      render: v => <Text style={{ fontSize: 11, color: '#aaa' }}>{v ? dayjs(v).format('YY.MM.DD') : '-'}</Text>,
    },
    {
      title: '마지막 로그인', dataIndex: 'lastLoginAt', key: 'login', width: 120,
      sorter: (a, b) => {
        if (!a.lastLoginAt && !b.lastLoginAt) return 0;
        if (!a.lastLoginAt) return 1;
        if (!b.lastLoginAt) return -1;
        return dayjs(a.lastLoginAt).unix() - dayjs(b.lastLoginAt).unix();
      },
      showSorterTooltip: { title: '로그인 정렬' },
      render: v => <Text style={{ fontSize: 11, color: '#888' }}>
        {v ? dayjs(v).format('YY.MM.DD HH:mm') : '-'}
      </Text>,
    },
    {
      title: '액션', key: 'action', width: 130, fixed: 'right',
      render: (_, r) => (
        <Space size={3}>
          <Tooltip title="수정">
            <Button size="small" icon={<EditOutlined />} type="primary" ghost onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.status === 'ACTIVE' ? '비활성화' : '활성화'}>
            <Button size="small"
              icon={r.status === 'ACTIVE' ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(r)} />
          </Tooltip>
          {/* 비밀번호 초기화 */}
          <Popconfirm
            title={<><b>{r.displayName}</b> 비밀번호를 초기화하시겠습니까?<br />
              <span style={{ fontSize: 12, color: '#888' }}>초기 비밀번호: dhicc@5595</span></>}
            onConfirm={() => handleResetPassword(r)}
            okText="초기화" cancelText="취소"
            okButtonProps={{ style: { background: '#fa8c16', borderColor: '#fa8c16' } }}>
            <Tooltip title="비밀번호 초기화">
              <Button size="small" icon={<KeyOutlined />} style={{ color: '#fa8c16', borderColor: '#fa8c16' }} />
            </Tooltip>
          </Popconfirm>
          {/* 삭제 */}
          <Popconfirm
            title={<><b>"{r.displayName}"</b> 계정을 완전히 삭제하시겠습니까?<br />
              <span style={{ color: '#ff4d4f', fontSize: 12 }}>연관 데이터도 모두 삭제됩니다.</span></>}
            onConfirm={() => handleDelete(r)} okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}>
            <Button size="small" icon={<DeleteOutlined />} danger ghost />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ── 일괄처리 액션바 ── */
  const batchBar = selectedIds.length > 0 && (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#EBF3FB', border: '1px solid #91caff',
      borderRadius: 8, padding: '8px 14px', marginBottom: 10,
    }}>
      <CheckSquareOutlined style={{ color: '#2E75B6' }} />
      <Text style={{ fontSize: 13 }}>
        <b style={{ color: '#2E75B6' }}>{selectedIds.length}명</b> 선택됨
      </Text>
      <Divider type="vertical" />
      <Dropdown menu={{
        items: [
          { key: 'ACTIVE',   label: <><Badge status="success" /> 활성으로 변경</>,   onClick: () => handleBatchStatus('ACTIVE') },
          { key: 'INACTIVE', label: <><Badge status="default" /> 비활성으로 변경</>, onClick: () => handleBatchStatus('INACTIVE') },
          { key: 'LOCKED',   label: <><Badge status="error" /> 잠금 처리</>,         onClick: () => handleBatchStatus('LOCKED') },
        ],
      }}>
        <Button size="small" icon={<DownOutlined />}>상태 변경</Button>
      </Dropdown>
      <Popconfirm
        title={<><b>{selectedIds.length}명</b>을 모두 삭제하시겠습니까?<br />
          <span style={{ color: '#ff4d4f', fontSize: 12 }}>이 작업은 되돌릴 수 없습니다.</span></>}
        onConfirm={handleBatchDelete} okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />}>일괄 삭제</Button>
      </Popconfirm>
      <Button size="small" type="text" onClick={() => setSelectedIds([])}>선택 해제</Button>
    </div>
  );

  return (
    <div>
      {/* 헤더 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>사용자 관리</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>계정 생성 및 역할·상태를 관리합니다.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { addForm.resetFields(); setAddRole('TEAM_MEMBER'); setAddOpen(true); }}>
              계정 생성
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPI 필터 카드 */}
      <Row gutter={8} style={{ marginBottom: 14 }}>
        {kpiCards.map(c => (
          <Col key={c.key}>
            <KpiCard label={c.label} value={c.value} active={c.active}
              colorKey={c.colorKey} icon={c.icon} onClick={c.onClick} />
          </Col>
        ))}
      </Row>

      {/* 검색 필터 */}
      <div style={{
        background: '#F8F9FF', border: '1px solid #E8EDF5',
        borderRadius: 10, padding: '14px 16px', marginBottom: 14,
      }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} md={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="이름 · 아이디 · 이메일 · 부서 검색"
              allowClear value={search.keyword}
              onChange={e => setSearch(s => ({ ...s, keyword: e.target.value }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select mode="multiple" style={{ width: '100%' }}
              placeholder="역할 필터 (복수 선택)" allowClear maxTagCount={2}
              value={search.roles}
              onChange={v => setSearch(s => ({ ...s, roles: v as UserRole[] }))}
              options={Object.entries(ROLE_CFG).map(([k, v]) => ({
                value: k,
                label: <Tag color={v.color} style={{ margin: 0, fontSize: 11 }}>{v.label}</Tag>,
              }))}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select mode="multiple" style={{ width: '100%' }}
              placeholder="상태 필터" allowClear value={search.statuses}
              onChange={v => setSearch(s => ({ ...s, statuses: v as UserStatus[] }))}
              options={Object.entries(STATUS_CFG).map(([k, v]) => ({
                value: k, label: <Badge status={v.badge} text={v.label} />,
              }))}
            />
          </Col>
          <Col xs={24} md={3} style={{ textAlign: 'right' }}>
            <Space>
              {hasFilter && (
                <Tooltip title="필터 초기화">
                  <Button size="small" type="text" icon={<CloseCircleOutlined />}
                    style={{ color: '#ff4d4f' }} onClick={() => setSearch(INIT_SEARCH)} />
                </Tooltip>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {hasFilter
                  ? <><b style={{ color: '#2E75B6' }}>{filtered.length}</b> / {users.length}명</>
                  : <>{users.length}명</>}
              </Text>
            </Space>
          </Col>
        </Row>
        {hasFilter && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {search.keyword && (
              <Tag closable color="blue"
                onClose={() => setSearch(s => ({ ...s, keyword: '' }))}>"{search.keyword}"</Tag>
            )}
            {search.roles.map(r => (
              <Tag key={r} closable color={ROLE_CFG[r].color}
                onClose={() => setSearch(s => ({ ...s, roles: s.roles.filter(x => x !== r) }))}>
                {ROLE_CFG[r].label}
              </Tag>
            ))}
            {search.statuses.map(st => (
              <Tag key={st} closable
                onClose={() => setSearch(s => ({ ...s, statuses: s.statuses.filter(x => x !== st) }))}>
                {STATUS_CFG[st].label}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* 일괄처리 액션바 */}
      {batchBar}

      {/* 테이블 */}
      <Table
        dataSource={filtered} columns={columns} rowKey="userId" loading={loading}
        size="small" scroll={{ x: 1200 }}
        pagination={{ pageSize: 15, showTotal: t => `총 ${t}명`, showSizeChanger: false }}
        rowClassName={r => r.status !== 'ACTIVE' ? 'user-row-inactive' : ''}
        locale={{ emptyText: hasFilter ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.' }}
        showSorterTooltip={false}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: keys => setSelectedIds(keys as number[]),
          getCheckboxProps: r => ({ name: r.displayName }),
        }}
      />

      {/* 계정 생성 Drawer */}
      <Drawer title={<><PlusOutlined style={{ color: '#2E75B6', marginRight: 8 }} />계정 생성</>}
        open={addOpen} onClose={() => setAddOpen(false)} width={460} destroyOnClose
        footer={<div style={{ textAlign: 'right' }}><Space>
          <Button onClick={() => setAddOpen(false)}>취소</Button>
          <Button type="primary" loading={saving} onClick={() => addForm.submit()}>생성</Button>
        </Space></div>}>
        <Form form={addForm} layout="vertical" onFinish={handleCreate}
          initialValues={{ userRole: 'TEAM_MEMBER' }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="아이디 *" rules={[{ required: true }, { min: 3 }]}>
                <Input prefix={<UserOutlined />} placeholder="예: kim.cs" autoFocus />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="displayName" label="이름 *" rules={[{ required: true }]}>
                <Input placeholder="예: 김철수" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="이메일 *" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="예: kim@company.com" />
          </Form.Item>
          <Form.Item name="password" label="초기 비밀번호 *"
            rules={[{ required: true }, { min: 8, message: '8자 이상' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="8자 이상" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="department" label="소속팀"><Input placeholder="예: SCM1팀" /></Form.Item></Col>
            <Col span={12}><Form.Item name="position" label="직책"><Input placeholder="예: 대리" /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <Form.Item name="userRole" label="역할 *" rules={[{ required: true }]}>
            <Select onChange={v => setAddRole(v as UserRole)}>
              {Object.entries(ROLE_CFG).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  <Tag color={v.color} style={{ marginRight: 6 }}>{v.label}</Tag>{v.desc}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {addRole === 'CLIENT_VIEWER' && (
            <Form.Item name="orgId" label="소속 지자체 *"
              rules={[{ required: true, message: '소속 기관을 선택하세요.' }]}>
              <Select placeholder="지자체 선택" showSearch optionFilterProp="label"
                options={orgs.map(o => ({ value: o.orgId, label: `${o.name} (${o.region ?? ''})` }))} />
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* 계정 수정 Drawer */}
      <Drawer
        title={<Space><EditOutlined style={{ color: '#2E75B6' }} />계정 수정
          {editUser && <Tag color={ROLE_CFG[editUser.userRole].color}>{editUser.displayName}</Tag>}
        </Space>}
        open={editOpen} onClose={() => setEditOpen(false)} width={460} destroyOnClose
        footer={<div style={{ textAlign: 'right' }}><Space>
          <Button onClick={() => setEditOpen(false)}>취소</Button>
          <Button type="primary" loading={saving} onClick={() => editForm.submit()}>저장</Button>
        </Space></div>}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="displayName" label="이름 *" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="이메일 *" rules={[{ required: true }, { type: 'email' }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="department" label="소속팀"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="position" label="직책"><Input /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="userRole" label="역할">
                <Select onChange={v => setEditRole(v as UserRole)}>
                  {Object.entries(ROLE_CFG).map(([k, v]) => (
                    <Select.Option key={k} value={k}>
                      <Tag color={v.color}>{v.label}</Tag> {v.desc}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="status" label="상태">
                <Select>
                  {Object.entries(STATUS_CFG).map(([k, v]) => (
                    <Select.Option key={k} value={k}>
                      <Badge status={v.badge} text={v.label} />
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {editRole === 'CLIENT_VIEWER' && (
            <Form.Item name="orgId" label="소속 지자체">
              <Select placeholder="지자체 선택" allowClear showSearch optionFilterProp="label"
                options={orgs.map(o => ({ value: o.orgId, label: `${o.name} (${o.region ?? ''})` }))} />
            </Form.Item>
          )}
          <Divider style={{ margin: '12px 0' }} />
          <Form.Item name="newPassword" label="새 비밀번호" help="변경 안 하면 비워두세요">
            <Input.Password prefix={<LockOutlined />} placeholder="8자 이상 (비워두면 유지)" />
          </Form.Item>
        </Form>
      </Drawer>

      <style>{`.user-row-inactive td { opacity: 0.5; }`}</style>
    </div>
  );
};

export default UserManagementPage;
