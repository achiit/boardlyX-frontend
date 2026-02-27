import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Users, UserPlus, X, ArrowLeft, Search,
  Clock, AlertCircle, Crown, Shield, User as UserIcon,
  Check, Loader2, Trash2, Edit3, CheckCircle2,
  Calendar, Tag, Columns, MessageSquare, Hash, ChevronRight,
  CircleDot, ArrowUpRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import * as teamApi from '../../src/services/teamApi';
import type { Team, TeamDetail, TeamMember, TeamTask, SearchedUser } from '../../src/services/teamApi';
import { UserSearch } from './UserSearch';
import { useSocket } from '../../src/hooks/useSocket';
import * as chatApi from '../../src/services/chatApi';

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

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
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

function RoleBadge({ role }: { role: string }) {
  if (role === 'owner') return <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-md"><Crown size={10} />Owner</span>;
  if (role === 'admin') return <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-md"><Shield size={10} />Admin</span>;
  return <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40 bg-white/5 px-1.5 py-0.5 rounded-md"><UserIcon size={10} />Member</span>;
}

function AvatarStack({ members, max = 4 }: { members: { user_name: string | null; user_email: string | null; user_username?: string | null }[]; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - max;
  return (
    <div className="flex -space-x-2">
      {shown.map((m, i) => (
        <div key={i} className="w-7 h-7 rounded-full border-2 border-[#1A1D25] overflow-hidden bg-indigo-500/20 flex items-center justify-center" title={m.user_name || m.user_email || ''}>
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_name || m.user_email || i}`} alt="" className="w-full h-full" />
        </div>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-[#1A1D25] bg-white/10 flex items-center justify-center text-[10px] text-white/60 font-medium">
          +{extra}
        </div>
      )}
    </div>
  );
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

// ─── Create Team Panel ──────────────────────────────────────────────
function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Team) => void }) {
  const { auth } = useStore();
  const [name, setName] = useState('');
  const [membersToInvite, setMembersToInvite] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleAddMember(user: SearchedUser) {
    if (!membersToInvite.find((m) => m.id === user.id)) {
      setMembersToInvite((prev) => [...prev, user]);
    }
  }

  function handleRemoveMember(id: string) {
    setMembersToInvite((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      setError('');
      const team = await teamApi.createTeam(name.trim());
      for (const member of membersToInvite) {
        try { await teamApi.inviteMember(team.id, { userId: member.id }); } catch { }
      }
      onCreated(team);
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    } finally { setLoading(false); }
  }

  const excludeIds = [auth.user?.id || '', ...membersToInvite.map((m) => m.id)].filter(Boolean);

  return (
    <SlidePanel onClose={onClose}>
      <PanelHeader title="Create Team" subtitle="Start collaborating with your team" icon={Users} onClose={onClose} />

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Team Name */}
          <div>
            <SectionLabel icon={Edit3} label="Team Name" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product Team, Engineering..."
              className={inputClass} autoFocus />
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.04]" />

          {/* Add Members */}
          <div>
            <SectionLabel icon={UserPlus} label="Invite Members" />
            <p className="text-[11px] text-white/20 mb-3">Search by username or email. They'll receive a notification.</p>
            <UserSearch onSelect={handleAddMember} excludeIds={excludeIds} placeholder="Search to add members..." />

            {membersToInvite.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {membersToInvite.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] group hover:border-white/[0.08] transition-colors">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-500/15 flex-shrink-0 ring-2 ring-indigo-500/10">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.username || m.name || m.email}`} alt="" className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70 font-medium truncate">{m.name || m.username || 'User'}</span>
                        {m.username && <span className="text-[10px] text-indigo-400/70 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">@{m.username}</span>}
                      </div>
                      {m.email && <p className="text-[10px] text-white/20 truncate mt-0.5">{m.email}</p>}
                    </div>
                    <button type="button" onClick={() => handleRemoveMember(m.id)}
                      className="p-1.5 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/[0.04] flex-shrink-0 bg-[#13151C]">
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white/40 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          <button onClick={(e) => handleSubmit(e as any)} disabled={loading || !name.trim()}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-40 active:scale-[0.98]">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {membersToInvite.length > 0 ? `Create & Invite ${membersToInvite.length}` : 'Create Team'}
          </button>
        </div>
      </div>
    </SlidePanel>
  );
}

// ─── Invite Member Panel ────────────────────────────────────────────
function InviteModal({ teamId, teamName, existingMemberIds, onClose, onInvited }: { teamId: string; teamName: string; existingMemberIds: string[]; onClose: () => void; onInvited?: () => void }) {
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentInvites, setRecentInvites] = useState<SearchedUser[]>([]);

  async function handleInvite() {
    if (!selectedUser) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await teamApi.inviteMember(teamId, { userId: selectedUser.id });
      setSuccess(`Invitation sent to @${selectedUser.username || selectedUser.email}!`);
      setRecentInvites((prev) => [selectedUser, ...prev]);
      setSelectedUser(null);
      onInvited?.();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally { setLoading(false); }
  }

  const allExcluded = [...existingMemberIds, ...recentInvites.map((u) => u.id)];

  return (
    <SlidePanel onClose={onClose} width="sm:max-w-[440px]">
      <PanelHeader title={`Invite to ${teamName}`} subtitle="They'll receive a notification to accept or decline" icon={UserPlus} onClose={onClose} />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        <div>
          <SectionLabel icon={Search} label="Find User" />
          <UserSearch
            onSelect={(user) => { setSelectedUser(user); setError(''); setSuccess(''); }}
            excludeIds={allExcluded}
            placeholder="Search by username or email..."
            autoFocus
          />
        </div>

        {selectedUser && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/15">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-indigo-500/15 flex-shrink-0 ring-2 ring-indigo-500/10">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username || selectedUser.name}`} alt="" className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{selectedUser.name || selectedUser.username || 'User'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedUser.username && <span className="text-[11px] text-indigo-400 font-mono">@{selectedUser.username}</span>}
                {selectedUser.email && <span className="text-[10px] text-white/25">{selectedUser.email}</span>}
              </div>
            </div>
            <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg text-white/15 hover:text-white/40 hover:bg-white/5 transition-colors"><X size={14} /></button>
          </div>
        )}

        {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p>}
        {success && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15">
            <Check size={14} className="text-emerald-400 flex-shrink-0" />
            <span className="text-xs text-emerald-300">{success}</span>
          </div>
        )}

        {recentInvites.length > 0 && (
          <div>
            <SectionLabel icon={Clock} label="Just Invited" />
            <div className="space-y-1.5">
              {recentInvites.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.015]">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username || u.name}`} alt="" className="w-full h-full" />
                  </div>
                  <span className="text-xs text-white/30">{u.username ? `@${u.username}` : u.email}</span>
                  <span className="text-[10px] text-emerald-400/50 ml-auto">Invited</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/[0.04] flex-shrink-0">
        <button onClick={handleInvite} disabled={loading || !selectedUser}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-40 active:scale-[0.98]">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          Send Invitation
        </button>
      </div>
    </SlidePanel>
  );
}

