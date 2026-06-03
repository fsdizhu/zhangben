import { 
  User, 
  Entry, 
  Config, 
  Statistics, 
  StatisticsByPerson,
  ParsedEntry,
  LoginRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  AddUserRequest,
  UpdateUserRequest,
  EntryRequest,
  PermissionInfo,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(data: LoginRequest): Promise<{ success: boolean; message: string; token?: string; user?: User }> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getCurrentUser(): Promise<{ success: boolean; user?: User }> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function changePassword(data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function resetPassword(data: ResetPasswordRequest): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getUsers(): Promise<{ success: boolean; users?: User[] }> {
  const response = await fetch(`${API_BASE}/auth/users`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function addUser(data: AddUserRequest): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/auth/users`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateUser(username: string, data: UpdateUserRequest): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/auth/users/${username}`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getPermissions(): Promise<{ success: boolean; permissions?: PermissionInfo[] }> {
  const response = await fetch(`${API_BASE}/auth/permissions`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function deleteUser(username: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/auth/users/${username}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getEntries(
  sortBy: string = 'id', 
  order: string = 'desc', 
  limit: number = 50, 
  offset: number = 0
): Promise<{ success: boolean; entries?: Entry[]; total?: number }> {
  const response = await fetch(`${API_BASE}/entries?sortBy=${sortBy}&order=${order}&limit=${limit}&offset=${offset}`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getEntry(id: number): Promise<{ success: boolean; entry?: Entry }> {
  const response = await fetch(`${API_BASE}/entries/${id}`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function addEntry(data: EntryRequest): Promise<{ success: boolean; message: string; id?: number }> {
  const response = await fetch(`${API_BASE}/entries`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateEntry(id: number, data: Partial<EntryRequest> & { password: string }): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/entries/${id}`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteEntry(id: number, password: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/entries/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return response.json();
}

export async function getEntriesByType(type: '借出' | '收回'): Promise<{ success: boolean; entries?: Entry[] }> {
  const response = await fetch(`${API_BASE}/entries/filter/type/${type}`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getEntriesByDate(startDate: string, endDate: string): Promise<{ success: boolean; entries?: Entry[] }> {
  const response = await fetch(`${API_BASE}/entries/filter/date?start=${startDate}&end=${endDate}`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getEntriesByPerson(person: string): Promise<{ success: boolean; entries?: Entry[] }> {
  const response = await fetch(`${API_BASE}/entries/filter/person?person=${encodeURIComponent(person)}`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getPersons(): Promise<{ success: boolean; persons?: string[] }> {
  const response = await fetch(`${API_BASE}/entries/persons`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getStats(startDate?: string, endDate?: string, persons?: string[]): Promise<{ success: boolean; stats?: Statistics }> {
  let url = `${API_BASE}/entries/stats`;
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (persons && persons.length > 0) params.append('persons', persons.join(','));
  if (params.toString()) url += `?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function getStatsByPerson(startDate?: string, endDate?: string, persons?: string[]): Promise<{ success: boolean; stats?: StatisticsByPerson }> {
  let url = `${API_BASE}/entries/stats/person`;
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (persons && persons.length > 0) params.append('persons', persons.join(','));
  if (params.toString()) url += `?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function searchEntries(query: string): Promise<{ success: boolean; entries?: Entry[] }> {
  const response = await fetch(`${API_BASE}/entries/search?q=${encodeURIComponent(query)}`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function parseText(text: string, threshold?: number): Promise<{ 
  success: boolean; 
  high_confidence?: ParsedEntry[]; 
  low_confidence?: ParsedEntry[];
}> {
  const response = await fetch(`${API_BASE}/parser/parse`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, threshold }),
  });
  return response.json();
}

export async function parseAndSave(text: string, threshold?: number, saveLowConfidence = false): Promise<{ 
  success: boolean; 
  message: string;
  saved_count?: number;
}> {
  const response = await fetch(`${API_BASE}/parser/parse-and-save`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, threshold, save_low_confidence: saveLowConfidence }),
  });
  return response.json();
}

export async function getConfig(): Promise<{ success: boolean; config?: Config }> {
  const response = await fetch(`${API_BASE}/config`, {
    headers: getAuthHeader(),
  });
  return response.json();
}

export async function updatePresetNames(names: string[]): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/config/preset-names`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  });
  return response.json();
}

export async function updateKeywords(data: {
  lend_keywords?: string[];
  receive_keywords?: string[];
  excluded_keywords?: string[];
}): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/config/keywords`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateThreshold(threshold: number): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/config/threshold`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ threshold }),
  });
  return response.json();
}

export async function clearDatabase(password: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/admin/clear-database`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return response.json();
}

export async function exportCSV(startDate?: string, endDate?: string, persons?: string[]): Promise<Blob> {
  let url = `${API_BASE}/export/csv`;
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (persons && persons.length > 0) params.append('persons', persons.join(','));
  if (params.toString()) url += `?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: getAuthHeader(),
  });
  return response.blob();
}

export async function exportExcel(startDate?: string, endDate?: string, persons?: string[]): Promise<Blob> {
  let url = `${API_BASE}/export/excel`;
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (persons && persons.length > 0) params.append('persons', persons.join(','));
  if (params.toString()) url += `?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: getAuthHeader(),
  });
  return response.blob();
}

export async function exportExcelByPerson(startDate?: string, endDate?: string, persons?: string[]): Promise<Blob> {
  let url = `${API_BASE}/export/excel-by-person`;
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (persons && persons.length > 0) params.append('persons', persons.join(','));
  if (params.toString()) url += `?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: getAuthHeader(),
  });
  return response.blob();
}

export async function importCSV(data: any[]): Promise<{ success: boolean; message: string; imported?: number; failed?: number }> {
  const response = await fetch(`${API_BASE}/import/csv`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  return response.json();
}
