import React, { useEffect, useState } from 'react';
import {
  Table, Select, Button, Typography, Tag, Space, message,
  Row, Col, Card, Tooltip, Drawer, Form, Avatar, Popconfirm,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SafetyCertificateOutlined, PlusOutlined, UserOutlined,
  DeleteOutlined, ReloadOutlined, CrownOutlined,
  TeamOutlined, EyeOutlined,
} from '@ant-design/icons';
import { projectApi, userApi, memberApi } from '@/api';
import type { ProjectDto, UserDto, ProjectMemberDto, ProjectRole } from '@/types';

const { Title, Text } = Typography;

const ROLE_CFG: Record<ProjectRole, { color: string; label: string; desc: string }> = {
  PROJECT_MANAGER: { color: 'purple', label: 'PM',      desc: 'WBS 전체 편집 · 팀 관리' },
  TEAM_LEAD:       { color: 'blue',   label: '팀장',    desc: '팀 작업 편집 · 진척 관리' },
  DEVELOPER:       { color: 'cyan',   label: '팀원',    desc: '담당 작업 진척 입력' },
  VIEWER:          { color: 'green',  label: '열람자',  desc: '조회만 가능 (고객사용)' },
  REPORTER:        { color: 'orange', label: '보고담당', desc: '리포트 생성 권한' },
};

const apiErr = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류 발생';

