import { Category, Resource } from '../../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

function getToken(): string | null {
    return localStorage.getItem('token');
}

function headers(): HeadersInit {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function listCategories(teamId: string): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/api/resources/categories/${teamId}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch categories');
    }
    return res.json();
}

export async function createCategory(teamId: string, name: string): Promise<Category> {
    const res = await fetch(`${API_BASE}/api/resources/categories`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ teamId, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create category');
    return data;
}

export async function deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/resources/categories/${id}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete category');
    }
}

export async function listResources(categoryId: string): Promise<Resource[]> {
    const res = await fetch(`${API_BASE}/api/resources/${categoryId}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch resources');
    }
    return res.json();
}

export async function createResource(body: {
    categoryId: string;
    title: string;
    url: string;
    description?: string;
}): Promise<Resource> {
    const res = await fetch(`${API_BASE}/api/resources`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create resource');
    return data;
}

export async function deleteResource(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/resources/${id}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete resource');
    }
}
