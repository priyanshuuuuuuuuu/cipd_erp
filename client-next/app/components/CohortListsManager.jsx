'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X, MapPin, Tag, Sparkles, Folder } from 'lucide-react';
import { api } from '@/lib/api';

const btn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, color: '#334155' };
const input = { display: 'block', width: '100%', marginTop: 5, padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Cohort-specific lists the admin can maintain. Each tab: where it lives in the API, its form fields and its table columns.
function buildTabs(data) {
  const categoryOptions = [{ value: '', label: 'No category' }, ...data.categories.map(c => ({ value: c.id, label: c.course_name ? `${c.name} (${c.course_name})` : c.name }))];
  const courseOptions = data.courses.map(c => ({ value: c.id, label: c.name }));
  return [
    {
      key: 'venues', label: 'Venues', icon: MapPin, singular: 'venue', rows: data.venues, endpoint: '/api/admin/venues',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'building', label: 'Building', hint: 'optional' },
        { key: 'is_active', label: 'Active (available when scheduling)', kind: 'checkbox', editOnly: true },
      ],
      columns: [
        { label: 'Venue', render: r => r.name },
        { label: 'Building', render: r => r.building || '-' },
        { label: 'Status', render: r => (r.is_active === false ? 'Inactive' : 'Active') },
        { label: 'Classes', render: r => r.used_by },
      ],
      blank: { name: '', building: '', is_active: true },
      deleteNote: r => (r.used_by ? `This venue is used by ${plural(r.used_by, 'class', 'classes')} and cannot be deleted. Edit it and untick Active to hide it.` : null),
    },
    {
      key: 'types', label: 'Class types', icon: Tag, singular: 'class type', rows: data.sessionTypes, endpoint: '/api/admin/session-types',
      fields: [{ key: 'name', label: 'Name', required: true }],
      columns: [{ label: 'Class type', render: r => r.name }, { label: 'Classes', render: r => r.used_by }],
      blank: { name: '' },
      deleteNote: r => (r.used_by ? `This class type is used by ${plural(r.used_by, 'class', 'classes')} and cannot be deleted.` : null),
    },
    {
      key: 'skills', label: 'Skills', icon: Sparkles, singular: 'skill', rows: data.skills, endpoint: '/api/admin/skills',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'category_id', label: 'Category', kind: 'select', options: categoryOptions },
        { key: 'details', label: 'Details', kind: 'textarea', hint: 'optional' },
      ],
      columns: [
        { label: 'Skill', render: r => r.name },
        { label: 'Category', render: r => r.category_name || '-' },
        { label: 'Classes', render: r => r.used_by },
      ],
      blank: { name: '', category_id: '', details: '' },
      confirmDelete: r => `Delete the skill "${r.name}"?${r.used_by ? ` It will also be removed from ${plural(r.used_by, 'class', 'classes')}.` : ''}`,
    },
    {
      key: 'categories', label: 'Categories', icon: Folder, singular: 'category', rows: data.categories, endpoint: '/api/admin/categories',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'course_id', label: 'Course', kind: 'select', options: courseOptions, required: true },
      ],
      columns: [
        { label: 'Category', render: r => r.name },
        { label: 'Course', render: r => r.course_name || '-' },
        { label: 'Skills', render: r => r.skill_count },
        { label: 'Classes', render: r => r.used_by },
      ],
      blank: { name: '', course_id: '' },
      confirmDelete: r => `Delete the category "${r.name}"?${r.skill_count ? ` ${plural(r.skill_count, 'skill', 'skills')} will become uncategorised.` : ''}${r.used_by ? ` ${plural(r.used_by, 'class', 'classes')} will lose this category.` : ''}`,
    },
  ];
}

