'use client';

import { Alert, Button, Card, ConfigProvider, Empty, Input, Modal, Radio, Select, Spin, Switch, Table, Tag, Typography, message, theme } from 'antd';
import { MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { calculateEmptyClassrooms } from '../src/calculateEmptyClassrooms';
import type { ApiResponse, EmptyClassroom } from '../src/frontendTypes';

const CLASS_TIME_OPTIONS = [
  '第1节',
  '第2节',
  '第3节',
  '第4节',
  '第5节',
  '第6节',
  '第7节',
  '第8节',
  '第9节',
  '第10节',
  '第11节',
  '第12节',
  '第13节',
  '第14节',
];

export default function Home() {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState<ApiResponse>({ code: 1 });
  const [selectedCampus, setSelectedCampus] = useState('');
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
    void loadData();
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
              <Select
                mode="multiple"
                placeholder="选择上课时间"
                value={selectedClassTimes}
                onChange={setSelectedClassTimes}
                options={CLASS_TIME_OPTIONS.map((label, value) => ({ label, value }))}
              />
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
                  { title: '座位数', dataIndex: 'size', align: 'center' },
                  { title: '类型', dataIndex: 'type', align: 'center' },
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

          <div className="ad-support-bar">
            <span className="ad-support-icon" aria-hidden="true">📣</span>
            <span>
              为了本项目的可持续健康发展，诚征校内外研究生招生广告，相关收益将用于支持项目运营。合作联系：
              <a href="mailto:chengensen@foxmail.com">chengensen@foxmail.com</a>
              ，谢谢您的支持！
            </span>
          </div>
          <div className="footer">Cloudflare Workers + Next.js + TypeScript</div>
        </main>
      </Spin>

      <Modal title="反馈提交" open={reportOpen} confirmLoading={reporting} onOk={submitReport} onCancel={() => setReportOpen(false)} okText="提交" cancelText="取消">
        <Input.TextArea rows={4} value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="请输入反馈内容，建议附上联系方式" />
      </Modal>
    </ConfigProvider>
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
