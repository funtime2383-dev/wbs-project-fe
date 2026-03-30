import React from 'react';
import { Button, Space, Segmented, Tooltip, Upload, message } from 'antd';
import {
  ZoomInOutlined, ZoomOutOutlined, DownloadOutlined,
  UploadOutlined, SyncOutlined, CalendarOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';

interface GanttToolbarProps {
  projectId: number | null;
  projectName: string;
  viewMode: 'gantt' | 'table';
  onViewModeChange: (mode: 'gantt' | 'table') => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onRefresh: () => void;
  onExportExcel: () => void;
  onImportExcel: (file: File) => void;
  loading?: boolean;
}

const GanttToolbar: React.FC<GanttToolbarProps> = ({
  viewMode, onViewModeChange,
  onZoomIn, onZoomOut,
  onRefresh, onExportExcel, onImportExcel,
  loading,
}) => {
  const uploadProps: UploadProps = {
    accept: '.xlsx,.xlsm,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      const isExcel = file.name.match(/\.(xlsx|xlsm|xls)$/i);
      if (!isExcel) {
        message.error('.xlsx, .xlsm, .xls 파일만 업로드 가능합니다.');
        return false;
      }
      onImportExcel(file);
      return false; // prevent auto upload
    },
  };

  return (
    <Space wrap>
      <Segmented
        value={viewMode}
        onChange={(v) => onViewModeChange(v as 'gantt' | 'table')}
        options={[
          { value: 'table', icon: <UnorderedListOutlined />, label: '목록' },
          { value: 'gantt', icon: <CalendarOutlined />, label: '간트차트' },
        ]}
      />

      {viewMode === 'gantt' && (
        <Space.Compact>
          <Tooltip title="확대">
            <Button icon={<ZoomInOutlined />} onClick={onZoomIn} />
          </Tooltip>
          <Tooltip title="축소">
            <Button icon={<ZoomOutOutlined />} onClick={onZoomOut} />
          </Tooltip>
        </Space.Compact>
      )}

      <Button
        icon={<SyncOutlined spin={loading} />}
        onClick={onRefresh}
        loading={loading}
      >
        새로고침
      </Button>

      <Upload {...uploadProps}>
        <Tooltip title="XLGantt .xlsm/.xlsx 파일 Import">
          <Button icon={<UploadOutlined />}>엑셀 Import</Button>
        </Tooltip>
      </Upload>

      <Tooltip title="현재 WBS를 엑셀로 Export">
        <Button icon={<DownloadOutlined />} onClick={onExportExcel}>
          엑셀 Export
        </Button>
      </Tooltip>
    </Space>
  );
};

export default GanttToolbar;
