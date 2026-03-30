import React, { useEffect, useState, useMemo } from 'react';
import {
  Row, Col, Typography, Button, Space, Tag, Badge, Avatar,
  Input, Select, Empty, Spin, Tooltip, Progress, Steps,
  Modal, Form, DatePicker, message, Dropdown, Divider,
  Checkbox, Alert, Tabs,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  CalendarOutlined, TeamOutlined, RightOutlined,
  AppstoreOutlined, UnorderedListOutlined,
  CheckCircleOutlined,
  EditOutlined, CloseCircleOutlined, DeleteOutlined,
  MoreOutlined, PauseOutlined, PlayCircleOutlined,
  CodeOutlined, CloudServerOutlined, AuditOutlined,
  FileAddOutlined, AppstoreAddOutlined,
  ArrowLeftOutlined, ArrowRightOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectApi, memberApi, userApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import type {
  ProjectDto, CreateProjectRequest, UpdateProjectRequest,
  ProjectMemberDto, ProjectStatus, UserDto, UserRole, ProjectRole,
} from '@/types';
import dayjs from 'dayjs';
import api from '@/api/client';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_CFG: Record<ProjectStatus, { label: string; color: string; badge: 'success' | 'processing' | 'warning' | 'error' | 'default' }> = {
  ACTIVE:    { label: '진행중',   color: '#2E75B6', badge: 'processing' },
  COMPLETED: { label: '완료',     color: '#52c41a', badge: 'success'    },
  SUSPENDED: { label: '일시중단', color: '#fa8c16', badge: 'warning'    },
};

const ROLE_CFG: Record<UserRole, { label: string; color: string }> = {
  SYSTEM_ADMIN:  { label: '시스템 관리자', color: 'red'    },
  PM:            { label: 'PM',           color: 'purple' },
  TEAM_LEAD:     { label: '팀장',         color: 'blue'   },
  TEAM_MEMBER:   { label: '팀원',         color: 'cyan'   },
  CLIENT_VIEWER: { label: '고객사',       color: 'green'  },
};

const PROJECT_ROLE_CFG: Record<ProjectRole, { label: string; color: string }> = {
  PROJECT_MANAGER: { label: 'PM',   color: '#722ed1' },
  TEAM_LEAD:       { label: '팀장', color: '#2E75B6' },
  DEVELOPER:       { label: '개발', color: '#13c2c2' },
  VIEWER:          { label: '뷰어', color: '#888'    },
  REPORTER:        { label: '보고', color: '#fa8c16' },
};

const TEMPLATES = [
  { key: 'SW_DEV',     icon: <CodeOutlined style={{ fontSize: 30, color: '#2E75B6' }} />,       title: '소프트웨어 개발', desc: '분석→설계→구현→테스트→이행',    count: 38, color: '#EBF4FF', border: '#2E75B6', tags: ['분석','설계','구현','테스트'] },
  { key: 'INFRA',      icon: <CloudServerOutlined style={{ fontSize: 30, color: '#52c41a' }} />, title: '인프라 구축',    desc: '분석→설계→구축→테스트→안정화', count: 26, color: '#F0FFF4', border: '#52c41a', tags: ['네트워크','서버','보안'] },
  { key: 'CONSULTING', icon: <AuditOutlined style={{ fontSize: 30, color: '#fa8c16' }} />,       title: '컨설팅 / 용역', desc: '진단→개선방안→이행계획→보고', count: 20, color: '#FFF7E6', border: '#fa8c16', tags: ['진단','분석','개선안','보고'] },
];

const MEMBER_AVATAR_COLORS = ['#2E75B6','#722ed1','#13c2c2','#52c41a','#fa8c16','#eb2f96','#f5222d'];

const dday = (endDate: string): { label: string; color: string } => {
  const diff = dayjs(endDate).diff(dayjs(), 'day');
  if (diff < 0)   return { label: `D+${Math.abs(diff)}`, color: '#ff4d4f' };
  if (diff === 0) return { label: 'D-Day',                color: '#fa8c16' };
  if (diff <= 7)  return { label: `D-${diff}`,            color: '#fa8c16' };
  return { label: `D-${diff}`, color: '#52c41a' };
};

const toDateStr = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'object' && v.format) return v.format('YYYY-MM-DD');
  return String(v).slice(0, 10);
};

