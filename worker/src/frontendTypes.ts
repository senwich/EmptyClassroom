export type ApiResponse = {
  code: number;
  data?: ClassInfo;
  msg?: string;
  stale?: boolean;
};

export type ClassInfo = {
  campus_info_map?: Record<string, CampusInfo>;
  class_table: ClassTableConfig | null;
  update_at: string;
  notification: NotificationConfig | null;
  is_fallback: Record<string, boolean>;
};

export type CampusInfo = {
  name: string;
  building_info_map: Record<string, BuildingInfo>;
  building_id_map: Record<string, number>;
  max_building_id: number;
};

export type BuildingInfo = {
  name: string;
  classroom_info_map: Record<string, ClassroomInfo>;
  classroom_id_map: Record<string, number>;
  class_matrix: number[][];
  max_classroom_id: number;
};

export type ClassroomInfo = {
  name: string;
  size: number;
  can_trust: boolean;
  building_id: number;
  type: string;
};

export type NotificationConfig = {
  title: string;
  content: string;
  duration: number;
  type: string;
  showNotification: boolean;
  start: string;
  end: string;
};

export type ClassTableConfig = {
  start_week: string;
  end_week: string;
  unable_reason: string;
  is_available: boolean;
  class_table_map: Record<string, ClassTable>;
};

export type ClassTable = {
  class: Array<{
    campus: string;
    seat: string;
    name: string;
    classes: number[][][];
  }>;
  typeMap: Record<string, string>;
};

export type EmptyClassroom = {
  name: string;
  size: string | number;
  canTrust: boolean;
  type: string;
  emptyClassTime: number[];
};
