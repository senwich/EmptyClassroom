'use client';

import { Alert, Button, Card, ConfigProvider, Empty, Input, Modal, Radio, Select, Spin, Switch, Table, Tag, Typography, message, theme } from 'antd';
import { MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { calculateEmptyClassrooms } from '../src/calculateEmptyClassrooms';
import type { ApiResponse, EmptyClassroom } from '../src/frontendTypes';
import Footer from './footer';

const CLASS_TIME_OPTIONS = [
  { value: 0, period: '上午', label: '08:00-08:45' },
  { value: 1, period: '上午', label: '08:50-09:35' },
  { value: 2, period: '上午', label: '09:50-10:35' },
  { value: 3, period: '上午', label: '10:40-11:25' },
  { value: 4, period: '上午', label: '11:30-12:15' },
  { value: 5, period: '下午', label: '13:00-13:45' },
  { value: 6, period: '下午', label: '13:50-14:35' },
  { value: 7, period: '下午', label: '14:45-15:30' },
  { value: 8, period: '下午', label: '15:40-16:25' },
  { value: 9, period: '下午', label: '16:35-17:20' },
  { value: 10, period: '下午', label: '17:25-18:10' },
  { value: 11, period: '晚间', label: '18:30-19:15' },
  { value: 12, period: '晚间', label: '19:20-20:05' },
  { value: 13, period: '晚间', label: '20:10-20:55' },
];

const CLASS_TIME_GROUPS = ['上午', '下午', '晚间'];

type HomeClientProps = {
  initialData: ApiResponse;
  initialIsDark: boolean;
};

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

function persistTheme(isDark: boolean) {
  localStorage.setItem('darkMode', String(isDark));
  document.cookie = `darkMode=${isDark}; path=/; max-age=31536000; samesite=lax`;
}

export default function HomeClient({ initialData, initialIsDark }: HomeClientProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [todayData, setTodayData] = useState<ApiResponse>(initialData);
  const [selectedCampus, setSelectedCampus] = useState(() => sortCampus(Object.keys(initialData.data?.campus_info_map ?? {}))[0] ?? '');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedClassTimes, setSelectedClassTimes] = useState<number[]>([]);
  const [isDark, setIsDark] = useState(initialIsDark);
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
      applyTheme(matches);
      setIsDark(matches);
      persistTheme(matches);
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
                  applyTheme(checked);
                  persistTheme(checked);
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
        {CLASS_TIME_GROUPS.map((group) => (
          <div className="class-time-group" key={group}>
            <div className="class-time-group-title">{group}</div>
            <div className="class-time-group-grid">
              {CLASS_TIME_OPTIONS.filter((item) => item.period === group).map((item) => {
                const selected = selectedSet.has(item.value);
                return (
                  <button
                    type="button"
                    key={item.value}
                    className={`class-time-block${selected ? ' selected' : ''}`}
                    onClick={() => toggle(item.value)}
                    aria-pressed={selected ? 'true' : 'false'}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
