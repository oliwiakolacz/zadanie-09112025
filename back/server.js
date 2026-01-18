const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// -------------------------------------
// Middleware
// -------------------------------------

app.use(express.json());
app.use(express.static(path.join(__dirname, '../front')));

app.use(session({
  secret: 'todo-app-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true w produkcji z HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 godziny
  }
}));

// -------------------------------------
// Baza danych SQLite
// -------------------------------------

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err);
  } else {
    console.log('Połączono z bazą SQLite');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Tabela users
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela tasks
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        assignee TEXT,
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        deadline TEXT,
        categories TEXT,
        completed BOOLEAN DEFAULT 0,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Tabele utworzone/zweryfikowane');
  });
}

// -------------------------------------
// Middleware autoryzacji
// -------------------------------------

// Sprawdza czy użytkownik jest zalogowany
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'No session - please login' });
}

// Sprawdza czy użytkownik jest adminem
function isAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

// -------------------------------------
// Endpointy autoryzacji
// -------------------------------------

// POST /auth/register - Rejestracja
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Walidacja
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Sprawdź czy email już istnieje
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash hasła
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Wstaw użytkownika
      db.run(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
        [email, passwordHash, 'user'],
        function(err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error creating user' });
          }

          res.status(201).json({
            message: 'User created',
            user: {
              id: this.lastID,
              email: email,
              role: 'user'
            }
          });
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login - Logowanie
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Sprawdź hasło
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Ustaw sesję
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  });
});

// POST /auth/logout - Wylogowanie
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// GET /auth/me - Aktualny użytkownik
app.get('/auth/me', isAuthenticated, (req, res) => {
  res.json({
    user: {
      id: req.session.userId,
      email: req.session.email,
      role: req.session.role
    }
  });
});

// -------------------------------------
// Endpointy tasków
// -------------------------------------

// GET /tasks - Pobieranie zadań
app.get('/tasks', isAuthenticated, (req, res) => {
  let query, params;

  if (req.session.role === 'admin') {
    // Admin widzi wszystkie taski
    query = `
      SELECT tasks.*, users.email as user_email 
      FROM tasks 
      LEFT JOIN users ON tasks.user_id = users.id 
      ORDER BY tasks.created_at DESC
    `;
    params = [];
  } else {
    // User widzi tylko swoje taski
    query = 'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC';
    params = [req.session.userId];
  }

  db.all(query, params, (err, tasks) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Konwersja completed z 0/1 na boolean
    const formattedTasks = tasks.map(task => ({
      ...task,
      completed: Boolean(task.completed)
    }));

    res.json(formattedTasks);
  });
});

// POST /tasks - Tworzenie zadania
app.post('/tasks', isAuthenticated, (req, res) => {
  const { title, description, assignee, priority, deadline, categories } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Walidacja priority
  const validPriorities = ['low', 'medium', 'high'];
  const taskPriority = priority && validPriorities.includes(priority) ? priority : 'medium';

  db.run(
    `INSERT INTO tasks (title, description, assignee, priority, deadline, categories, user_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title.trim(), 
      description ? description.trim() : null,
      assignee ? assignee.trim() : null,
      taskPriority,
      deadline ? deadline.trim() : null,
      categories ? categories.trim() : null,
      req.session.userId
    ],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error creating task' });
      }

      // Pobierz utworzony task
      db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, task) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Error fetching created task' });
        }

        res.status(201).json({
          ...task,
          completed: Boolean(task.completed)
        });
      });
    }
  );
});

// PUT /tasks/:id - Aktualizacja zadania
app.put('/tasks/:id', isAuthenticated, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, description, assignee, priority, deadline, categories, completed } = req.body;

  // Walidacja pól (whitelist)
  const allowedUpdates = ['title', 'description', 'assignee', 'priority', 'deadline', 'categories', 'completed'];
  const updateKeys = Object.keys(req.body);
  const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));

  if (!isValidOperation) {
    return res.status(400).json({ 
      error: 'Invalid updates',
      allowedFields: allowedUpdates
    });
  }

  // Walidacja priority jeśli podane
  if (priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Priority must be: low, medium, or high' });
    }
  }

  // Sprawdź czy task istnieje i czy user ma dostęp
  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!task) {
      return res.status(404).json({ error: 'Task not found', id: taskId });
    }

    // Sprawdź uprawnienia (user może edytować tylko swoje, admin wszystkie)
    if (req.session.role !== 'admin' && task.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Buduj query aktualizacji
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description ? description.trim() : null);
    }
    if (assignee !== undefined) {
      updates.push('assignee = ?');
      values.push(assignee ? assignee.trim() : null);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (deadline !== undefined) {
      updates.push('deadline = ?');
      values.push(deadline ? deadline.trim() : null);
    }
    if (categories !== undefined) {
      updates.push('categories = ?');
      values.push(categories ? categories.trim() : null);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');

    values.push(taskId);

    db.run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Error updating task' });
        }

        // Pobierz zaktualizowany task
        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, updatedTask) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error fetching updated task' });
          }

          res.json({
            ...updatedTask,
            completed: Boolean(updatedTask.completed)
          });
        });
      }
    );
  });
});

// DELETE /tasks/:id - Usuwanie zadania
app.delete('/tasks/:id', isAuthenticated, (req, res) => {
  const taskId = parseInt(req.params.id);

  // Sprawdź czy task istnieje i czy user ma dostęp
  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!task) {
      return res.status(404).json({ error: 'Task not found', id: taskId });
    }

    // Sprawdź uprawnienia
    if (req.session.role !== 'admin' && task.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error deleting task' });
      }

      res.status(204).send();
    });
  });
});

// -------------------------------------
// Endpointy administracyjne
// -------------------------------------

// GET /admin/users - Lista użytkowników (tylko admin)
app.get('/admin/users', isAuthenticated, isAdmin, (req, res) => {
  db.all(
    'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC',
    [],
    (err, users) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(users);
    }
  );
});

// DELETE /admin/users/:id - Usunięcie użytkownika (tylko admin)
app.delete('/admin/users/:id', isAuthenticated, isAdmin, (req, res) => {
  const userId = parseInt(req.params.id);

  // Nie można usunąć samego siebie
  if (userId === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Usuń użytkownika (CASCADE usunie też jego taski)
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error deleting user' });
      }

      res.status(204).send();
    });
  });
});

// -------------------------------------
// Endpoint health
// -------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------
// Start serwera
// -------------------------------------

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
  console.log('');
  console.log('Endpointy autoryzacji:');
  console.log(`  POST   http://localhost:${PORT}/auth/register`);
  console.log(`  POST   http://localhost:${PORT}/auth/login`);
  console.log(`  POST   http://localhost:${PORT}/auth/logout`);
  console.log(`  GET    http://localhost:${PORT}/auth/me`);
  console.log('');
  console.log('Endpointy tasków:');
  console.log(`  GET    http://localhost:${PORT}/tasks`);
  console.log(`  POST   http://localhost:${PORT}/tasks`);
  console.log(`  PUT    http://localhost:${PORT}/tasks/:id`);
  console.log(`  DELETE http://localhost:${PORT}/tasks/:id`);
  console.log('');
  console.log('Endpointy admina:');
  console.log(`  GET    http://localhost:${PORT}/admin/users`);
  console.log(`  DELETE http://localhost:${PORT}/admin/users/:id`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Błąd zamykania bazy:', err);
    }
    console.log('\nBaza danych zamknięta');
    process.exit(0);
  });
});
