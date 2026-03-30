import React, { useEffect, useState } from 'react';
import {
  Row, Col, Select, Typography, Card, Table,
  Tooltip, Space, message, Spin, Progress, Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { projectApi, analysisApi } from '@/api';
import type { ProjectDto } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface AssigneeWorkload {
  userId: number;
  displayName: string;
  taskCount: number;
  totalWorkload: number;
  plannedWorkload: number;
  earnedValue: number;
  planRate: number;
  actualRate: number;
  diff: number;
  tasks: TaskRow[];
}

interface TaskRow {
  taskId: number;
  wbsCode: string;
  taskName: string;
  plannedStart?: string;
  plannedEnd?: string;
  totalWorkload: number;
  planProgress: number;
  actualProgress: number;
}

function heatColor(value: number, max: number): string {
  if (value === 0) return '#f5f5f5';
  const r = Math.min(value / (max || 1), 1);
  if (r < 0.33) return `rgba(46,117,182,${(0.2 + r * 1.5).toFixed(2)})`;
  if (r < 0.66) return `rgba(46,117,182,${(0.5 + r).toFixed(2)})`;
  return `rgba(31,78,121,${(0.6 + r * 0.4).toFixed(2)})`;
}

function buildWeeks(startDate: string, endDate: string): string[] {
  const weeks: string[] = [];
  let cur = dayjs(startDate).startOf('week');
  const end = dayjs(endDate).endOf('week');
  while (!cur.isAfter(end)) {
    weeks.push(cur.format('MM/DD'));
    cur = cur.add(1, 'week');
  }
  return weeks;
}

function weeklyWorkload(tasks: TaskRow[], weekLabel: string, refYear: number): number {
  const ws = dayjs(`${refYear}-${weekLabel}`, 'YYYY-MM/DD');
  const we = ws.add(6, 'day');
  let total = 0;
  tasks.forEach((t) => {
    if (!t.plannedStart || !t.plannedEnd) return;
    const ts = dayjs(t.plannedStart);
    const te = dayjs(t.plannedEnd);
    const os = ts.isAfter(ws) ? ts : ws;
    const oe = te.isBefore(we) ? te : we;
    const days = oe.diff(os, 'day') + 1;
    if (days > 0) {
      const totalDays = Math.max(te.diff(ts, 'day') + 1, 1);
      total += (t.totalWorkload * days) / totalDays;
    }
  });
  return Math.round(total * 10) / 10;
}

const WorkloadPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selected, setSelected] = useState<ProjectDto | null>(null);
  const [workloads, setWorkloads] = useState<AssigneeWorkload[]>([]);
  const [loading, setLoading] = useState(false);
  const [weeks, setWeeks] = useState<string[]>([]);

  useEffect(() => {
    projectApi.findAll().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelected(data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    analysisApi
      .getByAssignee(selected.projectId)
      .then((data: unknown) => {
        setWorkloads(data as AssigneeWorkload[]);
        setWeeks(buildWeeks(selected.startDate, selected.endDate));
      })
      .catch(() => message.error('데이터 로드 실패'))
      .finally(() => setLoading(false));
  }, [selected]);

  const refYear = selected ? dayjs(selected.startDate).year() : dayjs().year();
  const maxByWeek = weeks.map((w) =>
    Math.max(...workloads.map((wl) => weeklyWorkload(wl.tasks, w, refYear)), 1),
  );

  const summaryColumns: ColumnsType<AssigneeWorkload> = [
    {
      title: '담당자', dataIndex: 'displayName', key: 'name', width: 110, fixed: 'left',
      render: (v) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '작업', dataIndex: 'taskCount', key: 'tc', width: 60, align: 'center',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '총 Man-day', dataIndex: 'totalWorkload', key: 'total', width: 90, align: 'right',
      render: (v: number) => `${v.toFixed(1)}d`,
    },
    {
      title: '계획', dataIndex: 'planRate', key: 'plan', width: 140,
      render: (v: number) => (
        <><Text style={{ fontSize: 11 }}>{v.toFixed(1)}%</Text>
        <Progress percent={Math.round(v)} strokeColor="#2E75B6" showInfo={false} size="small" /></>
      ),
    },
    {
      title: '실적', dataIndex: 'actualRate', key: 'actual', width: 140,
      render: (v: number, r: AssigneeWorkload) => {
        const late = r.planRate > v + 5;
        return (
          <><Text style={{ fontSize: 11, color: late ? '#ff4d4f' : '#52c41a' }}>{v.toFixed(1)}%</Text>
          <Progress percent={Math.round(v)} strokeColor={late ? '#ff4d4f' : '#52c41a'} showInfo={false} size="small" /></>
        );
      },
    },
    {
      title: '차이', dataIndex: 'diff', key: 'diff', width: 70, align: 'center',
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {v >= 0 ? '+' : ''}{v.toFixed(1)}%
        </Text>
      ),
    },
    ...weeks.slice(0, 12).map((w, i) => ({
      title: <span style={{ fontSize: 10, whiteSpace: 'nowrap' as const }}>{w}</span>,
      key: `w${i}`,
      width: 52,
      align: 'center' as const,
      render: (_: unknown, r: AssigneeWorkload) => {
        const val = weeklyWorkload(r.tasks, w, refYear);
        const bg = heatColor(val, maxByWeek[i]);
        const bright = val > maxByWeek[i] * 0.6;
        return (
          <Tooltip title={`${r.displayName} | ${w}주 | ${val}d`}>
            <div style={{
              background: bg, borderRadius: 4, padding: '2px 0',
              fontSize: 11, fontWeight: val > 0 ? 600 : 400,
              color: bright ? '#fff' : '#333', cursor: 'default',
            }}>
              {val > 0 ? val : ''}
            </div>
          </Tooltip>
        );
      },
    })),
  ];

  const taskColumns: ColumnsType<TaskRow> = [
    { title: 'WBS', dataIndex: 'wbsCode', width: 130,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text> },
    { title: '작업명', dataIndex: 'taskName' },
    { title: '시작일', dataIndex: 'plannedStart', width: 96,
      render: (v) => <Text style={{ fontSize: 12 }}>{v ?? '-'}</Text> },
    { title: '완료일', dataIndex: 'plannedEnd', width: 96,
      render: (v) => <Text style={{ fontSize: 12 }}>{v ?? '-'}</Text> },
    { title: 'Man-day', dataIndex: 'totalWorkload', width: 80, align: 'right',
      render: (v: number) => `${v}d` },
    { title: '계획%', dataIndex: 'planProgress', width: 70, align: 'right',
      render: (v: number) => `${v.toFixed(0)}%` },
    { title: '실적%', dataIndex: 'actualProgress', width: 70, align: 'right',
      render: (v: number, r: TaskRow) => (
        <Text style={{ color: r.planProgress > v + 5 ? '#ff4d4f' : '#52c41a' }}>
          {v.toFixed(0)}%
        </Text>
      ) },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>워크로드 분석</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            담당자별 주간 투입량 히트맵
          </Text>
        </Col>
        <Col>
          <Select
            style={{ width: 240 }} placeholder="프로젝트 선택"
            value={selected?.projectId}
            onChange={(v) => setSelected(projects.find((p) => p.projectId === v) ?? null)}
            options={projects.map((p) => ({ value: p.projectId, label: p.name }))}
          />
        </Col>
      </Row>

      {/* 범례 */}
      <Card size="small" style={{ marginBottom: 14, borderRadius: 8 }}>
        <Space>
          <Text style={{ fontSize: 12 }}>투입 강도:</Text>
          {[0, 1, 3, 5, 7, 9].map((v) => (
            <Tooltip key={v} title={`${v}d`}>
              <div style={{ width: 26, height: 18, borderRadius: 3,
                background: heatColor(v, 9), display: 'inline-block', border: '1px solid #ddd' }} />
            </Tooltip>
          ))}
          <Text type="secondary" style={{ fontSize: 11 }}>낮음 → 높음</Text>
        </Space>
      </Card>

      {/* KPI */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: '총 담당자', value: workloads.length, color: '#2E75B6' },
          { label: '전체 Man-day',
            value: `${workloads.reduce((s, w) => s + w.totalWorkload, 0).toFixed(1)}d`,
            color: '#722ed1' },
          { label: '평균 계획 진척율',
            value: workloads.length
              ? `${(workloads.reduce((s, w) => s + w.planRate, 0) / workloads.length).toFixed(1)}%`
              : '-',
            color: '#2E75B6' },
          { label: '평균 실적 진척율',
            value: workloads.length
              ? `${(workloads.reduce((s, w) => s + w.actualRate, 0) / workloads.length).toFixed(1)}%`
              : '-',
            color: '#52c41a' },
        ].map((s) => (
          <Col key={s.label}>
            <Card size="small" style={{ minWidth: 120, textAlign: 'center', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={workloads}
          columns={summaryColumns}
          rowKey="userId"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={false}
          style={{ borderRadius: 8 }}
          expandable={{
            expandedRowRender: (r) => (
              <Table dataSource={r.tasks} rowKey="taskId" columns={taskColumns}
                size="small" pagination={false} style={{ margin: '4px 0' }} />
            ),
          }}
        />
      </Spin>
    </div>
  );
};

export default WorkloadPage;
