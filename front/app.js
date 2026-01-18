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
      credentials: 'include' // Ważne dla sesji!
    });

    // 204 No Content
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

async function createTask(title, description) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, description })
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
  
  // Sprawdź czy użytkownik jest zalogowany
  try {
    const data = await getCurrentUser();
    if (data.user) {
      currentUser = data.user;
      showApp();
      await refreshTasks();
    }
  } catch (error) {
    // Nie zalogowany - pokaż formularz logowania
    showAuth();
  }

  // Event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // Login
  loginForm.addEventListener('submit', handleLogin);
  
  // Logout
  logoutBtn.addEventListener('click', handleLogout);
  
  // Task form
  taskForm.addEventListener('submit', handleTaskSubmit);
  
  // Cancel edit
  cancelEditBtn.addEventListener('click', cancelEdit);
  
  // Filters
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      filterTabs.forEach(t => t.classList.remove('active', 'indigo-text'));
      this.classList.add('active', 'indigo-text');
      currentFilter = this.getAttribute('href').replace('#', '');
      renderTasks();
    });
  });
  
  // Search
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
  
  // Reinicjalizuj tabs
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
  
  if (!title) {
    M.toast({ html: 'Tytuł jest wymagany!', classes: 'red darken-1' });
    return;
  }
  
  try {
    if (editingId) {
      // Edycja
      await updateTask(editingId, { title, description });
      M.toast({ html: 'Zadanie zaktualizowane!', classes: 'indigo' });
      cancelEdit();
    } else {
      // Nowe zadanie
      await createTask(title, description);
      M.toast({ html: 'Dodano nowe zadanie!', classes: 'green' });
    }
    
    taskForm.reset();
    M.updateTextFields();
    await refreshTasks();
  } catch (error) {
    M.toast({ html: error.message || 'Błąd zapisu', classes: 'red darken-1' });
  }
}

function startEdit(id) {
  const task = tasksCache.find(t => t.id === id);
  if (!task) return;
  
  document.getElementById('title').value = task.title;
  document.getElementById('description').value = task.description || '';
  M.updateTextFields();
  
  editingId = id;
  saveBtn.innerHTML = '<i class="material-icons left">edit</i>Zapisz zmiany';
  cancelEditBtn.style.display = 'inline-block';
  
  // Scroll do formularza
  taskForm.scrollIntoView({ behavior: 'smooth' });
  
  M.toast({ html: 'Tryb edycji', classes: 'blue' });
}

function cancelEdit() {
  editingId = null;
  taskForm.reset();
  M.updateTextFields();
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
      (t.description && t.description.toLowerCase().includes(searchQuery))
    );
  }
  
  // Licznik aktywnych
  const activeCount = tasksCache.filter(t => !t.completed).length;
  counter.textContent = `Aktywnych: ${activeCount}`;
  
  // Wyczyść listę
  tasksList.innerHTML = '';
  
  if (tasks.length === 0) {
    emptyList.style.display = 'block';
    return;
  } else {
    emptyList.style.display = 'none';
  }
  
  // Renderuj zadania
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `collection-item avatar ${task.completed ? 'completed' : ''}`;
    li.setAttribute('data-id', task.id);
    
    const createdDate = new Date(task.created_at).toLocaleDateString('pl-PL');
    
    li.innerHTML = `
      <label>
        <input type="checkbox" class="filled-in complete-checkbox" ${task.completed ? 'checked' : ''}/>
        <span></span>
      </label>
      <span class="title task-title">${escapeHtml(task.title)}</span>
      <p>
        ${task.description ? `<span>${escapeHtml(task.description)}</span><br>` : ''}
        <small class="grey-text">Utworzono: ${createdDate}</small>
        ${task.user_email ? `<br><small class="grey-text"><i class="material-icons tiny">person</i> ${escapeHtml(task.user_email)}</small>` : ''}
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
  
  // Event listeners dla checkboxów
  tasksList.querySelectorAll('.complete-checkbox').forEach(cb => {
    cb.addEventListener('change', function() {
      const id = parseInt(this.closest('.collection-item').dataset.id);
      toggleComplete(id, this.checked);
    });
  });
  
  // Event listeners dla edycji
  tasksList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const id = parseInt(this.closest('.collection-item').dataset.id);
      startEdit(id);
    });
  });
  
  // Event listeners dla usuwania
  tasksList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const id = parseInt(this.closest('.collection-item').dataset.id);
      deleteTask(id);
    });
  });
}

// -------------------------------------
// Pomocnicze
// -------------------------------------

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
