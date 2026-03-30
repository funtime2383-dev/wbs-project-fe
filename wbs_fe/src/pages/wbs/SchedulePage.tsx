import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Table, Tag, Button, Space, Typography, Progress, Modal,
  Form, InputNumber, DatePicker, Input, message, Tooltip,
  Row, Col, Select, Spin, Drawer, Divider, Upload,
  Slider, Steps, Popconfirm, Alert, Avatar, Empty, Popover, Checkbox, Tree, Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  PlusOutlined, SyncOutlined, PercentageOutlined, DeleteOutlined,
  EditOutlined, AppstoreAddOutlined, CodeOutlined, CheckCircleOutlined,
  CloudServerOutlined, AuditOutlined, DownloadOutlined, UploadOutlined,
  FolderOutlined, FileOutlined, CalendarOutlined, TeamOutlined,
  UserAddOutlined, ArrowLeftOutlined, MinusSquareOutlined, PlusSquareOutlined,
  CheckOutlined, SearchOutlined, ThunderboltOutlined,
  ArrowUpOutlined, ArrowDownOutlined, SortAscendingOutlined, ScissorOutlined,
  GlobalOutlined, CopyOutlined, FlagOutlined, HistoryOutlined, SaveOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { wbsApi, projectApi, excelApi, teamApi, memberApi, assignApi, baselineApi } from '@/api';
import type {
  WbsTaskDto, ProjectDto, TeamDto, ProjectMemberDto,
  AssignmentDto, UpdateWbsTaskRequest, BaselineDto, BaselineTaskSnapshot,
} from '@/types';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

const LC: Record<number, string> = {
  1: '#1F4E79', 2: '#2E75B6', 3: '#4472C4', 4: '#5B9BD5',
  5: '#70AD47', 6: '#ED7D31', 7: '#A9D18E', 8: '#9DC3E6',
};
const AVATAR_COLORS = ['#2E75B6', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96'];

const TEMPLATES = [
  { key: 'SW_DEV',     icon: <CodeOutlined style={{ fontSize: 28, color: '#2E75B6' }} />,       title: '소프트웨어 개발', desc: '분석→설계→구현→테스트→이행',    color: '#EBF4FF', border: '#2E75B6', count: 38, tags: ['분석','설계','구현','테스트'] },
  { key: 'INFRA',      icon: <CloudServerOutlined style={{ fontSize: 28, color: '#52c41a' }} />, title: '인프라 구축',    desc: '분석→설계→구축→테스트→안정화', color: '#F0FFF4', border: '#52c41a', count: 26, tags: ['네트워크','서버','보안'] },
  { key: 'CONSULTING', icon: <AuditOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,       title: '컨설팅 / 용역', desc: '진단→개선→이행계획→보고',      color: '#FFF7E6', border: '#fa8c16', count: 20, tags: ['진단','분석','개선안','보고'] },
];

const fmt     = (d?: Dayjs | null) => d?.format('YYYY-MM-DD') ?? undefined;
const toDayjs = (s?: string | null) => (s ? dayjs(s) : null);
const apiErr  = (e: unknown, fb = '오류 발생') =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fb;

const calcPlanProgress = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 0;
  const s = dayjs(start), e = dayjs(end), today = dayjs();
  if (today.isBefore(s)) return 0;
  if (today.isAfter(e)) return 100;
  const total = e.diff(s, 'day');
  if (total <= 0) return 100;
  return Math.min(100, Math.round((today.diff(s, 'day') / total) * 100));
};

const flattenTree = (nodes: WbsTaskDto[]): WbsTaskDto[] =>
  nodes.flatMap(n => [n, ...(n.children ? flattenTree(n.children) : [])]);

const collectGroupKeys = (nodes: WbsTaskDto[]): React.Key[] =>
  nodes.flatMap(n =>
    n.isGroup && n.children?.length ? [n.taskId, ...collectGroupKeys(n.children)] : [],
  );

const toTreeData = (nodes: WbsTaskDto[], excludeTaskId: number): DataNode[] =>
  nodes.map(n => {
    const isExcluded = n.taskId === excludeTaskId || isAncestorOf(n, excludeTaskId);
    return {
      key: String(n.taskId),
      title: (
        <span style={{ color: isExcluded ? '#ccc' : LC[n.wbsLevel] ?? '#333', fontSize: 12 }}>
          {n.isGroup ? <FolderOutlined style={{ marginRight: 4 }} /> : <FileOutlined style={{ marginRight: 4, color: '#bbb' }} />}
          [{n.wbsCode}] {n.taskName}
        </span>
      ),
      disabled: isExcluded,
      children: n.children?.length ? toTreeData(n.children, excludeTaskId) : undefined,
    };
  });

function isAncestorOf(node: WbsTaskDto, targetId: number): boolean {
  return node.children?.some(c => c.taskId === targetId || isAncestorOf(c, targetId)) ?? false;
}

interface ChildAddItem { id: number; name: string; isGroup: boolean; }
interface EditForm {
  taskName: string; isGroup: boolean; weight: number;
  plannedStart?: Dayjs; plannedEnd?: Dayjs; actualStart?: Dayjs; actualEnd?: Dayjs;
  totalWorkload?: number; plannedWorkload?: number; planProgress?: number;
  deliverable?: string; notes?: string;
}
interface ProgForm {
  actualProgress: number; actualStart?: Dayjs; actualEnd?: Dayjs;
  actualWorkload?: number; comment?: string;
}

const InlineDateRange: React.FC<{
  startVal?: string | null; endVal?: string | null;
  onSave: (s: string | undefined, e: string | undefined) => void;
  mode: 'plan' | 'actual'; children: React.ReactNode; disabled?: boolean;
}> = ({ startVal, endVal, onSave, mode, children, disabled }) => {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Dayjs | null>(toDayjs(startVal));
  const [e, setE] = useState<Dayjs | null>(toDayjs(endVal));
  const color = mode === 'plan' ? '#2E75B6' : '#52c41a';
  if (disabled) return <>{children}</>;
  return (
    <Popover open={open}
      onOpenChange={v => { if (v) { setS(toDayjs(startVal)); setE(toDayjs(endVal)); } setOpen(v); }}
      trigger="click" placement="bottomLeft"
      content={
        <div style={{ width: 280 }} onClick={ev => ev.stopPropagation()}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>{mode === 'plan' ? '📅 계획 기간' : '✅ 실제 기간'}</div>
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col span={12}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>시작일</div><DatePicker size="small" style={{ width: '100%' }} value={s} onChange={d => setS(d)} /></Col>
            <Col span={12}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>완료일</div><DatePicker size="small" style={{ width: '100%' }} value={e} onChange={d => setE(d)} /></Col>
          </Row>
          {mode === 'plan' && s && e && <div style={{ fontSize: 11, color, marginBottom: 8, background: `${color}10`, padding: '4px 8px', borderRadius: 4 }}>💡 계획 진척율 자동 계산: {calcPlanProgress(fmt(s), fmt(e))}%</div>}
          {mode === 'actual' && e && <div style={{ fontSize: 11, color: '#52c41a', marginBottom: 8, background: '#f6ffed', padding: '4px 8px', borderRadius: 4 }}>✅ 완료일 입력 시 실적 100% 자동 저장</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Button size="small" onClick={() => setOpen(false)}>취소</Button>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => { onSave(fmt(s), fmt(e)); setOpen(false); }}>저장</Button>
          </div>
        </div>
      }>
      <div style={{ cursor: 'pointer' }} onClick={ev => ev.stopPropagation()}>{children}</div>
    </Popover>
  );
};

const InlineNumber: React.FC<{
  value: number; onSave: (v: number) => void; label: string;
  min?: number; max?: number; step?: number; suffix?: string; children: React.ReactNode; disabled?: boolean;
}> = ({ value, onSave, label, min = 0, max, step = 1, suffix, children, disabled }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value);
  if (disabled) return <>{children}</>;
  return (
    <Popover open={open} onOpenChange={v => { if (v) setVal(value); setOpen(v); }} trigger="click" placement="bottomLeft"
      content={
        <div style={{ width: 200 }} onClick={ev => ev.stopPropagation()}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>{label}</div>
          <InputNumber min={min} max={max} step={step} value={val} onChange={v => setVal(v ?? 0)} addonAfter={suffix} style={{ width: '100%', marginBottom: 8 }} autoFocus onPressEnter={() => { onSave(val); setOpen(false); }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Button size="small" onClick={() => setOpen(false)}>취소</Button>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => { onSave(val); setOpen(false); }}>저장</Button>
          </div>
        </div>
      }>
      <div style={{ cursor: 'pointer' }} onClick={ev => ev.stopPropagation()}>{children}</div>
    </Popover>
  );
};

