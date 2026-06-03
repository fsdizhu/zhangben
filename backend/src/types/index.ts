export interface User {
  username: string;
  password: string;
  is_super: boolean;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
}

export type Permission = 
  | 'add_entry'
  | 'edit_entry'
  | 'delete_entry'
  | 'import_entry'
  | 'clear_database';

export const ALL_PERMISSIONS: Permission[] = [
  'add_entry',
  'edit_entry',
  'delete_entry',
  'import_entry',
  'clear_database',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  add_entry: '增加账目',
  edit_entry: '修改账目',
  delete_entry: '删除账目',
  import_entry: '导入账目',
  clear_database: '清空数据库',
};

export interface Entry {
  id: number;
  date: string;
  person: string;
  description?: string;
  amount: number;
  type: '借出' | '收回';
  created_at?: string;
  updated_at?: string;
}

export interface ParsedEntry {
  date: string;
  person: string;
  description: string;
  amount: number;
  type: '借出' | '收回';
  confidence: number;
  confidence_details: {
    date: number;
    amount: number;
    person: number;
    type: number;
  };
}

export interface Config {
  preset_names: string[];
  lend_keywords: string[];
  receive_keywords: string[];
  excluded_keywords: string[];
  confidence_threshold: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface ResetPasswordRequest {
  username: string;
  super_code?: string;
  admin_password?: string;
  new_password: string;
}

export interface AddUserRequest {
  username: string;
  password: string;
  is_super?: boolean;
  permissions?: string[];
}

export interface UpdateUserRequest {
  password?: string;
  is_super?: boolean;
  permissions?: string[];
}

export interface EntryRequest {
  date: string;
  person: string;
  description?: string;
  amount: number;
  type: '借出' | '收回';
}

export interface ParseRequest {
  text: string;
  threshold?: number;
}

export interface ParseResult {
  high_confidence: ParsedEntry[];
  low_confidence: ParsedEntry[];
  threshold: number;
}

export interface Statistics {
  total_entries: number;
  total_lend: number;
  total_receive: number;
  balance: number;
}

export interface StatisticsByPerson {
  [person: string]: {
    '借出': number;
    '收回': number;
  };
}