// ─── Create Task Panel ──────────────────────────────────────────────
function CreateTaskModal({
  teamId,
  members,
  onClose,
  onCreated,
}: {
  teamId: string;
  members: TeamMember[];
  onClose: () => void;
  onCreated: (t: TeamTask) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [boardColumn, setBoardColumn] = useState('backlog');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setLoading(true);
      setError('');
      const task = await teamApi.createTeamTask(teamId, { title: title.trim(), description, priority, boardColumn, assigneeIds });
      onCreated(task);
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally { setLoading(false); }
  }

  const selectedCol = BOARD_COLUMNS.find((c) => c.id === boardColumn);

  return (
    <SlidePanel onClose={onClose} width="sm:max-w-[500px]">
      <PanelHeader title="New Task" subtitle="Add a task to the team board" icon={Plus} onClose={onClose} />

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Title */}
          <div>
            <SectionLabel icon={Edit3} label="Title" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?"
              className={`${inputClass} text-base font-medium`} autoFocus />
          </div>

          {/* Description */}
          <div>
            <SectionLabel icon={MessageSquare} label="Description" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add more details..."
              className={`${inputClass} min-h-[100px] resize-none`} />
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* Priority & Column */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel icon={Tag} label="Priority" />
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${priority === p
                        ? PRIORITY_COLORS[p]
                        : 'bg-white/[0.02] border-white/[0.06] text-white/25 hover:bg-white/[0.04]'
                      }`}>
                    {PRIORITY_LABELS[p]}
                  </button>
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

          {/* Assignees */}
          <div>
            <SectionLabel icon={Users} label={`Assign Members (${assigneeIds.length}/${members.length})`} />
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
        </div>
      </form>

      {/* Footer */}
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

// ─── Task Detail Drawer ─────────────────────────────────────────────
function TaskDetailDrawer({
  task,
  members,
  teamId,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: TeamTask;
  members: TeamMember[];
  teamId: string;
  onClose: () => void;
  onUpdate: (updated: TeamTask) => void;
  onDelete: (taskId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [boardColumn, setBoardColumn] = useState(task.board_column || 'backlog');
  const [assigneeIds, setAssigneeIds] = useState<string[]>((task.assignees || []).map((a) => a.user_id));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setBoardColumn(task.board_column || 'backlog');
    setAssigneeIds((task.assignees || []).map((a) => a.user_id));
  }, [task]);

  function toggleAssignee(uid: string) {
    setAssigneeIds((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]);
  }

  async function handleSave() {
    try {
      setSaving(true);
      const updated = await teamApi.updateTeamTask(teamId, task.id, {
        title: title.trim(),
        description,
        priority,
        boardColumn,
        assigneeIds,
      });
      onUpdate(updated);
      setIsEditing(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleMarkComplete() {
    try {
      setSaving(true);
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const updated = await teamApi.updateTeamTask(teamId, task.id, { status: newStatus });
      onUpdate(updated);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await teamApi.deleteTeamTask(teamId, task.id);
      onDelete(task.id);
    } catch { /* ignore */ } finally { setDeleting(false); }
  }

  const columnInfo = BOARD_COLUMNS.find((c) => c.id === (task.board_column || 'backlog'));
  const createdDate = new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const updatedDate = new Date(task.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <SlidePanel onClose={onClose} width="sm:max-w-[520px]">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <button onClick={handleMarkComplete} disabled={saving}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${task.status === 'completed'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-white/[0.03] border-white/[0.06] text-white/25 hover:bg-indigo-500/10 hover:border-indigo-500/20 hover:text-indigo-400'
              }`}
            title={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}>
            <CheckCircle2 size={18} />
          </button>
          <div>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15' : 'bg-amber-500/10 text-amber-300 border border-amber-500/15'
              }`}>
              {task.status === 'completed' ? 'Completed' : 'Active'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="p-2 rounded-xl text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors" title="Edit">
              <Edit3 size={15} />
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-xl text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
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
              className="w-full text-lg font-bold text-white bg-[#0F1117]/80 border border-white/[0.06] rounded-xl px-4 py-3 mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30"
              autoFocus />
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
                        }`}>
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                  {PRIORITY_LABELS[task.priority] || task.priority}
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
                  <span className="text-xs text-white/55 font-medium">{columnInfo?.label || task.board_column}</span>
                </div>
              )}
            </div>

            {/* Created */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <Calendar size={13} className="text-white/20" />
                <span className="text-xs text-white/35">Created</span>
              </div>
              <span className="text-xs text-white/50">{createdDate}</span>
            </div>

            {/* Updated */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <Clock size={13} className="text-white/20" />
                <span className="text-xs text-white/35">Last updated</span>
              </div>
              <span className="text-xs text-white/50">{updatedDate}</span>
            </div>

            {/* Task hash */}
            {task.task_hash && (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Hash size={13} className="text-white/20" />
                  <span className="text-xs text-white/35">Task Hash</span>
                </div>
                <span className="text-[11px] text-indigo-300/70 font-mono">{task.task_hash.slice(0, 12)}...</span>
              </div>
            )}

            {/* On-chain */}
            {task.transaction_hash && (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/[0.08]">
                <div className="flex items-center gap-2.5">
                  <CircleDot size={13} className="text-emerald-400/60" />
                  <span className="text-xs text-white/35">On-Chain Tx</span>
                </div>
                <a href={`https://sepolia.etherscan.io/tx/${task.transaction_hash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 font-mono flex items-center gap-1 hover:text-indigo-300 transition-colors">
                  {task.transaction_hash.slice(0, 10)}...<ArrowUpRight size={10} />
                </a>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.04] mb-6" />

          {/* Assignees */}
          <div className="mb-6">
            <SectionLabel icon={Users} label={`Assignees${!isEditing ? ` (${(task.assignees || []).length})` : ''}`} />
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const selected = assigneeIds.includes(m.user_id);
                  return (
                    <button key={m.user_id} type="button" onClick={() => toggleAssignee(m.user_id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${selected
                          ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/10'
                          : 'bg-white/[0.015] border-white/[0.05] text-white/40 hover:bg-white/[0.03] hover:border-white/[0.08]'
                        }`}>
                      <div className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ${selected ? 'ring-2 ring-indigo-500/20' : ''}`}>
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_username || m.user_name || m.user_email}`} alt="" className="w-full h-full" />
                      </div>
                      <span className="truncate">{m.user_username ? `@${m.user_username}` : m.user_name || m.user_email}</span>
                      {selected && <Check size={12} className="text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {(task.assignees || []).length > 0 ? (
                  (task.assignees || []).map((a) => (
                    <div key={a.user_id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-indigo-500/15 ring-2 ring-indigo-500/10">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.user_username || a.user_name || a.user_email}`} alt="" className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white/65 font-medium truncate">{a.user_name || a.user_username || 'Unknown'}</p>
                          {a.user_username && <span className="text-[10px] text-indigo-400/70 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">@{a.user_username}</span>}
                        </div>
                        {a.user_email && <p className="text-[10px] text-white/20 truncate mt-0.5">{a.user_email}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-white/15">
                    <Users size={20} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No assignees yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      {isEditing && (
        <div className="px-6 py-4 border-t border-white/[0.04] flex items-center gap-3 flex-shrink-0 bg-[#13151C]">
          <button onClick={() => setIsEditing(false)}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white/40 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-40 active:scale-[0.98]">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Changes
          </button>
        </div>
      )}

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-10 flex items-center justify-center p-8">
          <div className="bg-[#1A1D25] border border-white/[0.08] rounded-2xl p-7 max-w-sm w-full shadow-2xl shadow-black/50">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center mb-5 mx-auto">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Delete Task</h3>
            <p className="text-sm text-white/35 text-center mb-6 leading-relaxed">
              This will permanently remove <span className="text-white/50 font-medium">"{task.title}"</span> from the board.
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

// ─── Kanban Card ────────────────────────────────────────────────────
const KanbanCard: React.FC<{
  task: TeamTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: TeamTask) => void;
}> = ({ task, onDragStart, onClick }) => {
  const wasDragging = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => { wasDragging.current = true; onDragStart(e, task.id); }}
      onDragEnd={() => { setTimeout(() => { wasDragging.current = false; }, 100); }}
      onClick={() => { if (!wasDragging.current) onClick(task); }}
      className="bg-[#0F1117] border border-white/5 rounded-xl p-3.5 cursor-pointer active:cursor-grabbing hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
          {PRIORITY_LABELS[task.priority] || task.priority}
        </span>
        <span className="text-[10px] text-white/25 flex items-center gap-1"><Clock size={9} />{timeAgo(task.created_at)}</span>
      </div>
      <h4 className={`text-sm font-medium mb-1 line-clamp-2 ${task.status === 'completed' ? 'text-white/40 line-through' : 'text-white'}`}>{task.title}</h4>
      {task.description && (
        <p className="text-xs text-white/35 line-clamp-2 mb-3">{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        <AvatarStack members={task.assignees || []} max={3} />
        <div className="flex items-center gap-1.5">
          {task.status === 'completed' && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Done</span>
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
  tasks: TeamTask[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, column: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onAddTask: (column: string) => void;
  onTaskClick: (task: TeamTask) => void;
}> = ({ column, tasks, onDragStart, onDrop, onDragOver, onAddTask, onTaskClick }) => {
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
        <button
          onClick={() => onAddTask(column.id)}
          className="p-1 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-2.5 min-h-[120px]">
        {tasks.map((t) => <KanbanCard key={t.id} task={t} onDragStart={onDragStart} onClick={onTaskClick} />)}
        {tasks.length === 0 && (
          <div className={`border-2 border-dashed rounded-xl py-8 text-center transition-colors ${isDragOver ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/5'}`}>
            <p className="text-xs text-white/20">Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Teams Page (Main Component) ────────────────────────────────────
export const TeamsPage: React.FC = () => {
  const { teams, setTeams, activeTeamId, setActiveTeamId, auth, setMobileMenuOpen } = useStore();
  const { sendMessage } = useSocket();
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState('backlog');
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const draggedTask = useRef<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const list = await teamApi.listTeams();
      setTeams(list);
    } catch { /* ignore */ }
  }, [setTeams]);

  const fetchTeamDetail = useCallback(async (id: string) => {
    try {
      const [detail, tasks] = await Promise.all([
        teamApi.getTeam(id),
        teamApi.listTeamTasks(id),
      ]);
      setTeamDetail(detail);
      setTeamTasks(tasks);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchTeams();
      setLoading(false);
    })();
  }, [fetchTeams]);

  useEffect(() => {
    if (activeTeamId) fetchTeamDetail(activeTeamId);
  }, [activeTeamId, fetchTeamDetail]);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    draggedTask.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
  }

  async function handleDrop(_e: React.DragEvent, column: string) {
    const taskId = draggedTask.current;
    if (!taskId || !activeTeamId) return;
    draggedTask.current = null;

    setTeamTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, board_column: column } : t)
    );

    try {
      const tasksInCol = teamTasks.filter((t) => t.board_column === column || t.id === taskId);
      await teamApi.moveTask(activeTeamId, taskId, column, tasksInCol.length);
    } catch { /* ignore */ }
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }

  function handleAddTask(column: string) {
    setNewTaskColumn(column);
    setShowCreateTask(true);
  }

  function handleTaskCreated(task: TeamTask) {
    setTeamTasks((prev) => [task, ...prev]);
    setShowCreateTask(false);
  }

  function handleTaskClick(task: TeamTask) {
    setSelectedTask(task);
  }

  function handleTaskUpdated(updated: TeamTask) {
    setTeamTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setSelectedTask(updated);
  }

  function handleTaskDeleted(taskId: string) {
    setTeamTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
  }

  // ─── Team List View ──
  if (!activeTeamId) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Teams</h1>
            <p className="text-sm text-white/40 mt-1 hidden sm:block">Collaborate with your teammates on tasks</p>
          </div>
          <button
            onClick={() => setShowCreateTeam(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-[0.98] self-start sm:self-auto"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/20"><Plus size={14} /></span>
            Create Team
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={24} className="animate-spin text-white/30" />
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
              <Users size={32} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No teams yet</h2>
            <p className="text-sm text-white/40 mb-6 max-w-sm text-center">Create a team to start collaborating. Invite members and manage tasks together on a shared board.</p>
            <button
              onClick={() => setShowCreateTeam(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-[0.98]"
            >
              <Plus size={16} /> Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setActiveTeamId(team.id)}
                className="text-left bg-[#1A1D25] border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 hover:bg-[#1A1D25]/80 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                    <Users size={20} className="text-indigo-400" />
                  </div>
                  <span className="text-xs text-white/25 flex items-center gap-1"><Clock size={10} />{timeAgo(team.created_at)}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">{team.name}</h3>
                <p className="text-xs text-white/40">{team.memberCount ?? 1} member{(team.memberCount ?? 1) > 1 ? 's' : ''}</p>
              </button>
            ))}
          </div>
        )}

        {showCreateTeam && (
          <CreateTeamModal
            onClose={() => setShowCreateTeam(false)}
            onCreated={(t) => {
              setTeams([t, ...teams]);
              setShowCreateTeam(false);
              setActiveTeamId(t.id);
            }}
          />
        )}
      </div>
    );
  }

  // ─── Team Detail + Kanban View ──
  const members = teamDetail?.members || [];
  const currentRole = members.find((m) => m.user_id === auth.user?.id)?.role;
  const isOwnerOrAdmin = currentRole === 'owner' || currentRole === 'admin';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-white/5 flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <button
            onClick={() => { setActiveTeamId(null); setTeamDetail(null); setTeamTasks([]); }}
            className="p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2 truncate">
              {teamDetail?.name || 'Loading...'}
              <span className="text-xs text-white/30 font-normal bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">{teamTasks.length} tasks</span>
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <AvatarStack members={members} max={4} />
              <span className="text-xs text-white/30 hidden sm:inline">{members.length} member{members.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 self-start sm:self-auto">
          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
            >
              <UserPlus size={16} /> <span className="hidden sm:inline">Invite</span>
            </button>
          )}
          <button
            onClick={() => { setNewTaskColumn('backlog'); setShowCreateTask(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium px-4 md:px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-[0.98] text-sm"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/20"><Plus size={14} /></span>
            Add Task
          </button>
        </div>
      </div>

      {/* Members strip */}
      <div className="px-4 md:px-8 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto pb-1 custom-scrollbar">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 flex-shrink-0">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-indigo-500/20 flex-shrink-0">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_username || m.user_name || m.user_email}`} alt="" className="w-full h-full" />
              </div>
              <span className="text-xs text-white/60 font-medium whitespace-nowrap">{m.user_name || m.user_username || m.user_email}</span>
              <span className="hidden sm:inline"><RoleBadge role={m.role} /></span>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6">
        <div className="flex gap-4 md:gap-5 min-w-max h-full">
          {BOARD_COLUMNS.map((col) => {
            const colTasks = teamTasks
              .filter((t) => (t.board_column || 'backlog') === col.id)
              .sort((a, b) => a.board_order - b.board_order);
            return (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={colTasks}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onAddTask={handleAddTask}
                onTaskClick={handleTaskClick}
              />
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showInvite && teamDetail && (
        <InviteModal
          teamId={teamDetail.id}
          teamName={teamDetail.name}
          existingMemberIds={members.map((m) => m.user_id)}
          onClose={() => setShowInvite(false)}
          onInvited={() => { }}
        />
      )}
      {showCreateTask && teamDetail && (
        <CreateTaskModal
          teamId={teamDetail.id}
          members={teamDetail.members}
          onClose={() => setShowCreateTask(false)}
          onCreated={async (task) => {
            setTeamTasks(prev => [...prev, task]);
            setShowCreateTask(false);

            // Forward notification to Team Chat (which flows to Telegram)
            try {
              const convs = await chatApi.listConversations();
              const teamConv = convs.find(c => c.team_id === teamDetail.id);
              if (teamConv) {
                const assignees = task.assignees?.map(a => a.user_name || a.user_username || a.user_id).join(', ') || 'Unassigned';
                const msg = `🎟️ *New Task Created*\n\n**${task.title}**\nPriority: ${task.priority}\nAssigned: ${assignees}`;
                sendMessage(teamConv.id, msg);
              }
            } catch (err) {
              console.error('Failed to notify chat of new task', err);
            }
          }}
        />
      )}
      {selectedTask && teamDetail && (
        <TaskDetailDrawer
          task={selectedTask}
          members={members}
          teamId={teamDetail.id}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdated}
          onDelete={handleTaskDeleted}
        />
      )}
    </div>
  );
};