/* ════════════════════════════════════════════════════════════════════════ */
const SchedulePage: React.FC = () => {
  const { projectId: pidStr } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const projectId = pidStr ? Number(pidStr) : null;

  // ★ CLIENT_VIEWER 여부
  const isClientViewer = useAuthStore(s => s.user?.userRole === 'CLIENT_VIEWER');

  const [project,   setProject]   = useState<ProjectDto | null>(null);
  const [treeTasks, setTreeTasks] = useState<WbsTaskDto[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [teams,     setTeams]     = useState<TeamDto[]>([]);
  const [members,   setMembers]   = useState<ProjectMemberDto[]>([]);

  const [expandedSet, setExpandedSet] = useState<Set<React.Key>>(new Set());
  const expandedKeys = useMemo(() => Array.from(expandedSet), [expandedSet]);

  const [childAddModal, setChildAddModal] = useState<{ open: boolean; parentId: number; parentLabel: string } | null>(null);
  const [childAddItems, setChildAddItems] = useState<ChildAddItem[]>([{ id: 1, name: '', isGroup: false }]);
  const [childAddBusy,  setChildAddBusy]  = useState(false);
  const nextItemId   = useRef(2);
  const lastInputRef = useRef<any>(null);

  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);

  const [reparentModal,   setReparentModal]   = useState<{ open: boolean; task: WbsTaskDto } | null>(null);
  const [reparentTarget,  setReparentTarget]  = useState<string | null>(null);
  const [reparentLoading, setReparentLoading] = useState(false);

  const [copyModal,   setCopyModal]   = useState<{ open: boolean; task: WbsTaskDto } | null>(null);
  const [copyTarget,  setCopyTarget]  = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);

  const [baselines,        setBaselines]       = useState<BaselineDto[]>([]);
  const [baselineListOpen, setBaselineListOpen] = useState(false);
  const [baselineSaveOpen, setBaselineSaveOpen] = useState(false);
  const [baselineSaveName, setBaselineSaveName] = useState('');
  const [baselineSaveDesc, setBaselineSaveDesc] = useState('');
  const [baselineSaveBusy, setBaselineSaveBusy] = useState(false);
  const [activeBaseline,   setActiveBaseline]   = useState<BaselineDto | null>(null);
  const [baselineLoading,  setBaselineLoading]  = useState(false);

  const [editOpen,       setEditOpen]       = useState(false);
  const [progOpen,       setProgOpen]       = useState(false);
  const [tplOpen,        setTplOpen]        = useState(false);
  const [assignOpen,     setAssignOpen]     = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [addOpen,        setAddOpen]        = useState(false);

  const [editTask,   setEditTask]   = useState<WbsTaskDto | null>(null);
  const [progTask,   setProgTask]   = useState<WbsTaskDto | null>(null);
  const [assignTask, setAssignTask] = useState<WbsTaskDto | null>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const flatTasks     = useMemo(() => flattenTree(treeTasks), [treeTasks]);
  const selectedTasks = useMemo(() => flatTasks.filter(t => selectedRowKeys.includes(t.taskId)), [flatTasks, selectedRowKeys]);
  const leaves        = flatTasks.filter(t => !t.isGroup);
  const planAvg       = leaves.length ? leaves.reduce((s, t) => s + +t.planProgress, 0) / leaves.length : 0;
  const actualAvg     = leaves.length ? leaves.reduce((s, t) => s + +t.actualProgress, 0) / leaves.length : 0;
  const delayedCnt    = leaves.filter(t => +t.planProgress > +t.actualProgress + 5).length;
  const completedCnt  = leaves.filter(t => +t.actualProgress >= 100).length;

  const [assignLoading,    setAssignLoading]    = useState(false);
  const [curAssignments,   setCurAssignments]   = useState<AssignmentDto[]>([]);
  const [selUserIds,       setSelUserIds]       = useState<number[]>([]);
  const [memberSearch,     setMemberSearch]     = useState('');
  const [bulkSelUserIds,   setBulkSelUserIds]   = useState<number[]>([]);
  const [bulkMemberSearch, setBulkMemberSearch] = useState('');
  const [bulkLoading,      setBulkLoading]      = useState(false);
  const [bulkDelLoading,   setBulkDelLoading]   = useState(false);

  const [editLoading, setEditLoading] = useState(false);
  const [progLoading, setProgLoading] = useState(false);
  const [tplLoading,  setTplLoading]  = useState(false);
  const [addLoading,  setAddLoading]  = useState(false);
  const [selTpl,      setSelTpl]      = useState<string | null>(null);
  const [sliderVal,   setSliderVal]   = useState(0);

  const [editForm] = Form.useForm<EditForm>();
  const [progForm] = Form.useForm<ProgForm>();
  const [addForm]  = Form.useForm();

  useEffect(() => {
    if (!projectId) { navigate('/wbs/schedule'); return; }
    projectApi.findById(projectId).then(setProject)
      .catch(() => { message.error('프로젝트를 찾을 수 없습니다.'); navigate('/wbs/schedule'); });
  }, [projectId]);

  const reload = useCallback((pid: number, parentIdToExpand?: number) => {
    setLoading(true);
    wbsApi.getTree(pid)
      .then(tree => {
        setTreeTasks(tree);
        setExpandedSet(prev => {
          if (prev.size === 0) {
            const init: React.Key[] = [];
            const collect = (nodes: WbsTaskDto[], depth: number) => {
              if (depth > 2) return;
              nodes.forEach(n => { if (n.isGroup && n.children?.length) { init.push(n.taskId); collect(n.children, depth + 1); } });
            };
            collect(tree, 1); return new Set(init);
          }
          if (parentIdToExpand !== undefined) { const next = new Set(prev); next.add(parentIdToExpand); return next; }
          return prev;
        });
      })
      .catch(() => message.error('작업 로드 실패'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!project) return;
    reload(project.projectId);
    Promise.all([teamApi.getTeams(project.projectId), memberApi.getMembers(project.projectId)])
      .then(([t, m]) => { setTeams(t); setMembers(m); }).catch(() => {});
  }, [project, reload]);

  const allGroupKeys    = useMemo(() => collectGroupKeys(treeTasks), [treeTasks]);
  const allExpanded     = allGroupKeys.length > 0 && allGroupKeys.every(k => expandedSet.has(k));
  const toggleExpandAll = () => setExpandedSet(allExpanded ? new Set() : new Set(allGroupKeys));
  const toggleExpand    = (key: React.Key, expanded: boolean) =>
    setExpandedSet(prev => { const next = new Set(prev); expanded ? next.add(key) : next.delete(key); return next; });

  const saveField = useCallback(async (task: WbsTaskDto, patch: Partial<UpdateWbsTaskRequest>) => {
    if (!project || isClientViewer) return;
    try {
      await wbsApi.updateTask(project.projectId, task.taskId, {
        taskName: task.taskName, isGroup: task.isGroup, weight: +task.weight,
        plannedStart: task.plannedStart, plannedEnd: task.plannedEnd,
        actualStart: task.actualStart, actualEnd: task.actualEnd,
        totalWorkload: +task.totalWorkload || undefined, plannedWorkload: +task.plannedWorkload || undefined,
        planProgress: +task.planProgress || undefined, deliverable: task.deliverable, notes: task.notes, ...patch,
      });
      const pn = (nodes: WbsTaskDto[]): WbsTaskDto[] => nodes.map(n => n.taskId === task.taskId ? { ...n, ...patch } : { ...n, children: pn(n.children ?? []) });
      setTreeTasks(prev => pn(prev));
    } catch (e) { message.error(apiErr(e, '저장 실패')); }
  }, [project, isClientViewer]);

  const savePlanPeriod = useCallback(async (task: WbsTaskDto, start?: string, end?: string) => {
    const pp = calcPlanProgress(start, end);
    await saveField(task, { plannedStart: start, plannedEnd: end, planProgress: pp });
    message.success(`계획 기간 저장 · 계획 진척율 ${pp}% 자동 계산`);
  }, [saveField]);

  const saveActualPeriod = useCallback(async (task: WbsTaskDto, start?: string, end?: string) => {
    if (!project || isClientViewer) return;
    if (end) {
      await wbsApi.updateProgress(project.projectId, task.taskId, { actualProgress: 100, actualStart: start, actualEnd: end });
      const pn = (nodes: WbsTaskDto[]): WbsTaskDto[] => nodes.map(n => n.taskId === task.taskId ? { ...n, actualStart: start, actualEnd: end, actualProgress: 100 } : { ...n, children: pn(n.children ?? []) });
      setTreeTasks(prev => pn(prev)); message.success('실제 기간 저장 · 실적 100% 자동 설정');
    } else { await saveField(task, { actualStart: start, actualEnd: end }); message.success('실제 기간 저장'); }
  }, [saveField, project, isClientViewer]);

  const openChildAdd = (r: WbsTaskDto) => { nextItemId.current = 2; setChildAddItems([{ id: 1, name: '', isGroup: false }]); setChildAddModal({ open: true, parentId: r.taskId, parentLabel: `[${r.wbsCode}] ${r.taskName}` }); setTimeout(() => lastInputRef.current?.focus(), 150); };
  const updateItem = (id: number, field: 'name' | 'isGroup', value: string | boolean) => setChildAddItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  const addItem = () => { const newId = nextItemId.current++; setChildAddItems(prev => [...prev, { id: newId, name: '', isGroup: false }]); setTimeout(() => lastInputRef.current?.focus(), 60); };
  const removeItem = (id: number) => setChildAddItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);
  const submitChildAdd = async () => {
    const valid = childAddItems.filter(it => it.name.trim()); if (valid.length === 0) { message.warning('작업명을 1개 이상 입력하세요.'); return; }
    if (!project || !childAddModal) return; setChildAddBusy(true);
    try { for (const it of valid) await wbsApi.createTask(project.projectId, { parentTaskId: childAddModal.parentId, taskName: it.name.trim(), isGroup: it.isGroup, weight: 1 }); message.success(`✅ ${valid.length}개 하위 작업 추가 완료`); setChildAddModal(null); reload(project.projectId, childAddModal.parentId); }
    catch (e) { message.error(apiErr(e, '작업 추가 실패')); } finally { setChildAddBusy(false); }
  };

  const submitAdd = async (v: any) => {
    if (!project) return; setAddLoading(true);
    try { await wbsApi.createTask(project.projectId, { taskName: v.taskName, isGroup: v.isGroup ?? false, weight: v.weight ?? 1, plannedStart: fmt(v.plannedStart), plannedEnd: fmt(v.plannedEnd), deliverable: v.deliverable, notes: v.notes }); message.success(`✅ "${v.taskName}" 추가 완료`); setAddOpen(false); reload(project.projectId); }
    catch (e) { message.error(apiErr(e, '추가 실패')); } finally { setAddLoading(false); }
  };

  const openEdit = (t: WbsTaskDto) => {
    if (isClientViewer) return;
    setEditTask(t); editForm.setFieldsValue({ taskName: t.taskName, isGroup: t.isGroup, weight: +t.weight, plannedStart: toDayjs(t.plannedStart), plannedEnd: toDayjs(t.plannedEnd), actualStart: toDayjs(t.actualStart), actualEnd: toDayjs(t.actualEnd), totalWorkload: +t.totalWorkload || undefined, plannedWorkload: +t.plannedWorkload || undefined, planProgress: +t.planProgress || undefined, deliverable: t.deliverable ?? '', notes: t.notes ?? '' }); setEditOpen(true);
  };
  const submitEdit = async (v: EditForm) => {
    if (!editTask || !project) return; setEditLoading(true);
    try { await wbsApi.updateTask(project.projectId, editTask.taskId, { taskName: v.taskName, isGroup: v.isGroup, weight: v.weight, plannedStart: fmt(v.plannedStart), plannedEnd: fmt(v.plannedEnd), actualStart: fmt(v.actualStart), actualEnd: fmt(v.actualEnd), totalWorkload: v.totalWorkload, plannedWorkload: v.plannedWorkload, planProgress: v.planProgress, deliverable: v.deliverable, notes: v.notes }); message.success('✅ 수정 완료'); setEditOpen(false); reload(project.projectId); }
    catch (e) { message.error(apiErr(e, '수정 실패')); } finally { setEditLoading(false); }
  };

  const openProg = (t: WbsTaskDto) => {
    if (isClientViewer) return;
    setProgTask(t); const v = +t.actualProgress; setSliderVal(v); progForm.setFieldsValue({ actualProgress: v, actualStart: toDayjs(t.actualStart), actualEnd: toDayjs(t.actualEnd), actualWorkload: +t.actualWorkload || undefined, comment: '' }); setProgOpen(true);
  };
  const submitProg = async (v: ProgForm) => {
    if (!progTask || !project) return; setProgLoading(true);
    try { await wbsApi.updateProgress(project.projectId, progTask.taskId, { actualProgress: v.actualProgress, actualStart: fmt(v.actualStart), actualEnd: fmt(v.actualEnd), actualWorkload: v.actualWorkload, comment: v.comment }); message.success(`✅ 진척율 ${v.actualProgress}% 저장`); setProgOpen(false); reload(project.projectId); }
    catch (e) { message.error(apiErr(e, '저장 실패')); } finally { setProgLoading(false); }
  };

  const deleteTask = async (t: WbsTaskDto) => { if (!project) return; try { await wbsApi.deleteTask(project.projectId, t.taskId); message.success('삭제되었습니다.'); reload(project.projectId); } catch { message.error('삭제 실패'); } };
  const handleMove = async (task: WbsTaskDto, direction: 'up' | 'down') => { if (!project) return; setMovingTaskId(task.taskId); try { await wbsApi.moveTask(project.projectId, task.taskId, direction); reload(project.projectId); } catch (e) { message.warning(apiErr(e, '이동할 수 없습니다.')); } finally { setMovingTaskId(null); } };
  const openReparent = (task: WbsTaskDto) => { setReparentTarget(null); setReparentModal({ open: true, task }); };
  const submitReparent = async () => { if (!project || !reparentModal || reparentTarget === null) { message.warning('이동할 위치를 선택하세요.'); return; } setReparentLoading(true); try { await wbsApi.reparentTask(project.projectId, reparentModal.task.taskId, reparentTarget === '0' ? null : Number(reparentTarget)); message.success('✅ 작업 위치가 변경되었습니다.'); setReparentModal(null); reload(project.projectId); } catch (e) { message.error(apiErr(e, '이동 실패')); } finally { setReparentLoading(false); } };
  const reparentTreeData = useMemo((): DataNode[] => { if (!reparentModal) return []; return [{ key: '0', title: <span style={{ color: '#1F4E79', fontWeight: 600, fontSize: 12 }}><GlobalOutlined style={{ marginRight: 4 }} />최상위 (루트)</span> }, ...toTreeData(treeTasks, reparentModal.task.taskId)]; }, [reparentModal, treeTasks]);
  const openCopy = (task: WbsTaskDto) => { setCopyTarget(null); setCopyModal({ open: true, task }); };
  const submitCopy = async () => { if (!project || !copyModal) return; setCopyLoading(true); try { const targetParentId = copyTarget === null ? undefined : copyTarget === '0' ? null : Number(copyTarget); await wbsApi.copyTask(project.projectId, copyModal.task.taskId, targetParentId); message.success(`✅ "${copyModal.task.taskName}" 복사 완료`); setCopyModal(null); reload(project.projectId); } catch (e) { message.error(apiErr(e, '복사 실패')); } finally { setCopyLoading(false); } };
  const copyTreeData = useMemo((): DataNode[] => { if (!copyModal) return []; return [{ key: 'same', title: <span style={{ color: '#555', fontSize: 12 }}>📌 원본과 같은 위치 (기본)</span> }, { key: '0', title: <span style={{ color: '#1F4E79', fontWeight: 600, fontSize: 12 }}><GlobalOutlined style={{ marginRight: 4 }} />최상위 (루트)</span> }, ...toTreeData(treeTasks, copyModal.task.taskId)]; }, [copyModal, treeTasks]);

  const loadBaselines = useCallback(async () => { if (!project) return; setBaselineLoading(true); try { setBaselines(await baselineApi.getList(project.projectId)); } catch { message.error('기준선 목록 로드 실패'); } finally { setBaselineLoading(false); } }, [project]);
  const openBaselineList = () => { loadBaselines(); setBaselineListOpen(true); };
  const handleBaselineSave = async () => { if (!project) return; setBaselineSaveBusy(true); try { await baselineApi.save(project.projectId, { name: baselineSaveName.trim() || undefined, description: baselineSaveDesc.trim() || undefined }); message.success('✅ 기준선 저장 완료'); setBaselineSaveOpen(false); setBaselineSaveName(''); setBaselineSaveDesc(''); loadBaselines(); } catch (e) { message.error(apiErr(e, '기준선 저장 실패')); } finally { setBaselineSaveBusy(false); } };
  const handleBaselineDelete = async (bid: number) => { if (!project) return; try { await baselineApi.delete(project.projectId, bid); message.success('기준선 삭제됨'); if (activeBaseline?.baselineId === bid) setActiveBaseline(null); loadBaselines(); } catch { message.error('삭제 실패'); } };
  const handleBaselineCompare = async (bid: number) => { if (!project) return; if (activeBaseline?.baselineId === bid) { setActiveBaseline(null); return; } try { const detail = await baselineApi.getDetail(project.projectId, bid); setActiveBaseline(detail); message.success(`"${detail.name}" 기준선 비교 활성화`); } catch { message.error('기준선 로드 실패'); } };
  const baselineMap = useMemo((): Map<number, BaselineTaskSnapshot> => { if (!activeBaseline?.tasks) return new Map(); return new Map(activeBaseline.tasks.map(t => [t.taskId, t])); }, [activeBaseline]);

  const handleBulkDelete = () => {
    if (!project || selectedRowKeys.length === 0) return;
    const leafSel = selectedTasks.filter(t => !t.isGroup); const groupSel = selectedTasks.filter(t => t.isGroup);
    Modal.confirm({ title: `선택한 ${selectedRowKeys.length}개 작업을 삭제하시겠습니까?`, icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />, content: (<div style={{ marginTop: 8 }}>{leafSel.length > 0 && <div>• 작업 {leafSel.length}개</div>}{groupSel.length > 0 && <div style={{ color: '#ff4d4f' }}>• 그룹 {groupSel.length}개 (⚠ 하위 작업 포함)</div>}<div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8 }}>이 작업은 되돌릴 수 없습니다.</div></div>), okText: `${selectedRowKeys.length}개 삭제`, cancelText: '취소', okButtonProps: { danger: true },
      onOk: async () => { setBulkDelLoading(true); try { const sorted = [...selectedTasks].sort((a, b) => a.wbsLevel - b.wbsLevel); const deleted = new Set<number>(); for (const task of sorted) { if (deleted.has(task.taskId)) continue; await wbsApi.deleteTask(project.projectId, task.taskId); deleted.add(task.taskId); flattenTree(task.children ?? []).forEach(c => deleted.add(c.taskId)); } message.success(`✅ ${deleted.size}개 작업 삭제 완료`); setSelectedRowKeys([]); reload(project.projectId); } catch (e) { message.error(apiErr(e, '삭제 실패')); } finally { setBulkDelLoading(false); } },
    });
  };

  const openAssign = (task: WbsTaskDto) => { setAssignTask(task); setCurAssignments(task.assignments ?? []); setSelUserIds([]); setMemberSearch(''); setAssignOpen(true); };
  const availableMembers = useMemo(() => members.filter(m => !curAssignments.find(a => a.userId === m.userId) && (!memberSearch || [m.displayName, m.username].some(v => v.toLowerCase().includes(memberSearch.toLowerCase())))), [members, curAssignments, memberSearch]);
  const allChecked  = availableMembers.length > 0 && availableMembers.every(m => selUserIds.includes(m.userId));
  const someChecked = availableMembers.some(m => selUserIds.includes(m.userId));
  const toggleAll   = () => allChecked ? setSelUserIds(p => p.filter(id => !availableMembers.find(m => m.userId === id))) : setSelUserIds(p => [...new Set([...p, ...availableMembers.map(m => m.userId)])]);
  const toggleUser  = (uid: number) => setSelUserIds(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);
  const patchAssignInTree = (taskId: number, next: AssignmentDto[]) => { const pn = (nodes: WbsTaskDto[]): WbsTaskDto[] => nodes.map(n => n.taskId === taskId ? { ...n, assignments: next } : { ...n, children: pn(n.children ?? []) }); setTreeTasks(prev => pn(prev)); };
  const handleAssignBulk = async () => { if (!assignTask || !project || selUserIds.length === 0) { message.warning('담당자를 선택하세요.'); return; } setAssignLoading(true); try { const results = await Promise.all(selUserIds.map(uid => assignApi.assign(project.projectId, assignTask.taskId, { userId: uid }))); const next = [...curAssignments]; results.forEach(r => { const idx = next.findIndex(a => a.userId === r.userId); idx >= 0 ? (next[idx] = r) : next.push(r); }); setCurAssignments(next); patchAssignInTree(assignTask.taskId, next); message.success(`${results.length}명 배정 완료`); setSelUserIds([]); } catch (e) { message.error(apiErr(e, '배정 실패')); } finally { setAssignLoading(false); } };
  const handleUnassign = async (userId: number) => { if (!assignTask || !project) return; try { await assignApi.unassign(project.projectId, assignTask.taskId, userId); const next = curAssignments.filter(a => a.userId !== userId); setCurAssignments(next); patchAssignInTree(assignTask.taskId, next); message.success('담당자 해제됨'); } catch (e) { message.error(apiErr(e, '해제 실패')); } };
  const openBulkAssign = () => { setBulkSelUserIds([]); setBulkMemberSearch(''); setBulkAssignOpen(true); };
  const bulkAvailableMembers = useMemo(() => members.filter(m => !bulkMemberSearch || [m.displayName, m.username].some(v => v.toLowerCase().includes(bulkMemberSearch.toLowerCase()))), [members, bulkMemberSearch]);
  const bulkAllChecked  = bulkAvailableMembers.length > 0 && bulkAvailableMembers.every(m => bulkSelUserIds.includes(m.userId));
  const bulkSomeChecked = bulkAvailableMembers.some(m => bulkSelUserIds.includes(m.userId));
  const toggleBulkAll   = () => bulkAllChecked ? setBulkSelUserIds([]) : setBulkSelUserIds(bulkAvailableMembers.map(m => m.userId));
  const toggleBulkUser  = (uid: number) => setBulkSelUserIds(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);
  const handleBulkAssignSubmit = async () => { if (!project || bulkSelUserIds.length === 0) { message.warning('담당자를 선택하세요.'); return; } const leafTasks = selectedTasks.filter(t => !t.isGroup); if (leafTasks.length === 0) { message.warning('선택된 작업이 없습니다.'); return; } setBulkLoading(true); try { await Promise.all(leafTasks.flatMap(task => bulkSelUserIds.map(uid => assignApi.assign(project.projectId, task.taskId, { userId: uid })))); reload(project.projectId); message.success(`✅ ${leafTasks.length}개 작업에 ${bulkSelUserIds.length}명 일괄 배정 완료`); setBulkAssignOpen(false); setSelectedRowKeys([]); } catch (e) { message.error(apiErr(e, '일괄 배정 실패')); } finally { setBulkLoading(false); } };

  const applyTemplate = async () => { if (!selTpl || !project) return; setTplLoading(true); try { await wbsApi.applyTemplate(project.projectId, selTpl); message.success(`${TEMPLATES.find(t => t.key === selTpl)?.title} 적용 완료!`); setTplOpen(false); setSelTpl(null); reload(project.projectId); } catch (e) { message.error(apiErr(e, '템플릿 적용 실패')); } finally { setTplLoading(false); } };

  const uploadProps: UploadProps = { accept: '.xlsx,.xlsm,.xls', showUploadList: false, beforeUpload: async file => { if (!project) return false; try { await excelApi.importXlGantt(project.projectId, file); message.success('Import 완료!'); reload(project.projectId); } catch { message.error('Import 실패'); } return false; } };

  const baselineCompareColumn: ColumnsType<WbsTaskDto>[number] = {
    title: <span style={{ color: '#fa8c16', fontSize: 11 }}><FlagOutlined style={{ marginRight: 3 }} />기준선 비교</span>, key: 'bl', width: 130,
    render: (_, r) => { const snap = baselineMap.get(r.taskId); if (!snap) return <Text style={{ fontSize: 11, color: '#ccc' }}>신규</Text>; const startDiff = (r.plannedStart && snap.plannedStart) ? dayjs(r.plannedStart).diff(dayjs(snap.plannedStart), 'day') : null; const progressDiff = +r.planProgress - +snap.planProgress; return (<div style={{ fontSize: 11, lineHeight: 1.6 }}>{startDiff !== null && startDiff !== 0 && <div style={{ color: startDiff > 0 ? '#ff4d4f' : '#52c41a' }}>시작 {startDiff > 0 ? `+${startDiff}` : startDiff}일</div>}{progressDiff !== 0 && <div style={{ color: progressDiff > 0 ? '#52c41a' : '#ff4d4f' }}>계획% {progressDiff > 0 ? `+${progressDiff.toFixed(0)}` : progressDiff.toFixed(0)}%</div>}{startDiff === 0 && progressDiff === 0 && <Text style={{ fontSize: 11, color: '#52c41a' }}>변동 없음</Text>}</div>); },
  };

  const baseColumns: ColumnsType<WbsTaskDto> = [
    { title: 'WBS', dataIndex: 'wbsCode', key: 'code', width: 100, fixed: 'left', render: (v, r) => <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: r.isGroup ? 700 : 400, color: LC[r.wbsLevel] ?? '#333' }}>{v}</Text> },
    {
      title: '작업명', dataIndex: 'taskName', key: 'name', width: 280, fixed: 'left',
      render: (v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {r.isGroup ? <FolderOutlined style={{ color: LC[r.wbsLevel], flexShrink: 0, fontSize: 13 }} /> : <FileOutlined style={{ color: '#bbb', flexShrink: 0, fontSize: 12 }} />}
          <Text strong={r.isGroup} style={{ fontSize: 13, color: r.isGroup ? LC[r.wbsLevel] : '#333', cursor: isClientViewer ? 'default' : 'pointer', flex: 1, minWidth: 0 }} ellipsis={{ tooltip: v }} onClick={e => { e.stopPropagation(); if (!isClientViewer) openEdit(r); }}>{v}</Text>
          {!isClientViewer && <Tooltip title="하위 작업 추가"><Button size="small" type="text" icon={<PlusOutlined />} className="child-add-btn" style={{ flexShrink: 0, color: '#2E75B6', padding: '0 3px', opacity: 0.3 }} onClick={e => { e.stopPropagation(); openChildAdd(r); }} /></Tooltip>}
        </div>
      ),
    },
    {
      title: <Space size={3}><CalendarOutlined style={{ color: '#2E75B6' }} />계획 기간</Space>, key: 'period', width: 185,
      render: (_, r) => (
        <InlineDateRange startVal={r.plannedStart} endVal={r.plannedEnd} mode="plan" onSave={(s, e) => savePlanPeriod(r, s, e)} disabled={isClientViewer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {r.plannedStart ? <Text style={{ fontSize: 12, color: '#333' }}>{r.plannedStart} ~ {r.plannedEnd ?? '?'}</Text> : <Text style={{ fontSize: 12, color: '#ccc' }}>{isClientViewer ? '-' : '클릭하여 입력'}</Text>}
            {!isClientViewer && <EditOutlined style={{ fontSize: 10, color: '#ccc', marginLeft: 2 }} />}
          </div>
        </InlineDateRange>
      ),
    },
    {
      title: <Space size={3}><CheckCircleOutlined style={{ color: '#52c41a' }} />실제 기간</Space>, key: 'aperiod', width: 185,
      render: (_, r) => (
        <InlineDateRange startVal={r.actualStart} endVal={r.actualEnd} mode="actual" onSave={(s, e) => saveActualPeriod(r, s, e)} disabled={isClientViewer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {r.actualStart ? <Text style={{ fontSize: 12, color: '#2E75B6' }}>{r.actualStart} ~ {r.actualEnd ?? '진행중'}</Text> : <Text style={{ fontSize: 12, color: '#ccc' }}>{isClientViewer ? '-' : '클릭하여 입력'}</Text>}
            {!isClientViewer && <EditOutlined style={{ fontSize: 10, color: '#ccc', marginLeft: 2 }} />}
          </div>
        </InlineDateRange>
      ),
    },
    {
      title: <Space size={3}><TeamOutlined />담당자</Space>, key: 'asgn', width: 120,
      render: (_, r) => {
        const assignments = r.assignments ?? [];
        if (isClientViewer) {
          return assignments.length > 0
            ? <Text style={{ fontSize: 12, color: '#555' }}><EyeOutlined style={{ marginRight: 4, color: '#bbb' }} />{assignments.length}명</Text>
            : <Text type="secondary" style={{ fontSize: 11 }}>미지정</Text>;
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            {assignments.length > 0 ? assignments.map((a, i) => (<Tooltip key={a.userId} title={a.displayName}><Avatar size={22} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], fontSize: 10, fontWeight: 700, border: '1.5px solid #fff', marginLeft: i > 0 ? -6 : 0, cursor: 'default' }}>{a.displayName[0]}</Avatar></Tooltip>)) : <Text type="secondary" style={{ fontSize: 11 }}>미지정</Text>}
            {!r.isGroup && <Tooltip title="담당자 배정"><Button size="small" type="link" icon={<UserAddOutlined />} style={{ padding: '0 2px', color: '#aaa', height: 'auto', marginLeft: 3 }} onClick={e => { e.stopPropagation(); openAssign(r); }} /></Tooltip>}
          </div>
        );
      },
    },
    {
      title: 'M/D', dataIndex: 'totalWorkload', key: 'wd', width: 75, align: 'right',
      render: (v, r) => (
        <InlineNumber value={+v} label="총 Man-Day" step={0.5} suffix="d" onSave={val => saveField(r, { totalWorkload: val })} disabled={isClientViewer}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            <Text style={{ fontSize: 12, color: +v > 0 ? '#333' : '#ccc' }}>{+v > 0 ? `${+v}d` : '-'}</Text>
            {!isClientViewer && <EditOutlined style={{ fontSize: 9, color: '#ccc' }} />}
          </div>
        </InlineNumber>
      ),
    },
    {
      title: '계획%', dataIndex: 'planProgress', key: 'pp', width: 115,
      render: (v, r) => (
        <InlineNumber value={Math.round(+v)} label="계획 진척율" max={100} step={5} suffix="%" onSave={val => saveField(r, { planProgress: val })} disabled={isClientViewer}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 11, color: '#2E75B6', fontWeight: 600 }}>{(+v).toFixed(0)}%</Text>
              {!isClientViewer && <EditOutlined style={{ fontSize: 9, color: '#ccc' }} />}
            </div>
            <Progress percent={Math.round(+v)} strokeColor="#2E75B6" showInfo={false} size="small" strokeWidth={5} style={{ margin: 0 }} />
          </div>
        </InlineNumber>
      ),
    },
    {
      title: '실적%', dataIndex: 'actualProgress', key: 'ap', width: 125,
      render: (v, r) => { const late = +r.planProgress > +v + 5, done = +v >= 100; const color = done ? '#52c41a' : late ? '#ff4d4f' : '#2E75B6'; return (<div style={{ cursor: (!isClientViewer && !r.isGroup) ? 'pointer' : 'default' }} onClick={() => !isClientViewer && !r.isGroup && openProg(r)}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Text style={{ fontSize: 11, color, fontWeight: 600 }}>{(+v).toFixed(0)}%</Text>{done && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} />}{late && !done && <Text style={{ fontSize: 10, color: '#ff4d4f' }}>▼지연</Text>}{!isClientViewer && !r.isGroup && <EditOutlined style={{ fontSize: 10, color: '#ddd', marginLeft: 'auto' }} />}</div><Progress percent={Math.round(+v)} strokeColor={color} showInfo={false} size="small" strokeWidth={5} style={{ margin: 0 }} /></div>); },
    },
    {
      title: '산출물', dataIndex: 'deliverable', key: 'dlv', width: 110,
      render: (v, r) => {
        if (isClientViewer) return v ? <Tooltip title={v}><Text style={{ fontSize: 12, maxWidth: 95 }} ellipsis>{v}</Text></Tooltip> : <Text style={{ color: '#ccc', fontSize: 12 }}>-</Text>;
        return (<Popover trigger="click" placement="bottomLeft" content={<div style={{ width: 220 }} onClick={ev => ev.stopPropagation()}><div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>📋 산출물</div><Input.TextArea defaultValue={v ?? ''} rows={2} autoFocus id={`dlv-${r.taskId}`} style={{ marginBottom: 8 }} /><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}><Button size="small">취소</Button><Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => { const el = document.getElementById(`dlv-${r.taskId}`) as HTMLTextAreaElement; saveField(r, { deliverable: el?.value || undefined }); }}>저장</Button></div></div>}><div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} onClick={ev => ev.stopPropagation()}>{v ? <Tooltip title={v}><Text style={{ fontSize: 12, maxWidth: 85 }} ellipsis>{v}</Text></Tooltip> : <Text style={{ color: '#ccc', fontSize: 12 }}>-</Text>}<EditOutlined style={{ fontSize: 9, color: '#ccc', flexShrink: 0 }} /></div></Popover>);
      },
    },
    ...(!isClientViewer ? [{
      title: '', key: 'act', width: 155, fixed: 'right' as const,
      render: (_: any, r: WbsTaskDto) => (
        <Space size={1} className="row-actions">
          <Tooltip title="위로"><Button size="small" type="text" icon={<ArrowUpOutlined />} loading={movingTaskId === r.taskId} style={{ color: '#555', padding: '0 2px' }} onClick={e => { e.stopPropagation(); handleMove(r, 'up'); }} /></Tooltip>
          <Tooltip title="아래로"><Button size="small" type="text" icon={<ArrowDownOutlined />} loading={movingTaskId === r.taskId} style={{ color: '#555', padding: '0 2px' }} onClick={e => { e.stopPropagation(); handleMove(r, 'down'); }} /></Tooltip>
          <Tooltip title="그룹 이동"><Button size="small" type="text" icon={<ScissorOutlined />} style={{ color: '#fa8c16', padding: '0 2px' }} onClick={e => { e.stopPropagation(); openReparent(r); }} /></Tooltip>
          <Tooltip title="복사"><Button size="small" type="text" icon={<CopyOutlined />} style={{ color: '#13c2c2', padding: '0 2px' }} onClick={e => { e.stopPropagation(); openCopy(r); }} /></Tooltip>
          {!r.isGroup && <Tooltip title="담당자 배정"><Button size="small" icon={<UserAddOutlined />} style={{ borderColor: '#722ed1', color: '#722ed1' }} onClick={e => { e.stopPropagation(); openAssign(r); }} /></Tooltip>}
          <Popconfirm title={<><b>"{r.taskName}"</b> 삭제?{r.isGroup && <div style={{ color: '#ff4d4f', fontSize: 12 }}>⚠ 하위 작업도 삭제됩니다.</div>}</>} onConfirm={() => deleteTask(r)} okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}>
            <Button size="small" icon={<DeleteOutlined />} danger ghost onClick={e => e.stopPropagation()} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const columns: ColumnsType<WbsTaskDto> = useMemo(() => {
    if (!activeBaseline) return baseColumns;
    const insertIdx = baseColumns.findIndex(c => c.key === 'aperiod');
    const result = [...baseColumns]; result.splice(insertIdx + 1, 0, baselineCompareColumn); return result;
  }, [activeBaseline, baselineMap, treeTasks, isClientViewer]);

  const rowSelection = isClientViewer ? undefined : { selectedRowKeys, onChange: (keys: React.Key[]) => setSelectedRowKeys(keys), getCheckboxProps: (r: WbsTaskDto) => ({ disabled: r.isGroup }), renderCell: (_: boolean, r: WbsTaskDto, __: number, originNode: React.ReactNode) => r.isGroup ? null : originNode };
  const totalScrollX = activeBaseline ? 1600 : (isClientViewer ? 1200 : 1560);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} size="small" type="text" style={{ color: '#888', padding: 0, marginBottom: 4 }} onClick={() => navigate('/wbs/schedule')}>← 프로젝트 목록</Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Title level={4} style={{ margin: 0, color: '#1F4E79' }}>{project?.name ?? '로딩 중...'}</Title>
            {project && <Tag color="processing" style={{ fontSize: 11 }}>{project.startDate} ~ {project.endDate}</Tag>}
            {isClientViewer && <Tag color="green" icon={<EyeOutlined />}>열람 전용</Tag>}
            {activeBaseline && <Tag color="orange" icon={<FlagOutlined />} closable onClose={() => setActiveBaseline(null)} style={{ fontWeight: 600 }}>기준선 비교: {activeBaseline.name}</Tag>}
          </div>
        </Col>
        <Col>
          <Space wrap size={6}>
            <Button icon={<SyncOutlined />} onClick={() => project && reload(project.projectId)} />
            <Tooltip title={allExpanded ? '전체 접기' : '전체 펼치기'}><Button icon={allExpanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />} onClick={toggleExpandAll} /></Tooltip>
            {!isClientViewer && (
              <>
                <Tooltip title="WBS 코드 재정렬"><Button icon={<SortAscendingOutlined />} onClick={async () => { if (!project) return; try { await wbsApi.reorderCodes(project.projectId); message.success('WBS 코드 재정렬 완료'); reload(project.projectId); } catch { message.error('재정렬 실패'); } }} /></Tooltip>
                <Tooltip title="기준선 저장"><Button icon={<SaveOutlined />} style={{ borderColor: '#fa8c16', color: '#fa8c16' }} onClick={() => { setBaselineSaveName(''); setBaselineSaveDesc(''); setBaselineSaveOpen(true); }}>기준선 저장</Button></Tooltip>
              </>
            )}
            <Badge count={baselines.length} size="small" color="#fa8c16">
              <Tooltip title="기준선 목록 / 비교"><Button icon={<HistoryOutlined />} onClick={openBaselineList}>기준선</Button></Tooltip>
            </Badge>
            {!isClientViewer && (
              <>
                <Upload {...uploadProps}><Button icon={<UploadOutlined />}>Import</Button></Upload>
                <Button icon={<DownloadOutlined />} onClick={() => project && excelApi.exportExcel(project.projectId, project.name)}>Export</Button>
                <Button icon={<AppstoreAddOutlined />} style={{ borderColor: '#4472C4', color: '#4472C4' }} onClick={() => setTplOpen(true)}>템플릿</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { addForm.resetFields(); addForm.setFieldsValue({ isGroup: false, weight: 1 }); setAddOpen(true); }}>작업 추가</Button>
              </>
            )}
          </Space>
        </Col>
      </Row>

      {treeTasks.length > 0 && (
        <Row gutter={8} style={{ marginBottom: 10 }}>
          {[{ label: '전체', value: leaves.length, color: '#1F4E79' }, { label: '완료', value: completedCnt, color: '#52c41a' }, { label: '지연', value: delayedCnt, color: delayedCnt ? '#ff4d4f' : '#52c41a' }, { label: '계획 진척율', value: `${planAvg.toFixed(1)}%`, color: '#2E75B6' }, { label: '실적 진척율', value: `${actualAvg.toFixed(1)}%`, color: actualAvg >= planAvg ? '#52c41a' : '#ff4d4f' }].map(s => (
            <Col key={s.label}><div style={{ background: '#FAFBFF', border: '1px solid #E8EDF5', borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: '5px 12px', minWidth: 85 }}><Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text><div style={{ color: s.color, fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{s.value}</div></div></Col>
          ))}
          {teams.length > 0 && (<Col><div style={{ background: '#FAFBFF', border: '1px solid #E8EDF5', borderRadius: 8, padding: '5px 12px' }}><Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>팀 현황</Text><Space size={4}>{teams.map(t => <Tag key={t.teamId} style={{ background: `${t.color}20`, borderColor: t.color, color: t.color, fontSize: 11, margin: 0 }}>{t.name}</Tag>)}</Space></div></Col>)}
        </Row>
      )}

      {treeTasks.length > 0 && !isClientViewer && (
        <Alert type="info" showIcon closable message={<Text style={{ fontSize: 12 }}>💡 작업명 클릭 → 수정 &nbsp;|&nbsp; <PlusOutlined style={{ color: '#2E75B6' }} /> 하위 추가 &nbsp;|&nbsp; <ArrowUpOutlined /><ArrowDownOutlined /> 순서 이동 &nbsp;|&nbsp; <ScissorOutlined style={{ color: '#fa8c16' }} /> 그룹 이동 &nbsp;|&nbsp; <CopyOutlined style={{ color: '#13c2c2' }} /> 복사</Text>} style={{ marginBottom: 10, padding: '4px 12px' }} />
      )}
      {treeTasks.length > 0 && isClientViewer && (
        <Alert type="info" showIcon message={<Text style={{ fontSize: 12 }}><EyeOutlined style={{ marginRight: 4 }} />열람 전용 계정입니다. 데이터 조회 및 기준선 비교 기능을 사용할 수 있습니다.</Text>} style={{ marginBottom: 10, padding: '4px 12px' }} />
      )}

      {!isClientViewer && selectedRowKeys.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 16px', marginBottom: 10, background: '#F5F0FF', border: '1px solid #D3ADF7', borderRadius: 10 }}>
          <Text style={{ fontWeight: 600, color: '#722ed1', fontSize: 13, marginRight: 4 }}><CheckCircleOutlined style={{ marginRight: 6 }} />{selectedRowKeys.length}개 작업 선택됨</Text>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={openBulkAssign} style={{ background: '#722ed1', borderColor: '#722ed1' }}>담당자 일괄 배정</Button>
          <Button danger icon={<DeleteOutlined />} loading={bulkDelLoading} onClick={handleBulkDelete}>선택 삭제</Button>
          <Button size="small" type="text" onClick={() => setSelectedRowKeys([])} style={{ color: '#aaa', marginLeft: 'auto' }}>선택 해제</Button>
        </div>
      )}

      {treeTasks.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <AppstoreAddOutlined style={{ fontSize: 52, color: '#d9d9d9', marginBottom: 14 }} />
          <div style={{ color: '#aaa', marginBottom: 18, fontSize: 14 }}>WBS 데이터가 없습니다.{!isClientViewer && <><br />템플릿으로 빠르게 시작하거나 직접 추가하세요.</>}</div>
          {!isClientViewer && <Space><Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={() => setTplOpen(true)}>템플릿으로 시작</Button><Button size="large" icon={<PlusOutlined />} onClick={() => { addForm.resetFields(); addForm.setFieldsValue({ isGroup: false, weight: 1 }); setAddOpen(true); }}>직접 추가</Button></Space>}
        </div>
      )}

      {treeTasks.length > 0 && (
        <Spin spinning={loading}>
          <Table dataSource={treeTasks} columns={columns} rowKey="taskId" size="small" scroll={{ x: totalScrollX }}
            rowSelection={rowSelection}
            expandable={{ expandedRowKeys: expandedKeys, onExpand: (expanded, record) => toggleExpand(record.taskId, expanded), expandIcon: ({ expanded, onExpand, record }) => (record.children?.length ?? 0) > 0 ? (<span onClick={e => { e.stopPropagation(); onExpand(record, e as any); }} style={{ cursor: 'pointer', marginRight: 4, userSelect: 'none', color: LC[record.wbsLevel] ?? '#888', fontSize: 13 }}>{expanded ? '▼' : '▶'}</span>) : <span style={{ display: 'inline-block', width: 17 }} />, indentSize: 14 }}
            pagination={false}
            rowClassName={r => r.isGroup ? 'wbs-row-g' : +r.planProgress > +r.actualProgress + 5 ? 'wbs-row-d' : +r.actualProgress >= 100 ? 'wbs-row-ok' : ''}
          />
        </Spin>
      )}

      {/* 기준선 저장 Modal */}
      <Modal title={<><SaveOutlined style={{ color: '#fa8c16', marginRight: 8 }} />기준선 저장</>} open={baselineSaveOpen} onCancel={() => setBaselineSaveOpen(false)} onOk={handleBaselineSave} okText="저장" cancelText="취소" confirmLoading={baselineSaveBusy} destroyOnClose width={420}>
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FFF7E6', border: '1px solid #ffd591', borderRadius: 6, fontSize: 12, color: '#666' }}>📌 현재 시점의 <b>모든 작업의 계획 정보</b>를 스냅샷으로 저장합니다.</div>
        <div style={{ marginBottom: 8 }}><div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>기준선 이름 <span style={{ color: '#aaa' }}>(생략 시 자동 생성)</span></div><Input placeholder="예: 1차 기준선, 계약 기준선" value={baselineSaveName} onChange={e => setBaselineSaveName(e.target.value)} onPressEnter={handleBaselineSave} autoFocus /></div>
        <div><div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>설명 <span style={{ color: '#aaa' }}>(선택)</span></div><Input.TextArea rows={2} value={baselineSaveDesc} onChange={e => setBaselineSaveDesc(e.target.value)} /></div>
      </Modal>

      {/* 기준선 목록 Modal */}
      <Modal title={<><HistoryOutlined style={{ marginRight: 8 }} />기준선 관리</>} open={baselineListOpen} onCancel={() => setBaselineListOpen(false)} footer={<Button onClick={() => setBaselineListOpen(false)}>닫기</Button>} width={620} destroyOnClose>
        {!isClientViewer && <Button icon={<SaveOutlined />} style={{ marginBottom: 12, borderColor: '#fa8c16', color: '#fa8c16' }} onClick={() => { setBaselineSaveName(''); setBaselineSaveDesc(''); setBaselineListOpen(false); setBaselineSaveOpen(true); }}>새 기준선 저장</Button>}
        <Spin spinning={baselineLoading}>
          {baselines.length === 0 ? <Empty description="저장된 기준선이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{baselines.map(b => (
                <div key={b.baselineId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${activeBaseline?.baselineId === b.baselineId ? '#fa8c16' : '#f0f0f0'}`, borderRadius: 8, background: activeBaseline?.baselineId === b.baselineId ? '#FFF7E6' : '#fafafa' }}>
                  <FlagOutlined style={{ color: '#fa8c16', fontSize: 16, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{b.name}</div>
                    {b.description && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{b.description}</div>}
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{dayjs(b.createdAt).format('YYYY-MM-DD HH:mm')} · {b.taskCount}개 작업 스냅샷</div>
                  </div>
                  <Space size={6}>
                    <Button size="small" type={activeBaseline?.baselineId === b.baselineId ? 'primary' : 'default'} style={activeBaseline?.baselineId === b.baselineId ? { background: '#fa8c16', borderColor: '#fa8c16' } : { borderColor: '#fa8c16', color: '#fa8c16' }} onClick={() => handleBaselineCompare(b.baselineId)}>{activeBaseline?.baselineId === b.baselineId ? '비교 중단' : '비교'}</Button>
                    {!isClientViewer && <Popconfirm title="이 기준선을 삭제하시겠습니까?" okText="삭제" cancelText="취소" okButtonProps={{ danger: true }} onConfirm={() => handleBaselineDelete(b.baselineId)}><Button size="small" icon={<DeleteOutlined />} danger ghost /></Popconfirm>}
                  </Space>
                </div>
              ))}</div>}
        </Spin>
      </Modal>

      {/* 복사 Modal */}
      <Modal title={<div><div style={{ fontWeight: 700, fontSize: 15 }}><CopyOutlined style={{ color: '#13c2c2', marginRight: 8 }} />작업 복사</div>{copyModal && <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>복사 대상: <span style={{ color: LC[copyModal.task.wbsLevel] ?? '#2E75B6', fontWeight: 600 }}>[{copyModal.task.wbsCode}] {copyModal.task.taskName}</span></div>}</div>}
        open={!!copyModal?.open} onCancel={() => { setCopyModal(null); setCopyTarget(null); }} onOk={submitCopy} okText="복사" cancelText="취소" confirmLoading={copyLoading} okButtonProps={{ style: { background: '#13c2c2', borderColor: '#13c2c2' } }} destroyOnClose width={460}>
        <div style={{ marginBottom: 10, fontSize: 12, color: '#666' }}>복사할 위치를 선택하세요.</div>
        {copyTarget !== null && (<div style={{ marginBottom: 10, padding: '6px 12px', background: '#E6FFFB', border: '1px solid #87e8de', borderRadius: 6, fontSize: 12 }}>위치: <b style={{ color: '#13c2c2' }}>{copyTarget === 'same' || copyTarget === null ? '원본과 같은 위치' : copyTarget === '0' ? '최상위 (루트)' : (() => { const t = flatTasks.find(t => String(t.taskId) === copyTarget); return t ? `[${t.wbsCode}] ${t.taskName}` : ''; })()}</b></div>)}
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 4px', maxHeight: 300, overflowY: 'auto' }}>
          <Tree treeData={copyTreeData} selectedKeys={copyTarget ? [copyTarget] : ['same']} onSelect={keys => { if (keys.length === 0) return; const k = String(keys[0]); setCopyTarget(k === 'same' ? null : k); }} defaultExpandAll blockNode />
        </div>
      </Modal>

      {/* 부모 변경 Modal */}
      <Modal title={<div><div style={{ fontWeight: 700, fontSize: 15 }}><ScissorOutlined style={{ color: '#fa8c16', marginRight: 8 }} />작업 위치 변경</div>{reparentModal && <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>이동 대상: <span style={{ color: LC[reparentModal.task.wbsLevel] ?? '#2E75B6', fontWeight: 600 }}>[{reparentModal.task.wbsCode}] {reparentModal.task.taskName}</span></div>}</div>}
        open={!!reparentModal?.open} onCancel={() => { setReparentModal(null); setReparentTarget(null); }} onOk={submitReparent} okText="이동" cancelText="취소" confirmLoading={reparentLoading} okButtonProps={{ disabled: reparentTarget === null, style: { background: '#fa8c16', borderColor: '#fa8c16' } }} destroyOnClose width={460}>
        <div style={{ marginBottom: 10, fontSize: 12, color: '#666' }}>이동할 위치(상위 그룹)를 선택하세요.</div>
        {reparentTarget !== null && (<div style={{ marginBottom: 10, padding: '6px 12px', background: '#FFF7E6', border: '1px solid #ffd591', borderRadius: 6, fontSize: 12 }}>선택: <b style={{ color: '#fa8c16' }}>{reparentTarget === '0' ? '최상위 (루트)' : (() => { const t = flatTasks.find(t => String(t.taskId) === reparentTarget); return t ? `[${t.wbsCode}] ${t.taskName}` : ''; })()}</b></div>)}
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 4px', maxHeight: 320, overflowY: 'auto' }}>
          <Tree treeData={reparentTreeData} selectedKeys={reparentTarget ? [reparentTarget] : []} onSelect={keys => setReparentTarget(keys.length > 0 ? String(keys[0]) : null)} defaultExpandAll blockNode />
        </div>
      </Modal>

      {/* 하위 작업 추가 Modal */}
      <Modal title={<div><div style={{ fontWeight: 700, fontSize: 15 }}><PlusOutlined style={{ color: '#2E75B6', marginRight: 8 }} />하위 작업 추가</div>{childAddModal && <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>상위: <span style={{ color: '#2E75B6' }}>{childAddModal.parentLabel}</span></div>}</div>}
        open={!!childAddModal?.open} onCancel={() => setChildAddModal(null)} onOk={submitChildAdd} okText={`${childAddItems.filter(it => it.name.trim()).length > 0 ? childAddItems.filter(it => it.name.trim()).length + '개 ' : ''}추가`} cancelText="취소" confirmLoading={childAddBusy} okButtonProps={{ disabled: childAddItems.every(it => !it.name.trim()) }} destroyOnClose width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
          {childAddItems.map((item, idx) => (
            <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#bbb', minWidth: 18, textAlign: 'right', paddingTop: 1 }}>{idx + 1}</span>
              <Input ref={idx === childAddItems.length - 1 ? lastInputRef : undefined} placeholder={`작업명 ${idx + 1}`} value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (idx === childAddItems.length - 1) addItem(); } }} style={{ flex: 1 }} autoFocus={idx === 0} />
              <Select size="small" value={item.isGroup} onChange={v => updateItem(item.id, 'isGroup', v)} style={{ width: 88 }}><Select.Option value={false}><FileOutlined style={{ marginRight: 3, color: '#aaa' }} />작업</Select.Option><Select.Option value={true}><FolderOutlined style={{ marginRight: 3, color: '#2E75B6' }} />그룹</Select.Option></Select>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={childAddItems.length === 1} onClick={() => removeItem(item.id)} style={{ padding: '0 4px', flexShrink: 0 }} />
            </div>
          ))}
        </div>
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addItem} style={{ marginTop: 8, color: '#2E75B6', borderColor: '#BDD7EE' }}>항목 추가</Button>
      </Modal>

      {/* 최상위 작업 추가 Drawer */}
      <Drawer title={<><PlusOutlined style={{ color: '#2E75B6', marginRight: 8 }} />작업 추가 (최상위)</>} open={addOpen} onClose={() => setAddOpen(false)} width={440} destroyOnClose footer={<div style={{ textAlign: 'right' }}><Space><Button onClick={() => setAddOpen(false)}>취소</Button><Button type="primary" loading={addLoading} icon={<PlusOutlined />} onClick={() => addForm.submit()}>추가</Button></Space></div>}>
        <Form form={addForm} layout="vertical" onFinish={submitAdd} initialValues={{ isGroup: false, weight: 1 }}>
          <Form.Item name="taskName" label="작업명 *" rules={[{ required: true }]}><Input placeholder="예: 1단계 분석" size="large" autoFocus /></Form.Item>
          <Row gutter={12}><Col span={12}><Form.Item name="isGroup" label="유형"><Select><Select.Option value={false}><FileOutlined style={{ marginRight: 6, color: '#aaa' }} />작업</Select.Option><Select.Option value={true}><FolderOutlined style={{ marginRight: 6, color: '#2E75B6' }} />그룹</Select.Option></Select></Form.Item></Col><Col span={12}><Form.Item name="weight" label="가중치"><InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Divider style={{ margin: '10px 0' }}>📅 계획 일정</Divider>
          <Row gutter={12}><Col span={12}><Form.Item name="plannedStart" label="시작일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="plannedEnd" label="완료일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Divider style={{ margin: '10px 0' }}>📋 부가 정보</Divider>
          <Form.Item name="deliverable" label="산출물"><Input /></Form.Item>
          <Form.Item name="notes" label="비고"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Drawer>

      {/* 수정 Drawer */}
      <Drawer title={<><EditOutlined style={{ color: '#2E75B6', marginRight: 8 }} />작업 수정{editTask && <Tag color="blue" style={{ marginLeft: 8 }}>{editTask.wbsCode}</Tag>}</>} open={editOpen} onClose={() => setEditOpen(false)} width={500} destroyOnClose footer={<div style={{ textAlign: 'right' }}><Space><Button onClick={() => setEditOpen(false)}>취소</Button><Button type="primary" loading={editLoading} icon={<CheckCircleOutlined />} onClick={() => editForm.submit()}>저장</Button></Space></div>}>
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item name="taskName" label="작업명 *" rules={[{ required: true }]}><Input size="large" /></Form.Item>
          <Row gutter={12}><Col span={12}><Form.Item name="isGroup" label="유형"><Select><Select.Option value={false}>작업</Select.Option><Select.Option value={true}>그룹</Select.Option></Select></Form.Item></Col><Col span={12}><Form.Item name="weight" label="가중치"><InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Divider style={{ margin: '10px 0' }}>📅 계획 일정</Divider>
          <Row gutter={12}><Col span={12}><Form.Item name="plannedStart" label="시작일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="plannedEnd" label="완료일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Divider style={{ margin: '10px 0' }}>✅ 실적 일정</Divider>
          <Row gutter={12}><Col span={12}><Form.Item name="actualStart" label="실제 시작일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="actualEnd" label="실제 완료일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Divider style={{ margin: '10px 0' }}>📊 작업량</Divider>
          <Row gutter={12}><Col span={8}><Form.Item name="totalWorkload" label="총 M/D"><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="plannedWorkload" label="계획 M/D"><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="planProgress" label="계획 진척%"><InputNumber min={0} max={100} step={5} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Divider style={{ margin: '10px 0' }}>📋 부가 정보</Divider>
          <Form.Item name="deliverable" label="산출물"><Input /></Form.Item>
          <Form.Item name="notes" label="비고"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Drawer>

      {/* 담당자 배정 Drawer */}
      <Drawer title={<div><div style={{ fontWeight: 700, fontSize: 15 }}><UserAddOutlined style={{ color: '#722ed1', marginRight: 8 }} />담당자 배정{assignTask && <Tag color="purple" style={{ marginLeft: 8 }}>{assignTask.wbsCode}</Tag>}</div>{assignTask && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{assignTask.taskName}</div>}</div>} open={assignOpen} onClose={() => setAssignOpen(false)} width={480} destroyOnClose>
        <div style={{ marginBottom: 16 }}><Text strong style={{ fontSize: 13 }}>현재 담당자 ({curAssignments.length}명)</Text>{curAssignments.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="배정된 담당자가 없습니다" style={{ margin: '10px 0' }} /> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{curAssignments.map((a, i) => { const team = teams.find(t => t.teamId === a.teamId); return (<Tag key={a.userId} closable onClose={() => Modal.confirm({ title: `"${a.displayName}" 해제?`, okText: '해제', cancelText: '취소', okButtonProps: { danger: true }, onOk: () => handleUnassign(a.userId) })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, background: team?.color ? `${team.color}15` : '#F0F5FF', borderColor: team?.color ?? '#BDD7EE', color: team?.color ?? '#2E75B6' }}><Avatar size={18} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], fontSize: 9 }}>{a.displayName[0]}</Avatar>{a.displayName}</Tag>); })}</div>}</div>
        <Divider style={{ margin: '12px 0' }}><Text style={{ fontSize: 13, fontWeight: 600, color: '#722ed1' }}>멤버 추가</Text></Divider>
        <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="이름 / 아이디 검색" allowClear value={memberSearch} onChange={e => setMemberSearch(e.target.value)} style={{ marginBottom: 8 }} />
        {availableMembers.length > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#F5F0FF', borderRadius: '8px 8px 0 0', border: '1px solid #D3ADF7', borderBottom: 'none' }}><Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} onChange={toggleAll}><Text style={{ fontSize: 12, fontWeight: 600, color: '#722ed1' }}>전체 선택 ({availableMembers.length}명)</Text></Checkbox>{selUserIds.length > 0 && <Tag color="purple" style={{ fontWeight: 600 }}>{selUserIds.length}명 선택됨</Tag>}</div>}
        <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${availableMembers.length > 0 ? '#D3ADF7' : '#E8EDF5'}`, borderRadius: availableMembers.length > 0 ? '0 0 8px 8px' : 8 }}>{members.length === 0 ? <Alert type="warning" message="프로젝트 멤버가 없습니다." showIcon style={{ border: 'none', borderRadius: 0 }} /> : availableMembers.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 12 }}>{memberSearch ? '검색 결과 없음' : '모든 멤버가 이미 배정되었습니다.'}</div> : availableMembers.map((m, i) => { const checked = selUserIds.includes(m.userId); return (<div key={m.userId} onClick={() => toggleUser(m.userId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < availableMembers.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer', background: checked ? '#F5F0FF' : 'transparent' }}><Checkbox checked={checked} onClick={e => e.stopPropagation()} onChange={() => toggleUser(m.userId)} /><Avatar size={30} style={{ background: checked ? '#722ed1' : '#bbb', fontSize: 12 }}>{m.displayName[0]}</Avatar><div style={{ flex: 1 }}><div style={{ fontWeight: checked ? 600 : 400, fontSize: 13, color: checked ? '#722ed1' : '#333' }}>{m.displayName}</div><div style={{ fontSize: 11, color: '#999' }}>@{m.username}{m.role ? ` · ${m.role}` : ''}</div></div>{checked && <CheckCircleOutlined style={{ color: '#722ed1', fontSize: 14 }} />}</div>); })}</div>
        <Button type="primary" block icon={<UserAddOutlined />} loading={assignLoading} disabled={selUserIds.length === 0} onClick={handleAssignBulk} style={{ marginTop: 14, height: 42, fontSize: 14, background: '#722ed1', borderColor: '#722ed1' }}>{selUserIds.length > 0 ? `선택한 ${selUserIds.length}명 배정하기` : '담당자를 선택하세요'}</Button>
      </Drawer>

      {/* 일괄 배정 Modal */}
      <Modal title={<div><div style={{ fontWeight: 700, fontSize: 16 }}><ThunderboltOutlined style={{ color: '#722ed1', marginRight: 8 }} />담당자 일괄 배정</div><div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>선택된 <b style={{ color: '#722ed1' }}>{selectedTasks.filter(t => !t.isGroup).length}개</b> 작업에 담당자를 한 번에 배정합니다.</div></div>} open={bulkAssignOpen} onCancel={() => setBulkAssignOpen(false)} onOk={handleBulkAssignSubmit} okText={bulkSelUserIds.length > 0 ? `${bulkSelUserIds.length}명 × ${selectedTasks.filter(t => !t.isGroup).length}개 배정` : '담당자를 선택하세요'} cancelText="취소" okButtonProps={{ disabled: bulkSelUserIds.length === 0, loading: bulkLoading, style: { background: '#722ed1', borderColor: '#722ed1' } }} destroyOnClose width={560}>
        <div style={{ marginBottom: 14 }}><Text strong style={{ fontSize: 12, color: '#666' }}>배정 대상 작업 ({selectedTasks.filter(t => !t.isGroup).length}개)</Text><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, maxHeight: 80, overflowY: 'auto', padding: '6px 8px', background: '#F8F9FF', borderRadius: 8, border: '1px solid #E8EDF5' }}>{selectedTasks.filter(t => !t.isGroup).map(t => <Tag key={t.taskId} style={{ fontSize: 11 }}>[{t.wbsCode}] {t.taskName}</Tag>)}{selectedTasks.filter(t => t.isGroup).length > 0 && <Text style={{ fontSize: 11, color: '#aaa' }}>(그룹 {selectedTasks.filter(t => t.isGroup).length}개 제외)</Text>}</div></div>
        <Text strong style={{ fontSize: 12, color: '#666' }}>배정할 담당자 선택</Text>
        <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="이름 / 아이디 검색" allowClear value={bulkMemberSearch} onChange={e => setBulkMemberSearch(e.target.value)} style={{ marginTop: 8, marginBottom: 6 }} />
        {bulkAvailableMembers.length > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#F5F0FF', borderRadius: '8px 8px 0 0', border: '1px solid #D3ADF7', borderBottom: 'none' }}><Checkbox checked={bulkAllChecked} indeterminate={bulkSomeChecked && !bulkAllChecked} onChange={toggleBulkAll}><Text style={{ fontSize: 12, fontWeight: 600, color: '#722ed1' }}>전체 선택 ({bulkAvailableMembers.length}명)</Text></Checkbox>{bulkSelUserIds.length > 0 && <Tag color="purple" style={{ fontWeight: 600 }}>{bulkSelUserIds.length}명 선택됨</Tag>}</div>}
        <div style={{ maxHeight: 280, overflowY: 'auto', border: `1px solid ${bulkAvailableMembers.length > 0 ? '#D3ADF7' : '#E8EDF5'}`, borderRadius: bulkAvailableMembers.length > 0 ? '0 0 8px 8px' : 8 }}>{members.length === 0 ? <Alert type="warning" message="프로젝트 멤버가 없습니다." showIcon style={{ border: 'none' }} /> : bulkAvailableMembers.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 12 }}>검색 결과 없음</div> : bulkAvailableMembers.map((m, i) => { const checked = bulkSelUserIds.includes(m.userId); return (<div key={m.userId} onClick={() => toggleBulkUser(m.userId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < bulkAvailableMembers.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer', background: checked ? '#F5F0FF' : 'transparent', transition: 'background 0.12s' }}><Checkbox checked={checked} onClick={e => e.stopPropagation()} onChange={() => toggleBulkUser(m.userId)} /><Avatar size={32} style={{ background: checked ? '#722ed1' : '#bbb', fontSize: 13, flexShrink: 0 }}>{m.displayName[0]}</Avatar><div style={{ flex: 1 }}><div style={{ fontWeight: checked ? 600 : 400, fontSize: 13, color: checked ? '#722ed1' : '#333' }}>{m.displayName}</div><div style={{ fontSize: 11, color: '#999' }}>@{m.username}{m.role ? ` · ${m.role}` : ''}</div></div>{checked && <CheckCircleOutlined style={{ color: '#722ed1', fontSize: 15 }} />}</div>); })}</div>
        {bulkSelUserIds.length > 0 && <div style={{ marginTop: 12, padding: '8px 12px', background: '#F5F0FF', borderRadius: 8, border: '1px solid #D3ADF7', fontSize: 12, color: '#722ed1' }}>⚡ <b>{selectedTasks.filter(t => !t.isGroup).length}개 작업</b>에 <b>{bulkSelUserIds.length}명</b> 배정</div>}
      </Modal>

      {/* 진척율 Modal */}
      <Modal title={<><PercentageOutlined style={{ color: '#52c41a', marginRight: 8 }} />진척율 입력{progTask && <Tag color="blue" style={{ marginLeft: 8 }}>{progTask.wbsCode}</Tag>}</>} open={progOpen} onCancel={() => setProgOpen(false)} onOk={() => progForm.submit()} okText="저장" cancelText="취소" confirmLoading={progLoading} destroyOnClose width={480}>
        {progTask && <div style={{ background: '#F0F5FF', border: '1px solid #BDD7EE', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}><Row justify="space-between"><Col><Text type="secondary" style={{ fontSize: 12 }}>계획 기간</Text><div style={{ fontSize: 13 }}>{progTask.plannedStart ?? '-'} ~ {progTask.plannedEnd ?? '-'}</div></Col><Col style={{ textAlign: 'right' }}><Text type="secondary" style={{ fontSize: 12 }}>계획 진척율</Text><div style={{ fontSize: 20, fontWeight: 700, color: '#2E75B6' }}>{(+progTask.planProgress).toFixed(0)}%</div></Col></Row></div>}
        <Form form={progForm} layout="vertical" onFinish={submitProg}>
          <div style={{ marginBottom: 8 }}><Space wrap>{[0, 10, 25, 50, 75, 90, 100].map(v => <Button key={v} size="small" type={sliderVal === v ? 'primary' : 'default'} style={v === 100 ? { borderColor: '#52c41a', color: sliderVal === 100 ? undefined : '#52c41a' } : {}} onClick={() => { setSliderVal(v); progForm.setFieldsValue({ actualProgress: v }); }}>{v === 100 ? '✅ 완료' : `${v}%`}</Button>)}</Space></div>
          <Form.Item name="actualProgress" label="실적 진척율 (%)" rules={[{ required: true }]}><Row gutter={12} align="middle"><Col flex="auto"><Slider min={0} max={100} step={5} value={sliderVal} onChange={v => { setSliderVal(v); progForm.setFieldsValue({ actualProgress: v }); }} trackStyle={{ background: sliderVal >= 100 ? '#52c41a' : '#2E75B6' }} marks={{ 0: '0', 25: '25', 50: '50', 75: '75', 100: '100' }} /></Col><Col style={{ width: 80 }}><InputNumber min={0} max={100} value={sliderVal} onChange={v => { setSliderVal(v ?? 0); progForm.setFieldsValue({ actualProgress: v }); }} style={{ width: '100%' }} addonAfter="%" /></Col></Row></Form.Item>
          <Steps size="small" current={sliderVal === 0 ? 0 : sliderVal < 50 ? 1 : sliderVal < 100 ? 2 : 3} style={{ marginBottom: 14 }} items={[{ title: '시작전' }, { title: '초반' }, { title: '후반' }, { title: '완료' }]} />
          <Row gutter={12}><Col span={12}><Form.Item name="actualStart" label="실제 시작일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="actualEnd" label="실제 완료일"><DatePicker style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Form.Item name="actualWorkload" label="실제 투입 Man-day"><InputNumber min={0} step={0.5} style={{ width: '100%' }} addonAfter="일" /></Form.Item>
          <Form.Item name="comment" label="코멘트"><Input.TextArea rows={2} placeholder="이슈, 특이사항 등" /></Form.Item>
        </Form>
      </Modal>

      {/* 템플릿 Modal */}
      <Modal title={<><AppstoreAddOutlined style={{ color: '#2E75B6', marginRight: 8 }} /><span style={{ fontWeight: 700 }}>WBS 템플릿 선택</span></>} open={tplOpen} onCancel={() => { setTplOpen(false); setSelTpl(null); }} onOk={applyTemplate} okText={selTpl ? `"${TEMPLATES.find(t => t.key === selTpl)?.title}" 적용` : '적용'} cancelText="취소" okButtonProps={{ disabled: !selTpl, loading: tplLoading }} width={660} destroyOnClose>
        <Alert type="warning" showIcon message="기존 WBS 데이터가 있으면 적용되지 않습니다." style={{ marginBottom: 14 }} />
        <Row gutter={[12, 12]}>{TEMPLATES.map(tpl => <Col span={8} key={tpl.key}><div onClick={() => setSelTpl(tpl.key)} style={{ border: selTpl === tpl.key ? `2px solid ${tpl.border}` : '1px solid #e8e8e8', background: selTpl === tpl.key ? tpl.color : '#fff', borderRadius: 12, padding: '16px 12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', boxShadow: selTpl === tpl.key ? `0 2px 12px ${tpl.border}40` : 'none' }}>{selTpl === tpl.key && <div style={{ color: tpl.border, fontWeight: 700, fontSize: 11, marginBottom: 4 }}>✓ 선택됨</div>}<div style={{ marginBottom: 8 }}>{tpl.icon}</div><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: selTpl === tpl.key ? tpl.border : '#333' }}>{tpl.title}</div><div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.6 }}>{tpl.desc}</div><Space wrap style={{ justifyContent: 'center', marginBottom: 6 }}>{tpl.tags.map(tag => <Tag key={tag} style={{ fontSize: 10, margin: '1px' }}>{tag}</Tag>)}</Space><div style={{ fontSize: 12, color: tpl.border, fontWeight: 600 }}>📋 {tpl.count}개 작업</div></div></Col>)}</Row>
      </Modal>

      <style>{`
        .wbs-row-g > td        { background: #F0F5FF !important; }
        .wbs-row-g:hover > td  { background: #E6EFFF !important; }
        .wbs-row-d > td        { background: #FFF2F0 !important; }
        .wbs-row-d:hover > td  { background: #FFE9E6 !important; }
        .wbs-row-ok > td       { background: #F6FFED !important; }
        .wbs-row-ok:hover > td { background: #EDFDE0 !important; }
        .row-actions { opacity: 0.2; transition: opacity 0.15s; }
        tr:hover .row-actions  { opacity: 1; }
        tr:hover .child-add-btn { opacity: 1 !important; }
        .ant-table-selection-column { width: 36px !important; min-width: 36px !important; }
      `}</style>
    </div>
  );
};

export default SchedulePage;
