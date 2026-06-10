export type Env = {
  KV: KVNamespace;
  JW_USERNAME?: string;
  JW_PASSWORD?: string;
  JW_PROXY_URL?: string;
  JW_PROXY_TOKEN?: string;
  LARK_WEBHOOK?: string;
  EC_CONFIG_JSON?: string;
  EC_CAMPUS_TABLES_JSON?: string;
  EC_NOTIFICATION_JSON?: string;
  EC_FETCH?: typeof fetch;
};

export type CampusConfig = {
  name: string;
  id?: number;
  has_realtime: boolean;
  replace_regex?: Array<{
    regex: string;
    replace: string;
  }>;
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

export type ClassTableClassroomInfo = {
  campus: string;
  seat: string;
  name: string;
  classes: number[][][];
};

export type ClassTable = {
  class: ClassTableClassroomInfo[];
  typeMap: Record<string, string>;
};

export type ClassTableConfig = {
  start_week: string;
  end_week: string;
  unable_reason: string;
  is_available: boolean;
  class_table_map: Record<string, ClassTable>;
};

export type Config = {
  class_table: ClassTableConfig;
  campus: CampusConfig[];
  notification: NotificationConfig;
};

export type LoginResponse = {
  code: string;
  Msg?: string;
  data?: {
    token?: string;
  };
};

export type JWClassInfo = {
  CLASSROOMS: string;
  NODETIME: string;
  NODENAME: string;
};

export type QueryResponse = {
  code: string;
  Msg?: string;
  data?: JWClassInfo[];
};

export type ClassroomInfo = {
  name: string;
  size: number;
  can_trust: boolean;
  building_id: number;
  type: string;
};

export type BuildingInfo = {
  name: string;
  classroom_info_map: Record<string, ClassroomInfo>;
  classroom_id_map: Record<string, number>;
  class_matrix: number[][];
  max_classroom_id: number;
};

export type CampusInfo = {
  name: string;
  building_info_map: Record<string, BuildingInfo>;
  building_id_map: Record<string, number>;
  max_building_id: number;
};

export type ClassInfo = {
  campus_info_map?: Record<string, CampusInfo>;
  class_table: ClassTableConfig | null;
  update_at: string;
  notification: NotificationConfig | null;
  is_fallback: Record<string, boolean>;
};
