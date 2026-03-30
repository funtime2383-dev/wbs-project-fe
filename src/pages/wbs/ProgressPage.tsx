import React, { useEffect, useState } from 'react';
import {
  Table, Select, Typography, Progress, Tag,
  Row, Col, Card, Statistic, Spin, message,
} from 'antd';
import {
  RiseOutlined, FallOutlined, MinusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { projectApi, wbsApi } from '@/api';
import type { ProjectDto, WbsTaskDto, AssignmentDto } from '@/types';

const { Title, Text } = Typography;

interface AssigneeRow {
  key: string;
  displayName: string;
  userId: number;
  taskCount: number;
  totalWorkload: number;
  plannedWorkload: number;
  earnedValue: number;
  planRate: number;
  actualRate: number;
  diff: number;
  tasks: WbsTaskDto[];
}

const ProgressPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<WbsTaskDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectApi.findAll().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(data[0].projectId);
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    wbsApi.getTaskList(selectedProjectId)
      .then(setTasks)
      .catch(() => message.error('데이터 로드 실패'))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  // 담당자별 집계
  const assigneeRows: AssigneeRow[] = React.useMemo(() => {
    const map = new Map<number, AssigneeRow>();

    tasks
      .filter((t) => !t.isGroup)
      .forEach((task) => {
        task.assignments.forEach((a: AssignmentDto) => {
          const existing = map.get(a.userId);
          const earned = task.totalWorkload * (task.actualProgress / 100);
          if (existing) {
            existing.taskCount += 1;
            existing.totalWorkload += task.totalWorkload;
            existing.plannedWorkload += task.plannedWorkload;
            existing.earnedValue += earned;
            existing.tasks.push(task);
          } else {
            map.set(a.userId, {
              key: String(a.userId),
              userId: a.userId,
              displayName: a.displayName,
              taskCount: 1,
              totalWorkload: task.totalWorkload,
              plannedWorkload: task.plannedWorkload,
              earnedValue: earned,
              planRate: 0,
              actualRate: 0,
              diff: 0,
              tasks: [task],
            });
          }
        });
      });

    return Array.from(map.values()).map((row) => ({
      ...row,
      planRate: row.totalWorkload > 0 ? (row.plannedWorkload / row.totalWorkload) * 100 : 0,
      actualRate: row.totalWorkload > 0 ? (row.earnedValue / row.totalWorkload) * 100 : 0,
      diff: row.totalWorkload > 0
        ? ((row.earnedValue - row.plannedWorkload) / row.totalWorkload) * 100
        : 0,
    }));
  }, [tasks]);

  const overallPlan = assigneeRows.length
    ? assigneeRows.reduce((s, r) => s + r.planRate, 0) / assigneeRows.length : 0;
  const overallActual = assigneeRows.length
    ? assigneeRows.reduce((s, r) => s + r.actualRate, 0) / assigneeRows.length : 0;
  const totalWorkload = assigneeRows.reduce((s, r) => s + r.totalWorkload, 0);

  const expandedColumns: ColumnsType<WbsTaskDto> = [
    { title: 'WBS 코드', dataIndex: 'wbsCode', width: 150,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text> },
    { title: '작업명', dataIndex: 'taskName', width: 220 },
    { title: '시작일', dataIndex: 'plannedStart', width: 100,
      render: (v) => <Text style={{ fontSize: 12 }}>{v ?? '-'}</Text> },
    { title: '완료일', dataIndex: 'plannedEnd', width: 100,
      render: (v) => <Text style={{ fontSize: 12 }}>{v ?? '-'}</Text> },
    { title: '총작업량', dataIndex: 'totalWorkload', width: 90, align: 'right',
      render: (v) => `${v}d` },
    { title: '계획 진척율', dataIndex: 'planProgress', width: 110,
      render: (v) => <Text>{v.toFixed(1)}%</Text> },
    { title: '실적 진척율', dataIndex: 'actualProgress', width: 110,
      render: (v, r) => (
        <Text style={{ color: r.planProgress > v + 5 ? '#ff4d4f' : '#52c41a' }}>
          {v.toFixed(1)}%
        </Text>
      ) },
  ];

  const columns: ColumnsType<AssigneeRow> = [
    {
      title: '담당자',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 140,
      render: (name) => (
        <Text strong style={{ fontSize: 13 }}>{name}</Text>
      ),
    },
    {
      title: '할당 Task',
      dataIndex: 'taskCount',
      key: 'taskCount',
      width: 90,
      align: 'center',
      render: (v) => <Tag color="blue">{v}건</Tag>,
    },
    {
      title: '총작업량(A)',
      dataIndex: 'totalWorkload',
      key: 'totalWorkload',
      width: 100,
      align: 'right',
      render: (v) => `${v.toFixed(1)}d`,
    },
    {
      title: '계획작업량(B)',
      dataIndex: 'plannedWorkload',
      key: 'plannedWorkload',
      width: 110,
      align: 'right',
      render: (v) => `${v.toFixed(1)}d`,
    },
    {
      title: '실적기성(C)',
      dataIndex: 'earnedValue',
      key: 'earnedValue',
      width: 100,
      align: 'right',
      render: (v) => `${v.toFixed(1)}d`,
    },
    {
      title: '계획(B/A)',
      dataIndex: 'planRate',
      key: 'planRate',
      width: 150,
      render: (v) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 11 }}>{v.toFixed(1)}%</Text>
          </div>
          <Progress percent={Math.round(v)} strokeColor="#2E75B6" showInfo={false} size="small" />
        </div>
      ),
    },
    {
      title: '실적(C/A)',
      dataIndex: 'actualRate',
      key: 'actualRate',
      width: 150,
      render: (v, r) => {
        const isDelayed = r.planRate > v + 5;
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 11, color: isDelayed ? '#ff4d4f' : '#52c41a' }}>
                {v.toFixed(1)}%
              </Text>
            </div>
            <Progress
              percent={Math.round(v)}
              strokeColor={isDelayed ? '#ff4d4f' : '#52c41a'}
              showInfo={false}
              size="small"
            />
          </div>
        );
      },
    },
    {
      title: '차이(실적-계획)',
      dataIndex: 'diff',
      key: 'diff',
      width: 130,
      align: 'center',
      render: (v) => {
        const abs = Math.abs(v).toFixed(1);
        if (v > 2) return <Tag icon={<RiseOutlined />} color="success">+{abs}%</Tag>;
        if (v < -2) return <Tag icon={<FallOutlined />} color="error">{v.toFixed(1)}%</Tag>;
        return <Tag icon={<MinusOutlined />} color="default">±{abs}%</Tag>;
      },
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>
            담당자별 진행율
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            담당자별 투입 작업량, 계획/실적 진행율을 분석합니다.
          </Text>
        </Col>
        <Col>
          <Select
            style={{ width: 240 }}
            placeholder="프로젝트 선택"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map((p) => ({ value: p.projectId, label: p.name }))}
          />
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#EBF4FF', borderRadius: 8 }}>
            <Statistic title="전체 계획 진척율" value={overallPlan.toFixed(1)} suffix="%" valueStyle={{ color: '#2E75B6' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: overallActual >= overallPlan ? '#F0FFF4' : '#FFF2F0', borderRadius: 8 }}>
            <Statistic
              title="전체 실적 진척율"
              value={overallActual.toFixed(1)}
              suffix="%"
              valueStyle={{ color: overallActual >= overallPlan ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#F9F0FF', borderRadius: 8 }}>
            <Statistic title="전체 투입 Man-day" value={totalWorkload.toFixed(1)} suffix="d" valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={assigneeRows}
          columns={columns}
          rowKey="userId"
          size="small"
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <Table
                dataSource={record.tasks}
                columns={expandedColumns}
                rowKey="taskId"
                size="small"
                pagination={false}
                style={{ margin: '4px 0' }}
              />
            ),
          }}
          style={{ borderRadius: 8 }}
        />
      </Spin>
    </div>
  );
};

export default ProgressPage;
