'use client';

import React, { useCallback, useEffect, useState } from 'react';
import '../../Dashboard.css';
import {
  AlertCircle, Archive, Bell, BookOpen, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  Clock, FileBarChart, GraduationCap, Layers, LayoutGrid, LogOut, Menu, MessageSquare,
  Pencil, Plus, RefreshCw, Settings, Trophy, Users, Wifi, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCohort } from '../../contexts/CohortContext';
import ProgramCourseModal from '../../components/ProgramCourseModal';
import CourseFacultyModal from '../../components/CourseFacultyModal';
import CohortListsManager from '../../components/CohortListsManager';

const button = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, color: '#334155' };

export default function AdminProgramsPage() {
  const router = useRouter();
  const { authReady, logout, user: authUser } = useAuth();
  const { selectedCohort, selectedCohortObj, loading: cohortLoading, isReadOnly } = useCohort();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { program: null|object }
  const [facultyModal, setFacultyModal] = useState(null); // course being assigned faculty
  const [editing, setEditing] = useState(null); // { type: 'program'|'course', item, name, code, description }
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const navTo = (path) => router.push(path);

  const openEdit = (type, item) => setEditing({ type, item, name: item.name || '', code: item.code || '', description: item.description || '' });
  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true); setEditError('');
    try {
      if (editing.type === 'program') {
        await api.patch(`/api/admin/programs/${editing.item.id}`, { name: editing.name });
      } else {
        await api.patch(`/api/admin/courses/${editing.item.id}`, { name: editing.name, code: editing.code, description: editing.description });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const load = useCallback(async () => {
    if (!selectedCohort) return;
    try {
      setLoading(true);
      const data = await api.get('/api/admin/programs?include_courses=1');
      setPrograms(data.programs || []);
      setUnassigned(data.unassigned_courses || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load programs.');
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    if (authReady && !cohortLoading && selectedCohort) load();
  }, [authReady, cohortLoading, selectedCohort, load]);

  const sidebarItem = (path, icon, text, active = false) => (
    <div className={`nav-item${active ? ' active' : ''}`} onClick={() => !active && navTo(path)} style={{ cursor: active ? 'default' : 'pointer' }}>{icon}<span>{text}</span></div>
  );

  return (
    <div className="dashboard-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
        <div>
          <div className="user-profile" style={{ position: 'relative' }}>
            <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>AD</div>
            <div className="user-info"><h3>Admin</h3><p>Programs & Courses</p></div>
            <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>{isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</div>
          </div>
          <div id="cohort-switcher-portal" style={{ padding: '0 1rem 1rem', display: isCollapsed ? 'none' : 'block', width: '100%', boxSizing: 'border-box' }} />
          <nav className="nav-menu">
            <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#555', padding: '8px 1rem 4px' }}><span>Main</span></div>
            {sidebarItem('/admin', <LayoutGrid size={18} />, 'Dashboard')}
            {sidebarItem('/admin/schedule', <Calendar size={18} />, 'Schedule Management')}
            {sidebarItem('/admin/attendance', <CheckCircle size={18} />, 'Attendance Monitoring')}
            {sidebarItem('/admin/live-students', <Users size={18} />, 'Live Students')}
            {sidebarItem('/admin/students', <GraduationCap size={18} />, 'Student Management')}
            {sidebarItem('/admin/leave-requests', <Clock size={18} />, 'Leave Requests')}
            {sidebarItem('/admin/wifi-logs', <Wifi size={18} />, 'Wi-Fi Logs')}
            <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
            {sidebarItem('/admin/feedback', <MessageSquare size={18} />, 'Feedback Analytics')}
            {sidebarItem('/admin/leaderboard', <Trophy size={18} />, 'Leaderboard')}
            {sidebarItem('/admin/faculty-hours', <Clock size={18} />, 'Faculty Management')}
            {sidebarItem('/admin/reports', <FileBarChart size={18} />, 'Reports')}
            <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
            {sidebarItem('/admin/programs', <BookOpen size={18} />, 'Programs & Courses', true)}
            {sidebarItem('/admin/cohorts', <Layers size={18} />, 'Cohorts')}
            {sidebarItem('/admin/notifications', <Bell size={18} />, 'Notifications')}
            {sidebarItem('/admin/settings', <Settings size={18} />, 'Settings')}
          </nav>
        </div>
        <div className="sidebar-footer"><div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /><span>Log out</span></div></div>
      </aside>

      <div className="main-content" style={{ padding: '2rem 3rem' }}>
        <div className="content-center admin-full" style={{ maxWidth: 1120, margin: '0 auto' }}>
          <button
            type="button"
            onClick={() => router.push('/admin/settings')}
            style={{ display: 'inline-flex', alignSelf: 'flex-start', width: 'fit-content', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}
          >
            <ChevronLeft size={14} /> Back to Settings
          </button>
          <header className="dashboard-header" style={{ borderBottom: 0, padding: '0 0 1.5rem', background: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Programs & Courses</h1>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '4px 0 0' }}>Programs are shared globally; courses below belong to <strong>{selectedCohortObj?.label || 'the selected cohort'}</strong>.</p>
              </div>
            </div>
            <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
              <button style={button} onClick={load} disabled={loading}><RefreshCw size={13} /> Refresh</button>
              <button style={{ ...button, border: 0, background: '#0f172a', color: '#fff', opacity: isReadOnly ? 0.5 : 1 }} disabled={isReadOnly || !selectedCohort} onClick={() => setModal({ program: null })}><Plus size={14} /> New program</button>
            </div>
          </header>

          {isReadOnly && <div style={{ display: 'flex', gap: 8, padding: '11px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.8rem', marginBottom: 14 }}><Archive size={16} /> This cohort is archived. Programs and courses are read-only.</div>}
          {error && <div style={{ display: 'flex', gap: 8, padding: '11px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8rem', marginBottom: 14 }}><AlertCircle size={16} /> {error}</div>}

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading programs…</div>
          ) : programs.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
              <BookOpen size={42} color="#cbd5e1" />
              <h2 style={{ color: '#0f172a', fontSize: '1.05rem' }}>No programs yet</h2>
              <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Create a program and add all of its initial courses in one step.</p>
              {!isReadOnly && <button style={{ ...button, border: 0, background: '#0f172a', color: '#fff' }} onClick={() => setModal({ program: null })}><Plus size={14} /> Create first program</button>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
              {programs.map((program) => (
                <section key={program.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div><h2 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>{program.name}<button title="Rename program" disabled={isReadOnly} onClick={() => openEdit('program', program)} style={{ background: 'none', border: 'none', cursor: isReadOnly ? 'not-allowed' : 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}><Pencil size={13} /></button></h2><div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: 2 }}>{program.courses.length} course{program.courses.length === 1 ? '' : 's'} in this cohort</div></div>
                    <button style={{ ...button, padding: '5px 9px', opacity: isReadOnly ? 0.5 : 1 }} disabled={isReadOnly} onClick={() => setModal({ program })}><Plus size={12} /> Add courses</button>
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {program.courses.map((course) => (
                      <div key={course.id} style={{ border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: 9, padding: '10px 11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#1e293b', fontWeight: 700, fontSize: '0.82rem' }}>{course.name}</span><code style={{ color: '#475569', fontSize: '0.7rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: 5 }}>{course.code}</code></div>
                        <button style={{ ...button, padding: '3px 8px', marginTop: 6, fontSize: '0.68rem' }} onClick={() => setFacultyModal(course)}><Users size={11} /> Faculty</button>
                        <button style={{ ...button, padding: '3px 8px', marginTop: 6, marginLeft: 6, fontSize: '0.68rem', opacity: isReadOnly ? 0.5 : 1 }} disabled={isReadOnly} onClick={() => openEdit('course', course)}><Pencil size={11} /> Edit</button>
                        {course.description && <div style={{ color: '#64748b', fontSize: '0.72rem', lineHeight: 1.45, marginTop: 5 }}>{course.description}</div>}
                      </div>
                    ))}
                    {!program.courses.length && <div style={{ color: '#94a3b8', fontSize: '0.76rem', padding: 8 }}>No courses in this cohort.</div>}
                  </div>
                </section>
              ))}
            </div>
          )}

          {unassigned.length > 0 && (
            <section style={{ marginTop: 18, padding: 16, borderRadius: 12, border: '1px solid #fde68a', background: '#fffbeb' }}>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.84rem' }}>Shared / legacy courses</div>
              <div style={{ color: '#a16207', fontSize: '0.72rem', margin: '3px 0 9px' }}>These courses have no program and remain available to every student.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{unassigned.map((course) => <span key={course.id} style={{ padding: '5px 8px', borderRadius: 7, background: '#fff', border: '1px solid #fde68a', color: '#78350f', fontSize: '0.72rem' }}>{course.code ? `${course.code} — ` : ''}{course.name}</span>)}</div>
            </section>
          )}
          {selectedCohort && <CohortListsManager key={selectedCohort} readOnly={isReadOnly} cohortLabel={selectedCohortObj?.label} />}
        </div>
      </div>


      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 440, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.4rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{editing.type === 'program' ? 'Rename Program' : 'Edit Course'}</h3>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {editError && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.78rem' }}>{editError}</div>}
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555' }}>Name
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 5, padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </label>
              {editing.type === 'course' && (
                <>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555' }}>Code
                    <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 5, padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', boxSizing: 'border-box', textTransform: 'uppercase' }} />
                  </label>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555' }}>Description <span style={{ fontWeight: 400, color: '#aaa' }}>— optional</span>
                    <textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 5, padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </label>
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '1rem 1.4rem', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setEditing(null)} style={button}>Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} style={{ ...button, border: 0, background: '#0f172a', color: '#fff', opacity: editSaving ? 0.6 : 1 }}>{editSaving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
      {facultyModal && <CourseFacultyModal course={facultyModal} readOnly={isReadOnly} onClose={() => setFacultyModal(null)} />}
      {modal && <ProgramCourseModal program={modal.program} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />}
    </div>
  );
}
