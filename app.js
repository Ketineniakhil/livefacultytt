import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// 🔑 Supabase credentials
const SUPABASE_URL = 'https://ezpvndamsyabfbdpadeh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cHZuZGFtc3lhYmZiZHBhZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0ODU3NjksImV4cCI6MjA3MzA2MTc2OX0.yOi2-xn4UAnOC2H142x5daoS4DhNvJBtIv1RQCkeK94';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get current day and time in HH:MM format
function getCurrentDayTime() {
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const currentDay = dayNames[now.getDay()].toLowerCase();
  const currentTime = now.toTimeString().slice(0,5); // HH:MM
  return { currentDay, currentTime };
}

// Fetch timetable filtered by current day AND current time
// Fetch timetable for current day
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

  // Filter by current time in JS
  const currentData = (data || []).filter(slot => {
    if (!slot.period || !slot.period.start_time || !slot.period.end_time) return false;
    const start = slot.period.start_time.slice(0,5);
    const end = slot.period.end_time.slice(0,5);
    return currentTime >= start && currentTime <= end;
  });

  return currentData;
}


// Render dashboard
function renderDashboard(data) {
  const dashboard = document.getElementById('dashboard');
  if (!data.length) {
    dashboard.innerHTML = `<p class="loading">No class is happening right now.</p>`;
    return;
  }

  // Group by classroom
  const grouped = {};
  data.forEach(item => {
    if (!grouped[item.classroom]) grouped[item.classroom] = [];
    grouped[item.classroom].push(item);
  });

  let html = `<table>
    <thead>
      <tr>
        <th>Classroom</th>
        <th>Period</th>
        <th>Faculty</th>
        <th>Subject</th>
      </tr>
    </thead>
    <tbody>`;

  for (const room in grouped) {
    grouped[room].forEach(slot => {
      const start = slot.period.start_time.slice(0,5);
      const end = slot.period.end_time.slice(0,5);
      html += `<tr class="highlight">
        <td>${room}</td>
        <td>${slot.period.period_name} (${start} - ${end})</td>
        <td>${slot.faculty_name}</td>
        <td>${slot.is_leisure ? "Leisure" : slot.subject}</td>
      </tr>`;
    });
  }

  html += `</tbody></table>`;
  dashboard.innerHTML = html;
}

// Main function
async function main() {
  const now = new Date();
  document.getElementById('current-date').textContent = now.toDateString();
  const currentTimetable = await getCurrentTimetable();
  renderDashboard(currentTimetable);
}

// Refresh periodically
main();
setInterval(main, 60_000);

// Real-time DB changes
supabase
  .channel('timetable-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable' }, () => {
    console.log('Change detected: refreshing dashboard');
    main();
  })
  .subscribe();
