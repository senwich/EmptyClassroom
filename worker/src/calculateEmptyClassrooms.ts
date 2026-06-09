import type { BuildingInfo, ClassInfo, EmptyClassroom } from './frontendTypes';

export function calculateEmptyClassrooms(
  classInfo: ClassInfo,
  selectedCampus: string,
  selectedBuildings: string[],
  selectedClassTimes: number[],
): EmptyClassroom[] {
  const campusInfo = classInfo.campus_info_map?.[selectedCampus];
  if (!campusInfo || selectedBuildings.length === 0 || selectedClassTimes.length === 0) {
    return [];
  }

  const result: EmptyClassroom[] = [];
  for (const buildingId of selectedBuildings) {
    const buildingInfo = campusInfo.building_info_map[String(buildingId)];
    if (!buildingInfo) {
      continue;
    }
    result.push(...calculateBuildingEmptyClassrooms(buildingInfo, selectedClassTimes));
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function calculateBuildingEmptyClassrooms(buildingInfo: BuildingInfo, selectedClassTimes: number[]): EmptyClassroom[] {
  const result: EmptyClassroom[] = [];
  for (const [classroomId, classroomInfo] of Object.entries(buildingInfo.classroom_info_map)) {
    const isBusy = selectedClassTimes.some((classTime) => buildingInfo.class_matrix[classTime]?.[Number(classroomId)] === 1);
    if (isBusy) {
      continue;
    }
    const emptyClassTime: number[] = [];
    for (let classTime = 0; classTime < 14; classTime++) {
      if (buildingInfo.class_matrix[classTime]?.[Number(classroomId)] === 0) {
        emptyClassTime.push(classTime);
      }
    }
    result.push({
      name: `${buildingInfo.name}-${classroomInfo.name}`,
      size: classroomInfo.size === 0 ? '无数据' : classroomInfo.size,
      canTrust: classroomInfo.can_trust,
      type: classroomInfo.type || '无数据',
      emptyClassTime,
    });
  }
  return result;
}
