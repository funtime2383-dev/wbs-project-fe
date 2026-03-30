import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Select, Typography, message, Modal,
  Form, Input, InputNumber, DatePicker, Space, Button,
  Drawer, Descriptions, Tag, Divider,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { wbsApi, projectApi, excelApi } from '@/api';
import type { WbsTaskDto, ProjectDto, CreateWbsTaskRequest, UpdateProgressRequest } from '@/types';
import GanttChart from '@/components/gantt/GanttChart';
import GanttToolbar from '@/components/gantt/GanttToolbar';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const GanttPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<WbsTaskDto[]>([]);
  const [treeTasks, setTreeTasks] = useState<WbsTaskDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'gantt' | 'table'>('table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WbsTaskDto | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressForm] = Form.useForm();

  useEffect(() => {
    projectApi.findAll().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProject(data[0]);
    });
  }, []);

  const loadTasks = useCallback(async (projectId: number) => {
    setLoading(true);
    try {
      const [flat, tree] = await Promise.all([
        wbsApi.getTaskList(projectId),
        wbsApi.getTaskTree(projectId),
      ]);
      setTasks(flat);
      setTreeTasks(tree);
    } catch { message.error('데이터 로드 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedProject) loadTasks(selectedProject.projectId);
  }, [selectedProject, loadTasks]);

  const handleTaskClick = (task: WbsTaskDto) => {
    setSelectedTask(task);
    setDrawerOpen(true);
    progressForm.setFieldsValue({
      actualProgress: task.actualProgress,
      actualWorkload: task.actualWorkload,
      actualStart: task.actualStart ? dayjs(task.actualStart) : null,
      actualEnd: task.actualEnd ? dayjs(task.actualEnd) : null,
    });
  };

  const handleAddTask = async (values: Record<string, unknown>) => {
    if (!selectedProject) return;
    try {
      const req: CreateWbsTaskRequest = {
        taskName: values.taskName as string,
        plannedStart: values.plannedStart ? (values.plannedStart as ReturnType<typeof dayjs>).format('YYYY-MM-DD') : undefined,
        plannedEnd: values.plannedEnd ? (values.plannedEnd as ReturnType<typeof dayjs>).format('YYYY-MM-DD') : undefined,
        weight: values.weight as number,
        isGroup: values.isGroup as boolean,
        deliverable: values.deliverable as string,
        notes: values.notes as string,
      };
      await wbsApi.createTask(selectedProject.projectId, req);
      message.success('작업이 추가되었습니다.');
      setAddModalOpen(false);
      addForm.resetFields();
      loadTasks(selectedProject.projectId);
    } catch { message.error('작업 추가 실패'); }
  };

  const handleProgressSave = async (values: Record<string, unknown>) => {
    if (!selectedProject || !selectedTask) return;
    try {
      const req: UpdateProgressRequest = {
        actualProgress: values.actualProgress as number,
        actualWorkload: values.actualWorkload as number,
        comment: values.comment as string,
        actualStart: values.actualStart ? (values.actualStart as ReturnType<typeof dayjs>).format('YYYY-MM-DD') : undefined,
        actualEnd: values.actualEnd ? (values.actualEnd as ReturnType<typeof dayjs>).format('YYYY-MM-DD') : undefined,
      };
      const updated = await wbsApi.updateProgress(selectedProject.projectId, selectedTask.taskId, req);
      setTasks((prev) => prev.map((t) => (t.taskId === updated.taskId ? updated : t)));
      message.success('진척율이 저장되었습니다.');
      setProgressModalOpen(false);
      setDrawerOpen(false);
    } catch { message.error('저장 실패'); }
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>WBS 일정 관리</Title>
          {selectedProject && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedProject.startDate} ~ {selectedProject.endDate}
            </Text>
          )}
        </Col>
        <Col>
          <Space wrap>
            <Select
              style={{ width: 220 }}
              placeholder="프로젝트 선택"
              value={selectedProject?.projectId}
              onChange={(v) => setSelectedProject(projects.find((x) => x.projectId === v) ?? null)}
              options={projects.map((p) => ({ value: p.projectId, label: p.name }))}
            />
            <GanttToolbar
              projectId={selectedProject?.projectId ?? null}
              projectName={selectedProject?.name ?? ''}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onRefresh={() => selectedProject && loadTasks(selectedProject.projectId)}
              onExportExcel={() => selectedProject && excelApi.exportExcel(selectedProject.projectId, selectedProject.name)}
              onImportExcel={async (file) => {
                if (!selectedProject) return;
                try {
                  await excelApi.importXlGantt(selectedProject.projectId, file);
                  message.success('Import 완료!');
                  loadTasks(selectedProject.projectId);
                } catch { message.error('Import 실패'); }
              }}
              loading={loading}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
              작업 추가
            </Button>
          </Space>
        </Col>
      </Row>

      {viewMode === 'gantt' ? (
        <GanttChart tasks={treeTasks} loading={loading} onTaskClick={handleTaskClick} />
      ) : (
        /* 목록 뷰: SchedulePage를 인라인으로 렌더링 */
        <div>
          {tasks.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>
              작업 데이터가 없습니다. 엑셀 Import 또는 작업 추가를 해주세요.
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#555' }}>
              총 {tasks.length}개 작업 | 지연: {tasks.filter((t) => !t.isGroup && t.planProgress > t.actualProgress + 5).length}건
            </div>
          )}
        </div>
      )}

      {/* Task Detail Drawer */}
      <Drawer
        title={selectedTask?.taskName}
        placement="right"
        width={440}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          !selectedTask?.isGroup && (
            <Button type="primary" size="small" onClick={() => setProgressModalOpen(true)}>
              진척율 입력
            </Button>
          )
        }
      >
        {selectedTask && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="WBS 코드"><Text code>{selectedTask.wbsCode}</Text></Descriptions.Item>
              <Descriptions.Item label="레벨">Level {selectedTask.wbsLevel}</Descriptions.Item>
              <Descriptions.Item label="계획 기간">{selectedTask.plannedStart ?? '-'} ~ {selectedTask.plannedEnd ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="총 작업량">{selectedTask.totalWorkload}d</Descriptions.Item>
              <Descriptions.Item label="계획 진척율"><Text style={{ color: '#2E75B6' }}>{selectedTask.planProgress}%</Text></Descriptions.Item>
              <Descriptions.Item label="실적 진척율">
                <Text style={{ color: selectedTask.actualProgress >= selectedTask.planProgress ? '#52c41a' : '#ff4d4f' }}>
                  {selectedTask.actualProgress}%
                </Text>
              </Descriptions.Item>
              {selectedTask.deliverable && <Descriptions.Item label="산출물">{selectedTask.deliverable}</Descriptions.Item>}
            </Descriptions>
            {selectedTask.assignments.length > 0 && (
              <><Divider>담당자</Divider>
              <Space wrap>{selectedTask.assignments.map((a) => <Tag key={a.userId} color="geekblue">{a.displayName}</Tag>)}</Space></>
            )}
            {selectedTask.notes && <><Divider>비고</Divider><Text type="secondary">{selectedTask.notes}</Text></>}
          </>
        )}
      </Drawer>

      {/* Add Task Modal */}
      <Modal title="작업 추가" open={addModalOpen} onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }} onOk={() => addForm.submit()} okText="추가" cancelText="취소" width={500}>
        <Form form={addForm} layout="vertical" onFinish={handleAddTask} style={{ marginTop: 16 }}>
          <Form.Item name="taskName" label="작업명" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="plannedStart" label="계획 시작일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="plannedEnd" label="계획 완료일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="weight" label="가중치" initialValue={1}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isGroup" label="유형" initialValue={false}><Select options={[{ value: false, label: '작업' }, { value: true, label: '그룹' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="deliverable" label="산출물"><Input /></Form.Item>
          <Form.Item name="notes" label="비고"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Progress Modal */}
      <Modal title={`진척율 입력 — ${selectedTask?.taskName}`} open={progressModalOpen} onCancel={() => setProgressModalOpen(false)} onOk={() => progressForm.submit()} okText="저장" cancelText="취소">
        <Form form={progressForm} layout="vertical" onFinish={handleProgressSave} style={{ marginTop: 16 }}>
          <Form.Item name="actualProgress" label="실적 진척율 (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} step={5} style={{ width: '100%' }} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="actualStart" label="실제 시작일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="actualEnd" label="실제 완료일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="actualWorkload" label="투입 Man-day"><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="comment" label="코멘트"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GanttPage;
