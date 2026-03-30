import React, { useMemo } from 'react';
import { Empty, Spin, Tooltip, Tag } from 'antd';
import dayjs from 'dayjs';
import type { WbsTaskDto } from '@/types';

interface Props {
  tasks: WbsTaskDto[];
  loading?: boolean;
  onTaskClick?: (task: WbsTaskDto) => void;
}

const ROW_H = 32;
const LABEL_W = 380;
const DAY_W = 24;
const HEADER_H = 52;

const LEVEL_COLORS: Record<number, string> = {
  1: '#1F4E79', 2: '#2E75B6', 3: '#4472C4', 4: '#5B9BD5',
  5: '#70AD47', 6: '#ED7D31', 7: '#A9D18E', 8: '#9DC3E6',
};

function flattenTree(tasks: WbsTaskDto[], depth = 0): { task: WbsTaskDto; depth: number }[] {
  const result: { task: WbsTaskDto; depth: number }[] = [];
  tasks.forEach((t) => {
    result.push({ task: t, depth });
    if (t.children?.length) result.push(...flattenTree(t.children, depth + 1));
  });
  return result;
}

const GanttChart: React.FC<Props> = ({ tasks, loading, onTaskClick }) => {
  const flat = useMemo(() => flattenTree(tasks), [tasks]);

  const { minDate, maxDate, days } = useMemo(() => {
    const dates = flat.flatMap(({ task: t }) =>
      [t.plannedStart, t.plannedEnd, t.actualStart, t.actualEnd].filter(Boolean) as string[]
    );
    if (!dates.length) return { minDate: dayjs(), maxDate: dayjs().add(30, 'day'), days: 30 };
    const min = dayjs(dates.reduce((a, b) => (a < b ? a : b))).startOf('month');
    const max = dayjs(dates.reduce((a, b) => (a > b ? a : b))).endOf('month');
    return { minDate: min, maxDate: max, days: max.diff(min, 'day') + 1 };
  }, [flat]);

  const totalW = LABEL_W + days * DAY_W;

  // 월 헤더 그룹
  const months = useMemo(() => {
    const result: { label: string; x: number; w: number }[] = [];
    let cur = minDate.clone();
    while (cur.isBefore(maxDate) || cur.isSame(maxDate, 'day')) {
      const start = cur.diff(minDate, 'day');
      const daysInMonth = Math.min(cur.daysInMonth() - cur.date() + 1, days - start);
      result.push({ label: cur.format('YYYY년 MM월'), x: LABEL_W + start * DAY_W, w: daysInMonth * DAY_W });
      cur = cur.add(1, 'month').startOf('month');
    }
    return result;
  }, [minDate, maxDate, days]);

  const dayToX = (dateStr: string) =>
    LABEL_W + dayjs(dateStr).diff(minDate, 'day') * DAY_W;

  const today = dayjs();
  const todayX = LABEL_W + today.diff(minDate, 'day') * DAY_W;
  const totalH = HEADER_H + flat.length * ROW_H;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
      <Spin size="large" />
    </div>
  );
  if (!flat.length) return <Empty description="WBS 데이터가 없습니다." style={{ padding: 60 }} />;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)', border: '1px solid #e8e8e8', borderRadius: 8 }}>
      <svg width={totalW} height={totalH} style={{ display: 'block', fontFamily: 'inherit' }}>
        {/* 배경 */}
        <rect x={0} y={0} width={totalW} height={totalH} fill="#fff" />

        {/* 월 헤더 */}
        {months.map((m, i) => (
          <g key={i}>
            <rect x={m.x} y={0} width={m.w} height={26} fill={i % 2 === 0 ? '#1F4E79' : '#2E75B6'} />
            <text x={m.x + m.w / 2} y={17} fill="#fff" fontSize={11} fontWeight={600} textAnchor="middle">{m.label}</text>
          </g>
        ))}

        {/* 날짜 헤더 (주 단위) */}
        {Array.from({ length: Math.ceil(days / 7) }).map((_, wi) => {
          const d = minDate.add(wi * 7, 'day');
          const x = LABEL_W + wi * 7 * DAY_W;
          return (
            <g key={wi}>
              <rect x={x} y={26} width={7 * DAY_W} height={26} fill={wi % 2 === 0 ? '#EBF4FF' : '#F5F8FF'} />
              <text x={x + 4} y={41} fill="#555" fontSize={10}>{d.format('MM/DD')}</text>
              <line x1={x} y1={26} x2={x} y2={totalH} stroke="#e0e0e0" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* 레이블 헤더 */}
        <rect x={0} y={0} width={LABEL_W} height={HEADER_H} fill="#1F4E79" />
        <text x={12} y={30} fill="#fff" fontSize={12} fontWeight={700}>WBS 코드</text>
        <text x={120} y={30} fill="#fff" fontSize={12} fontWeight={700}>작업명</text>
        <text x={290} y={30} fill="#fff" fontSize={12} fontWeight={700}>담당자</text>
        <text x={12} y={47} fill="rgba(255,255,255,0.7)" fontSize={10}>진척율</text>

        {/* 오늘 선 */}
        {todayX >= LABEL_W && todayX <= totalW && (
          <line x1={todayX} y1={0} x2={todayX} y2={totalH} stroke="#ff4d4f" strokeWidth={1.5} strokeDasharray="4,3" />
        )}

        {/* 행 */}
        {flat.map(({ task: t, depth }, i) => {
          const y = HEADER_H + i * ROW_H;
          const color = LEVEL_COLORS[t.wbsLevel] ?? '#5B9BD5';
          const isDelayed = t.planProgress > t.actualProgress + 5;
          const rowBg = t.isGroup ? '#F0F5FF' : i % 2 === 0 ? '#fff' : '#FAFAFA';

          // 간트 바 계산
          const hasPlanned = t.plannedStart && t.plannedEnd;
          const px = hasPlanned ? dayToX(t.plannedStart!) : 0;
          const pw = hasPlanned ? Math.max(dayjs(t.plannedEnd!).diff(dayjs(t.plannedStart!), 'day') * DAY_W, DAY_W) : 0;

          const hasActual = t.actualStart && t.actualEnd;
          const ax = hasActual ? dayToX(t.actualStart!) : (hasPlanned ? px : 0);
          const aw = hasActual
            ? Math.max(dayjs(t.actualEnd!).diff(dayjs(t.actualStart!), 'day') * DAY_W, DAY_W)
            : (hasPlanned ? pw * (t.actualProgress / 100) : 0);

          return (
            <g
              key={t.taskId}
              onClick={() => onTaskClick?.(t)}
              style={{ cursor: 'pointer' }}
            >
              {/* 행 배경 */}
              <rect x={0} y={y} width={totalW} height={ROW_H} fill={rowBg} />
              <line x1={0} y1={y + ROW_H} x2={totalW} y2={y + ROW_H} stroke="#f0f0f0" strokeWidth={0.5} />

              {/* 레이블 영역 구분선 */}
              <line x1={LABEL_W} y1={y} x2={LABEL_W} y2={y + ROW_H} stroke="#d9d9d9" strokeWidth={1} />

              {/* WBS 코드 */}
              <text x={12} y={y + 20} fill={color} fontSize={10} fontFamily="monospace" fontWeight={t.isGroup ? 700 : 400}>
                {t.wbsCode}
              </text>

              {/* 작업명 (들여쓰기) */}
              <text
                x={120 + depth * 10}
                y={y + 20}
                fill={t.isGroup ? '#1F4E79' : '#333'}
                fontSize={11}
                fontWeight={t.isGroup ? 700 : 400}
              >
                {t.taskName.length > 14 - depth ? t.taskName.slice(0, 14 - depth) + '…' : t.taskName}
              </text>

              {/* 담당자 */}
              <text x={290} y={y + 20} fill="#666" fontSize={10}>
                {t.assignments.slice(0, 2).map((a) => a.displayName).join(', ')}
              </text>

              {/* 진척율 텍스트 */}
              <text x={12} y={y + ROW_H - 5} fill={isDelayed ? '#ff4d4f' : '#52c41a'} fontSize={9}>
                {`계획 ${t.planProgress}% / 실적 ${t.actualProgress}%`}
              </text>

              {/* 계획 바 */}
              {hasPlanned && px >= LABEL_W && (
                <g>
                  <rect x={px} y={y + 8} width={pw} height={10} rx={3} fill={color} opacity={0.35} />
                  <text x={px + pw + 3} y={y + 17} fill={color} fontSize={9}>
                    {t.plannedEnd}
                  </text>
                </g>
              )}

              {/* 실적 바 */}
              {aw > 0 && ax >= LABEL_W && (
                <rect
                  x={ax}
                  y={y + 20}
                  width={aw}
                  height={8}
                  rx={3}
                  fill={isDelayed ? '#ff4d4f' : '#52c41a'}
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}

        {/* 레이블 영역 경계 */}
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={totalH} stroke="#d9d9d9" strokeWidth={1.5} />
      </svg>
    </div>
  );
};

export default GanttChart;
