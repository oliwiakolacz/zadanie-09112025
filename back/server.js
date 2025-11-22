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

    // Zabezpieczenie: jeśli plik jest pusty (0 bajtów lub same spacje), zwróć pustą tablicę
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
    const userData = req.body;

    // Walidacja: czy przesłano jakiekolwiek dane
    if (!userData || Object.keys(userData).length === 0) {
      return res.status(400).json({ error: 'Brak danych zadania' });
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

    // Wyliczanie nowego ID (maxId + 1)
    const maxId = currentTasks.reduce((max, task) => (task.id > max ? task.id : max), 0);
    const newId = maxId + 1;

    // Tworzenie obiektu zadania
    const newTask = {
      id: newId,
      ...userData,            // np. title, description
      completed: false,       // Domyślnie false
      createdAt: new Date().toISOString()
    };

    // Zapis do pliku
    currentTasks.push(newTask);
    await fs.writeFile(filePath, JSON.stringify(currentTasks, null, 2));

    // Zwrot utworzonego obiektu
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
    // Odczyt zadań
    const fileContent = await fs.readFile(filePath, 'utf8');
    let currentTasks = JSON.parse(fileContent);

    // Szukanie zadania
    const taskIndex = currentTasks.findIndex(task => task.id === id);

    // Obsługa błędu 404 - Task not found
    if (taskIndex === -1) {
      return res.status(404).json({
        error: "Task not found",
        id: id
      });
    }

    // Aktualizacja obiektu
    const updatedTask = {
      ...currentTasks[taskIndex], // Kopia starego
      ...updates,                 // Nadpisanie nowymi polami
      id: id,                     // ID bez zmian
      updatedAt: new Date().toISOString() // Data edycji
    };

    currentTasks[taskIndex] = updatedTask;

    // Zapis zmian
    await fs.writeFile(filePath, JSON.stringify(currentTasks, null, 2));

    // Zwrot zaktualizowanego obiektu
    res.json(updatedTask);

  } catch (error) {
    // Obsługa sytuacji, gdy plik nie istnieje przy próbie edycji
    if (error.code === 'ENOENT') {
        return res.status(404).json({ error: "Task not found", id: id });
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera przy aktualizacji' });
  }
});

// --- 4. GET /health (Status serwera) ---
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
  console.log(` - PUT        http://localhost:${PORT}/tasks/:id`);
  console.log(` - GET        http://localhost:${PORT}/health`);
});
