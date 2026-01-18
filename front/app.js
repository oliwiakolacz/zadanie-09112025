// Główna logika aplikacji ToDo - Vanilla JS + Materialize CSS
// Zintegrowane z REST API backend

// -------------------------------------
// Konfiguracja API
// -------------------------------------

const API_URL = window.location.origin;

// -------------------------------------
// Stan aplikacji
// -------------------------------------

let currentUser = null;
let tasksCache = [];
let editingId = null;
let currentFilter = 'all';
let searchQuery = '';

// -------------------------------------
// Elementy DOM
// -------------------------------------

// Sekcje
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');

// Auth
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const logoutLi = document.getElementById('logout-li');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');

// Tasks
const tasksList = document.getElementById('tasks-list');
const taskForm = document.getElementById('task-form');
const filterTabs = document.querySelectorAll('#filters a');
const searchInput = document.getElementById('search-tasks');
const counter = document.getElementById('counter');
const emptyList = document.getElementById('empty-list');
const saveBtn = document.getElementById('save-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// -------------------------------------
// Funkcje API
// -------------------------------------

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    });

    if (response.status === 204) {
      return { success: true };
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Błąd serwera');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
async function login(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

async function logout() {
  return apiRequest('/auth/logout', { method: 'POST' });
}

async function getCurrentUser() {
  return apiRequest('/auth/me');
}

// Tasks API
async function getTasks() {
  return apiRequest('/tasks');
}

async function createTask(taskData) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData)
  });
}

async function updateTask(id, updates) {
  return apiRequest(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

async function deleteTaskAPI(id) {
  return apiRequest(`/tasks/${id}`, { method: 'DELETE' });
}

// -------------------------------------
// Inicjalizacja
// -------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  M.AutoInit();
  
  // Inicjalizacja datepicker
  const datePickerElems = document.querySelectorAll('.datepicker');
  M.Datepicker.init(datePickerElems, {
    format: 'yyyy-mm-dd',
    firstDay: 1,
    i18n: {
      cancel: 'Anuluj',
      clear: 'Wyczyść',
      done: 'OK',
      months: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
      monthsShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
      weekdays: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
      weekdaysShort: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'],
      weekdaysAbbrev: ['N', 'P', 'W', 'Ś', 'C', 'P', 'S']
    }
  });
  
  // Sprawdź czy użytkownik jest zalogowany
  try {
    const data = await getCurrentUser();
    if (data.user) {
      currentUser = data.user;
      showApp();
      await refreshTasks();
    }
  } catch (error) {
    showAuth();
  }

  setupEventListeners();
});

function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  taskForm.addEventListener('submit', handleTaskSubmit);
  cancelEditBtn.addEventListener('click', cancelEdit);
  
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      filterTabs.forEach(t => t.classList.remove('active', 'indigo-text'));
      this.classList.add('active', 'indigo-text');
      currentFilter = this.getAttribute('href').replace('#', '');
      renderTasks();
    });
  });
  
  searchInput.addEventListener('input', function() {
    searchQuery = this.value.toLowerCase();
    renderTasks();
  });
}

// -------------------------------------
// Obsługa widoków
// -------------------------------------

function showAuth() {
  authSection.style.display = 'block';
  appSection.style.display = 'none';
  userInfo.style.display = 'none';
  logoutLi.style.display = 'none';
}

function showApp() {
  authSection.style.display = 'none';
  appSection.style.display = 'block';
  userInfo.style.display = 'inline';
  logoutLi.style.display = 'inline';
  userEmailSpan.textContent = currentUser.email;
  
  // Reinicjalizuj komponenty Materialize
  M.FormSelect.init(document.querySelectorAll('select'));
  const tabsEl = document.querySelector('#filters');
  M.Tabs.init(tabsEl);
}