export default function CohortListsManager({ readOnly = false, cohortLabel = 'the selected cohort' }) {
  const [data, setData] = useState({ venues: [], sessionTypes: [], skills: [], categories: [], courses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState('venues');
  const [form, setForm] = useState(null); // { mode: 'add'|'edit', id?, values }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await api.get('/api/admin/cohort-lists'));
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load cohort settings.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const tabs = useMemo(() => buildTabs(data), [data]);
  const tab = tabs.find(t => t.key === active) || tabs[0];

  const openAdd = () => { setFormError(''); setForm({ mode: 'add', values: { ...tab.blank } }); };
  const openEdit = (row) => {
    const values = {};
    for (const f of tab.fields) values[f.key] = row[f.key] ?? (f.kind === 'checkbox' ? true : '');
    setFormError(''); setForm({ mode: 'edit', id: row.id, values });
  };

  const save = async () => {
    for (const f of tab.fields) {
      if (f.required && !String(form.values[f.key] || '').trim()) { setFormError(`${f.label} is required.`); return; }
    }
    setSaving(true); setFormError('');
    try {
      if (form.mode === 'add') await api.post(tab.endpoint, form.values);
      else await api.patch(`${tab.endpoint}/${form.id}`, form.values);
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const blocked = tab.deleteNote?.(row);
    if (blocked) { window.alert(blocked); return; }
    const message = tab.confirmDelete ? tab.confirmDelete(row) : `Delete "${row.name}"?`;
    if (!window.confirm(message)) return;
    try {
      await api.delete(`${tab.endpoint}/${row.id}`);
      await load();
    } catch (err) {
      window.alert(err.message || 'Failed to delete.');
    }
  };

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Cohort settings</h2>
      <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '4px 0 12px' }}>
        Venues, class types, skills and categories below belong to <strong>{cohortLabel}</strong> only. Changes here do not affect other cohorts.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const on = t.key === tab.key;
          return (
            <button key={t.key} type="button" onClick={() => setActive(t.key)}
              style={{ ...btn, background: on ? '#0f172a' : '#fff', color: on ? '#fff' : '#334155', borderColor: on ? '#0f172a' : '#e2e8f0' }}>
              <Icon size={13} /> {t.label} <span style={{ opacity: 0.7 }}>({t.rows.length})</span>
            </button>
          );
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
          <button type="button" disabled={readOnly} onClick={openAdd} style={{ ...btn, border: 0, background: '#0f172a', color: '#fff', opacity: readOnly ? 0.5 : 1 }}>
            <Plus size={13} /> Add {tab.singular}
          </button>
        </div>
        {error && <div style={{ padding: 12, color: '#b91c1c', fontSize: '0.8rem' }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>Loading…</div>
        ) : tab.rows.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No {tab.label.toLowerCase()} in this cohort yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {tab.columns.map(c => <th key={c.label} style={{ textAlign: 'left', padding: '9px 14px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>{c.label}</th>)}
                  <th style={{ borderBottom: '1px solid #f1f5f9' }} />
                </tr>
              </thead>
              <tbody>
                {tab.rows.map(row => (
                  <tr key={row.id}>
                    {tab.columns.map(c => <td key={c.label} style={{ padding: '9px 14px', borderBottom: '1px solid #f8fafc', color: '#334155' }}>{c.render(row)}</td>)}
                    <td style={{ padding: '6px 14px', borderBottom: '1px solid #f8fafc', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" title="Edit" disabled={readOnly} onClick={() => openEdit(row)} style={{ ...btn, padding: '4px 8px', opacity: readOnly ? 0.5 : 1 }}><Pencil size={12} /></button>
                      <button type="button" title="Delete" disabled={readOnly} onClick={() => remove(row)} style={{ ...btn, padding: '4px 8px', marginLeft: 6, color: '#b91c1c', opacity: readOnly ? 0.5 : 1 }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 440, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.4rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{form.mode === 'add' ? 'Add' : 'Edit'} {tab.singular}</h3>
              <button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {formError && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.78rem' }}>{formError}</div>}
              {tab.fields.filter(f => !(f.editOnly && form.mode === 'add')).map(f => {
                const set = (v) => setForm({ ...form, values: { ...form.values, [f.key]: v } });
                const label = <>{f.label}{f.hint && <span style={{ fontWeight: 400, color: '#aaa' }}> - {f.hint}</span>}</>;
                if (f.kind === 'checkbox') {
                  return <label key={f.key} style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={!!form.values[f.key]} onChange={e => set(e.target.checked)} /> {f.label}
                  </label>;
                }
                return (
                  <label key={f.key} style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555' }}>{label}
                    {f.kind === 'textarea' ? (
                      <textarea rows={3} value={form.values[f.key] || ''} onChange={e => set(e.target.value)} style={{ ...input, resize: 'vertical' }} />
                    ) : f.kind === 'select' ? (
                      <select value={form.values[f.key] || ''} onChange={e => set(e.target.value)} style={{ ...input, background: '#fff' }}>
                        {f.required && <option value="">Select...</option>}
                        {f.options.filter(o => !(f.required && o.value === '')).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input value={form.values[f.key] || ''} onChange={e => set(e.target.value)} style={input} />
                    )}
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '1rem 1.4rem', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setForm(null)} style={btn}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...btn, border: 0, background: '#0f172a', color: '#fff', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
