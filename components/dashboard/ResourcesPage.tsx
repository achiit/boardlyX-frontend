import React, { useEffect, useState, useCallback } from 'react';
import {
    Plus, Folder, Link as LinkIcon, Trash2, ExternalLink,
    Loader2, AlertTriangle, ChevronRight, FolderPlus, Globe, Shield
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import * as resourceService from '../../src/services/resourceService';
import { Category, Resource } from '../../types';

export const ResourcesPage: React.FC = () => {
    const { auth, activeTeamId } = useStore();
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [resources, setResources] = useState<Resource[]>([]);

    const [loading, setLoading] = useState(true);
    const [resourcesLoading, setResourcesLoading] = useState(false);
    const [error, setError] = useState<{ message: string; type?: 'auth' | 'general' } | null>(null);

    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [showResourceForm, setShowResourceForm] = useState(false);
    const [newResource, setNewResource] = useState({
        title: '',
        url: '',
        description: '',
    });

    const fetchCategories = useCallback(async () => {
        if (!activeTeamId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await resourceService.listCategories(activeTeamId);
            setCategories(data);
            if (data.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(data[0].id);
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load categories';
            setError({
                message: msg,
                type: msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('membership') ? 'auth' : 'general'
            });
        } finally {
            setLoading(false);
        }
    }, [activeTeamId, selectedCategoryId]);

    const fetchResources = useCallback(async (catId: string) => {
        setResourcesLoading(true);
        try {
            const data = await resourceService.listResources(catId);
            setResources(data);
        } catch (e) {
            console.error('Failed to load resources', e);
        } finally {
            setResourcesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        if (selectedCategoryId) {
            fetchResources(selectedCategoryId);
        } else {
            setResources([]);
        }
    }, [selectedCategoryId, fetchResources]);

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTeamId || !newCategoryName.trim()) return;
        try {
            const cat = await resourceService.createCategory(activeTeamId, newCategoryName);
            setCategories([...categories, cat]);
            setNewCategoryName('');
            setShowCategoryForm(false);
            setSelectedCategoryId(cat.id);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to create category');
        }
    };

    const handleDeleteCategory = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this category? All links inside will be lost.')) return;
        try {
            await resourceService.deleteCategory(id);
            setCategories(categories.filter(c => c.id !== id));
            if (selectedCategoryId === id) {
                setSelectedCategoryId(categories.find(c => c.id !== id)?.id || null);
            }
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to delete category');
        }
    };

    const handleCreateResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategoryId || !newResource.title.trim() || !newResource.url.trim()) return;

        // Simple URL validation
        try {
            new URL(newResource.url);
        } catch {
            alert('Please enter a valid URL (including http:// or https://)');
            return;
        }

        try {
            const res = await resourceService.createResource({
                categoryId: selectedCategoryId,
                ...newResource
            });
            setResources([res, ...resources]);
            setNewResource({ title: '', url: '', description: '' });
            setShowResourceForm(false);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to add resource');
        }
    };

    const handleDeleteResource = async (id: string) => {
        if (!confirm('Delete this link?')) return;
        try {
            await resourceService.deleteResource(id);
            setResources(resources.filter(r => r.id !== id));
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to delete resource');
        }
    };

    if (loading && categories.length === 0) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={28} className="animate-spin text-indigo-400" />
                    <span className="text-sm text-white/30">Loading resources...</span>
                </div>
            </div>
        );
    }

    if (error?.type === 'auth') {
        return (
            <div className="p-8">
                <Card className="py-16 text-center border-red-500/20 bg-red-500/[0.02]">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <Shield size={28} className="text-red-400/60" />
                    </div>
                    <h4 className="text-white font-semibold mb-1">Access Denied</h4>
                    <p className="text-sm text-white/35 mb-5 max-w-[320px] mx-auto">
                        You don't have permission to view this team's resources. Please ensure you are a member of the selected team.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => fetchCategories()} className="border-white/10">
                        Try Again
                    </Button>
                </Card>
            </div>
        );
    }

    if (!activeTeamId) {
        return (
            <div className="p-8">
                <Card className="py-16 text-center border-white/5 bg-white/[0.01]">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={28} className="text-amber-400/40" />
                    </div>
                    <h4 className="text-white font-semibold mb-1">No Team Selected</h4>
                    <p className="text-sm text-white/30 mb-5 max-w-[280px] mx-auto">
                        Please select or create a team to manage resources.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight">Resources</h1>
                    <p className="text-sm text-white/35 mt-1">Organize and share team links and documentation.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCategoryForm(true)}
                        className="border-white/5 hover:border-white/10"
                    >
                        <FolderPlus size={16} className="mr-2" />
                        New Category
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowResourceForm(true)}
                        disabled={!selectedCategoryId}
                    >
                        <Plus size={16} className="mr-2" />
                        Add Link
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Categories Sidebar */}
                <div className="lg:col-span-3 space-y-4">
                    <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest pl-1">Categories</h3>
                    <div className="space-y-1">
                        {categories.length === 0 ? (
                            <p className="text-xs text-white/20 pl-1 italic">No categories yet</p>
                        ) : (
                            categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`w-full flex items-center justify-between group px-3 py-2.5 rounded-xl transition-all duration-200 ${selectedCategoryId === cat.id
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : 'text-white/40 hover:bg-white/[0.03] hover:text-white/60 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Folder size={18} className={selectedCategoryId === cat.id ? 'text-indigo-400' : 'text-white/20'} />
                                        <span className="text-sm font-medium truncate">{cat.name}</span>
                                    </div>
                                    <Trash2
                                        size={14}
                                        className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all cursor-pointer"
                                        onClick={(e) => handleDeleteCategory(cat.id, e)}
                                    />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Resources Grid */}
                <div className="lg:col-span-9 space-y-6">
                    {!selectedCategoryId ? (
                        <Card className="py-20 text-center bg-white/[0.02] border-dashed border-white/5">
                            <Folder size={40} className="mx-auto mb-4 text-white/10" />
                            <h3 className="text-white/40 font-medium">Select a category to view resources</h3>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Folder className="text-indigo-400" size={20} />
                                    {categories.find(c => c.id === selectedCategoryId)?.name}
                                    <span className="text-xs font-normal text-white/20 ml-2">({resources.length} items)</span>
                                </h2>
                            </div>

                            {resourcesLoading ? (
                                <div className="py-20 flex justify-center">
                                    <Loader2 size={24} className="animate-spin text-indigo-400/40" />
                                </div>
                            ) : resources.length === 0 ? (
                                <Card className="py-20 text-center bg-white/[0.02] border-dashed border-white/5">
                                    <LinkIcon size={40} className="mx-auto mb-4 text-white/10" />
                                    <p className="text-white/30 text-sm mb-4">No resources in this category</p>
                                    <Button variant="outline" size="sm" onClick={() => setShowResourceForm(true)}>
                                        Add your first link
                                    </Button>
                                </Card>
                            ) : (
                                <div key={selectedCategoryId} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                    {resources.map(res => (
                                        <Card key={res.id} className="group relative border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.03] transition-all duration-300">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Globe size={14} className="text-indigo-400/60" />
                                                        <h4 className="text-sm font-semibold text-white/90 truncate group-hover:text-indigo-400 transition-colors">
                                                            {res.title}
                                                        </h4>
                                                    </div>
                                                    {res.description && (
                                                        <p className="text-xs text-white/40 line-clamp-2 mb-3 leading-relaxed">
                                                            {res.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-auto">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] text-indigo-400">
                                                                {res.user_name?.[0]?.toUpperCase() || 'U'}
                                                            </div>
                                                            <span className="text-[10px] text-white/25">Added by {res.user_name}</span>
                                                        </div>
                                                        <span className="text-[10px] text-white/10">•</span>
                                                        <span className="text-[10px] text-white/25">
                                                            {new Date(res.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <a
                                                        href={res.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-indigo-500 transition-all"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDeleteResource(res.id)}
                                                        className="p-2 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Category Form Modal */}
            {showCategoryForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <Card className="border-white/10 shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Create Category</h3>
                            <form onSubmit={handleCreateCategory} className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-white/40 mb-1.5 block">Category Name</label>
                                    <input
                                        autoFocus
                                        required
                                        type="text"
                                        placeholder="e.g. Backend, UI/UX"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        className="w-full bg-[#1A1D25] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-white"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCategoryForm(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="primary" className="flex-1">
                                        Create
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            )}

            {/* Resource Form Modal */}
            {showResourceForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <Card className="border-white/10 shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Add Resource</h3>
                            <form onSubmit={handleCreateResource} className="space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-white/40 mb-1.5 block">Title</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. API Documentation"
                                            value={newResource.title}
                                            onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                            className="w-full bg-[#1A1D25] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-white/40 mb-1.5 block">URL</label>
                                        <input
                                            required
                                            type="url"
                                            placeholder="https://..."
                                            value={newResource.url}
                                            onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                                            className="w-full bg-[#1A1D25] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-white/40 mb-1.5 block">Description (Optional)</label>
                                        <textarea
                                            placeholder="What is this link for?"
                                            value={newResource.description}
                                            onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                                            className="w-full bg-[#1A1D25] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-white min-h-[100px] resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowResourceForm(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="primary" className="flex-1">
                                        Add Link
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            )}
            {/* Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};
