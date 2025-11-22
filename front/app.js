// Główna logika aplikacji ToDo - Vanilla JS + Materialize CSS

// -------------------------------------
// Model i obsługa localStorage
// -------------------------------------

const STORAGE_KEY = 'todo-tasks';

/* Schemat zadania:
{
  id: 'string',
  title: 'string',
  description: 'string',
  assignee: 'string',
  priority: 'low'|'medium'|'high',
  deadline: 'string', // ISO
  status: 'active'|'completed',
  categories: ['string'],
  createdAt: 'string', // ISO
  updatedAt: 'string' // ISO
}
*/

// Pobieranie zadań z localStorage
function getTasks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

// Zapisywanie zadań do localStorage
function setTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Generowanie unikalnego ID zadania
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// -------------------------------------
// Widoki i UI
// -------------------------------------

// Elementy DOM
const tasksList = document.getElementById('tasks-list');
const taskForm = document.getElementById('task-form');
const filterTabs = document.querySelectorAll('#filters a');
const searchInput = document.getElementById('search-tasks');
const counter = document.getElementById('counter');
const emptyList = document.getElementById('empty-list');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const saveBtn = document.getElementById('save-btn'); // Poprawne odwołanie do przycisku

// Tryb edycji
let editingId = null;
let currentFilter = 'all';
let searchQuery = '';

// Inicjalizacja Materialize
document.addEventListener('DOMContentLoaded', () => {
  M.AutoInit();
  renderTasks();
});

// Obsługa formularza dodawania/edycji zadania
taskForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const tasks = getTasks();
  const title = taskForm.title.value.trim();
  const description = taskForm.description.value.trim();
  const assignee = taskForm.assignee.value.trim();
  const deadline = taskForm.deadline.value ? new Date(taskForm.deadline.value).toISOString() : '';
  const priority = taskForm.priority.value;
  const categories = taskForm.category.value.split(',').map(s => s.trim()).filter(Boolean);
  const now = new Date().toISOString();

  if (!title) {
    M.toast({ html: '[translate:Tytuł zadania jest wymagany.]', classes: 'red darken-1' });
    return;
  }

  if (editingId) {
    // Edycja zadania
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      tasks[idx] = {
        ...tasks[idx],
        title,
        description,
        assignee,
        deadline,
        priority,
        categories,
        updatedAt: now
      };
      M.toast({ html: '[translate:Zadanie zaktualizowane!]', classes: 'indigo' });
    }
    editingId = null;
    saveBtn.innerHTML = '<i class="material-icons left">add_circle</i> [translate:Dodaj / Zapisz]';
  } else {
    // Nowe zadanie
    const newTask = {
      id: generateId(),
      title,
      description,
      assignee,
      priority,
      deadline,
      status: 'active',
      categories,
      createdAt: now,
      updatedAt: now
    };
    tasks.unshift(newTask);
    M.toast({ html: '[translate:Dodano nowe zadanie!]', classes: 'indigo' });
  }

  setTasks(tasks);
  taskForm.reset();
  M.updateTextFields();
  renderTasks();
});

// Obsługa filtrów
filterTabs.forEach(tab => {
  tab.addEventListener('click', function (e) {
    e.preventDefault();
    filterTabs.forEach(t => t.classList.remove('active','indigo-text'));
    this.classList.add('active','indigo-text');
    currentFilter = this.getAttribute('href').replace('#', '');
    renderTasks();
  });
});

// Obsługa wyszukiwarki
searchInput.addEventListener('input', function () {
  searchQuery = this.value.toLowerCase();
  renderTasks();
});

// Obsługa eksportu
exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(getTasks(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks.json';
  a.click();
  URL.revokeObjectURL(url);
});

// Obsługa importu (plik)
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', function () {
  const file = this.files[0];
  if (file && file.type === 'application/json') {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const tasks = JSON.parse(e.target.result);
        if (Array.isArray(tasks)) {
          setTasks(tasks);
          renderTasks();
          M.toast({ html: '[translate:Zaimportowano zadania!]', classes: 'indigo' });
        }
      } catch {
        M.toast({ html: '[translate:Nieprawidłowy plik JSON!]', classes: 'red darken-1' });
      }
    };
    reader.readAsText(file);
  }
  this.value = '';
});

