import React, { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Space, Typography, Tag, Form, Input,
  Select, message, Popconfirm, Row, Col, Drawer,
  Divider, Badge, Tooltip, Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  BankOutlined, ReloadOutlined, SearchOutlined,
  CloseCircleOutlined, EnvironmentOutlined,
  MailOutlined, PhoneOutlined, CheckCircleOutlined,
  StopOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { orgApi } from '@/api';
import type { OrgDto } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const apiErr = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류 발생';

// 지역 목록 (검색 Select용)
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

interface SearchState { keyword: string; region: string; active: string; }
const INIT_SEARCH: SearchState = { keyword: '', region: '', active: '' };

// KPI 색상
const KPI_PALETTE = {
  all:      { main: '#2E75B6' },
  active:   { main: '#52c41a' },
  inactive: { main: '#aaa'    },
};

const KpiCard: React.FC<{
  label: string; value: number; active: boolean;
  colorKey: keyof typeof KPI_PALETTE; icon: React.ReactNode; onClick: () => void;
}> = ({ label, value, active, colorKey, icon, onClick }) => {
  const { main } = KPI_PALETTE[colorKey];
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
      <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2 }}>{label}</div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════ */
const OrgManagementPage: React.FC = () => {
  const [orgs,     setOrgs]     = useState<OrgDto[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [addOpen,  setAddOpen]  = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrg,  setEditOrg]  = useState<OrgDto | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [addForm]  = Form.useForm<Partial<OrgDto>>();
  const [editForm] = Form.useForm<Partial<OrgDto>>();
  const [search,   setSearch]   = useState<SearchState>(INIT_SEARCH);

  const load = () => {
    setLoading(true);
    orgApi.findAll()
      .then(setOrgs)
      .catch(() => message.error('데이터 로드 실패'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  /* ── 필터링 ── */
  const filtered = useMemo(() => orgs.filter(o => {
    if (search.keyword) {
      const kw = search.keyword.toLowerCase();
      if (![o.name, o.region ?? '', o.contactEmail ?? '', o.notes ?? '']
        .some(v => v.toLowerCase().includes(kw))) return false;
    }
    if (search.region && o.region !== search.region) return false;
    if (search.active === 'true'  && !o.active) return false;
    if (search.active === 'false' &&  o.active) return false;
    return true;
  }), [orgs, search]);

  const hasFilter = !!(search.keyword || search.region || search.active);

  /* ── KPI 카드 ── */
  const isAllActive      = !hasFilter;
  const isActiveFilter   = search.active === 'true'  && !search.keyword && !search.region;
  const isInactiveFilter = search.active === 'false' && !search.keyword && !search.region;

  const kpiCards = [
    { key: 'all' as const,      label: '전체',   icon: <BankOutlined />,         value: orgs.length,                       active: isAllActive,      onClick: () => setSearch(INIT_SEARCH) },
    { key: 'active' as const,   label: '운영 중', icon: <CheckCircleOutlined />,  value: orgs.filter(o => o.active).length, active: isActiveFilter,   onClick: () => isActiveFilter   ? setSearch(INIT_SEARCH) : setSearch({ keyword: '', region: '', active: 'true' }) },
    { key: 'inactive' as const, label: '비활성',  icon: <StopOutlined />,         value: orgs.filter(o => !o.active).length, active: isInactiveFilter, onClick: () => isInactiveFilter ? setSearch(INIT_SEARCH) : setSearch({ keyword: '', region: '', active: 'false' }) },
  ];

  /* ── CRUD ── */
  const handleCreate = async (v: Partial<OrgDto>) => {
    setSaving(true);
    try {
      await orgApi.create(v);
      message.success(`✅ "${v.name}" 등록 완료`);
      setAddOpen(false); addForm.resetFields(); load();
    } catch (e) { message.error(apiErr(e)); }
    finally { setSaving(false); }
  };

  const openEdit = (o: OrgDto) => {
    setEditOrg(o);
    editForm.setFieldsValue({
      name: o.name, region: o.region ?? '',
      contactEmail: o.contactEmail ?? '', contactPhone: o.contactPhone ?? '',
      notes: o.notes ?? '', active: o.active,
    });
    setEditOpen(true);
  };

  const handleEdit = async (v: Partial<OrgDto>) => {
    if (!editOrg) return;
    setSaving(true);
    try {
      await orgApi.update(editOrg.orgId!, v);
      message.success('✅ 수정 완료');
      setEditOpen(false); load();
    } catch (e) { message.error(apiErr(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (o: OrgDto) => {
    try {
      await orgApi.delete(o.orgId!);
      message.success(`"${o.name}" 비활성 처리 완료`);
      load();
    } catch (e) { message.error(apiErr(e)); }
  };

  /* ── 지역 목록 (실제 데이터 기반) ── */
  const regionOptions = useMemo(() => {
    const fromData = [...new Set(orgs.map(o => o.region).filter(Boolean) as string[])].sort();
    return [...new Set([...fromData, ...REGIONS])].sort();
  }, [orgs]);

  /* ── 테이블 컬럼 ── */
  const columns: ColumnsType<OrgDto> = [
    {
      title: '지자체명', key: 'name', width: 200, fixed: 'left',
      sorter: (a, b) => a.name.localeCompare(b.name, 'ko'),
      showSorterTooltip: { title: '이름 정렬' },
      render: (_, r) => (
        <Space>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: r.active ? '#E6F4FF' : '#f5f5f5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BankOutlined style={{ color: r.active ? '#2E75B6' : '#ccc', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: '#999' }}>ID: {r.orgId}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '지역', dataIndex: 'region', key: 'region', width: 90,
      sorter: (a, b) => (a.region ?? '').localeCompare(b.region ?? '', 'ko'),
      showSorterTooltip: { title: '지역 정렬' },
      render: v => v
        ? <Tag icon={<EnvironmentOutlined />} color="geekblue">{v}</Tag>
        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
    {
      title: '담당자 이메일', dataIndex: 'contactEmail', key: 'email', width: 210,
      sorter: (a, b) => (a.contactEmail ?? '').localeCompare(b.contactEmail ?? ''),
      showSorterTooltip: { title: '이메일 정렬' },
      render: v => v
        ? <Space size={4}><MailOutlined style={{ color: '#888', fontSize: 11 }} /><Text style={{ fontSize: 12 }}>{v}</Text></Space>
        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
    {
      title: '연락처', dataIndex: 'contactPhone', key: 'phone', width: 130,
      sorter: (a, b) => (a.contactPhone ?? '').localeCompare(b.contactPhone ?? ''),
      showSorterTooltip: { title: '연락처 정렬' },
      render: v => v
        ? <Space size={4}><PhoneOutlined style={{ color: '#888', fontSize: 11 }} /><Text style={{ fontSize: 12 }}>{v}</Text></Space>
        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
    {
      title: '비고', dataIndex: 'notes', key: 'notes', width: 180,
      render: v => v
        ? <Tooltip title={v}><Space size={4}><FileTextOutlined style={{ color: '#aaa', fontSize: 11 }} /><Text style={{ fontSize: 12, maxWidth: 150 }} ellipsis>{v}</Text></Space></Tooltip>
        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
    {
      title: '상태', dataIndex: 'active', key: 'active', width: 80, align: 'center' as const,
      sorter: (a, b) => (a.active ? 1 : 0) - (b.active ? 1 : 0),
      showSorterTooltip: { title: '상태 정렬' },
      render: v => v
        ? <Badge status="success" text="운영 중" />
        : <Badge status="default" text="비활성" />,
    },
    {
      title: '액션', key: 'action', width: 90, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="수정">
            <Button size="small" icon={<EditOutlined />} type="primary" ghost onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title={<><b>"{r.name}"</b>을 비활성 처리하시겠습니까?<br />
              <span style={{ fontSize: 12, color: '#888' }}>연결된 고객사 계정은 유지됩니다.</span></>}
            onConfirm={() => handleDelete(r)} okText="비활성" cancelText="취소"
            okButtonProps={{ danger: true }} disabled={!r.active}>
            <Tooltip title={r.active ? '비활성 처리' : '이미 비활성'}>
              <Button size="small" icon={<DeleteOutlined />} danger ghost disabled={!r.active} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ── 지역별 분포 미니 통계 ── */
  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    orgs.filter(o => o.active && o.region).forEach(o => {
      map[o.region!] = (map[o.region!] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [orgs]);

  return (
    <div>
      {/* 헤더 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>지자체 관리</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>고객사 지자체 등록 및 연락처를 관리합니다.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
              지자체 등록
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPI 카드 */}
      <Row gutter={8} style={{ marginBottom: 14 }} align="middle">
        {kpiCards.map(c => (
          <Col key={c.key}>
            <KpiCard label={c.label} value={c.value} active={c.active}
              colorKey={c.key} icon={c.icon} onClick={c.onClick} />
          </Col>
        ))}
        {/* 지역별 분포 미니 뱃지 */}
        {regionStats.length > 0 && (
          <Col flex="auto">
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #E8EDF5' }}
              styles={{ body: { padding: '8px 14px' } }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>지역별 운영</Text>
              <Space size={4} wrap>
                {regionStats.map(([region, cnt]) => (
                  <Tag
                    key={region} color="geekblue" style={{ cursor: 'pointer', fontSize: 11 }}
                    onClick={() => setSearch(s => ({ ...s, region: s.region === region ? '' : region }))}>
                    {region} {cnt}
                  </Tag>
                ))}
              </Space>
            </Card>
          </Col>
        )}
      </Row>

      {/* 검색 필터 */}
      <div style={{
        background: '#F8F9FF', border: '1px solid #E8EDF5',
        borderRadius: 10, padding: '14px 16px', marginBottom: 14,
      }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} md={9}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="기관명 · 이메일 · 비고 검색"
              allowClear value={search.keyword}
              onChange={e => setSearch(s => ({ ...s, keyword: e.target.value }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              style={{ width: '100%' }} placeholder="지역 선택"
              allowClear value={search.region || undefined}
              onChange={v => setSearch(s => ({ ...s, region: v ?? '' }))}
              showSearch
              options={regionOptions.map(r => ({ value: r, label: r }))}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              style={{ width: '100%' }} placeholder="상태 필터"
              allowClear value={search.active || undefined}
              onChange={v => setSearch(s => ({ ...s, active: v ?? '' }))}
              options={[
                { value: 'true',  label: <><Badge status="success" /> 운영 중</> },
                { value: 'false', label: <><Badge status="default" /> 비활성</> },
              ]}
            />
          </Col>
          <Col xs={24} md={4} style={{ textAlign: 'right' }}>
            <Space>
              {hasFilter && (
                <Tooltip title="필터 초기화">
                  <Button size="small" type="text" icon={<CloseCircleOutlined />}
                    style={{ color: '#ff4d4f' }} onClick={() => setSearch(INIT_SEARCH)} />
                </Tooltip>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {hasFilter
                  ? <><b style={{ color: '#2E75B6' }}>{filtered.length}</b> / {orgs.length}개</>
                  : <>{orgs.length}개</>}
              </Text>
            </Space>
          </Col>
        </Row>

        {/* 활성 필터 태그 */}
        {hasFilter && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {search.keyword && (
              <Tag closable color="blue"
                onClose={() => setSearch(s => ({ ...s, keyword: '' }))}>"{search.keyword}"</Tag>
            )}
            {search.region && (
              <Tag closable color="geekblue" icon={<EnvironmentOutlined />}
                onClose={() => setSearch(s => ({ ...s, region: '' }))}>{search.region}</Tag>
            )}
            {search.active && (
              <Tag closable
                onClose={() => setSearch(s => ({ ...s, active: '' }))}>
                {search.active === 'true' ? '운영 중' : '비활성'}
              </Tag>
            )}
          </div>
        )}
      </div>

      {/* 테이블 */}
      <Table
        dataSource={filtered} columns={columns} rowKey="orgId" loading={loading}
        size="small" scroll={{ x: 1000 }}
        pagination={{ pageSize: 15, showTotal: t => `총 ${t}개`, showSizeChanger: false }}
        rowClassName={r => !r.active ? 'org-row-inactive' : ''}
        locale={{ emptyText: hasFilter ? '검색 결과가 없습니다.' : '등록된 지자체가 없습니다.' }}
        showSorterTooltip={false}
      />

      {/* 지자체 등록 Drawer */}
      <Drawer
        title={<><PlusOutlined style={{ color: '#2E75B6', marginRight: 8 }} />지자체 등록</>}
        open={addOpen} onClose={() => setAddOpen(false)} width={480} destroyOnClose
        footer={<div style={{ textAlign: 'right' }}><Space>
          <Button onClick={() => setAddOpen(false)}>취소</Button>
          <Button type="primary" loading={saving} onClick={() => addForm.submit()}>등록</Button>
        </Space></div>}>
        <Form form={addForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="기관명 *" rules={[{ required: true, message: '기관명을 입력하세요.' }]}>
            <Input prefix={<BankOutlined />} placeholder="예: 수원시청" autoFocus />
          </Form.Item>
          <Form.Item name="region" label="지역">
            <Select placeholder="지역 선택" showSearch allowClear
              options={REGIONS.map(r => ({ value: r, label: r }))} />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="contactEmail" label="담당자 이메일"
                rules={[{ type: 'email', message: '올바른 이메일 형식이 아닙니다.' }]}>
                <Input prefix={<MailOutlined />} placeholder="예: cs@suwon.go.kr" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPhone" label="연락처">
                <Input prefix={<PhoneOutlined />} placeholder="예: 031-1234-5678" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="비고">
            <TextArea rows={3} placeholder="특이사항, 담당부서 등 메모" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 지자체 수정 Drawer */}
      <Drawer
        title={<Space><EditOutlined style={{ color: '#2E75B6' }} />지자체 수정
          {editOrg && <Tag color="geekblue">{editOrg.name}</Tag>}
        </Space>}
        open={editOpen} onClose={() => setEditOpen(false)} width={480} destroyOnClose
        footer={<div style={{ textAlign: 'right' }}><Space>
          <Button onClick={() => setEditOpen(false)}>취소</Button>
          <Button type="primary" loading={saving} onClick={() => editForm.submit()}>저장</Button>
        </Space></div>}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="기관명 *" rules={[{ required: true }]}>
            <Input prefix={<BankOutlined />} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="region" label="지역">
                <Select placeholder="지역 선택" showSearch allowClear
                  options={REGIONS.map(r => ({ value: r, label: r }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="active" label="상태">
                <Select options={[
                  { value: true,  label: <><Badge status="success" /> 운영 중</> },
                  { value: false, label: <><Badge status="default" /> 비활성</> },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="contactEmail" label="담당자 이메일"
                rules={[{ type: 'email', message: '올바른 이메일 형식이 아닙니다.' }]}>
                <Input prefix={<MailOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPhone" label="연락처">
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="비고">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>

      <style>{`.org-row-inactive td { opacity: 0.45; }`}</style>
    </div>
  );
};

export default OrgManagementPage;
