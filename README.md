# TODO API - Menadżer Zadań

**Autor:** Oliwia Kołacz
**Data:** 09.11.2025

## Opis projektu
REST API dla menadżera zadań z zapisem do pliku JSON oraz frontend w Materialize CSS.

## Technologie
- Node.js
- Express.js
- JSON (do przechowywania danych)
- Materialize CSS (frontend)

## Instalacja i uruchomienie

### Wymagania
- Node.js 18+

### Krok po kroku
```bash
# 1. Sklonuj repozytorium
git clone https://github.com/oliwiakolacz/zadanie-09112025.git

# 2. Przejdź do katalogu
cd zadanie-09112025

# 3. Zainstaluj zależności
npm install

# 4. Uruchom serwer
node back/server.js
```

Serwer powinien być dostępny pod adresem: `http://localhost:3000`

## Endpointy API

### 1. GET /health

**Opis:** Sprawdza status API
```bash
curl http://localhost:3000/health
```

### 2. GET /tasks

**Opis:** Pobiera wszystkie zadania
```bash
curl http://localhost:3000/tasks
```

### 3. POST /tasks

**Opis:** Dodaje nowe zadanie
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Nowe zadanie","description":"Opis"}'
```

### 4. PUT /tasks/:id

**Opis:** Modyfikuje istniejące zadanie
```bash
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Zaktualizowany","completed":true}'
```

### 5. DELETE /tasks/:id

**Opis:** Usuwa zadanie
```bash
curl -X DELETE http://localhost:3000/tasks/1
```

## Struktura projektu
```
zadanie-09112025/
├── back/
│   ├── server.js
│   └── data.json
├── front/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── package.json
├── README.md
└── .gitignore
```

## Testowanie

API testowane za pomocą Thunder Client (VS Code) oraz curl.