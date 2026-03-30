import React, { useEffect, useState } from 'react';
import {
  Table, Button, Space, Typography, Tag, message, Popconfirm,
  Row, Col, Card, Drawer, Form, Input, Select, Avatar, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, TeamOutlined, ReloadOutlined } from '@ant-design/icons';
import { teamApi, projectApi, userApi } from '@/api';
import type { TeamDto, ProjectDto, UserDto } from '@/types';

const { Title, Text } = Typography;

const COLORS = [
  { label: 'SCM1 블루',  value: '#2E75B6' },
  { label: 'SCM2 남색',  value: '#4472C4' },
  { label: 'SP 그린',    value: '#70AD47' },
  { label: 'MPM 오렌지', value: '#ED7D31' },
  { label: 'IPM 퍼플',   value: '#7030A0' },
  { label: '레드',        value: '#C00000' },
  { label: '청록',        value: '#00B0F0' },
  { label: '골드',        value: '#FFC000' },
  { label: '다크',        value: '#404040' },
];

const apiErr = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류 발생';

const TeamManagementPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [project,  setProject]  = useState<ProjectDto | null>(null);
  const [teams,    setTeams]    = useState<TeamDto[]>([]);
  const [allUsers, setAllUsers] = useState<UserDto[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [addOpen,  setAddOpen]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form]     = Form.useForm();

  useEffect(() => {
    Promise.all([projectApi.findAll(), userApi.findAll()])
      .then(([p, u]) => { setProjects(p); setAllUsers(u); if (p.length) setProject(p[0]); })
      .catch(() => message.error('데이터 로드 실패'));
  }, []);

  const loadTeams = (pid: number) => {
    setLoading(true);
    teamApi.getTeams(pid)
      .then(setTeams)
      .catch(() => message.error('팀 로드 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (project) loadTeams(project.projectId); }, [project]);

  const handleAdd = async (v: { name: string; color: string; leadUserId?: number }) => {
    if (!project) return;
    setSaving(true);
    try {
      await teamApi.createTeam(project.projectId, v);
      message.success(`✅ ${v.name} 팀 생성 완료`);
      setAddOpen(false); form.resetFields();
      loadTeams(project.projectId);
    } catch (e) { message.error(apiErr(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: TeamDto) => {
    if (!project) return;
    try {
      await teamApi.deleteTeam(project.projectId, t.teamId);
      message.success(`${t.name} 팀 삭제 완료`);
      loadTeams(project.projectId);
    } catch (e) { message.error(apiErr(e)); }
  };

  // 팀장 가능한 사용자 (TEAM_LEAD, PM)
  const leads = allUsers.filter(u =>
    u.status === 'ACTIVE' && ['SYSTEM_ADMIN', 'PM', 'TEAM_LEAD'].includes(u.userRole)
  );

  const columns: ColumnsType<TeamDto> = [
    {
      title: '팀', key: 'team', width: 220,
      render: (_, r) => (
        <Space>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: r.color ?? '#2E75B6', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TeamOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: r.color ?? '#888' }}>{r.color}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '팀장', key: 'lead', width: 160,
      render: (_, r) => r.leadDisplayName
        ? <Space>
            <Avatar size={24} style={{ background: r.color ?? '#2E75B6', fontSize: 11 }}>{r.leadDisplayName[0]}</Avatar>
            <Text style={{ fontSize: 13 }}>{r.leadDisplayName}</Text>
          </Space>
        : <Text type="secondary" style={{ fontSize: 12 }}>미지정</Text>,
    },
    {
      title: '색상', key: 'color', width: 140,
      render: (_, r) => (
        <Space>
          <div style={{ width: 50, height: 10, borderRadius: 5, background: r.color ?? '#ccc' }} />
          <Text style={{ fontSize: 11, color: '#888' }}>{r.color}</Text>
        </Space>
      ),
    },
    {
      title: '액션', key: 'action', width: 80, align: 'center',
      render: (_, r) => (
        <Popconfirm title={`"${r.name}" 팀을 삭제하시겠습니까?`}
          onConfirm={() => handleDelete(r)} okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}>
          <Button size="small" danger ghost icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>팀 관리</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>프로젝트별 팀을 구성합니다. 팀원/팀장 권한은 사용자 관리에서 설정하세요.</Text>
        </Col>
        <Col>
          <Space>
            <Select style={{ width: 240 }} placeholder="프로젝트 선택"
              value={project?.projectId}
              onChange={v => setProject(projects.find(p => p.projectId === v) ?? null)}
              options={projects.map(p => ({ value: p.projectId, label: p.name }))} />
            <Button icon={<ReloadOutlined />} onClick={() => project && loadTeams(project.projectId)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setAddOpen(true); }}>
              팀 추가
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPI */}
      <Row gutter={8} style={{ marginBottom: 14 }}>
        <Col>
          <div style={{ background: '#FAFBFF', border: '1px solid #E8EDF5', borderLeft: '4px solid #1F4E79', borderRadius: 8, padding: '6px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1F4E79' }}>{teams.length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>전체 팀</Text>
          </div>
        </Col>
        {/* 팀 색상 미리보기 */}
        {teams.map(t => (
          <Col key={t.teamId}>
            <div style={{
              background: `${t.color}15`, border: `2px solid ${t.color}`,
              borderRadius: 8, padding: '6px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.color }}>{t.name}</div>
              <Text style={{ fontSize: 11, color: t.color }}>{t.leadDisplayName ?? '팀장 미지정'}</Text>
            </div>
          </Col>
        ))}
      </Row>

      <Table dataSource={teams} columns={columns} rowKey="teamId"
        loading={loading} size="small" pagination={false}
        locale={{ emptyText: <Empty description="팀이 없습니다. 팀 추가 버튼으로 생성하세요." /> }} />

      {/* 팀 카드 */}
      {teams.length > 0 && (
        <Row gutter={[14, 14]} style={{ marginTop: 24 }}>
          {teams.map(t => (
            <Col key={t.teamId} xs={24} sm={12} md={8} lg={6}>
              <Card
                styles={{ body: { padding: 0 } }}
                style={{ borderRadius: 12, overflow: 'hidden', border: `2px solid ${t.color ?? '#E8EDF5'}` }}>
                <div style={{ background: t.color ?? '#2E75B6', padding: '16px 18px' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{t.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>팀</div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {t.leadDisplayName
                    ? <Space>
                        <Avatar size={22} style={{ background: t.color ?? '#2E75B6', fontSize: 11 }}>{t.leadDisplayName[0]}</Avatar>
                        <Text style={{ fontSize: 13 }}>팀장: <b>{t.leadDisplayName}</b></Text>
                      </Space>
                    : <Text type="secondary" style={{ fontSize: 12 }}>팀장 미지정</Text>
                  }
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ════ 팀 추가 Drawer ════ */}
      <Drawer title={<><PlusOutlined style={{ color: '#2E75B6', marginRight: 8 }} />팀 추가</>}
        open={addOpen} onClose={() => setAddOpen(false)} width={400} destroyOnClose
        footer={<div style={{ textAlign: 'right' }}><Space>
          <Button onClick={() => setAddOpen(false)}>취소</Button>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>추가</Button>
        </Space></div>}>
        <Form form={form} layout="vertical" onFinish={handleAdd} initialValues={{ color: '#2E75B6' }}>
          <Form.Item name="name" label="팀명 *" rules={[{ required: true, message: '팀명을 입력하세요' }]}>
            <Input placeholder="예: SCM1, SCM2, SP, MPM, IPM" size="large" autoFocus />
          </Form.Item>
          <Form.Item name="color" label="팀 색상">
            <Select>
              {COLORS.map(c => (
                <Select.Option key={c.value} value={c.value}>
                  <Space>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: c.value }} />
                    {c.label}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="leadUserId" label="팀장 지정 (선택)">
            <Select allowClear placeholder="팀장 선택" showSearch optionFilterProp="label"
              options={leads.map(u => ({
                value: u.userId,
                label: `${u.displayName} (@${u.username})`,
              }))} />
          </Form.Item>
          {/* 미리보기 */}
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const color = getFieldValue('color') || '#2E75B6';
              const name  = getFieldValue('name') || '팀명';
              return (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>미리보기</Text>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    background: `${color}18`, border: `2px solid ${color}`,
                    borderRadius: 12, padding: '10px 20px',
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TeamOutlined style={{ color: '#fff', fontSize: 16 }} />
                    </div>
                    <Text style={{ fontWeight: 700, fontSize: 18, color }}>{name}</Text>
                  </div>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default TeamManagementPage;
