import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// 🔑 Supabase credentials
const SUPABASE_URL = 'https://ezpvndamsyabfbdpadeh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cHZuZGFtc3lhYmZiZHBhZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0ODU3NjksImV4cCI6MjA3MzA2MTc2OX0.yOi2-xn4UAnOC2H142x5daoS4DhNvJBtIv1RQCkeK94';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ Current day + time
function getCurrentDayTime() {
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const currentDay = dayNames[now.getDay()].toLowerCase();
  const currentTime = now.toTimeString().slice(0,5); // HH:MM
  return { currentDay, currentTime };
}

// ✅ Fetch today’s timetable (current period only)
async function getCurrentTimetable() {
  const { currentDay, currentTime } = getCurrentDayTime();

  // Get day_id
  const { data: dayData, error: dayError } = await supabase
    .from('days')
    .select('id')
    .eq('day_name', currentDay)
    .limit(1)
    .maybeSingle();

  if (dayError || !dayData) {
    console.error('Error fetching day id:', dayError);
    return [];
  }
  const dayId = dayData.id;

  // Fetch all timetable rows for this day
  const { data, error } = await supabase
    .from('timetable')
    .select(`
      id,
      faculty_name,
      classroom,
      subject,
      is_leisure,
      period:period_id(period_name, start_time, end_time)
    `)
    .eq('day_id', dayId);

  if (error) {
    console.error('Error fetching timetable:', error);
    return [];
  }

  // Filter rows by current time
  const currentData = (data || []).filter(slot => {
    if (!slot.period?.start_time || !slot.period?.end_time) return false;
    const start = slot.period.start_time.slice(0,5);
    const end = slot.period.end_time.slice(0,5);
    return currentTime >= start && currentTime <= end;
  });

  return currentData;
}

// ✅ Render dashboard (active classes + leisure faculty separately)
function renderDashboard(data) {
  const dashboard = document.getElementById('dashboard');
  const leisureDashboard = document.getElementById('leisure-dashboard');

  if (!data.length) {
    dashboard.innerHTML = `<p class="loading">No class is happening right now.</p>`;
    leisureDashboard.innerHTML = `<p class="loading">No leisure faculty right now.</p>`;
    return;
  }

  const classes = data.filter(item => item.classroom !== null);
  const leisure = data.filter(item => item.classroom === null);

  // --- Active Classes ---
  if (classes.length) {
    let html = `<table class="styled-table">
      <thead>
        <tr>
          <th>Classroom</th>
          <th>Period</th>
          <th>Faculty</th>
          <th>Subject</th>
        </tr>
      </thead>
      <tbody>`;
    classes.forEach(slot => {
      const start = slot.period.start_time.slice(0,5);
      const end = slot.period.end_time.slice(0,5);
      html += `<tr class="active-class">
        <td>${slot.classroom}</td>
        <td>${slot.period.period_name} (${start} - ${end})</td>
        <td>${slot.faculty_name}</td>
        <td>${slot.subject}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    dashboard.innerHTML = html;
  } else {
    dashboard.innerHTML = `<p class="loading">No classes right now.</p>`;
  }

  // --- Leisure Faculty ---
  if (leisure.length) {
    let leisureHtml = `<table class="styled-table">
      <thead>
        <tr>
          <th>Faculty</th>
          <th>Period</th>
        </tr>
      </thead>
      <tbody>`;
    leisure.forEach(slot => {
      const start = slot.period.start_time.slice(0,5);
      const end = slot.period.end_time.slice(0,5);
      leisureHtml += `<tr class="leisure-class">
        <td>${slot.faculty_name}</td>
        <td>${slot.period.period_name} (${start} - ${end})</td>
      </tr>`;
    });
    leisureHtml += `</tbody></table>`;
    leisureDashboard.innerHTML = leisureHtml;
  } else {
    leisureDashboard.innerHTML = `<p class="loading">No leisure faculty right now.</p>`;
  }
}

// ✅ Leisure Finder (for user-selected day + period)
async function findLeisureFaculty(day, periodName) {
  // Get day_id
  const { data: dayData } = await supabase
    .from('days')
    .select('id')
    .eq('day_name', day)
    .maybeSingle();
  if (!dayData) return [];

  // Get period_id
  const { data: periodData } = await supabase
    .from('periods')
    .select('id, period_name')
    .ilike('period_name', periodName.replace(" ", "_").toLowerCase())
    .maybeSingle();
  if (!periodData) return [];

  // Get leisure faculty
  const { data, error } = await supabase
    .from('timetable')
    .select('faculty_name, classroom, period:period_id(period_name)')
    .eq('day_id', dayData.id)
    .eq('period_id', periodData.id)
    .is('classroom', null); // leisure = classroom null

  if (error) {
    console.error('Error fetching leisure faculty:', error);
    return [];
  }
  return data || [];
}

// ✅ Main entry
async function main() {
  const now = new Date();
  document.getElementById('current-date').textContent = now.toDateString();

  const currentTimetable = await getCurrentTimetable();
  renderDashboard(currentTimetable);
}

// Refresh every minute
main();
setInterval(main, 60_000);

// Listen for Supabase realtime changes
supabase
  .channel('timetable-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable' }, () => {
    console.log('Change detected: refreshing dashboard');
    main();
  })
  .subscribe();

// ✅ Leisure Finder toggle
const toggleBtn = document.getElementById('toggle-filter');
const form = document.getElementById('leisure-form');
toggleBtn.addEventListener('click', () => {
  form.style.display = form.style.display === "none" ? "block" : "none";
  toggleBtn.textContent = form.style.display === "none" ? "Show Leisure Finder" : "Hide Leisure Finder";
});

// ✅ Leisure Finder submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const day = document.getElementById('day').value.toLowerCase();
  const period = document.getElementById('period').value;

  const resultsEl = document.getElementById('leisure-results');
  resultsEl.textContent = "Searching...";

  const leisureFaculty = await findLeisureFaculty(day, period);

  if (!leisureFaculty.length) {
    resultsEl.innerHTML = `<p>No leisure faculty found for ${day}, ${period}.</p>`;
  } else {
    let html = `<table class="styled-table">
      <thead>
        <tr>
          <th>Faculty</th>
          <th>Period</th>
        </tr>
      </thead>
      <tbody>`;
    leisureFaculty.forEach(f => {
      html += `<tr class="leisure-class">
        <td>${f.faculty_name}</td>
        <td>${f.period.period_name}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    resultsEl.innerHTML = html;
  }
});
