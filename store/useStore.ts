import { create } from 'zustand';
import { AuthState, User, WalletState, Task, ApiTask, OnChainStatus, TeamSummary, AppNotification } from '../types';

export type PageId = 'overview' | 'tasks' | 'analytics' | 'settings' | 'teams' | 'chat';

export interface TaskFilters {
  status?: string;
  priority?: string;
  search?: string;
  sortBy?: string;
  order?: string;
}

export interface TaskPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface TxState {
  pendingTaskId: string | null;
  error: string | null;
}

interface AppState {
  auth: AuthState;
  wallet: WalletState;
  tasks: Task[];
  isSidebarOpen: boolean;
  currentPage: PageId;
  apiTasks: ApiTask[];
  taskFilters: TaskFilters;
  taskPagination: TaskPagination;
  txState: TxState;
  teams: TeamSummary[];
  notifications: AppNotification[];
  unreadNotifCount: number;
  activeTeamId: string | null;
  isMobileMenuOpen: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setWallet: (wallet: Partial<WalletState>) => void;
  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  addTask: (task: Task) => void;
  updateTaskStatus: (id: string, status: Task['status']) => void;
  setCurrentPage: (page: PageId) => void;
  setApiTasks: (tasks: ApiTask[], total: number) => void;
  setTaskFilters: (f: Partial<TaskFilters>) => void;
  setTaskPagination: (p: Partial<TaskPagination>) => void;
  setTxState: (s: Partial<TxState>) => void;
  updateApiTask: (id: string, patch: Partial<ApiTask>) => void;
  removeApiTask: (id: string) => void;
  appendApiTask: (task: ApiTask) => void;
  setTeams: (teams: TeamSummary[]) => void;
  setActiveTeamId: (id: string | null) => void;
  setNotifications: (n: AppNotification[], unread: number) => void;
  setUnreadNotifCount: (c: number) => void;
  markNotifRead: (id: string) => void;
  updateUser: (user: User) => void;
}

const mockTasks: Task[] = [
  { id: '1', title: 'System Design', assignee: 'Lison', date: '15 Sep 2024', updates: '2 hours ago', status: 'Pending', category: 'System Design', progress: 68 },
  { id: '2', title: 'Color Selection', assignee: 'Mickel fil', date: '07 Sep 2024', updates: 'Yesterday', status: 'Completed', category: 'Color Selection', progress: 100 },
  { id: '3', title: 'User Research', assignee: 'Jeiana', date: '02 Sep 2024', updates: '3 Days ago', status: 'Paused', category: 'User Research', progress: 45 },
];

export const useStore = create<AppState>((set, get) => ({
  auth: {
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
  },
  wallet: {
    address: null,
    balance: '0.00',
    network: 'Sepolia',
    isConnected: false,
  },
  tasks: mockTasks,
  isSidebarOpen: true,
  currentPage: 'overview',
  apiTasks: [],
  taskFilters: {},
  taskPagination: { limit: 20, offset: 0, total: 0 },
  txState: { pendingTaskId: null, error: null },
  teams: [],
  notifications: [],
  unreadNotifCount: 0,
  activeTeamId: null,
  isMobileMenuOpen: false,
  login: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ auth: { user, token, isAuthenticated: true } });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ auth: { user: null, token: null, isAuthenticated: false } });
  },
  setWallet: (wallet) => set((state) => ({ wallet: { ...state.wallet, ...wallet } })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTaskStatus: (id, status) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
  })),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setApiTasks: (apiTasks, total) =>
    set((state) => ({
      apiTasks,
      taskPagination: { ...state.taskPagination, total },
    })),
  setTaskFilters: (f) =>
    set((state) => ({ taskFilters: { ...state.taskFilters, ...f } })),
  setTaskPagination: (p) =>
    set((state) => ({
      taskPagination: { ...state.taskPagination, ...p },
    })),
  setTxState: (s) =>
    set((state) => ({ txState: { ...state.txState, ...s } })),
  updateApiTask: (id, patch) =>
    set((state) => ({
      apiTasks: state.apiTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  removeApiTask: (id) =>
    set((state) => ({
      apiTasks: state.apiTasks.filter((t) => t.id !== id),
      taskPagination: {
        ...state.taskPagination,
        total: Math.max(0, state.taskPagination.total - 1),
      },
    })),
  appendApiTask: (task) =>
    set((state) => ({
      apiTasks: [task, ...state.apiTasks],
      taskPagination: {
        ...state.taskPagination,
        total: state.taskPagination.total + 1,
      },
    })),
  setTeams: (teams) => set({ teams }),
  setActiveTeamId: (activeTeamId) => set({ activeTeamId }),
  setNotifications: (notifications, unreadNotifCount) =>
    set({ notifications, unreadNotifCount }),
  setUnreadNotifCount: (unreadNotifCount) => set({ unreadNotifCount }),
  markNotifRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadNotifCount: Math.max(0, state.unreadNotifCount - 1),
    })),
  updateUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set((state) => ({
      auth: { ...state.auth, user },
    }));
  },
}));

export function getOnChainStatus(task: ApiTask, pendingTaskId: string | null): OnChainStatus {
  if (pendingTaskId === task.id) return 'pending_tx';
  if (task.transactionHash && task.chainTimestamp) return 'stored';
  if (task.taskHash && !task.transactionHash) return 'not_stored';
  return 'not_stored';
}
