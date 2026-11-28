'use client';
import { useState } from 'react';
import { Search, X, Info } from 'lucide-react';

// Searchable multi-select for faculty. `value` is an array of faculty ids; `options` is [{ id, name }].
export default function FacultyMultiSelect({ value = [], onChange, options = [] }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);

    const selected = value.map(id => options.find(f => f.id === id) || { id, name: 'Unknown faculty' });
    const filtered = options.filter(f => !value.includes(f.id) && f.name.toLowerCase().includes(query.toLowerCase()));

    const add = (id) => { onChange([...value, id]); setQuery(''); };
    const remove = (id) => onChange(value.filter(v => v !== id));

    return (
        <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                Faculty
                <span title="To add a new faculty, please do so from the Faculty Management tab." style={{ display: 'inline-flex', cursor: 'help', color: '#888' }}>
                    <Info size={13} />
                </span>
            </label>

            {selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {selected.map(f => (
                        <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f5f3ff', color: '#3B2D82', border: '1px solid #ddd6fe', borderRadius: '999px', padding: '3px 6px 3px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                            {f.name}
                            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(f.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, color: '#3B2D82' }}>
                                <X size={13} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder={selected.length ? 'Add another faculty...' : 'Search faculty...'}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                    style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                <Search size={15} color="#aaa" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
            </div>

            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                    {filtered.map(f => (
                        <div key={f.id}
                            onMouseDown={e => { e.preventDefault(); add(f.id); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '0.8rem', color: '#333' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >{f.name}</div>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>
                            {options.length === value.length ? 'All faculty selected' : 'No faculty found'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