// Renderowanie listy zadań
function renderTasks() {
  let tasks = getTasks();

  // Filtrowanie
  if (currentFilter !== 'all') {
    tasks = tasks.filter(t => currentFilter === 'active' ? t.status === 'active' : t.status === 'completed');
  }
  // Wyszukiwanie
  if (searchQuery) {
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(searchQuery) ||
      t.description?.toLowerCase().includes(searchQuery) ||
      t.assignee?.toLowerCase().includes(searchQuery) ||
      (t.categories || []).some(cat => cat.toLowerCase().includes(searchQuery))
    );
  }

  // Licznik aktywnych
  const allTasks = getTasks();
  const activeCount = allTasks.filter(t => t.status === 'active').length;
  counter.textContent = `[translate:Aktywnych:] ${activeCount}`;

  tasksList.innerHTML = '';
  if (tasks.length === 0) {
    emptyList.style.display = 'block';
    return;
  } else {
    emptyList.style.display = 'none';
  }

  tasks.forEach(task => {
    const deadline = task.deadline ? new Date(task.deadline) : null;
    const overdue = deadline && task.status === 'active' && (deadline < new Date());
    const li = document.createElement('li');
    li.className = `collection-item avatar ${task.status === 'completed' ? 'completed' : ''} ${overdue ? 'task-overdue' : ''} priority-${task.priority}`;
    li.setAttribute('data-id', task.id);

    li.innerHTML = `
      <label>
        <input type="checkbox" class="filled-in complete-checkbox" ${task.status === 'completed' ? 'checked' : ''}/>
        <span></span>
      </label>
      <span class="title task-title">${task.title}</span>
      <p>
        ${task.description ? `<span>${task.description}</span><br>` : ''}
        <i class="material-icons tiny tooltipped" data-tooltip="[translate:Wykonawca]">person</i> ${task.assignee || '-'}
        &nbsp; ${(task.categories || []).map(cat => `<span class="task-category">${cat}</span>`).join('')}
        <br>
        <i class="material-icons tiny tooltipped" data-tooltip="[translate:Priorytet]">priority_high</i>
        <span class="priority-label">${priorityLabel(task.priority)}</span>
        &nbsp; <i class="material-icons tiny" data-tooltip="[translate:Deadline]">event</i>
        <span class="${overdue ? 'red-text' : ''}">${task.deadline ? formatDate(task.deadline) : '-'}</span>
      </p>
      <div class="secondary-content">
        <a href="#" class="edit-btn btn-flat tooltipped" data-tooltip="[translate:Edytuj]"><i class="material-icons">edit</i></a>
        <a href="#" class="delete-btn btn-flat red-text tooltipped" data-tooltip="[translate:Usuń]"><i class="material-icons">delete</i></a>
      </div>
    `;
    tasksList.appendChild(li);
  });

  // Inicjalizacja tooltips
  const tooltips = document.querySelectorAll('.tooltipped');
  M.Tooltip.init(tooltips);

  // Obsługa działań dla każdego zadania
  tasksList.querySelectorAll('.complete-checkbox').forEach(cb => {
    cb.addEventListener('change', function () {
      const id = this.closest('.collection-item').dataset.id;
      toggleComplete(id, this.checked);
    });
  });

  tasksList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const id = this.closest('.collection-item').dataset.id;
      startEdit(id);
    });
  });

  tasksList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const id = this.closest('.collection-item').dataset.id;
      deleteTask(id);
    });
  });
}

// Oznaczanie zadania jako zakończone/przywracanie
function toggleComplete(id, checked) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    tasks[idx].status = checked ? 'completed' : 'active';
    tasks[idx].updatedAt = new Date().toISOString();
    setTasks(tasks);
    renderTasks();
    let msg = checked ? '[translate:Zadanie oznaczone jako zakończone.]' : '[translate:Przywrócono zadanie jako aktywne.]';
    M.toast({ html: msg, classes: checked ? 'green' : 'blue' });
  }
}

// Edycja zadania
function startEdit(id) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  taskForm.title.value = task.title;
  taskForm.description.value = task.description || '';
  taskForm.assignee.value = task.assignee || '';
  taskForm.priority.value = task.priority;
  M.FormSelect.init(taskForm.priority);
  taskForm.deadline.value = task.deadline ? formatDate(task.deadline) : '';
  taskForm.category.value = (task.categories || []).join(', ');
  editingId = id;
  saveBtn.innerHTML = '<i class="material-icons left">edit</i> [translate:Zapisz zmiany]';
  M.updateTextFields();
  M.toast({ html: '[translate:Tryb edycji zadania.]', classes: 'blue' });
}

// Usuwanie zadania
function deleteTask(id) {
  let tasks = getTasks();
  tasks = tasks.filter(t => t.id !== id);
  setTasks(tasks);
  renderTasks();
  M.toast({ html: '[translate:Zadanie usunięte!]', classes: 'red' });
}

// Narzędziowe
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL');
}
function priorityLabel(priority) {
  return {
    'low': '[translate:Niski]',
    'medium': '[translate:Średni]',
    'high': '[translate:Wysoki]'
  }[priority] || priority;
}