// -------------------------------------
// Obsługa autoryzacji
// -------------------------------------

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  try {
    const data = await login(email, password);
    currentUser = data.user;
    M.toast({ html: 'Zalogowano pomyślnie!', classes: 'green' });
    showApp();
    await refreshTasks();
    loginForm.reset();
  } catch (error) {
    M.toast({ html: error.message || 'Błąd logowania', classes: 'red darken-1' });
  }
}

async function handleLogout(e) {
  e.preventDefault();
  
  try {
    await logout();
    currentUser = null;
    tasksCache = [];
    M.toast({ html: 'Wylogowano', classes: 'blue' });
    showAuth();
  } catch (error) {
    M.toast({ html: 'Błąd wylogowania', classes: 'red darken-1' });
  }
}

// -------------------------------------
// Obsługa zadań
// -------------------------------------

async function refreshTasks() {
  try {
    tasksCache = await getTasks();
    renderTasks();
  } catch (error) {
    M.toast({ html: 'Błąd pobierania zadań', classes: 'red darken-1' });
  }
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const assignee = document.getElementById('assignee').value.trim();
  const priority = document.getElementById('priority').value;
  const deadline = document.getElementById('deadline').value.trim();
  const categories = document.getElementById('categories').value.trim();
  
  if (!title) {
    M.toast({ html: 'Tytuł jest wymagany!', classes: 'red darken-1' });
    return;
  }
  
  const taskData = {
    title,
    description: description || null,
    assignee: assignee || null,
    priority,
    deadline: deadline || null,
    categories: categories || null
  };
  
  try {
    if (editingId) {
      await updateTask(editingId, taskData);
      M.toast({ html: 'Zadanie zaktualizowane!', classes: 'indigo' });
      cancelEdit();
    } else {
      await createTask(taskData);
      M.toast({ html: 'Dodano nowe zadanie!', classes: 'green' });
    }
    
    resetForm();
    await refreshTasks();
  } catch (error) {
    M.toast({ html: error.message || 'Błąd zapisu', classes: 'red darken-1' });
  }
}

function resetForm() {
  taskForm.reset();
  document.getElementById('priority').value = 'medium';
  M.FormSelect.init(document.querySelectorAll('select'));
  M.updateTextFields();
}

function startEdit(id) {
  const task = tasksCache.find(t => t.id === id);
  if (!task) return;
  
  document.getElementById('title').value = task.title;
  document.getElementById('description').value = task.description || '';
  document.getElementById('assignee').value = task.assignee || '';
  document.getElementById('priority').value = task.priority || 'medium';
  document.getElementById('deadline').value = task.deadline || '';
  document.getElementById('categories').value = task.categories || '';
  
  M.FormSelect.init(document.querySelectorAll('select'));
  M.updateTextFields();
  
  editingId = id;
  saveBtn.innerHTML = '<i class="material-icons left">edit</i>Zapisz zmiany';
  cancelEditBtn.style.display = 'inline-block';
  
  taskForm.scrollIntoView({ behavior: 'smooth' });
  M.toast({ html: 'Tryb edycji', classes: 'blue' });
}

function cancelEdit() {
  editingId = null;
  resetForm();
  saveBtn.innerHTML = '<i class="material-icons left">add_circle</i>Dodaj zadanie';
  cancelEditBtn.style.display = 'none';
}

async function toggleComplete(id, completed) {
  try {
    await updateTask(id, { completed });
    const msg = completed ? 'Zadanie zakończone!' : 'Przywrócono zadanie';
    M.toast({ html: msg, classes: completed ? 'green' : 'blue' });
    await refreshTasks();
  } catch (error) {
    M.toast({ html: 'Błąd aktualizacji', classes: 'red darken-1' });
  }
}

async function deleteTask(id) {
  if (!confirm('Czy na pewno chcesz usunąć to zadanie?')) {
    return;
  }
  
  try {
    await deleteTaskAPI(id);
    M.toast({ html: 'Zadanie usunięte!', classes: 'red' });
    await refreshTasks();
  } catch (error) {
    M.toast({ html: error.message || 'Błąd usuwania', classes: 'red darken-1' });
  }
}