const apiErr = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류 발생';

const MemberAvatars: React.FC<{ members: ProjectMemberDto[]; max?: number }> = ({ members, max = 4 }) => {
  const visible = members.slice(0, max);
  const rest = members.length - max;
  if (members.length === 0) return <Text style={{ fontSize: 11, color: '#bbb' }}>멤버 없음</Text>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {visible.map((m, i) => (
        <Tooltip key={m.userId} title={`${m.displayName} (${PROJECT_ROLE_CFG[m.role]?.label ?? m.role})`}>
          <Avatar size={22} style={{ background: MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length], fontSize: 10, fontWeight: 700, border: '1.5px solid #fff', marginLeft: i > 0 ? -6 : 0, cursor: 'default' }}>
            {m.displayName[0]}
          </Avatar>
        </Tooltip>
      ))}
      {rest > 0 && (
        <Avatar size={22} style={{ background: '#e0e0e0', color: '#888', fontSize: 9, marginLeft: -6, border: '1.5px solid #fff' }}>+{rest}</Avatar>
      )}
    </div>
  );
};

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [projects,     setProjects]     = useState<ProjectDto[]>([]);
  const [memberMap,    setMemberMap]    = useState<Record<number, ProjectMemberDto[]>>({});
  const [loading,      setLoading]      = useState(false);
  const [viewMode,     setViewMode]     = useState<'card' | 'list'>('card');
  const [keyword,      setKeyword]      = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus[]>([]);

  const [wizardOpen,   setWizardOpen]   = useState(false);
  const [wizardStep,   setWizardStep]   = useState(0);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [infoForm]     = Form.useForm();
  const [wizardInfo,   setWizardInfo]   = useState<any>(null);
  const [allUsers,     setAllUsers]     = useState<UserDto[]>([]);
  const [selUsers,     setSelUsers]     = useState<number[]>([]);
  const [userSearch,   setUserSearch]   = useState('');
  const [wbsMode,      setWbsMode]      = useState<'template' | 'manual' | null>(null);
  const [selTpl,       setSelTpl]       = useState<string | null>(null);

  const [editOpen,     setEditOpen]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<ProjectDto | null>(null);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editForm]     = Form.useForm();
  const [editTab,      setEditTab]      = useState('info');

  const [editMembers,      setEditMembers]      = useState<ProjectMemberDto[]>([]);
  const [editAllUsers,     setEditAllUsers]     = useState<UserDto[]>([]);
  const [editUserSearch,   setEditUserSearch]   = useState('');
  const [editMemberSaving, setEditMemberSaving] = useState(false);

  const canManage = user?.userRole === 'SYSTEM_ADMIN' || user?.userRole === 'PM';
  const isAdmin   = user?.userRole === 'SYSTEM_ADMIN';

  const load = async () => {
    setLoading(true);
    try {
      const list = await projectApi.findAll();
      setProjects(list);
      const mMap: Record<number, ProjectMemberDto[]> = {};
      await Promise.all(list.map(async p => {
        try { mMap[p.projectId] = await memberApi.getMembers(p.projectId); }
        catch { mMap[p.projectId] = []; }
      }));
      setMemberMap(mMap);
    } catch { message.error('프로젝트 로드 실패'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => projects.filter(p => {
    if (keyword && !p.name.toLowerCase().includes(keyword.toLowerCase()) &&
        !(p.description ?? '').toLowerCase().includes(keyword.toLowerCase())) return false;
    if (statusFilter.length && !statusFilter.includes(p.status)) return false;
    return true;
  }), [projects, keyword, statusFilter]);
  const hasFilter = !!(keyword || statusFilter.length);

  const openWizard = async () => {
    setWizardStep(0); setWizardInfo(null);
    setSelUsers([]); setUserSearch('');
    setWbsMode(null); setSelTpl(null);
    infoForm.resetFields();
    try { setAllUsers(await userApi.findAll()); } catch { setAllUsers([]); }
    setWizardOpen(true);
  };

  const filteredWizardUsers = useMemo(() =>
    allUsers.filter(u =>
      u.status === 'ACTIVE' &&
      u.userId !== user?.userId &&
      u.userRole !== 'SYSTEM_ADMIN' &&
      (!userSearch || [u.displayName, u.username, u.department ?? '']
        .some(v => v.toLowerCase().includes(userSearch.toLowerCase())))
    ), [allUsers, userSearch, user]);

  const goStep1 = async () => {
    try {
      const v = await infoForm.validateFields();
      const startDate = toDateStr(v.dateRange?.[0]);
      const endDate   = toDateStr(v.dateRange?.[1]);
      if (!startDate || !endDate) { message.warning('기간을 선택하세요.'); return; }
      setWizardInfo({ name: v.name, description: v.description, startDate, endDate });
      setWizardStep(1);
    } catch {}
  };

  const handleCreate = async () => {
    if (!wizardInfo) return;
    if (wbsMode === 'template' && !selTpl) { message.warning('템플릿을 선택하세요.'); return; }
    setWizardSaving(true);
    try {
      const req: any = { ...wizardInfo, memberUserIds: selUsers };
      const p = await projectApi.create(req as CreateProjectRequest);
      if (wbsMode === 'template' && selTpl) {
        try { await api.post(`/projects/${p.projectId}/template/${selTpl}`); }
        catch { message.warning('템플릿 적용 실패 — 프로젝트는 생성되었습니다.'); }
      }
      message.success(`✅ "${p.name}" 프로젝트 생성 완료!`);
      setWizardOpen(false); load();
      navigate(`/wbs/schedule/${p.projectId}`);
    } catch (e) { message.error(apiErr(e)); }
    finally { setWizardSaving(false); }
  };

  const openEdit = async (p: ProjectDto) => {
    setEditTarget(p); setEditTab('info');
    editForm.setFieldsValue({ name: p.name, description: p.description, dateRange: [dayjs(p.startDate), dayjs(p.endDate)], status: p.status });
    try {
      const [mems, users] = await Promise.all([memberApi.getMembers(p.projectId), userApi.findAll()]);
      setEditMembers(mems);
      setEditAllUsers(users.filter(u => u.status === 'ACTIVE' && u.userRole !== 'SYSTEM_ADMIN'));
    } catch { setEditMembers([]); setEditAllUsers([]); }
    setEditUserSearch('');
    setEditOpen(true);
  };

  const handleEdit = async (v: any) => {
    if (!editTarget) return; setEditSaving(true);
    try {
      await projectApi.update(editTarget.projectId, { name: v.name, description: v.description, startDate: toDateStr(v.dateRange?.[0]), endDate: toDateStr(v.dateRange?.[1]), status: v.status } as UpdateProjectRequest);
      message.success('✅ 수정 완료'); setEditOpen(false); load();
    } catch (e) { message.error(apiErr(e)); }
    finally { setEditSaving(false); }
  };

  const handleAddMember = async (userId: number) => {
    if (!editTarget) return; setEditMemberSaving(true);
    try {
      const newMember = await memberApi.addMember(editTarget.projectId, userId, 'DEVELOPER');
      setEditMembers(prev => [...prev, newMember]);
      setMemberMap(prev => ({ ...prev, [editTarget.projectId]: [...(prev[editTarget.projectId] ?? []), newMember] }));
      message.success('멤버 추가 완료');
    } catch (e) { message.error(apiErr(e)); }
    finally { setEditMemberSaving(false); }
  };

  const handleChangeRole = async (userId: number, role: ProjectRole) => {
    if (!editTarget) return;
    try { const updated = await memberApi.changeRole(editTarget.projectId, userId, role); setEditMembers(prev => prev.map(m => m.userId === userId ? updated : m)); }
    catch (e) { message.error(apiErr(e)); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!editTarget) return;
    try {
      await memberApi.removeMember(editTarget.projectId, userId);
      setEditMembers(prev => prev.filter(m => m.userId !== userId));
      setMemberMap(prev => ({ ...prev, [editTarget.projectId]: (prev[editTarget.projectId] ?? []).filter(m => m.userId !== userId) }));
      message.success('멤버 제거 완료');
    } catch (e) { message.error(apiErr(e)); }
  };

  const filteredEditUsers = useMemo(() =>
    editAllUsers.filter(u =>
      !editMembers.find(m => m.userId === u.userId) &&
      (!editUserSearch || [u.displayName, u.username, u.department ?? '']
        .some(v => v.toLowerCase().includes(editUserSearch.toLowerCase())))
    ), [editAllUsers, editMembers, editUserSearch]);

  const handleStatus = async (p: ProjectDto, status: ProjectStatus) => {
    try { await projectApi.changeStatus(p.projectId, status); message.success(`"${p.name}" → ${STATUS_CFG[status].label}`); load(); }
    catch (e) { message.error(apiErr(e)); }
  };
  const handleDelete = async (p: ProjectDto) => {
    try { await projectApi.delete(p.projectId); message.success(`"${p.name}" 삭제 완료`); load(); }
    catch (e) { message.error(apiErr(e)); }
  };

  const cardMenu = (p: ProjectDto): MenuProps => ({
    items: [
      { key: 'edit', label: '수정', icon: <EditOutlined /> },
      { type: 'divider' },
      ...(p.status !== 'ACTIVE'    ? [{ key: 'ACTIVE',    label: '진행중으로 변경', icon: <PlayCircleOutlined /> }]  : []),
      ...(p.status !== 'COMPLETED' ? [{ key: 'COMPLETED', label: '완료 처리',       icon: <CheckCircleOutlined /> }] : []),
      ...(p.status !== 'SUSPENDED' ? [{ key: 'SUSPENDED', label: '일시중단',        icon: <PauseOutlined /> }]       : []),
      { type: 'divider' },
      { key: 'delete', label: <span style={{ color: '#ff4d4f' }}>삭제</span>, icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />, danger: true },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === 'edit') { openEdit(p); return; }
      if (key === 'delete') {
        Modal.confirm({ title: `"${p.name}" 프로젝트를 삭제하시겠습니까?`, content: <span style={{ color: '#ff4d4f' }}>WBS 작업, 멤버 배정 등 관련 데이터가 모두 삭제됩니다.</span>, okText: '삭제', cancelText: '취소', okButtonProps: { danger: true }, onOk: () => handleDelete(p) });
        return;
      }
      handleStatus(p, key as ProjectStatus);
    },
  });

  const renderCard = (p: ProjectDto) => {
    const cfg  = STATUS_CFG[p.status];
    const dd   = dday(p.endDate);
    const mems = memberMap[p.projectId] ?? [];
    const duration = dayjs(p.endDate).diff(dayjs(p.startDate), 'day');
    const elapsed  = dayjs().diff(dayjs(p.startDate), 'day');
    const timeRate = Math.min(100, Math.max(0, Math.round((elapsed / (duration || 1)) * 100)));

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={p.projectId}>
        <div onClick={() => navigate(`/wbs/schedule/${p.projectId}`)}
          style={{ background: '#fff', border: '1.5px solid #E8EDF5', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', gap: 12, transition: 'all 0.18s ease' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 6px 20px rgba(46,117,182,0.18)'; el.style.borderColor = '#2E75B6'; el.style.transform = 'translateY(-3px)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.borderColor = '#E8EDF5'; el.style.transform = 'none'; }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge status={cfg.badge} text={<span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>} />
            <Space size={4}>
              <Tag style={{ background: dd.color + '15', color: dd.color, border: `1px solid ${dd.color}40`, fontSize: 11, fontWeight: 700, margin: 0 }}>{dd.label}</Tag>
              {canManage && (
                <Dropdown menu={cardMenu(p)} trigger={['click']}>
                  <Button size="small" type="text" icon={<MoreOutlined />} style={{ color: '#bbb' }} onClick={e => e.stopPropagation()} />
                </Dropdown>
              )}
            </Space>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1F4E79', marginBottom: 4, lineHeight: 1.4 }}>{p.name}</div>
            {p.description && <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: p.description }}>{p.description}</Text>}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: '#888' }}>기간 경과</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color: timeRate >= 100 ? '#ff4d4f' : '#2E75B6' }}>{timeRate}%</Text>
            </div>
            <Progress percent={timeRate} showInfo={false} size="small" strokeColor={timeRate >= 100 ? '#ff4d4f' : '#2E75B6'} trailColor="#f0f0f0" />
          </div>

          <Tag icon={<CalendarOutlined />} color="default" style={{ fontSize: 11, width: 'fit-content' }}>
            {dayjs(p.startDate).format('YY.MM.DD')} ~ {dayjs(p.endDate).format('YY.MM.DD')}
          </Tag>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            {isAdmin
              ? <Space size={4}><TeamOutlined style={{ color: '#888', fontSize: 12 }} /><Text style={{ fontSize: 12, color: '#888' }}>{mems.length}명</Text></Space>
              : <MemberAvatars members={mems} max={5} />
            }
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RightOutlined style={{ color: '#2E75B6', fontSize: 11 }} />
            </div>
          </div>
        </div>
      </Col>
    );
  };

  const renderRow = (p: ProjectDto) => {
    const cfg  = STATUS_CFG[p.status];
    const dd   = dday(p.endDate);
    const mems = memberMap[p.projectId] ?? [];

    return (
      <div key={p.projectId} onClick={() => navigate(`/wbs/schedule/${p.projectId}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1.5px solid #E8EDF5', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#2E75B6'; el.style.background = '#F8FBFF'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#E8EDF5'; el.style.background = '#fff'; }}>
        <Badge status={cfg.badge} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1F4E79' }}>{p.name}</div>
          {p.description && <Text type="secondary" style={{ fontSize: 12 }} ellipsis>{p.description}</Text>}
        </div>
        <Tag color="default" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {dayjs(p.startDate).format('YY.MM.DD')} ~ {dayjs(p.endDate).format('YY.MM.DD')}
        </Tag>
        {isAdmin
          ? <Space size={4}><TeamOutlined style={{ color: '#888', fontSize: 12 }} /><Text style={{ fontSize: 12, color: '#888' }}>{mems.length}명</Text></Space>
          : <MemberAvatars members={mems} max={4} />
        }
        <Tag style={{ background: dd.color + '15', color: dd.color, border: `1px solid ${dd.color}40`, fontSize: 11, fontWeight: 700 }}>{dd.label}</Tag>
        {canManage && (
          <Dropdown menu={cardMenu(p)} trigger={['click']}>
            <Button size="small" type="text" icon={<MoreOutlined />} style={{ color: '#bbb' }} onClick={e => e.stopPropagation()} />
          </Dropdown>
        )}
        <RightOutlined style={{ color: '#ccc', fontSize: 12 }} />
      </div>
    );
  };

  const summary = [
    { label: '전체',   value: projects.length,                                      color: '#2E75B6' },
    { label: '진행중', value: projects.filter(p => p.status === 'ACTIVE').length,    color: '#1677ff' },
    { label: '완료',   value: projects.filter(p => p.status === 'COMPLETED').length, color: '#52c41a' },
    { label: '중단',   value: projects.filter(p => p.status === 'SUSPENDED').length, color: '#fa8c16' },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>WBS 일정관리</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{user?.displayName}님의 프로젝트 목록 — 카드를 클릭하면 WBS로 이동합니다.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Tooltip title={viewMode === 'card' ? '리스트 보기' : '카드 보기'}>
              <Button icon={viewMode === 'card' ? <UnorderedListOutlined /> : <AppstoreOutlined />}
                onClick={() => setViewMode(v => v === 'card' ? 'list' : 'card')} />
            </Tooltip>
            {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>프로젝트 생성</Button>}
          </Space>
        </Col>
      </Row>

      <Row gutter={8} style={{ marginBottom: 14 }}>
        {summary.map(s => (
          <Col key={s.label}>
            <div style={{ background: '#fff', border: '1.5px solid #E8EDF5', borderRadius: 10, padding: '8px 18px', textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text>
            </div>
          </Col>
        ))}
      </Row>

      <div style={{ background: '#F8F9FF', border: '1px solid #E8EDF5', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} md={10}>
            <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="프로젝트명 또는 설명 검색" allowClear value={keyword} onChange={e => setKeyword(e.target.value)} />
          </Col>
          <Col xs={24} md={8}>
            <Select mode="multiple" style={{ width: '100%' }} placeholder="상태 필터" allowClear maxTagCount={3}
              value={statusFilter} onChange={v => setStatusFilter(v as ProjectStatus[])}
              options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: <Space size={4}><Badge status={v.badge} />{v.label}</Space> }))}
            />
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Space>
              {hasFilter && <Button size="small" type="text" icon={<CloseCircleOutlined />} style={{ color: '#ff4d4f' }} onClick={() => { setKeyword(''); setStatusFilter([]); }}>초기화</Button>}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {hasFilter ? <><b style={{ color: '#2E75B6' }}>{filtered.length}</b>/{projects.length}개</> : <>{projects.length}개</>}
              </Text>
            </Space>
          </Col>
        </Row>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" tip="프로젝트 로딩 중..." /></div>
      ) : filtered.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={hasFilter ? '검색 결과가 없습니다.' : canManage ? '아직 프로젝트가 없습니다.' : '배정된 프로젝트가 없습니다.'}
          style={{ padding: '60px 0' }}>
          {canManage && !hasFilter && <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>프로젝트 생성</Button>}
        </Empty>
      ) : viewMode === 'card' ? (
        <Row gutter={[16, 16]}>{filtered.map(renderCard)}</Row>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{filtered.map(renderRow)}</div>
      )}

      {/* 생성 Wizard */}
      <Modal open={wizardOpen} onCancel={() => setWizardOpen(false)} footer={null} width={640} destroyOnClose
        title={<Space><PlusOutlined style={{ color: '#2E75B6' }} /><span style={{ fontWeight: 700, fontSize: 16 }}>새 프로젝트 생성</span></Space>}>
        <Steps current={wizardStep} size="small" style={{ margin: '16px 0 24px' }}
          items={[{ title: '기본 정보' }, { title: '멤버 선택' }, { title: 'WBS 시작' }]} />

        {wizardStep === 0 && (
          <div>
            <Form form={infoForm} layout="vertical">
              <Form.Item name="name" label="프로젝트명 *" rules={[{ required: true, message: '프로젝트명을 입력하세요' }]}><Input placeholder="예: 수원시 정보화 고도화 사업" size="large" autoFocus /></Form.Item>
              <Form.Item name="description" label="프로젝트 설명"><Input.TextArea rows={2} placeholder="간단한 설명 (선택)" /></Form.Item>
              <Form.Item name="dateRange" label="기간 *" rules={[{ required: true, message: '기간을 선택하세요' }]}><RangePicker style={{ width: '100%' }} placeholder={['시작일', '완료일']} size="large" /></Form.Item>
            </Form>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button type="primary" onClick={goStep1} icon={<ArrowRightOutlined />} iconPosition="end">다음 — 멤버 선택</Button>
            </div>
          </div>
        )}

        {wizardStep === 1 && (
          <div>
            <Alert type="info" showIcon style={{ marginBottom: 12 }}
              message={<Text style={{ fontSize: 12 }}>프로젝트 멤버를 선택하세요. <b>{user?.displayName}</b>님은 자동으로 PM으로 등록됩니다.</Text>} />
            {selUsers.length > 0 && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: '#F0F5FF', borderRadius: 8, border: '1px solid #BDD7EE' }}>
                <Text style={{ fontSize: 12, color: '#2E75B6', fontWeight: 600 }}>선택됨 ({selUsers.length}명)</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {selUsers.map(uid => { const u = allUsers.find(x => x.userId === uid); if (!u) return null; return (<Tag key={uid} closable onClose={() => setSelUsers(prev => prev.filter(x => x !== uid))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Avatar size={14} style={{ background: '#2E75B6', fontSize: 10 }}>{u.displayName[0]}</Avatar>{u.displayName}</Tag>); })}
                </div>
              </div>
            )}
            <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="이름 / 아이디 / 부서 검색" allowClear value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
              {filteredWizardUsers.length === 0
                ? <div style={{ textAlign: 'center', padding: 24, color: '#aaa', fontSize: 13 }}>검색 결과 없음</div>
                : filteredWizardUsers.map(u => { const checked = selUsers.includes(u.userId); const roleCfg = ROLE_CFG[u.userRole]; return (<div key={u.userId} onClick={() => setSelUsers(prev => checked ? prev.filter(x => x !== u.userId) : [...prev, u.userId])} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', background: checked ? '#F0F5FF' : 'transparent' }}><Checkbox checked={checked} /><Avatar size={32} style={{ background: checked ? '#2E75B6' : '#ccc', flexShrink: 0 }}>{u.displayName[0]}</Avatar><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{u.displayName}<Tag color={roleCfg.color} style={{ marginLeft: 6, fontSize: 10 }}>{roleCfg.label}</Tag></div><div style={{ fontSize: 11, color: '#999' }}>@{u.username}{u.department ? ` · ${u.department}` : ''}</div></div>{checked && <CheckCircleOutlined style={{ color: '#2E75B6', fontSize: 16 }} />}</div>); })
              }
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setWizardStep(0)}>이전</Button>
              <Button type="primary" onClick={() => setWizardStep(2)} icon={<ArrowRightOutlined />} iconPosition="end">다음 — WBS 시작</Button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div>
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={12}><div onClick={() => setWbsMode('template')} style={{ border: `2px solid ${wbsMode === 'template' ? '#2E75B6' : '#e8e8e8'}`, borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'center', background: wbsMode === 'template' ? '#EBF4FF' : '#fff', transition: 'all 0.15s' }}><AppstoreAddOutlined style={{ fontSize: 32, color: wbsMode === 'template' ? '#2E75B6' : '#bbb', display: 'block', margin: '0 auto 8px' }} /><div style={{ fontWeight: 700, fontSize: 14, color: wbsMode === 'template' ? '#2E75B6' : '#333' }}>템플릿으로 시작</div><div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>미리 만들어진 WBS 구조 적용</div></div></Col>
              <Col span={12}><div onClick={() => { setWbsMode('manual'); setSelTpl(null); }} style={{ border: `2px solid ${wbsMode === 'manual' ? '#52c41a' : '#e8e8e8'}`, borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'center', background: wbsMode === 'manual' ? '#F6FFED' : '#fff', transition: 'all 0.15s' }}><FileAddOutlined style={{ fontSize: 32, color: wbsMode === 'manual' ? '#52c41a' : '#bbb', display: 'block', margin: '0 auto 8px' }} /><div style={{ fontWeight: 700, fontSize: 14, color: wbsMode === 'manual' ? '#52c41a' : '#333' }}>직접 등록</div><div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>빈 프로젝트로 시작</div></div></Col>
            </Row>
            {wbsMode === 'template' && (<><Divider style={{ margin: '0 0 14px' }}>템플릿 선택</Divider><Row gutter={[10, 10]}>{TEMPLATES.map(tpl => (<Col span={8} key={tpl.key}><div onClick={() => setSelTpl(tpl.key)} style={{ border: selTpl === tpl.key ? `2px solid ${tpl.border}` : '1px solid #e8e8e8', background: selTpl === tpl.key ? tpl.color : '#fff', borderRadius: 10, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: selTpl === tpl.key ? `0 2px 10px ${tpl.border}40` : 'none' }}>{selTpl === tpl.key && <div style={{ color: tpl.border, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>✓ 선택됨</div>}<div style={{ marginBottom: 6 }}>{tpl.icon}</div><div style={{ fontWeight: 700, fontSize: 13, color: selTpl === tpl.key ? tpl.border : '#333', marginBottom: 4 }}>{tpl.title}</div><div style={{ fontSize: 10, color: '#888', marginBottom: 6, lineHeight: 1.5 }}>{tpl.desc}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginBottom: 4 }}>{tpl.tags.map(t => <Tag key={t} style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>{t}</Tag>)}</div><div style={{ fontSize: 11, color: tpl.border, fontWeight: 600 }}>📋 {tpl.count}개 작업</div></div></Col>))}</Row></>)}
            {wbsMode === 'manual' && (<Alert type="success" showIcon message="직접 등록으로 시작합니다." description="생성 후 WBS 페이지에서 작업을 직접 추가하거나 나중에 템플릿을 적용할 수 있습니다." />)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setWizardStep(1)}>이전</Button>
              <Button type="primary" loading={wizardSaving} disabled={!wbsMode || (wbsMode === 'template' && !selTpl)} onClick={handleCreate} icon={<CheckCircleOutlined />}>
                {wbsMode === 'template' && selTpl ? `"${TEMPLATES.find(t => t.key === selTpl)?.title}" 템플릿으로 생성` : wbsMode === 'manual' ? '빈 프로젝트로 생성' : '방식을 선택하세요'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 수정 Modal */}
      <Modal title={<><EditOutlined style={{ color: '#2E75B6', marginRight: 8 }} />프로젝트 수정{editTarget && <Tag color="blue" style={{ marginLeft: 8 }}>{editTarget.name}</Tag>}</>}
        open={editOpen} onCancel={() => setEditOpen(false)}
        footer={editTab === 'info' ? [<Button key="cancel" onClick={() => setEditOpen(false)}>취소</Button>, <Button key="save" type="primary" loading={editSaving} onClick={() => editForm.submit()}>저장</Button>] : [<Button key="close" onClick={() => setEditOpen(false)}>닫기</Button>]}
        destroyOnClose width={560}>
        <Tabs activeKey={editTab} onChange={setEditTab} style={{ marginTop: 8 }}
          items={[
            { key: 'info', label: '기본 정보', children: (
              <Form form={editForm} layout="vertical" onFinish={handleEdit}>
                <Form.Item name="name" label="프로젝트명 *" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="description" label="설명"><Input.TextArea rows={2} /></Form.Item>
                <Form.Item name="dateRange" label="기간 *" rules={[{ required: true }]}><RangePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="status" label="상태"><Select options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: <Space size={4}><Badge status={v.badge} />{v.label}</Space> }))} /></Form.Item>
              </Form>
            )},
            { key: 'members', label: `멤버 관리 (${editMembers.length}명)`, children: (
              <div>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>현재 멤버 ({editMembers.length}명)</Text>
                {editMembers.length === 0
                  ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="등록된 멤버가 없습니다" style={{ marginBottom: 16 }} />
                  : <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>{editMembers.map((m, i) => (<div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: i < editMembers.length - 1 ? '1px solid #f5f5f5' : 'none' }}><Avatar size={30} style={{ background: MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length], fontSize: 12, flexShrink: 0 }}>{m.displayName[0]}</Avatar><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.displayName}</div><div style={{ fontSize: 11, color: '#999' }}>@{m.username}</div></div><Select size="small" value={m.role} style={{ width: 110 }} onChange={v => handleChangeRole(m.userId, v as ProjectRole)} options={Object.entries(PROJECT_ROLE_CFG).map(([k, v]) => ({ value: k, label: v.label }))} /><Tooltip title="멤버 제거"><Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={() => Modal.confirm({ title: `"${m.displayName}"을 제거하시겠습니까?`, okText: '제거', cancelText: '취소', okButtonProps: { danger: true }, onOk: () => handleRemoveMember(m.userId) })} /></Tooltip></div>))}</div>
                }
                <Divider style={{ margin: '12px 0' }}>+ 멤버 추가</Divider>
                <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="이름 / 아이디 / 부서 검색" allowClear value={editUserSearch} onChange={e => setEditUserSearch(e.target.value)} style={{ marginBottom: 8 }} />
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  {filteredEditUsers.length === 0
                    ? <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 12 }}>{editUserSearch ? '검색 결과 없음' : '추가 가능한 사용자가 없습니다'}</div>
                    : filteredEditUsers.map(u => { const roleCfg = ROLE_CFG[u.userRole]; return (<div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}><Avatar size={28} style={{ background: '#bbb', fontSize: 11, flexShrink: 0 }}>{u.displayName[0]}</Avatar><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{u.displayName}<Tag color={roleCfg.color} style={{ marginLeft: 6, fontSize: 10 }}>{roleCfg.label}</Tag></div><div style={{ fontSize: 11, color: '#999' }}>@{u.username}{u.department ? ` · ${u.department}` : ''}</div></div><Button size="small" type="primary" ghost icon={<UserAddOutlined />} loading={editMemberSaving} onClick={() => handleAddMember(u.userId)}>추가</Button></div>); })
                  }
                </div>
              </div>
            )},
          ]}
        />
      </Modal>
    </div>
  );
};

export default ProjectListPage;
