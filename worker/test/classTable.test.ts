import { describe, expect, it } from 'vitest';
import { processClassTableInfo, processJWClassInfo } from '../src/classTable';
import type { ClassInfo, JWClassInfo } from '../src/types';
import { makeConfig } from './helpers';

function emptyClassInfo(): ClassInfo {
  return {
    update_at: '2024-03-18T01:00:00.000Z',
    is_fallback: {},
    class_table: null,
    notification: null,
  };
}

describe('class table processing', () => {
  it('builds class matrix from static class table', () => {
    const config = makeConfig();
    const classInfo = emptyClassInfo();

    processClassTableInfo(config, classInfo, '西土城', new Date('2024-03-18T01:00:00+08:00'));

    const campus = classInfo.campus_info_map?.西土城;
    expect(campus).toBeTruthy();
    const building = campus?.building_info_map['0'];
    expect(building?.name).toBe('教一');
    expect(building?.classroom_info_map['0']).toMatchObject({
      name: '101',
      size: 80,
      can_trust: false,
      type: '普通教室',
    });
    expect(building?.class_matrix).toHaveLength(14);
    expect(building?.class_matrix[0][0]).toBe(1);
  });

  it('overlays realtime data and marks occupied node unavailable', () => {
    const config = makeConfig();
    const classInfo = emptyClassInfo();
    const jwClassInfo: JWClassInfo[] = [
      {
        CLASSROOMS: '教一-101(80)',
        NODETIME: '',
        NODENAME: '2',
      },
    ];

    processClassTableInfo(config, classInfo, '西土城', new Date('2024-03-18T01:00:00+08:00'));
    processJWClassInfo(config, jwClassInfo, classInfo, config.campus[0]);

    const building = classInfo.campus_info_map?.西土城.building_info_map['0'];
    expect(building?.classroom_info_map['0'].can_trust).toBe(true);
    expect(building?.class_matrix[0][0]).toBe(1);
    expect(building?.class_matrix[1][0]).toBe(0);
  });
});
