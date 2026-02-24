export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar: string;
  telegram_username?: string | null;
}

/** API task shape from backend */
export interface ApiTask {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  taskHash: string | null;
  transactionHash: string | null;
  chainTimestamp: string | null;
  boardColumn: string;
  boardOrder: number;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardTask extends ApiTask {
  teamName: string | null;
  assignees: {
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    user_username: string | null;
  }[];
}

export type OnChainStatus =
  | 'not_stored'
  | 'pending_tx'
  | 'stored'
  | 'verified'
  | 'failed_verification';

/** Legacy UI task (for backward compatibility with existing cards) */
export interface Task {
  id: string;
  title: string;
  progress: number;
  status: 'Pending' | 'Completed' | 'Paused';
  assignee: string;
  date: string;
  updates: string;
  category: 'System Design' | 'Color Selection' | 'User Research';
}

export interface WalletState {
  address: string | null;
  balance: string;
  network: string;
  isConnected: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface TeamSummary {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  memberCount?: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}
