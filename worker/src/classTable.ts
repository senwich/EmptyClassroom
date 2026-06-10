import { recordRefreshError, setCachedClassInfo } from './cache';
import { loadConfig } from './config';
import { queryOne } from './jw';
import { parseShanghaiDate, parseShanghaiDateTime, shanghaiNow, shanghaiWeekday, toIsoFromShanghaiNow } from './time';
import type { BuildingInfo, CampusConfig, CampusInfo, ClassInfo, ClassroomInfo, Config, Env, JWClassInfo } from './types';

const DEFAULT_REALTIME_CAMPUSES: CampusConfig[] = [
  { name: '西土城', id: 1, has_realtime: true, replace_regex: [] },
  { name: '沙河', id: 2, has_realtime: true, replace_regex: [] },
];

function emptyClassMatrix(defaultValue = 0): number[][] {
  return Array.from({ length: 14 }, () => [] as number[]).map((row) => row.map(() => defaultValue));
}

function newCampusInfo(name: string): CampusInfo {
  return {
    name,
    building_info_map: {},
    building_id_map: {},
    max_building_id: 0,
  };
}

function newBuildingInfo(name: string): BuildingInfo {
  return {
    name,
    classroom_info_map: {},
    classroom_id_map: {},
    class_matrix: emptyClassMatrix(),
    max_classroom_id: 0,
  };
}

function ensureBuilding(campusInfo: CampusInfo, buildingName: string): { buildingId: number; buildingInfo: BuildingInfo } {
  if (campusInfo.building_id_map[buildingName] === undefined) {
    const id = campusInfo.max_building_id;
    campusInfo.building_id_map[buildingName] = id;
    campusInfo.building_info_map[String(id)] = newBuildingInfo(buildingName);
    campusInfo.max_building_id += 1;
  }
  const buildingId = campusInfo.building_id_map[buildingName];
  return { buildingId, buildingInfo: campusInfo.building_info_map[String(buildingId)] };
}

