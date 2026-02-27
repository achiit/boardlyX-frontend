import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Search, Edit2, Trash2, CheckCircle2, Loader2, ExternalLink,
  ShieldCheck, LayoutGrid, List, ChevronRight, X, Tag, Calendar,
  MessageSquare, CircleDot, Columns, Clock, Hash, ArrowUpRight,
  Users, Check,
} from 'lucide-react';
import { useStore, getOnChainStatus } from '../../store/useStore';
import type { BoardTask, OnChainStatus } from '../../types';
import * as api from '../../src/services/api';
import { useLogTask } from '../../src/hooks/useLogTask';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { SEPOLIA_CHAIN_ID } from '../../src/config/contract';
import * as teamApi from '../../src/services/teamApi';
import type { Team, TeamMember } from '../../src/services/teamApi';

const BOARD_COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-500', accent: 'border-slate-500/40' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-500', accent: 'border-blue-500/40' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-500', accent: 'border-amber-500/40' },
  { id: 'review', label: 'Review', color: 'bg-purple-500', accent: 'border-purple-500/40' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500', accent: 'border-emerald-500/40' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const PRIORITY_LABELS: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

const ON_CHAIN_STYLE: Record<OnChainStatus, string> = {
  not_stored: 'bg-white/10 text-white/50 border-white/10',
  pending_tx: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  stored: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed_verification: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ON_CHAIN_LABEL: Record<OnChainStatus, string> = {
  not_stored: 'Off-chain', pending_tx: 'Pending', stored: 'On-chain', verified: 'Verified', failed_verification: 'Failed',
};

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Slide Panel Shell ──────────────────────────────────────────────
function SlidePanel({ onClose, children, width = 'sm:max-w-[480px]' }: { onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[6px] z-[199]" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-full ${width} bg-[#13151C] border-l border-white/[0.06] z-[200] shadow-2xl shadow-black/60 flex flex-col`}
        style={{ animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
        {children}
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </>
  );
}

function PanelHeader({ title, subtitle, icon: Icon, onClose }: { title: string; subtitle?: string; icon: React.ElementType; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 -mr-2 rounded-xl text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon size={13} className="text-white/25" />
      <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">{label}</span>
    </div>
  );
}

const inputClass = "w-full bg-[#0F1117]/80 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all";
const selectClass = "w-full bg-[#0F1117]/80 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all appearance-none";

// ─── Kanban Card ────────────────────────────────────────────────────
const KanbanCard: React.FC<{
  task: BoardTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: BoardTask) => void;
  onMarkComplete: (task: BoardTask) => void;
}> = ({ task, onDragStart, onClick, onMarkComplete }) => {
  const wasDragging = useRef(false);
  const onChainStatus = getOnChainStatus(task, null);
  const isCompleted = task.status === 'completed';

  return (
    <div
      draggable
      onDragStart={(e) => { wasDragging.current = true; onDragStart(e, task.id); }}
      onDragEnd={() => { setTimeout(() => { wasDragging.current = false; }, 100); }}
      onClick={() => { if (!wasDragging.current) onClick(task); }}
      className="bg-[#1A1D25] border border-white/[0.05] rounded-xl p-3.5 cursor-pointer group hover:border-white/[0.1] hover:bg-[#1D2028] transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
          {task.priority}
        </span>
        <span className="text-[10px] text-white/20 ml-auto">{timeAgo(task.createdAt)}</span>
      </div>
      <h4 className={`text-sm font-medium mb-1 leading-snug line-clamp-2 ${isCompleted ? 'text-white/35 line-through' : 'text-white/80'}`}>
        {task.title}
      </h4>
      {task.description && (
        <p className="text-[11px] text-white/25 line-clamp-1 mb-2">{task.description}</p>
      )}

      {task.teamName && (
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={10} className="text-indigo-400/60" />
          <span className="text-[10px] text-indigo-400/60 font-medium">{task.teamName}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {onChainStatus !== 'not_stored' && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${ON_CHAIN_STYLE[onChainStatus]}`}>
              {ON_CHAIN_LABEL[onChainStatus]}
            </span>
          )}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1.5 ml-1">
              {task.assignees.slice(0, 3).map((a) => (
                <div key={a.user_id} className="w-5 h-5 rounded-full border border-[#1A1D25] overflow-hidden bg-indigo-500/20"
                  title={a.user_name || a.user_username || a.user_email || ''}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.user_username || a.user_name || a.user_email}`} alt="" className="w-full h-full" />
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-5 h-5 rounded-full border border-[#1A1D25] bg-white/10 flex items-center justify-center text-[8px] text-white/50">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isCompleted ? (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle2 size={10} /> Done
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkComplete(task); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
                         text-white/25 bg-transparent border border-transparent
                         hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20
                         opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="Mark as complete"
            >
              <CheckCircle2 size={11} />
              <span>Complete</span>
            </button>
          )}
          <ChevronRight size={12} className="text-white/10 group-hover:text-white/30 transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ──────────────────────────────────────────────────
const KanbanColumn: React.FC<{
  column: typeof BOARD_COLUMNS[number];
  tasks: BoardTask[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, column: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onAddTask: (column: string) => void;
  onTaskClick: (task: BoardTask) => void;
  onMarkComplete: (task: BoardTask) => void;
}> = ({ column, tasks, onDragStart, onDrop, onDragOver, onAddTask, onTaskClick, onMarkComplete }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e, column.id); }}
      className={`flex flex-col min-w-[260px] sm:min-w-[280px] max-w-[300px] sm:max-w-[320px] flex-1 transition-colors rounded-2xl ${isDragOver ? 'bg-white/[0.02]' : ''}`}
    >
      <div className="flex items-center justify-between px-1 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
          <h3 className="text-sm font-semibold text-white/70">{column.label}</h3>
          <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <button onClick={() => onAddTask(column.id)} className="p-1 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-2.5 min-h-[120px]">
        {tasks.map((t) => <KanbanCard key={t.id} task={t} onDragStart={onDragStart} onClick={onTaskClick} onMarkComplete={onMarkComplete} />)}
        {tasks.length === 0 && (
          <div className={`border-2 border-dashed rounded-xl py-8 text-center transition-colors ${isDragOver ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/5'}`}>
            <p className="text-xs text-white/20">Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Task Detail Drawer ─────────────────────────────────────────────
function TaskDetailDrawer({ task, onClose, onUpdate, onDelete }: {
  task: BoardTask;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
  onDelete: (taskId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [boardColumn, setBoardColumn] = useState(task.boardColumn || 'backlog');
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { txState, setTxState } = useStore();
  const { logTaskAndStore, isPending: isLogPending } = useLogTask();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const isWrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;
  const [verifying, setVerifying] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setBoardColumn(task.boardColumn || 'backlog');
    setStatus(task.status);
    setAssigneeIds((task.assignees || []).map(a => a.user_id));
  }, [task]);

  useEffect(() => {
    if (isEditing && task.teamId) {
      teamApi.getTeam(task.teamId).then(t => setMembers(t.members)).catch(() => { });
    }
  }, [isEditing, task.teamId]);

  function toggleAssignee(id: string) {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    try {
      setSaving(true);
      if (task.teamId) {
        const { updateTeamTask } = await import('../../src/services/teamApi');
        const updated = await updateTeamTask(task.teamId, task.id, {
          title: title.trim(), description, priority, status, boardColumn, assigneeIds,
        });
        onUpdate({ ...task, ...updated, teamName: task.teamName, assignees: updated.assignees || task.assignees } as any);
      } else {
        const updated = await api.updateTask(task.id, {
          title: title.trim(), description, priority: priority as any, status: status as any, boardColumn, dueDate: task.dueDate,
        });
        onUpdate({ ...task, ...updated, teamName: null, assignees: [] });
      }
      setIsEditing(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleMarkComplete() {
    try {
      setSaving(true);
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      if (task.teamId) {
        const { updateTeamTask } = await import('../../src/services/teamApi');
        const updated = await updateTeamTask(task.teamId, task.id, { status: newStatus });
        onUpdate({ ...task, ...updated, teamName: task.teamName, assignees: updated.assignees || task.assignees } as any);
      } else {
        const updated = await api.updateTask(task.id, { status: newStatus as any });
        onUpdate({ ...task, ...updated, teamName: null, assignees: [] });
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      if (task.teamId) {
        const { deleteTeamTask } = await import('../../src/services/teamApi');
        await deleteTeamTask(task.teamId, task.id);
      } else {
        await api.deleteTask(task.id);
      }
      onDelete(task.id);
    } catch { /* ignore */ } finally { setDeleting(false); }
  }

  async function handleStoreOnChain() {
    if (!task.taskHash) return;
    setTxState({ pendingTaskId: task.id, error: null });
    try {
      await logTaskAndStore(task.id, task.taskHash);
      const updated = await api.getTask(task.id);
      onUpdate({ ...task, ...updated, teamName: task.teamName, assignees: task.assignees });
      setTxState({ pendingTaskId: null });
    } catch (e) {
      setTxState({ pendingTaskId: null, error: e instanceof Error ? e.message : 'Transaction failed' });
    }
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      await api.verifyTask(task.id, address ?? undefined);
    } catch { /* ignore */ } finally { setVerifying(false); }
  }

  const columnInfo = BOARD_COLUMNS.find((c) => c.id === (task.boardColumn || 'backlog'));
  const createdDate = new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const updatedDate = new Date(task.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const onChainStatus = getOnChainStatus(task, txState.pendingTaskId);

  return (
    <SlidePanel onClose={onClose} width="sm:max-w-[520px]">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <button onClick={handleMarkComplete} disabled={saving}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${task.status === 'completed'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-white/[0.03] border-white/[0.06] text-white/25 hover:bg-indigo-500/10 hover:border-indigo-500/20 hover:text-indigo-400'
              }`}>
            <CheckCircle2 size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15' : 'bg-amber-500/10 text-amber-300 border border-amber-500/15'
              }`}>
              {task.status === 'completed' ? 'Completed' : 'Active'}
            </span>
            {task.teamName && (
              <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/15 flex items-center gap-1">
                <Users size={9} /> {task.teamName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="p-2 rounded-xl text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors">
              <Edit2 size={15} />
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-xl text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={15} />
          </button>
          <button onClick={onClose} className="p-2 rounded-xl text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          {/* Title */}
          {isEditing ? (
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-bold text-white bg-[#0F1117]/80 border border-white/[0.06] rounded-xl px-4 py-3 mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" autoFocus />
          ) : (
            <h2 className={`text-lg font-bold mb-5 leading-snug ${task.status === 'completed' ? 'text-white/35 line-through' : 'text-white'}`}>
              {task.title}
            </h2>
          )}

          {/* Description */}
          <div className="mb-6">
            <SectionLabel icon={MessageSquare} label="Description" />
            {isEditing ? (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..."
                className={`${inputClass} min-h-[100px] resize-none`} />
            ) : (
              <div className="bg-[#0F1117]/40 rounded-xl px-4 py-3.5 min-h-[60px] border border-white/[0.03]">
                <p className="text-sm text-white/45 leading-relaxed whitespace-pre-wrap">
                  {task.description || 'No description provided.'}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.04] mb-6" />

          {/* Properties */}
          <div className="space-y-2.5 mb-6">
            <SectionLabel icon={Tag} label="Properties" />

            {/* Priority */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:border-white/[0.06] transition-colors">
              <div className="flex items-center gap-2.5">
                <Tag size={13} className="text-white/20" />
                <span className="text-xs text-white/35">Priority</span>
              </div>
              {isEditing ? (
                <div className="flex gap-1.5">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${priority === p ? PRIORITY_COLORS[p] : 'bg-transparent border-white/[0.06] text-white/20 hover:bg-white/[0.03]'
                        }`}>{PRIORITY_LABELS[p]}</button>
                  ))}
                </div>
              ) : (
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${PRIORITY_COLORS[task.priority]}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              )}
            </div>

            {/* Column */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:border-white/[0.06] transition-colors">
              <div className="flex items-center gap-2.5">
                <Columns size={13} className="text-white/20" />
                <span className="text-xs text-white/35">Column</span>
              </div>
              {isEditing ? (
                <select value={boardColumn} onChange={(e) => setBoardColumn(e.target.value)}
                  className="bg-[#0F1117] text-xs text-white border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30">
                  {BOARD_COLUMNS.map((c) => <option key={c.id} value={c.id} className="bg-[#1A1D25]">{c.label}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${columnInfo?.color || 'bg-slate-500'}`} />
                  <span className="text-xs text-white/55 font-medium">{columnInfo?.label}</span>
                </div>
              )}
            </div>

            {/* Status */}
            {isEditing && (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <CircleDot size={13} className="text-white/20" />
                  <span className="text-xs text-white/35">Status</span>
                </div>
                <div className="flex gap-1.5">
                  {([['pending', 'Active'], ['completed', 'Done']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setStatus(v as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${status === v
                        ? v === 'completed' ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300' : 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                        : 'bg-transparent border-white/[0.06] text-white/20 hover:bg-white/[0.03]'
                        }`}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Due date */}
            {task.dueDate && (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Calendar size={13} className="text-white/20" />
                  <span className="text-xs text-white/35">Due Date</span>
                </div>
                <span className="text-xs text-white/50">{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <Calendar size={13} className="text-white/20" />
                <span className="text-xs text-white/35">Created</span>
              </div>
              <span className="text-xs text-white/50">{createdDate}</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <Clock size={13} className="text-white/20" />
                <span className="text-xs text-white/35">Updated</span>
              </div>
              <span className="text-xs text-white/50">{updatedDate}</span>
            </div>

            {task.taskHash && (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Hash size={13} className="text-white/20" />
                  <span className="text-xs text-white/35">Hash</span>
                </div>
                <span className="text-[11px] text-indigo-300/70 font-mono">{task.taskHash.slice(0, 12)}...</span>
              </div>
            )}

            {task.transactionHash && (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/[0.08]">
                <div className="flex items-center gap-2.5">
                  <CircleDot size={13} className="text-emerald-400/60" />
                  <span className="text-xs text-white/35">On-Chain Tx</span>
                </div>
                <a href={`https://sepolia.etherscan.io/tx/${task.transactionHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 font-mono flex items-center gap-1 hover:text-indigo-300">
                  {task.transactionHash.slice(0, 10)}...<ArrowUpRight size={10} />
                </a>
              </div>
            )}
          </div>

          {/* On-chain actions */}
          {!isEditing && (
            <div className="space-y-2 mb-6">
              <SectionLabel icon={ShieldCheck} label="Blockchain" />
              <div className="flex gap-2">
                {task.taskHash && !task.transactionHash && (
                  <button
                    onClick={isWrongNetwork ? () => switchChainAsync?.({ chainId: SEPOLIA_CHAIN_ID }) : handleStoreOnChain}
                    disabled={isLogPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 transition-all disabled:opacity-40">
                    {isLogPending && txState.pendingTaskId === task.id ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                    {isWrongNetwork ? 'Switch to Sepolia' : 'Store On Chain'}
                  </button>
                )}
                {task.transactionHash && (
                  <button onClick={handleVerify} disabled={verifying}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-all disabled:opacity-40">
                    {verifying ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    Verify On Chain
                  </button>
                )}
                {onChainStatus === 'not_stored' && !task.taskHash && (
                  <p className="text-xs text-white/20 py-2">No task hash generated yet.</p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.04] mb-6" />

          {/* Assignees */}
          {isEditing && task.teamId ? (
            <div className="mb-6">
              <SectionLabel icon={Users} label={`Assign members (${assigneeIds.length}/${members.length})`} />
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const selected = assigneeIds.includes(m.user_id);
                  return (
                    <button key={m.user_id} type="button" onClick={() => toggleAssignee(m.user_id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${selected
                        ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/10'
                        : 'bg-white/[0.015] border-white/[0.05] text-white/40 hover:bg-white/[0.03] hover:border-white/[0.08]'
                        }`}>
                      <div className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ${selected ? 'ring-2 ring-indigo-500/20' : ''}`}>
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_username || m.user_name || m.user_email}`} alt="" className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="truncate">{m.user_username ? `@${m.user_username}` : m.user_name || m.user_email}</p>
                      </div>
                      {selected && <Check size={13} className="text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : task.assignees && task.assignees.length > 0 ? (
            <div className="mb-6">
              <SectionLabel icon={Users} label={`Assignees (${task.assignees.length})`} />
              <div className="space-y-1.5">
                {task.assignees.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-indigo-500/15 ring-2 ring-indigo-500/10">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.user_username || a.user_name || a.user_email}`} alt="" className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white/65 font-medium truncate">{a.user_name || a.user_username || 'Unknown'}</p>
                        {a.user_username && <span className="text-[10px] text-indigo-400/70 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">@{a.user_username}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      {isEditing && (
        <div className="px-6 py-4 border-t border-white/[0.04] flex items-center gap-3 flex-shrink-0 bg-[#13151C]">
          <button onClick={() => setIsEditing(false)}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white/40 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-40 active:scale-[0.98]">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Save Changes
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-10 flex items-center justify-center p-8">
          <div className="bg-[#1A1D25] border border-white/[0.08] rounded-2xl p-7 max-w-sm w-full shadow-2xl shadow-black/50">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center mb-5 mx-auto">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Delete Task</h3>
            <p className="text-sm text-white/35 text-center mb-6 leading-relaxed">
              Permanently remove <span className="text-white/50 font-medium">"{task.title}"</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white/40 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-red-500/90 hover:bg-red-500 transition-colors disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </SlidePanel>
  );
}

// ─── Create Task Panel ──────────────────────────────────────────────
function CreateTaskPanel({ initialColumn, onClose, onCreated }: {
  initialColumn: string;
  onClose: () => void;
  onCreated: (task: BoardTask) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [boardColumn, setBoardColumn] = useState(initialColumn);
  const [dueDate, setDueDate] = useState('');

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    teamApi.listTeams().then(setTeams).catch(() => { });
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      setAssigneeIds([]);
      return;
    }
    teamApi.getTeam(selectedTeamId).then(t => setMembers(t.members)).catch(() => { });
  }, [selectedTeamId]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const selectedCol = BOARD_COLUMNS.find((c) => c.id === boardColumn);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setLoading(true);
      setError('');

      let created: any;
      if (selectedTeamId) {
        created = await teamApi.createTeamTask(selectedTeamId, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          boardColumn,
          dueDate: dueDate || undefined,
          assigneeIds,
        });
        const teamObj = teams.find(t => t.id === selectedTeamId);
        onCreated({ ...created, teamName: teamObj?.name || null });
      } else {
        created = await api.createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || null,
          boardColumn,
        });
        onCreated({ ...created, teamName: null, assignees: [] });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally { setLoading(false); }
  }

  return (
    <SlidePanel onClose={onClose} width="sm:max-w-[500px]">
      <PanelHeader title="New Task" subtitle="Add a task to your board" icon={Plus} onClose={onClose} />

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          <div>
            <SectionLabel icon={Edit2} label="Title" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?"
              className={`${inputClass} text-base font-medium`} autoFocus />
          </div>
          <div>
            <SectionLabel icon={MessageSquare} label="Description" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add more details..."
              className={`${inputClass} min-h-[100px] resize-none`} />
          </div>
          <div className="border-t border-white/[0.04]" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel icon={Tag} label="Priority" />
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${priority === p ? PRIORITY_COLORS[p] : 'bg-white/[0.02] border-white/[0.06] text-white/25 hover:bg-white/[0.04]'
                      }`}>{PRIORITY_LABELS[p]}</button>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel icon={Columns} label="Column" />
              <select value={boardColumn} onChange={(e) => setBoardColumn(e.target.value)} className={selectClass}>
                {BOARD_COLUMNS.map((c) => <option key={c.id} value={c.id} className="bg-[#1A1D25]">{c.label}</option>)}
              </select>
              <div className="flex items-center gap-1.5 mt-2 px-1">
                <div className={`w-2 h-2 rounded-full ${selectedCol?.color || 'bg-slate-500'}`} />
                <span className="text-[10px] text-white/20">{selectedCol?.label}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.04]" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel icon={Users} label="Workspace" />
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className={selectClass}>
                <option value="" className="bg-[#1A1D25]">Personal</option>
                {teams.map((t) => <option key={t.id} value={t.id} className="bg-[#1A1D25]">{t.name}</option>)}
              </select>
            </div>
            <div>
              <SectionLabel icon={Calendar} label="Due Date" />
              <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* Assignees (only if Team is selected) */}
          {selectedTeamId && (
            <div>
              <SectionLabel icon={Users} label={`Assignees (${assigneeIds.length}/${members.length})`} />
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const selected = assigneeIds.includes(m.user_id);
                  return (
                    <button key={m.user_id} type="button" onClick={() => toggleAssignee(m.user_id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${selected
                        ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/10'
                        : 'bg-white/[0.015] border-white/[0.05] text-white/40 hover:bg-white/[0.03] hover:border-white/[0.08]'
                        }`}>
                      <div className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ${selected ? 'ring-2 ring-indigo-500/20' : ''}`}>
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_username || m.user_name || m.user_email}`} alt="" className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="truncate">{m.user_username ? `@${m.user_username}` : m.user_name || m.user_email}</p>
                      </div>
                      {selected && <Check size={13} className="text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </form>

      <div className="px-6 py-4 border-t border-white/[0.04] flex-shrink-0 bg-[#13151C]">
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white/40 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          <button onClick={(e) => handleSubmit(e as any)} disabled={loading || !title.trim()}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-40 active:scale-[0.98]">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Create Task
          </button>
        </div>
      </div>
    </SlidePanel>
  );
}

// ─── List View Row ──────────────────────────────────────────────────
const ListRow: React.FC<{ task: BoardTask; onClick: () => void; onMarkComplete: (task: BoardTask) => void }> = ({ task, onClick, onMarkComplete }) => {
  const onChainStatus = getOnChainStatus(task, null);
  const columnInfo = BOARD_COLUMNS.find((c) => c.id === task.boardColumn);
  const isCompleted = task.status === 'completed';

  return (
    <tr className="group hover:bg-white/[0.02] border-b border-white/[0.03] cursor-pointer" onClick={onClick}>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCompleted ? 'bg-emerald-500' : columnInfo?.color || 'bg-slate-500'}`} />
          <div>
            <p className={`text-sm font-medium ${isCompleted ? 'text-white/35 line-through' : 'text-white/80'}`}>{task.title}</p>
            {task.description && <p className="text-[11px] text-white/25 line-clamp-1 mt-0.5">{task.description}</p>}
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${PRIORITY_COLORS[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${columnInfo?.color || 'bg-slate-500'}`} />
          <span className="text-xs text-white/45">{columnInfo?.label}</span>
        </div>
      </td>
      <td className="py-3.5 px-4">
        {task.teamName ? (
          <span className="text-[10px] text-indigo-400/60 font-medium flex items-center gap-1">
            <Users size={10} /> {task.teamName}
          </span>
        ) : (
          <span className="text-[10px] text-white/20">Personal</span>
        )}
      </td>
      <td className="py-3.5 px-4">
        {onChainStatus !== 'not_stored' && (
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-medium border ${ON_CHAIN_STYLE[onChainStatus]}`}>
            {ON_CHAIN_LABEL[onChainStatus]}
          </span>
        )}
      </td>
      <td className="py-3.5 px-4">
        <div className="flex -space-x-1.5">
          {(task.assignees || []).slice(0, 3).map((a) => (
            <div key={a.user_id} className="w-5 h-5 rounded-full border border-[#0F1117] overflow-hidden bg-indigo-500/20">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.user_username || a.user_name || a.user_email}`} alt="" className="w-full h-full" />
            </div>
          ))}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className="text-[11px] text-white/20">{timeAgo(task.updatedAt)}</span>
      </td>
      <td className="py-3.5 px-3 text-right">
        {isCompleted ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-emerald-400 bg-emerald-500/10">
            <CheckCircle2 size={11} /> Done
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkComplete(task); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium
                       text-white/25 border border-transparent
                       hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20
                       opacity-0 group-hover:opacity-100 transition-all duration-200"
            title="Mark as complete"
          >
            <CheckCircle2 size={11} />
            <span>Complete</span>
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Tasks Page ────────────────────────────────────────────────
export const TasksPage: React.FC = () => {
  const [allTasks, setAllTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState('backlog');
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'personal' | 'team'>('all');
  const draggedTask = useRef<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tasks = await api.listMyBoardTasks();
      setAllTasks(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filtered = allTasks.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
    }
    if (filterSource === 'personal' && t.teamId) return false;
    if (filterSource === 'team' && !t.teamId) return false;
    return true;
  });

  function handleDragStart(e: React.DragEvent, taskId: string) {
    draggedTask.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
  }

  async function handleDrop(_e: React.DragEvent, column: string) {
    const taskId = draggedTask.current;
    if (!taskId) return;
    draggedTask.current = null;

    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    setAllTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, boardColumn: column } : t));

    try {
      const colTasks = allTasks.filter((t) => t.boardColumn === column || t.id === taskId);
      if (task.teamId) {
        const { moveTask } = await import('../../src/services/teamApi');
        await moveTask(task.teamId, taskId, column, colTasks.length);
      } else {
        await api.moveTask(taskId, column, colTasks.length);
      }
    } catch { /* ignore */ }
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }

  function handleAddTask(column: string) {
    setNewTaskColumn(column);
    setShowCreate(true);
  }

  function handleTaskCreated(task: BoardTask) {
    setAllTasks((prev) => [task, ...prev]);
    setShowCreate(false);
  }

  function handleTaskClick(task: BoardTask) {
    setSelectedTask(task);
  }

  function handleTaskUpdated(updated: BoardTask) {
    setAllTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setSelectedTask(updated);
  }

  function handleTaskDeleted(taskId: string) {
    setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
  }

  async function handleMarkComplete(task: BoardTask) {
    const updated: BoardTask = { ...task, status: 'completed', boardColumn: 'done' };
    setAllTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    try {
      if (task.teamId) {
        const { updateTeamTask } = await import('../../src/services/teamApi');
        await updateTeamTask(task.teamId, task.id, { status: 'completed', boardColumn: 'done' });
      } else {
        await api.updateTask(task.id, { status: 'completed', boardColumn: 'done' });
      }
    } catch {
      setAllTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    }
  }

  const totalCount = allTasks.length;
  const personalCount = allTasks.filter((t) => !t.teamId).length;
  const teamCount = allTasks.filter((t) => t.teamId).length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-white/5 flex-shrink-0 gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
            My Tasks
            <span className="text-xs text-white/30 font-normal bg-white/5 px-2.5 py-0.5 rounded-full">{totalCount} total</span>
          </h1>
          <p className="text-xs text-white/30 mt-1 hidden sm:block">Personal tasks and team-assigned tasks in one view</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setNewTaskColumn('backlog'); setShowCreate(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium px-4 md:px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-[0.98] text-sm">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/20"><Plus size={14} /></span>
            Add Task
          </button>
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            <button onClick={() => setViewMode('kanban')}
              className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/40 hover:text-white/60'}`}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/40 hover:text-white/60'}`}>
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="px-4 md:px-8 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input type="text" placeholder="Search tasks..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-white/[0.06] self-start">
            {([
              ['all', `All (${totalCount})`],
              ['personal', `Personal (${personalCount})`],
              ['team', `Team (${teamCount})`],
            ] as const).map(([val, lbl]) => (
              <button key={val} onClick={() => setFilterSource(val)}
                className={`px-3 md:px-3.5 py-1.5 text-[11px] md:text-xs font-medium transition-colors ${filterSource === val ? 'bg-indigo-500/15 text-indigo-300' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
                  }`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-white/20" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <button onClick={fetchTasks} className="text-sm text-indigo-400 hover:text-indigo-300">Try again</button>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6">
          <div className="flex gap-4 md:gap-5 min-w-max h-full">
            {BOARD_COLUMNS.map((col) => {
              const colTasks = filtered
                .filter((t) => (t.boardColumn || 'backlog') === col.id)
                .sort((a, b) => a.boardOrder - b.boardOrder);
              return (
                <KanbanColumn key={col.id} column={col} tasks={colTasks}
                  onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
                  onAddTask={handleAddTask} onTaskClick={handleTaskClick} onMarkComplete={handleMarkComplete} />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-4">
            <div className="bg-[#1A1D25]/50 border border-white/[0.04] rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-left border-b border-white/[0.04] text-[11px] font-semibold text-white/25 uppercase tracking-wider">
                    <th className="py-3 px-4">Task</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Column</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Chain</th>
                    <th className="py-3 px-4">Assignees</th>
                    <th className="py-3 px-4">Updated</th>
                    <th className="py-3 px-3 text-right w-[100px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => (
                    <ListRow key={task.id} task={task} onClick={() => handleTaskClick(task)} onMarkComplete={handleMarkComplete} />
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                    <Plus size={24} className="text-indigo-400/50" />
                  </div>
                  <p className="text-sm text-white/40 mb-4">No tasks found</p>
                  <button onClick={() => { setNewTaskColumn('backlog'); setShowCreate(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 active:scale-95">
                    <Plus size={14} /> Create Task
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panels */}
      {showCreate && (
        <CreateTaskPanel
          initialColumn={newTaskColumn}
          onClose={() => setShowCreate(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdated}
          onDelete={handleTaskDeleted}
        />
      )}
    </div>
  );
};
