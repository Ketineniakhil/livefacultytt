// ---- Import and init Supabase ----
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const SUPABASE_URL = 'https://ezpvndamsyabfbdpadeh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cHZuZGFtc3lhYmZiZHBhZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0ODU3NjksImV4cCI6MjA3MzA2MTc2OX0.yOi2-xn4UAnOC2H142x5daoS4DhNvJBtIv1RQCkeK94';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loadingEl = document.getElementById('loading');
const adminContent = document.getElementById('admin-content');
const logoutBtn = document.getElementById('logout-btn');
const timetableForm = document.getElementById('timetable-form');
const isLeisureCheckbox = document.getElementById('is_leisure');
const classroomInput = document.getElementById('classroom');
const subjectInput = document.getElementById('subject');
const messageEl = document.getElementById('message');

// ---- Check session on page load ----
async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
  } else {
    loadingEl.style.display = 'none';
    adminContent.style.display = 'block';
  }
}
checkSession();

// ---- Watch for logout in other tabs ----
supabase.auth.onAuthStateChange((event, session) => {
  if (!session) {
    window.location.href = 'login.html';
  }
});

// ---- Logout button ----
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}

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
  toggleClassroomSubject();
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

// ---- Custom Modal Confirmation ----
function showConfirmModal(message) {
  return new Promise((resolve) => {
    // create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-box';

    const msg = document.createElement('p');
    msg.textContent = message;

    const btns = document.createElement('div');
    btns.className = 'modal-buttons';

    const yesBtn = document.createElement('button');
    yesBtn.textContent = 'Yes, Replace';
    yesBtn.className = 'btn btn-primary';

    const noBtn = document.createElement('button');
    noBtn.textContent = 'Cancel';
    noBtn.className = 'btn btn-danger';

    btns.appendChild(yesBtn);
    btns.appendChild(noBtn);

    modal.appendChild(msg);
    modal.appendChild(btns);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    yesBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    noBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
  });
}

// ---- Form Submission ----
if (timetableForm) {
  timetableForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const salutation = document.getElementById('salutation').value;
    const facultyName = document.getElementById('faculty_name').value.trim();
    const classroom = classroomInput.value.trim();
    const subject = subjectInput.value.trim();
    const dayName = document.getElementById('day').value.trim().toLowerCase();
    const periodName = document.getElementById('period').value.trim();
    const isLeisure = isLeisureCheckbox.checked;

    if (
      !facultyName ||
      !dayName ||
      !periodName ||
      (!isLeisure && (!classroom || !subject))
    ) {
      messageEl.textContent = 'Please fill all required fields.';
      messageEl.style.color = 'red';
      return;
    }

    const dayId = await getDayIdByName(dayName);
    const periodId = await getPeriodIdByName(periodName);

    if (!dayId || !periodId) {
      messageEl.textContent = 'Day or period not found in database.';
      messageEl.style.color = 'red';
      return;
    }

    const rowData = {
      faculty_name: `${salutation} ${facultyName}`,
      day_id: dayId,
      period_id: periodId,
      is_leisure: isLeisure,
      classroom: isLeisure ? null : classroom,
      subject: isLeisure ? null : subject,
    };

    // ---- Check if entry exists ----
    const { data: existing, error: checkError } = await supabase
      .from('timetable')
      .select('*')
      .eq('faculty_name', rowData.faculty_name)
      .eq('day_id', dayId)
      .eq('period_id', periodId)
      .maybeSingle();

    if (checkError) {
      console.error(checkError);
      messageEl.textContent = 'Error checking timetable entry.';
      messageEl.style.color = 'red';
      return;
    }

    if (existing) {
      // ⚠️ Ask for confirmation with custom modal
      const confirmReplace = await showConfirmModal(
        `A record already exists for ${rowData.faculty_name} on ${dayName}, ${periodName}.
Do you want to replace it?`
      );

      if (!confirmReplace) {
        messageEl.textContent = 'Operation cancelled.';
        messageEl.style.color = 'orange';
        return;
      }

      // Update existing entry
      const { error: updateError } = await supabase
        .from('timetable')
        .update(rowData)
        .eq('id', existing.id);

      if (updateError) {
        messageEl.textContent = 'Error updating entry.';
        messageEl.style.color = 'red';
        return;
      }

      messageEl.textContent = 'Timetable entry updated successfully!';
      messageEl.style.color = 'green';
      timetableForm.reset();
      classroomInput.disabled = false;
      subjectInput.disabled = false;
      return;
    }

    // If no existing → insert new
    const { error: insertError } = await supabase
      .from('timetable')
      .insert([rowData]);

    if (insertError) {
      messageEl.textContent = `Error adding timetable entry: ${insertError.message}`;
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