function addClassroom(buildingInfo: BuildingInfo, classroomInfo: ClassroomInfo): number {
  const id = buildingInfo.max_classroom_id;
  buildingInfo.classroom_id_map[classroomInfo.name] = id;
  buildingInfo.classroom_info_map[String(id)] = classroomInfo;
  buildingInfo.max_classroom_id += 1;
  for (let i = 0; i < 14; i++) {
    buildingInfo.class_matrix[i].push(0);
  }
  return id;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function processClassTableInfo(config: Config, classInfo: ClassInfo, campusName: string, now = shanghaiNow()): void {
  const start = parseShanghaiDate(config.class_table.start_week);
  const end = parseShanghaiDate(config.class_table.end_week);
  if (now < start || now > new Date(end.getTime() + 24 * 60 * 60 * 1000)) {
    return;
  }

  const nowWeek = Math.floor((now.getTime() - start.getTime()) / 604800000);
  const today = shanghaiWeekday(now);
  const campusConfig = config.class_table.class_table_map[campusName];
  if (!campusConfig) {
    return;
  }

  classInfo.campus_info_map ??= {};
  const campusInfo = classInfo.campus_info_map[campusName] ?? newCampusInfo(campusName);

  for (const item of campusConfig.class ?? []) {
    const separator = item.name.indexOf('-');
    if (separator === -1) {
      continue;
    }
    const buildingName = item.name.slice(0, separator);
    const classroomName = item.name.slice(separator + 1);
    const { buildingId, buildingInfo } = ensureBuilding(campusInfo, buildingName);
    if (buildingInfo.classroom_id_map[classroomName] !== undefined) {
      continue;
    }

    const classroomId = addClassroom(buildingInfo, {
      name: classroomName,
      size: Number.parseInt(item.seat, 10) || 0,
      can_trust: false,
      building_id: buildingId,
      type: campusConfig.typeMap?.[item.name] ?? '',
    });

    for (let i = 0; i < 14; i++) {
      for (const week of item.classes?.[i]?.[today] ?? []) {
        if (week === nowWeek) {
          buildingInfo.class_matrix[i][classroomId] = 1;
        }
      }
    }
  }

  classInfo.campus_info_map[campusName] = campusInfo;
}

function normalizeClassroomName(classroom: string, campusConfig: CampusConfig): string {
  let result = classroom;
  for (const replaceConfig of campusConfig.replace_regex ?? []) {
    result = result.replace(new RegExp(replaceConfig.regex), replaceConfig.replace);
  }
  return result;
}

export function processJWClassInfo(config: Config, jwClassInfo: JWClassInfo[] | null, classInfo: ClassInfo, campusConfig: CampusConfig): void {
  if (!jwClassInfo) {
    return;
  }
  classInfo.campus_info_map ??= {};
  const campusInfo = classInfo.campus_info_map[campusConfig.name] ?? newCampusInfo(campusConfig.name);
  const campusClassTableConfig = config.class_table.class_table_map[campusConfig.name];

  for (const info of jwClassInfo) {
    for (const rawClassroom of info.CLASSROOMS.split(',')) {
      const classroom = normalizeClassroomName(rawClassroom, campusConfig);
      const classroomHead = classroom.split('(')[0];
      const separator = classroomHead.indexOf('-');
      if (separator === -1) {
        continue;
      }
      const buildingName = classroomHead.slice(0, separator);
      const classroomName = classroomHead.slice(separator + 1);
      const sizeMatch = classroom.match(/\((\d+)\)/);
      const { buildingId, buildingInfo } = ensureBuilding(campusInfo, buildingName);

      if (buildingInfo.classroom_id_map[classroomName] === undefined) {
        addClassroom(buildingInfo, {
          name: classroomName,
          size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0,
          can_trust: true,
          building_id: buildingId,
          type: '',
        });
        const classroomId = buildingInfo.classroom_id_map[classroomName];
        for (let i = 0; i < 14; i++) {
          buildingInfo.class_matrix[i][classroomId] = 1;
        }
      } else {
        const classroomId = buildingInfo.classroom_id_map[classroomName];
        const current = buildingInfo.classroom_info_map[String(classroomId)];
        if (!current.can_trust) {
          buildingInfo.classroom_info_map[String(classroomId)] = {
            name: classroomName,
            size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0,
            can_trust: true,
            building_id: buildingId,
            type: campusClassTableConfig?.typeMap?.[classroomName] ?? current.type,
          };
          for (let i = 0; i < 14; i++) {
            buildingInfo.class_matrix[i][classroomId] = 1;
          }
        }
      }

      const classroomId = buildingInfo.classroom_id_map[classroomName];
      const nodeName = Number.parseInt(info.NODENAME, 10);
      if (Number.isFinite(nodeName) && nodeName >= 1 && nodeName <= 14) {
        buildingInfo.class_matrix[nodeName - 1][classroomId] = 0;
      }
    }
  }

  classInfo.campus_info_map[campusConfig.name] = campusInfo;
}

export async function queryAll(env: Env, now = shanghaiNow()): Promise<ClassInfo> {
  const config = await loadConfig(env);
  const usingDefaultCampuses = config.campus.length === 0;
  if (config.campus.length === 0) {
    config.campus = DEFAULT_REALTIME_CAMPUSES;
  }

  const classInfo: ClassInfo = {
    update_at: toIsoFromShanghaiNow(),
    is_fallback: {},
    class_table: null,
    notification: null,
  };
  const realtimeErrors: string[] = [];

  for (const campus of config.campus) {
    processClassTableInfo(config, classInfo, campus.name, now);
    if (campus.has_realtime) {
      try {
        const jwClassInfo = await queryOne(env, campus.id ?? 0);
        processJWClassInfo(config, jwClassInfo, classInfo, campus);
      } catch (error) {
        realtimeErrors.push(`${campus.name}: ${errorMessage(error)}`);
        classInfo.is_fallback[campus.name] = true;
        processJWClassInfo(config, null, classInfo, campus);
      }
    }
  }

  if (usingDefaultCampuses && (!classInfo.campus_info_map || Object.keys(classInfo.campus_info_map).length === 0)) {
    const details = realtimeErrors.length > 0 ? ` (${realtimeErrors.join('; ')})` : '';
    const error = new Error(`no classroom data loaded; check JW_USERNAME/JW_PASSWORD or CONFIG_JSON${details}`);
    await recordRefreshError(env, error);
    throw error;
  }

  if (realtimeErrors.length > 0) {
    await recordRefreshError(env, new Error(realtimeErrors.join('; ')));
  }

  const notificationStart = parseShanghaiDateTime(config.notification.start);
  const notificationEnd = parseShanghaiDateTime(config.notification.end);
  classInfo.notification = now > notificationStart && now < notificationEnd ? config.notification : null;

  const classTableStart = parseShanghaiDate(config.class_table.start_week);
  const classTableEnd = parseShanghaiDate(config.class_table.end_week);
  classInfo.class_table = now < classTableStart || now > new Date(classTableEnd.getTime() + 24 * 60 * 60 * 1000) ? null : config.class_table;

  await setCachedClassInfo(env, classInfo);
  return classInfo;
}
