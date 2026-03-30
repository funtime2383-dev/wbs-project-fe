import React, { useEffect, useState } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Typography,
  Table, Tag, Spin, Empty,
} from 'antd';
import {
  ProjectOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { projectApi, wbsApi } from '@/api';
import type { ProjectDto, WbsTaskDto } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [tasks, setTasks] = useState<WbsTaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectDto | null>(null);

  useEffect(() => {
    projectApi.findAll().then((data) => {
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0]);
        return wbsApi.getTaskList(data[0].projectId);
      }
      return [];
    }).then(setTasks).catch(console.error).finally(() => setLoading(false));
  }, []);

  const overallPlan = tasks.length
    ? tasks.reduce((acc, t) => acc + t.planProgress, 0) / tasks.length
    : 0;
  const overallActual = tasks.length
    ? tasks.reduce((acc, t) => acc + t.actualProgress, 0) / tasks.length
    : 0;
  const delayed = tasks.filter(
    (t) => !t.isGroup && t.planProgress > t.actualProgress + 5
  );
  const completed = tasks.filter(
    (t) => !t.isGroup && t.actualProgress >= 100
  );

  const delayedColumns = [
    { title: 'WBS 코드', dataIndex: 'wbsCode', key: 'wbsCode', width: 140 },
    { title: '작업명', dataIndex: 'taskName', key: 'taskName' },
    {
      title: '계획',
      dataIndex: 'planProgress',
      key: 'plan',
      width: 100,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '실적',
      dataIndex: 'actualProgress',
      key: 'actual',
      width: 100,
      render: (v: number) => <Text type="danger">{v.toFixed(1)}%</Text>,
    },
    {
      title: '담당자',
      key: 'assignees',
      width: 160,
      render: (_: unknown, r: WbsTaskDto) =>
        r.assignments.map((a) => (
          <Tag key={a.userId} color="blue" style={{ marginBottom: 2 }}>
            {a.displayName}
          </Tag>
        )),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>
          대시보드
        </Title>
        {selectedProject && (
          <Text type="secondary">
            {selectedProject.name} | {selectedProject.startDate} ~ {selectedProject.endDate}
          </Text>
        )}
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#EBF4FF', borderRadius: 8 }}>
            <Statistic
              title="전체 프로젝트"
              value={projects.length}
              prefix={<ProjectOutlined style={{ color: '#2E75B6' }} />}
              valueStyle={{ color: '#1F4E79' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#F0FFF4', borderRadius: 8 }}>
            <Statistic
              title="완료 작업"
              value={completed.length}
              suffix={`/ ${tasks.filter((t) => !t.isGroup).length}`}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#FFFBF0', borderRadius: 8 }}>
            <Statistic
              title="지연 작업"
              value={delayed.length}
              prefix={<ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: delayed.length > 0 ? '#fa8c16' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#FFF0F0', borderRadius: 8 }}>
            <Statistic
              title="오늘"
              value={dayjs().format('MM월 DD일 (ddd)')}
              prefix={<ClockCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ fontSize: 18, color: '#555' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Progress */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="전체 진척율" bordered={false} style={{ borderRadius: 8 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>계획 진척율</Text>
                <Text strong>{overallPlan.toFixed(1)}%</Text>
              </div>
              <Progress
                percent={Math.round(overallPlan)}
                strokeColor="#2E75B6"
                showInfo={false}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>실적 진척율</Text>
                <Text strong style={{ color: overallActual >= overallPlan ? '#52c41a' : '#ff4d4f' }}>
                  {overallActual.toFixed(1)}%
                </Text>
              </div>
              <Progress
                percent={Math.round(overallActual)}
                strokeColor={overallActual >= overallPlan ? '#52c41a' : '#ff4d4f'}
                showInfo={false}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="작업 현황" bordered={false} style={{ borderRadius: 8 }}>
            <Row gutter={16}>
              {[
                { label: '전체', value: tasks.filter((t) => !t.isGroup).length, color: '#2E75B6' },
                { label: '완료', value: completed.length, color: '#52c41a' },
                { label: '진행중', value: tasks.filter((t) => !t.isGroup && t.actualProgress > 0 && t.actualProgress < 100).length, color: '#fa8c16' },
                { label: '지연', value: delayed.length, color: '#ff4d4f' },
              ].map((item) => (
                <Col span={6} key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>
                    {item.value}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Text>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Delayed Tasks */}
      <Card
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
            지연 작업 목록
          </span>
        }
        bordered={false}
        style={{ borderRadius: 8 }}
      >
        {delayed.length === 0 ? (
          <Empty description="지연 작업이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={delayed}
            columns={delayedColumns}
            rowKey="taskId"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
