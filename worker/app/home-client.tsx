'use client';

import { Alert, Button, Card, ConfigProvider, Empty, Input, Modal, Radio, Select, Spin, Switch, Table, Tag, Typography, message, theme } from 'antd';
import { MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { calculateEmptyClassrooms } from '../src/calculateEmptyClassrooms';
import type { ApiResponse, EmptyClassroom } from '../src/frontendTypes';
import Footer from './footer';

const CLASS_TIME_OPTIONS = [
  { value: 0, start: '08:00', end: '08:45' },
  { value: 1, start: '08:50', end: '09:35' },
  { value: 2, start: '09:50', end: '10:35' },
  { value: 3, start: '10:40', end: '11:25' },
  { value: 4, start: '11:30', end: '12:15' },
  { value: 5, start: '13:00', end: '13:45' },
  { value: 6, start: '13:50', end: '14:35' },
  { value: 7, start: '14:45', end: '15:30' },
  { value: 8, start: '15:40', end: '16:25' },
  { value: 9, start: '16:35', end: '17:20' },
  { value: 10, start: '17:25', end: '18:10' },
  { value: 11, start: '18:30', end: '19:15' },
  { value: 12, start: '19:20', end: '20:05' },
  { value: 13, start: '20:10', end: '20:55' },
];

type HomeClientProps = {
  initialData: ApiResponse;
};

export default function HomeClient({ initialData }: HomeClientProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [todayData, setTodayData] = useState<ApiResponse>(initialData);
  const [selectedCampus, setSelectedCampus] = useState(() => sortCampus(Object.keys(initialData.data?.campus_info_map ?? {}))[0] ?? '');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedClassTimes, setSelectedClassTimes] = useState<number[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reporting, setReporting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const resp = (await fetch('/api/get_data').then((item) => item.json())) as ApiResponse;
      setTodayData(resp);
      const campusNames = Object.keys(resp.data?.campus_info_map ?? {});
      if (!selectedCampus && campusNames.length > 0) {
        setSelectedCampus(sortCampus(campusNames)[0]);
      }
    } catch {
      setTodayData({ code: 500, msg: '加载失败' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const applyMode = (matches: boolean) => {
      document.body.classList.toggle('dark', matches);
      setIsDark(matches);
      localStorage.setItem('darkMode', String(matches));
    };
    const stored = localStorage.getItem('darkMode');
    applyMode(stored === null ? mql.matches : stored === 'true');
    const listener = (event: MediaQueryListEvent) => applyMode(event.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const campuses = useMemo(() => sortCampus(Object.keys(todayData.data?.campus_info_map ?? {})), [todayData]);

  const buildingOptions = useMemo(() => {
    const campus = todayData.data?.campus_info_map?.[selectedCampus];
    if (!campus) {
      return [];
    }
    return Object.entries(campus.building_info_map)
      .map(([id, building]) => ({ value: id, label: building.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedCampus, todayData]);

  const emptyClassrooms = useMemo(() => {
    if (todayData.code !== 0 || !todayData.data) {
      return [];
    }
    return calculateEmptyClassrooms(todayData.data, selectedCampus, selectedBuildings, selectedClassTimes);
  }, [selectedBuildings, selectedCampus, selectedClassTimes, todayData]);

  async function submitReport() {
    if (!reportText.trim()) {
      messageApi.error('请输入反馈内容');
      return;
    }
    setReporting(true);
    try {
      const resp = await fetch('/api/report', {
        method: 'POST',
        body: JSON.stringify({ text: reportText }),
      });
      if (!resp.ok) {
        throw new Error('report failed');
      }
      messageApi.success('提交成功');
      setReportText('');
      setReportOpen(false);
    } catch {
      messageApi.error('提交失败');
    } finally {
      setReporting(false);
    }
  }

  return (
    <ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      {contextHolder}
      <Spin spinning={loading}>
        <main className="app-shell">
          <div className="logo-mark">空</div>
          <Typography.Title level={3}>BUPT 空教室查询</Typography.Title>
          {todayData.data?.notification?.showNotification ? (
            <Alert className="toolbar-card" message={todayData.data.notification.title} description={todayData.data.notification.content} type="info" showIcon />
          ) : null}
          {todayData.code !== 0 ? <Alert className="toolbar-card" message={todayData.msg ?? '数据暂不可用'} type="error" showIcon /> : null}

          <Card className="toolbar-card">
            <div className="toolbar-grid">
              <div className="button-row">
                <Button icon={<MessageOutlined />} onClick={() => setReportOpen(true)} />
                <Button icon={<ReloadOutlined />} onClick={loadData} />
                <Switch checkedChildren="暗色" unCheckedChildren="亮色" checked={isDark} onChange={(checked) => {
                  document.body.classList.toggle('dark', checked);
                  localStorage.setItem('darkMode', String(checked));
                  setIsDark(checked);
                }} />
              </div>
              <Radio.Group
                value={selectedCampus}
                buttonStyle="solid"
                onChange={(event) => {
                  setSelectedCampus(event.target.value as string);
                  setSelectedBuildings([]);
                }}
              >
                {campuses.map((campus) => (
                  <Radio.Button value={campus} key={campus}>{campus}</Radio.Button>
                ))}
              </Radio.Group>
              <Select mode="multiple" placeholder="选择教学楼" options={buildingOptions} value={selectedBuildings} onChange={setSelectedBuildings} />
              <ClassTimeMatrix selectedClassTimes={selectedClassTimes} onChange={setSelectedClassTimes} />
            </div>
          </Card>

          <Card className="result-card" bodyStyle={{ padding: 0 }}>
            {emptyClassrooms.length === 0 ? (
              <Empty description={emptyDescription(selectedBuildings, selectedClassTimes)} />
            ) : (
              <Table<EmptyClassroom>
                rowKey="name"
                size="small"
                pagination={false}
                dataSource={emptyClassrooms}
                columns={[
                  { title: '教室', dataIndex: 'name', align: 'center' },
                  {
                    title: '来源',
                    dataIndex: 'canTrust',
                    align: 'center',
                    render: (canTrust: boolean) => <Tag color={canTrust ? 'green' : 'red'} bordered={false}>{canTrust ? '教务' : '课表'}</Tag>,
                  },
                ]}
              />
            )}
          </Card>

          <Footer />
        </main>
      </Spin>

      <Modal title="反馈提交" open={reportOpen} confirmLoading={reporting} onOk={submitReport} onCancel={() => setReportOpen(false)} okText="提交" cancelText="取消">
        <Input.TextArea rows={4} value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="请输入反馈内容，建议附上联系方式" />
      </Modal>
    </ConfigProvider>
  );
}

function ClassTimeMatrix({ selectedClassTimes, onChange }: { selectedClassTimes: number[]; onChange: (value: number[]) => void }) {
  const selectedSet = new Set(selectedClassTimes);
  const isAllSelected = CLASS_TIME_OPTIONS.every((item) => selectedSet.has(item.value));

  function toggle(value: number) {
    if (selectedSet.has(value)) {
      onChange(selectedClassTimes.filter((item) => item !== value));
      return;
    }
    onChange([...selectedClassTimes, value].sort((a, b) => a - b));
  }

  return (
    <div className="class-time-panel">
      <div className="class-time-header">
        <span>选择时间段</span>
        <Button size="small" type={isAllSelected ? 'primary' : 'default'} onClick={() => onChange(isAllSelected ? [] : CLASS_TIME_OPTIONS.map((item) => item.value))}>
          {isAllSelected ? '全不选' : '全选'}
        </Button>
      </div>
      <div className="class-time-grid">
        {CLASS_TIME_OPTIONS.map((item) => {
          const selected = selectedSet.has(item.value);
          return (
            <button
              type="button"
              key={item.value}
              className={`class-time-block${selected ? ' selected' : ''}`}
              onClick={() => toggle(item.value)}
              aria-pressed={selected ? 'true' : 'false'}
            >
              <span>{item.start}</span>
              <strong>{item.start}-{item.end}</strong>
              <span>{item.end}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sortCampus(campuses: string[]): string[] {
  const order = ['西土城', '沙河'];
  return [...campuses].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function emptyDescription(selectedBuildings: string[], selectedClassTimes: number[]): string {
  if (selectedBuildings.length === 0 && selectedClassTimes.length === 0) return '请选择教学楼和上课时间';
  if (selectedBuildings.length === 0) return '请选择教学楼';
  if (selectedClassTimes.length === 0) return '请选择上课时间';
  return '没有空教室了';
}
