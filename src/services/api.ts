import type { ApiTask, BoardTask, User } from '../../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  };
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

function headers(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token} ` } : {}),
  };
}

export interface ListTasksParams {
  status?: string;
  priority?: string;
  search?: string;
  sortBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
}

export interface ListTasksResponse {
  tasks: ApiTask[];
  total: number;
  limit: number;
  offset: number;
}

export async function listTasks(params: ListTasksParams = {}): Promise<ListTasksResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.priority) sp.set('priority', params.priority);
  if (params.search) sp.set('search', params.search);
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.order) sp.set('order', params.order);
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const res = await fetch(`${API_BASE} /api/tasks ? ${sp} `, { headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch tasks');
  }
  return res.json();
}

export async function getTask(id: string): Promise<ApiTask> {
  const res = await fetch(`${API_BASE} /api/tasks / ${id} `, { headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Task not found');
  }
  return res.json();
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  status?: 'pending' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  boardColumn?: string;
}

export async function createTask(body: CreateTaskBody): Promise<ApiTask> {
  const res = await fetch(`${API_BASE} /api/tasks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to create task');
  return data;
}

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: 'pending' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  boardColumn?: string;
  boardOrder?: number;
}

export async function updateTask(id: string, body: UpdateTaskBody): Promise<ApiTask> {
  const res = await fetch(`${API_BASE} /api/tasks / ${id} `, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update task');
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${API_BASE} /api/tasks / ${id} `, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete task');
  }
}

export async function storeOnChain(
  taskId: string,
  transactionHash: string,
  chainTimestamp: string | number
): Promise<ApiTask> {
  const res = await fetch(`${API_BASE} /api/tasks / ${taskId}/store-onchain`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ transactionHash, chainTimestamp }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to store on chain');
  return data;
}

export interface VerifyResponse {
  verified: boolean;
  blockTimestamp: number | null;
  transactionHash: string | null;
  error?: string;
}

export async function verifyTask(taskId: string, walletAddress?: string): Promise<VerifyResponse> {
  const url = walletAddress
    ? `${API_BASE}/api/tasks/${taskId}/verify?walletAddress=${encodeURIComponent(walletAddress)}`
    : `${API_BASE}/api/tasks/${taskId}/verify`;
  const res = await fetch(url, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data;
}

export interface AnalyticsResponse {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  onChainVerifiedCount: number;
  completionRatePercent: number;
}

export async function getAnalytics(): Promise<AnalyticsResponse> {
  const res = await fetch(`${API_BASE}/api/tasks/analytics`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics');
  return data;
}

export async function listMyBoardTasks(): Promise<BoardTask[]> {
  const res = await fetch(`${API_BASE}/api/tasks/my-board`, { headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch board tasks');
  }
  return res.json();
}

export async function moveTask(id: string, boardColumn: string, boardOrder: number): Promise<ApiTask> {
  const res = await fetch(`${API_BASE}/api/tasks/${id}/move`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ boardColumn, boardOrder }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to move task');
  return data;
}

export async function getProfile(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/users/me`, { headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch profile');
  }
  return res.json();
}

export async function disconnectTelegram(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/users/me/telegram`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to disconnect telegram');
  }
}

