export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeMac, isValidMac } from '@/lib/attendance-mac';
import { withRole } from '@/lib/middleware';
import XLSX from 'xlsx';

const SLOTS = [
  { id: 'slot1', label: '09:30 - 11:00', shortLabel: '9:30-11am', start: '09:30:00', end: '11:00:00' },
  { id: 'slot2', label: '11:15 - 12:45', shortLabel: '11:15am-12:45pm', start: '11:15:00', end: '12:45:00' },
  { id: 'slot3', label: '14:00 - 15:30', shortLabel: '2pm-3:30pm', start: '14:00:00', end: '15:30:00' },
  { id: 'slot4', label: '15:45 - 17:30', shortLabel: '3:45pm-5:30pm', start: '15:45:00', end: '17:30:00' },
];

async function handler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('from') || '2026-09-10';
    const dateTo = searchParams.get('to') || '2026-10-11';
    const format = searchParams.get('format') || 'json'; // 'json', 'csv', 'xlsx'

    // 1. Drizzle ORM: Fetch all students and user details
    const studentRows = await db
      .select({
        id: students.id,
        enrollmentNo: students.enrollmentNo,
        macAddress: students.macAddress,
        macVerified: students.macVerified,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
      })
      .from(students)
      .leftJoin(users, eq(students.id, users.id))
      .orderBy(students.enrollmentNo);

    const studentList = studentRows.map((s) => {
      const rawMac = s.macAddress || '';
      const norm = normalizeMac(rawMac);
      const valid = isValidMac(norm);
      const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Unnamed Student';

      return {
        id: s.id,
        enrollmentNo: s.enrollmentNo || 'NO-ENROLLMENT',
        name,
        email: s.email || '',
        macAddress: rawMac,
        normalizedMac: valid ? norm : null,
        macVerified: !!s.macVerified,
        isActive: s.isActive ?? true,
      };
    });

    // 2. Generate date range
    const dates = [];
    const curr = new Date(`${dateFrom}T00:00:00+05:30`);
    const end = new Date(`${dateTo}T00:00:00+05:30`);
    while (curr <= end) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayName = curr.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
      dates.push({ dateStr, dayName });
      curr.setDate(curr.getDate() + 1);
    }

    // 3. Supabase: Query wifi_snapshots by day and match
    const matrix = {};
    const dailySummary = {};
    const studentStats = {};

    studentList.forEach((st) => {
      studentStats[st.id] = {
        enrollmentNo: st.enrollmentNo,
        name: st.name,
        mac: st.normalizedMac,
        macVerified: st.macVerified,
        totalSlotsPresent: 0,
        totalSlotsEvaluated: dates.length * 4,
        bySlot: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
      };
    });

    for (const { dateStr, dayName } of dates) {
      matrix[dateStr] = {};
      dailySummary[dateStr] = {
        date: dateStr,
        dayName,
        snapshotsCount: 0,
        presentCount: 0,
        bySlotPresent: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
      };

      const dayStartIso = `${dateStr}T09:30:00+05:30`;
      const dayEndIso = `${dateStr}T17:30:00+05:30`;

      // Supabase query for wifi_snapshots (retained as per migration rule)
      const { data: snapshots } = await supabaseAdmin
        .schema('public')
        .from('wifi_snapshots')
        .select('id, captured_at, iw_dump')
        .gte('captured_at', dayStartIso)
        .lte('captured_at', dayEndIso)
        .order('captured_at', { ascending: true });

      dailySummary[dateStr].snapshotsCount = snapshots?.length || 0;

      const slotSeenMacs = {
        slot1: new Set(),
        slot2: new Set(),
        slot3: new Set(),
        slot4: new Set(),
      };

      (snapshots || []).forEach((snap) => {
        const snapTime = new Date(snap.captured_at).getTime();

        let matchedSlot = null;
        for (const slot of SLOTS) {
          const slotStartMs = new Date(`${dateStr}T${slot.start}+05:30`).getTime();
          const slotEndMs = new Date(`${dateStr}T${slot.end}+05:30`).getTime();
          if (snapTime >= slotStartMs && snapTime <= slotEndMs) {
            matchedSlot = slot.id;
            break;
          }
        }

        if (!matchedSlot) return;

        let clients = [];
        try {
          let dump = snap.iw_dump;
          if (typeof dump === 'string') dump = JSON.parse(dump);
          if (typeof dump === 'string') dump = JSON.parse(dump);
          clients = Array.isArray(dump) ? dump : [];
        } catch {
          clients = [];
        }

        clients.forEach((c) => {
          if (c && c.mac) {
            const norm = normalizeMac(c.mac);
            if (isValidMac(norm)) {
              slotSeenMacs[matchedSlot].add(norm);
            }
          }
        });
      });

      studentList.forEach((st) => {
        matrix[dateStr][st.id] = {};

        SLOTS.forEach((slot) => {
          const isPresent = st.normalizedMac ? slotSeenMacs[slot.id].has(st.normalizedMac) : false;
          const code = isPresent ? 'P' : 'A';
          matrix[dateStr][st.id][slot.id] = code;

          if (isPresent) {
            studentStats[st.id].totalSlotsPresent++;
            studentStats[st.id].bySlot[slot.id]++;
            dailySummary[dateStr].presentCount++;
            dailySummary[dateStr].bySlotPresent[slot.id]++;
          }
        });
      });
    }

    const grandTotalPresent = Object.values(dailySummary).reduce((acc, d) => acc + d.presentCount, 0);
    const grandTotalPossible = dates.length * 4 * studentList.length;

    // Handle CSV Export
    if (format === 'csv') {
      const flatHeaders = ['Date', 'Day of Week'];
      studentList.forEach((st) => {
        SLOTS.forEach((slot) => {
          flatHeaders.push(`"${st.name} [${st.enrollmentNo}] - ${slot.label}"`);
        });
      });

      const rows = [flatHeaders.join(',')];
      dates.forEach(({ dateStr, dayName }) => {
        const row = [dateStr, dayName];
        studentList.forEach((st) => {
          SLOTS.forEach((slot) => {
            row.push(matrix[dateStr][st.id][slot.id]);
          });
        });
        rows.push(row.join(','));
      });

      return new Response(rows.join('\r\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wifi_slots_attendance_${dateFrom}_to_${dateTo}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Handle Excel (.xlsx) Export
    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const sheetData = [];

      const headerRow1 = ['Date', 'Day'];
      studentList.forEach((st) => {
        headerRow1.push(`${st.name} (${st.enrollmentNo})`, '', '', '');
      });
      headerRow1.push('Day Present Total', 'Day Attendance %');
      sheetData.push(headerRow1);

      const headerRow2 = ['YYYY-MM-DD', 'Day'];
      studentList.forEach(() => {
        SLOTS.forEach((slot) => headerRow2.push(slot.label));
      });
      headerRow2.push('All Slots', '%');
      sheetData.push(headerRow2);

      dates.forEach(({ dateStr, dayName }) => {
        const row = [dateStr, dayName];
        let dayP = 0;
        studentList.forEach((st) => {
          SLOTS.forEach((slot) => {
            const val = matrix[dateStr][st.id][slot.id];
            row.push(val);
            if (val === 'P') dayP++;
          });
        });
        const dayPct = `${((dayP / (studentList.length * 4)) * 100).toFixed(1)}%`;
        row.push(dayP, dayPct);
        sheetData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      ];
      let cIdx = 2;
      studentList.forEach(() => {
        merges.push({ s: { r: 0, c: cIdx }, e: { r: 0, c: cIdx + 3 } });
        cIdx += 4;
      });
      merges.push({ s: { r: 0, c: cIdx }, e: { r: 0, c: cIdx + 1 } });
      ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Grid');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="wifi_slots_attendance_${dateFrom}_to_${dateTo}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Default JSON response
    return NextResponse.json({
      success: true,
      metadata: {
        generatedAt: new Date().toISOString(),
        dateFrom,
        dateTo,
        totalDays: dates.length,
        totalStudents: studentList.length,
        totalSlotsPerDay: SLOTS.length,
        totalPossibleSlots: grandTotalPossible,
        totalActualPresentSlots: grandTotalPresent,
        overallAttendancePct: Number(((grandTotalPresent / grandTotalPossible) * 100).toFixed(2)),
        slots: SLOTS,
      },
      students: studentList,
      dates,
      matrix,
      dailySummary,
      studentStats: Object.values(studentStats).sort((a, b) => b.totalSlotsPresent - a.totalSlotsPresent),
    });
  } catch (error) {
    console.error('Error in /api/admin/reports/wifi-slots:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withRole(['admin'])(handler);
