export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSchemaDb, getCohortConfig } from "@/lib/db";
import { students, users, sessions, courses, attendanceRecords } from "@/drizzle/schema";
import { eq, and, gte, lte, inArray, asc } from "drizzle-orm";
import { withRole } from "@/lib/middleware";
import * as XLSX from "xlsx";

// helpers
function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function statusFill(status) {
  switch (status) {
    case "present":  return "FFD1FAE5";
    case "partial":  return "FFFEF9C3";
    case "absent":   return "FFFEE2E2";
    case "leave":    return "FFEDE9FE";
    default:         return "FFFFFFFF";
  }
}

function statusFontColor(status) {
  switch (status) {
    case "present":  return "FF065F46";
    case "partial":  return "FF713F12";
    case "absent":   return "FF991B1B";
    case "leave":    return "FF5B21B6";
    default:         return "FF9CA3AF";
  }
}

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedSchema = searchParams.get("schema") || "july";
    const dateFrom = searchParams.get("dateFrom") || null;
    const dateTo   = searchParams.get("dateTo")   || null;

    const { schemas } = getCohortConfig();
    if (!schemas.includes(requestedSchema)) {
      return NextResponse.json({ error: "Invalid schema" }, { status: 400 });
    }
    const schemaDb = getSchemaDb(requestedSchema);

    // 1. Active students
    const studentsRaw = await schemaDb
      .select({
        id: students.id,
        enrollment_no: students.enrollmentNo,
        first_name: users.firstName,
        last_name: users.lastName,
      })
      .from(students)
      .innerJoin(users, eq(students.id, users.id))
      .where(eq(users.isActive, true))
      .orderBy(asc(students.enrollmentNo));

    const studentList = (studentsRaw || []).map(s => ({
      id: s.id,
      enrollment_no: s.enrollment_no || "",
      name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
    }));

    // 2. Completed sessions
    const conditions = [eq(sessions.status, "completed")];
    if (dateFrom) conditions.push(gte(sessions.sessionDate, dateFrom));
    if (dateTo)   conditions.push(lte(sessions.sessionDate, dateTo));

    const sessionsRaw = await schemaDb
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        course_name: courses.name,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(asc(sessions.sessionDate), asc(sessions.startTime));

    const sessionsList = (sessionsRaw || []).map(s => ({
      id: s.id,
      title: s.title || "—",
      session_date: s.session_date,
      course_name: s.course_name || "",
    }));

    if (sessionsList.length === 0) {
      return NextResponse.json(
        { error: "No completed sessions found for the selected filters." },
        { status: 404 }
      );
    }

    // 3. Attendance records (batch by session chunks)
    const sessionIds = sessionsList.map(s => s.id);
    const studentIds = studentList.map(s => s.id);
    const allRecords = [];
    const CHUNK = 200;
    for (let i = 0; i < sessionIds.length; i += CHUNK) {
      const recs = await schemaDb
        .select({
          student_id: attendanceRecords.studentId,
          session_id: attendanceRecords.sessionId,
          points: attendanceRecords.points,
          status: attendanceRecords.status,
        })
        .from(attendanceRecords)
        .where(and(
          inArray(attendanceRecords.sessionId, sessionIds.slice(i, i + CHUNK)),
          inArray(attendanceRecords.studentId, studentIds)
        ));
      if (recs) allRecords.push(...recs);
    }

    // 4. recordMap[student_id][session_id]
    const recordMap = {};
    for (const r of allRecords) {
      if (!recordMap[r.student_id]) recordMap[r.student_id] = {};
      recordMap[r.student_id][r.session_id] = {
        points: r.points != null ? Number(r.points) : null,
        status: r.status || "",
      };
    }

    // 5. Build AOA (array-of-arrays)
    const FIXED = ["Enrollment No", "Student Name", "Actual Score", "Total Positive Score"];
    const dateRow  = [...FIXED, ...sessionsList.map(s => fmtDate(s.session_date))];
    const titleRow = ["", "", "", "", ...sessionsList.map(s => s.title)];
    const wsData   = [dateRow, titleRow];

    for (const student of studentList) {
      let actualScore = 0;
      let posScore = 0;
      const sessionCells = [];

      for (const session of sessionsList) {
        const rec = recordMap[student.id]?.[session.id];
        if (rec != null && rec.points != null) {
          actualScore += rec.points;
          if (rec.points > 0) posScore += rec.points;
          sessionCells.push(rec.points);
        } else {
          sessionCells.push("");
        }
      }
      const row = [student.enrollment_no, student.name, actualScore, posScore, ...sessionCells];
      wsData.push(row);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 18 },
      { wch: 26 },
      { wch: 14 },
      { wch: 20 },
      ...sessionsList.map(() => ({ wch: 14 })),
    ];

    // Freeze top 2 rows + left 4 cols
    ws["!freeze"] = { xSplit: 4, ySplit: 2 };

    // Styles
    const numCols = FIXED.length + sessionsList.length;
    const numRows = 2 + studentList.length;

    const dateRowStyle = {
      font:      { bold: true, color: { rgb: "FFFFFFFF" } },
      fill:      { patternType: "solid", fgColor: { rgb: "FF1D4ED8" } },
      alignment: { horizontal: "center", wrapText: true },
    };
    const titleRowStyle = {
      font:      { bold: true, color: { rgb: "FF1F2937" } },
      fill:      { patternType: "solid", fgColor: { rgb: "FFE5E7EB" } },
      alignment: { horizontal: "center", wrapText: true },
    };
    const fixedStyle = {
      font:      { bold: true },
      alignment: { vertical: "middle" },
    };

    for (let c = 0; c < numCols; c++) {
      const a0 = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[a0]) ws[a0].s = dateRowStyle;
      const a1 = XLSX.utils.encode_cell({ r: 1, c });
      if (ws[a1]) ws[a1].s = titleRowStyle;
    }
    for (let r = 2; r < numRows; r++) {
      for (let c = 0; c < FIXED.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) ws[addr].s = fixedStyle;
      }
    }
    for (let ri = 0; ri < studentList.length; ri++) {
      for (let ci = 0; ci < sessionsList.length; ci++) {
        const rec = recordMap[studentList[ri].id]?.[sessionsList[ci].id];
        if (!rec) continue;
        const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci + FIXED.length });
        if (!ws[addr]) continue;
        ws[addr].s = {
          fill:      { patternType: "solid", fgColor: { rgb: statusFill(rec.status) } },
          font:      { color: { rgb: statusFontColor(rec.status) }, bold: true },
          alignment: { horizontal: "center" },
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Student Points");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", bookSST: false });
    const today = new Date().toISOString().split("T")[0];
    const filename = `cipd_student_report_${requestedSchema}_${today}.xlsx`;

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("Student report error:", err);
    return NextResponse.json({ error: "Failed to generate report: " + err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ["admin"]);
