// ---- Import and init Supabase ----
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const SUPABASE_URL = 'https://ezpvndamsyabfbdpadeh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cHZuZGFtc3lhYmZiZHBhZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0ODU3NjksImV4cCI6MjA3MzA2MTc2OX0.yOi2-xn4UAnOC2H142x5daoS4DhNvJBtIv1RQCkeK94';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Form Elements ----
const timetableForm = document.getElementById('timetable-form');
const isLeisureCheckbox = document.getElementById('is_leisure');
const classroomInput = document.getElementById('classroom');
const subjectInput = document.getElementById('subject');
const messageEl = document.getElementById('message');

// ---- Disable/Enable Classroom & Subject when leisure ----
if (isLeisureCheckbox) {
  const toggleClassroomSubject = () => {
    const checked = isLeisureCheckbox.checked;
    classroomInput.disabled = checked;
    subjectInput.disabled = checked;
    if (checked) {
      classroomInput.value = '';
      subjectInput.value = '';
    }
  };

  isLeisureCheckbox.addEventListener('change', toggleClassroomSubject);
  toggleClassroomSubject(); // run on load
}

// ---- Normalize Period Label ----
function normalizePeriodLabel(label) {
  if (!label) return label;
  if (/^period[_\s-]?\d+$/i.test(label)) {
    return label.toLowerCase().replace(/\s+/g, '_').replace('-', '_');
  }
  return label.toLowerCase().replace(/\s+/g, '_');
}

// ---- Get Day and Period IDs ----
async function getDayIdByName(dayName) {
  if (!dayName) return null;
  const { data, error } = await supabase
    .from('days')
    .select('id')
    .eq('day_name', dayName.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (error) console.error('Error fetching day id:', error);
  return data?.id || null;
}

async function getPeriodIdByName(periodName) {
  if (!periodName) return null;
  const code = normalizePeriodLabel(periodName);
  const { data, error } = await supabase
    .from('periods')
    .select('id')
    .eq('period_name', code)
    .limit(1)
    .maybeSingle();
  if (error) console.error('Error fetching period id:', error);
  return data?.id || null;
}

// ---- Form Submission ----
if (timetableForm) {
  timetableForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    // Collect values
    const salutation = document.getElementById('salutation').value;
    const facultyName = document.getElementById('faculty_name').value.trim();
    const classroom = classroomInput.value.trim();
    const subject = subjectInput.value.trim();
    const dayName = document.getElementById('day').value.trim().toLowerCase();
    const periodName = document.getElementById('period').value.trim();
    const isLeisure = isLeisureCheckbox.checked;

    // Basic validation
    if (!facultyName || !dayName || !periodName || (!isLeisure && (!classroom || !subject))) {
      messageEl.textContent = 'Please fill all required fields.';
      messageEl.style.color = 'red';
      return;
    }

    // Get IDs
    const dayId = await getDayIdByName(dayName);
    const periodId = await getPeriodIdByName(periodName);

    if (!dayId || !periodId) {
      messageEl.textContent = 'Day or period not found in database.';
      messageEl.style.color = 'red';
      console.log({ dayName, periodName, dayId, periodId });
      return;
    }

    // Prepare data for insert
    const rowData = {
      faculty_name: `${salutation} ${facultyName}`,
      day_id: dayId,
      period_id: periodId,
      is_leisure: isLeisure,
      classroom: isLeisure ? null : classroom,
      subject: isLeisure ? null : subject
    };

    console.log('Inserting row:', rowData); // debug

    // Insert into Supabase
    const { data, error } = await supabase
      .from('timetable')
      .insert([rowData]);

    if (error) {
      console.error('Supabase insert error:', error);
      messageEl.textContent = `Error adding timetable entry: ${error.message}`;
      messageEl.style.color = 'red';
      return;
    }

    messageEl.textContent = 'Timetable entry added successfully!';
    messageEl.style.color = 'green';
    timetableForm.reset();
    classroomInput.disabled = false;
    subjectInput.disabled = false;
  });
}