// -------------------------------------
// Renderowanie listy zadań
// -------------------------------------

function renderTasks() {
  let tasks = [...tasksCache];
  
  // Filtrowanie
  if (currentFilter !== 'all') {
    tasks = tasks.filter(t => 
      currentFilter === 'active' ? !t.completed : t.completed
    );
  }
  
  // Wyszukiwanie
  if (searchQuery) {
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(searchQuery) ||
      (t.description && t.description.toLowerCase().includes(searchQuery)) ||
      (t.assignee && t.assignee.toLowerCase().includes(searchQuery)) ||
      (t.categories && t.categories.toLowerCase().includes(searchQuery))
    );
  }
  
  // Licznik aktywnych
  const activeCount = tasksCache.filter(t => !t.completed).length;
  counter.textContent = `Aktywnych: ${activeCount}`;
  
  tasksList.innerHTML = '';
  
  if (tasks.length === 0) {
    emptyList.style.display = 'block';
    return;
  } else {
    emptyList.style.display = 'none';
  }
  
  tasks.forEach(task => {
    const li = document.createElement('li');
    
    // Sprawdź czy zadanie jest przeterminowane
    const isOverdue = task.deadline && !task.completed && new Date(task.deadline) < new Date();
    
    li.className = `collection-item avatar ${task.completed ? 'completed' : ''} ${isOverdue ? 'task-overdue' : ''} priority-${task.priority || 'medium'}`;
    li.setAttribute('data-id', task.id);
    
    // Formatuj kategorie jako tagi
    const categoriesTags = task.categories 
      ? task.categories.split(',').map(cat => `<span class="task-category">${escapeHtml(cat.trim())}</span>`).join(' ')
      : '';
    
    li.innerHTML = `
      <label>
        <input type="checkbox" class="filled-in complete-checkbox" ${task.completed ? 'checked' : ''}/>
        <span></span>
      </label>
      <span class="title task-title">${escapeHtml(task.title)}</span>
      <p>
        ${task.description ? `<span>${escapeHtml(task.description)}</span><br>` : ''}
        <i class="material-icons tiny">person</i> ${escapeHtml(task.assignee) || '-'}
        &nbsp; ${categoriesTags}
        <br>
        <i class="material-icons tiny">priority_high</i>
        <span class="priority-label">${priorityLabel(task.priority)}</span>
        &nbsp; <i class="material-icons tiny">event</i>
        <span class="${isOverdue ? 'red-text' : ''}">${task.deadline ? formatDate(task.deadline) : '-'}</span>
        ${task.user_email ? `<br><small class="grey-text"><i class="material-icons tiny">account_circle</i> ${escapeHtml(task.user_email)}</small>` : ''}
      </p>
      <div class="secondary-content">
        <a href="#" class="edit-btn btn-flat tooltipped" data-position="top" data-tooltip="Edytuj">
          <i class="material-icons">edit</i>
        </a>
        <a href="#" class="delete-btn btn-flat red-text tooltipped" data-position="top" data-tooltip="Usuń">
          <i class="material-icons">delete</i>
        </a>
      </div>
    `;
    
    tasksList.appendChild(li);
  });
  
  // Inicjalizacja tooltips
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));
  
  // Event listeners
  tasksList.querySelectorAll('.complete-checkbox').forEach(cb => {
    cb.addEventListener('change', function() {
      const id = parseInt(this.closest('.collection-item').dataset.id);
      toggleComplete(id, this.checked);
    });
  });
  
  tasksList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const id = parseInt(this.closest('.collection-item').dataset.id);
      startEdit(id);
    });
  });
  
  tasksList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const id = parseInt(this.closest('.collection-item').dataset.id);
      deleteTask(id);
    });
  });
}

// -------------------------------------
// Funkcje pomocnicze
// -------------------------------------

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL');
}

function priorityLabel(priority) {
  return {
    'low': 'Niski',
    'medium': 'Średni',
    'high': 'Wysoki'
  }[priority] || 'Średni';
}