const PermissionPage: React.FC = () => {
  const [projects,  setProjects]  = useState<ProjectDto[]>([]);
  const [project,   setProject]   = useState<ProjectDto | null>(null);
  const [members,   setMembers]   = useState<ProjectMemberDto[]>([]);
  const [allUsers,  setAllUsers]  = useState<UserDto[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [addOpen,   setAddOpen]   = useState(false);
  const [addForm]   = Form.useForm<{ userId: number; role: ProjectRole }>();
  const [saving,    setSaving]    = useState(false);

  // ── 초기 로드 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([projectApi.findAll(), userApi.findAll()]).then(([p, u]) => {
      setProjects(p);
      setAllUsers(u);
      if (p.length) setProject(p[0]);
    });
  }, []);

  const loadMembers = (pid: number) => {
    setLoading(true);
    memberApi.getMembers(pid)
      .then(setMembers)
      .catch(() => message.error('멤버 로드 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (project) loadMembers(project.projectId); }, [project]);

  // ── 멤버 추가 ────────────────────────────────────────────────────────────────
  const handleAdd = async (v: { userId: number; role: ProjectRole }) => {
    if (!project) return;
    setSaving(true);
    try {
      await memberApi.addMember(project.projectId, v.userId, v.role);
      message.success('✅ 멤버 추가 완료');
      setAddOpen(false); addForm.resetFields();
      loadMembers(project.projectId);
    } catch (e) { message.error(apiErr(e)); }
    finally { setSaving(false); }
  };

  // ── 권한 변경 ────────────────────────────────────────────────────────────────
  const handleRoleChange = async (userId: number, role: ProjectRole) => {
    if (!project) return;
    try {
      await memberApi.changeRole(project.projectId, userId, role);
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m));
      message.success('권한 변경 완료');
    } catch (e) { message.error(apiErr(e)); }
  };

  // ── 멤버 제거 ────────────────────────────────────────────────────────────────
  const handleRemove = async (userId: number) => {
    if (!project) return;
    try {
      await memberApi.removeMember(project.projectId, userId);
      message.success('프로젝트에서 제외되었습니다.');
      loadMembers(project.projectId);
    } catch (e) { message.error(apiErr(e)); }
  };

  // ── 컬럼 ─────────────────────────────────────────────────────────────────────
  const notYetMembers = allUsers.filter(u => !members.find(m => m.userId === u.userId));

  const columns: ColumnsType<ProjectMemberDto> = [
    {
      title: '사용자', key: 'user', width: 220,
      render: (_, r) => (
        <Space>
          <Avatar size={32} style={{ background: '#2E75B6' }}>{r.displayName[0]}</Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.displayName}</div>
            <div style={{ fontSize: 11, color: '#999' }}>@{r.username}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '이메일', dataIndex: 'email', key: 'email', width: 220,
      render: v => <Text style={{ fontSize: 12, color: '#666' }}>{v}</Text>,
    },
    {
      title: '현재 역할', key: 'roleTag', width: 120,
      render: (_, r) => {
        const c = ROLE_CFG[r.role];
        return <Tooltip title={c.desc}><Tag color={c.color}>{c.label}</Tag></Tooltip>;
      },
    },
    {
      title: '역할 변경', key: 'roleChange', width: 180,
      render: (_, r) => (
        <Select value={r.role} size="small" style={{ width: 160 }}
          onChange={v => handleRoleChange(r.userId, v as ProjectRole)}
          options={Object.entries(ROLE_CFG).map(([k, v]) => ({
            value: k,
            label: <Space size={4}><Tag color={v.color} style={{ margin: 0 }}>{v.label}</Tag><span style={{ fontSize: 11, color: '#888' }}>{v.desc}</span></Space>,
          }))} />
      ),
    },
    {
      title: '액션', key: 'action', width: 80, align: 'center',
      render: (_, r) => (
        <Popconfirm title={`"${r.displayName}"을 이 프로젝트에서 제외하시겠습니까?`}
          onConfirm={() => handleRemove(r.userId)} okText="제외" cancelText="취소" okButtonProps={{ danger: true }}>
          <Button size="small" danger ghost icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>권한 관리</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>프로젝트별 사용자 역할(RBAC)을 설정합니다.</Text>
        </Col>
        <Col>
          <Space>
            <Select style={{ width: 240 }} placeholder="프로젝트 선택"
              value={project?.projectId}
              onChange={v => setProject(projects.find(p => p.projectId === v) ?? null)}
              options={projects.map(p => ({ value: p.projectId, label: p.name }))} />
            <Button icon={<ReloadOutlined />} onClick={() => project && loadMembers(project.projectId)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
              멤버 추가
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 역할 가이드 */}
      <Row gutter={8} style={{ marginBottom: 14 }}>
        {Object.entries(ROLE_CFG).map(([k, v]) => (
          <Col key={k}>
            <div style={{ background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, padding: '6px 12px' }}>
              <Tag color={v.color} style={{ marginBottom: 3 }}>{v.label}</Tag>
              <div style={{ fontSize: 11, color: '#888' }}>{v.desc}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 현황 카드 */}
      <Row gutter={8} style={{ marginBottom: 14 }}>
        {Object.entries(ROLE_CFG).map(([k, v]) => {
          const cnt = members.filter(m => m.role === k).length;
          return (
            <Col key={k}>
              <Card size="small" style={{ minWidth: 80, textAlign: 'center', borderRadius: 8 }} styles={{ body: { padding: '6px 12px' } }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: cnt ? '#333' : '#ccc' }}>{cnt}</div>
                <Tag color={v.color} style={{ fontSize: 10, margin: 0 }}>{v.label}</Tag>
              </Card>
            </Col>
          );
        })}
      </Row>

      {members.length === 0 && !loading && (
        <Alert type="info" showIcon message="프로젝트에 추가된 멤버가 없습니다. 멤버 추가 버튼으로 사용자를 등록하세요." style={{ marginBottom: 14 }} />
      )}

      <Table dataSource={members} columns={columns} rowKey="userId"
        loading={loading} size="small" pagination={false}
        style={{ borderRadius: 8 }} />

      {/* ── 멤버 추가 Drawer ── */}
      <Drawer
        title={<><PlusOutlined style={{ color: '#2E75B6', marginRight: 8 }} />프로젝트 멤버 추가</>}
        open={addOpen} onClose={() => setAddOpen(false)} width={440} destroyOnClose
        footer={<div style={{ textAlign: 'right' }}><Space>
          <Button onClick={() => setAddOpen(false)}>취소</Button>
          <Button type="primary" loading={saving} onClick={() => addForm.submit()}>추가</Button>
        </Space></div>}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAdd}
          initialValues={{ role: 'DEVELOPER' }}>
          <Form.Item name="userId" label="사용자 선택 *" rules={[{ required: true, message: '사용자를 선택하세요' }]}>
            <Select showSearch placeholder="이름 또는 아이디로 검색" optionFilterProp="label"
              options={notYetMembers.map(u => ({
                value: u.userId,
                label: `${u.displayName} (@${u.username}) — ${u.department ?? ''}`,
              }))}
              notFoundContent={<div style={{ padding: 8, color: '#aaa', fontSize: 12 }}>추가할 수 있는 사용자가 없습니다</div>}
            />
          </Form.Item>
          <Form.Item name="role" label="프로젝트 역할 *" rules={[{ required: true }]}>
            <Select>
              {Object.entries(ROLE_CFG).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  <Tag color={v.color} style={{ marginRight: 6 }}>{v.label}</Tag>{v.desc}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Alert type="info" showIcon style={{ fontSize: 12 }}
            message="고객사(지자체) 계정은 '열람자' 역할로 추가하세요." />
        </Form>
      </Drawer>
    </div>
  );
};

export default PermissionPage;
