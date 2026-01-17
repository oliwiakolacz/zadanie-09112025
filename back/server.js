const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

// Ścieżka do pliku z danymi
const filePath = path.join(__dirname, 'data.json');

// --- 1. GET /tasks (Pobieranie wszystkich zadań) ---
app.get('/tasks', async (req, res) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');

    // Zabezpieczenie: jeśli plik jest pusty, zwróć pustą tablicę
    if (!data.trim()) {
      return res.json([]);
    }

    res.json(JSON.parse(data));

  } catch (error) {
    // Jeśli plik fizycznie nie istnieje, również zwróć pustą tablicę
    if (error.code === 'ENOENT') {
      return res.json([]);
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera przy odczycie pliku' });
  }
});

// --- 2. POST /tasks (Dodawanie nowego zadania) ---
app.post('/tasks', async (req, res) => {
  try {
    const { title, description } = req.body;

    // Walidacja: czy przesłano tytuł
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Tytuł jest wymagany.' });
    }

    // Odczyt obecnych zadań
    let currentTasks = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      if (fileContent.trim()) {
        const parsed = JSON.parse(fileContent);
        currentTasks = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Wyliczanie nowego ID
    const maxId = currentTasks.reduce((max, task) => (task.id > max ? task.id : max), 0);
    const newId = maxId + 1;

    // Tworzenie obiektu — tylko dozwolone pola
    const newTask = {
      id: newId,
      title: title.trim(),
      description: description !== undefined ? String(description).trim() : undefined,
      completed: false,
      createdAt: new Date().toISOString()
    };

    // Usunięcie undefined pól (description opcjonalny)
    Object.keys(newTask).forEach(key => newTask[key] === undefined && delete newTask[key]);

    // Zapis
    currentTasks.push(newTask);
    await fs.writeFile(filePath, JSON.stringify(currentTasks, null, 2));

    res.status(201).json(newTask);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera przy zapisie' });
  }
});

// --- 3. PUT /tasks/:id (Aktualizacja zadania) ---
app.put('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const updates = req.body;

  // Walidacja pól (Whitelist)
  const allowedUpdates = ['title', 'description', 'completed'];
  const updatesKeys = Object.keys(updates);
  const isValidOperation = updatesKeys.every((key) => allowedUpdates.includes(key));

  if (!isValidOperation) {
    const invalidFields = updatesKeys.filter(key => !allowedUpdates.includes(key));
    return res.status(400).json({ 
      error: 'Invalid updates! Contains forbidden fields.',
      invalidFields: invalidFields,
      allowedFields: allowedUpdates
    });
  }

  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    let currentTasks = JSON.parse(fileContent);

    const taskIndex = currentTasks.findIndex(task => task.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found", id: id });
    }

    // Aktualizacja
    const updatedTask = {
      ...currentTasks[taskIndex],
      ...updates,
      id: id,
      updatedAt: new Date().toISOString()
    };

    currentTasks[taskIndex] = updatedTask;
    await fs.writeFile(filePath, JSON.stringify(currentTasks, null, 2));

    res.json(updatedTask);

  } catch (error) {
    if (error.code === 'ENOENT') {
        return res.status(404).json({ error: "Task not found", id: id });
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera przy aktualizacji' });
  }
});

// --- 4. DELETE /tasks/:id (Usuwanie zadania) ---
app.delete('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    let currentTasks = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      currentTasks = JSON.parse(fileContent);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: "Task not found", id: id });
      }
      throw err;
    }

    const taskIndex = currentTasks.findIndex(task => task.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found", id: id });
    }

    // Usunięcie z tablicy
    const deletedTask = currentTasks.splice(taskIndex, 1)[0];

    await fs.writeFile(filePath, JSON.stringify(currentTasks, null, 2));

    res.json({
      message: "Task deleted successfully",
      deletedTask: deletedTask
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera przy usuwaniu' });
  }
});

// --- 5. GET /health (Status serwera) ---
app.get('/health', (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
  console.log(` - GET, POST  http://localhost:${PORT}/tasks`);
  console.log(` - PUT, DEL   http://localhost:${PORT}/tasks/:id`);
  console.log(` - GET        http://localhost:${PORT}/health`);
});
