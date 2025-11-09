# Code Review pliku app.js - aplikacja ToDo

## Ogólny opis
Plik `app.js` implementuje pełną logikę frontendowej aplikacji ToDo napisanej w czystym JavaScript, korzystającej z frameworka Materialize CSS do stylizacji zgodnej z Material Design. Umożliwia dodawanie, edytowanie, usuwanie, oznaczanie zadań jako zakończone, filtrowanie, wyszukiwanie oraz trwałe przechowywanie danych w localStorage.

---

## Mocne strony

- **Modularność funkcji:**  
  Funkcje takie jak `getTasks`, `setTasks`, `generateId` oraz `renderTasks` realizują konkretne zadania, co zwiększa czytelność i ułatwia konserwację.

- **Wykorzystanie nowoczesnego JS:**  
  Kod korzysta z ES6+ (np. arrow functions, template literals, spread operator), dzięki czemu jest zwięzły i czytelny.

- **Dobrze zarządzany stan aplikacji:**  
  Zmienne `editingId`, `currentFilter` i `searchQuery` efektywnie kontrolują obecny tryb i widok aplikacji.

- **Persistencja poprzez localStorage:**  
  Dane użytkownika są przechowywane lokalnie, co pozwala na utrzymanie listy zadań po odświeżeniu strony bez potrzeby backendu.

- **Integracja z Materialize:**  
  Inicjalizacja komponentów UI (datepicker, toast, tooltip) jest uporządkowana i poprawnie zrealizowana.

- **Informacje zwrotne dla użytkownika:**  
  Zaawansowane powiadomienia toast zwiększają wygodę użytkowania i informują o skuteczności akcji.

- **Obsługa błędów i walidacja:**  
  Pola obowiązkowe są weryfikowane, a import z JSON odpowiednio obsługiwany z komunikatami.

---

## Obszary do poprawy

- **Event delegation:**  
  Podpinanie listenerów do każdego elementu listy po renderze obciąża wydajność. Lepszym rozwiązaniem jest nasłuchiwanie zdarzeń na rodzicu (delegacja).

- **Optymalizacja aktualizacji UI:**  
  Metody aktualizujące komponenty Materialize μπορούν być zoptymalizowane, aby uniknąć nadmiarowych wywołań.

- **Rozdzielenie logiki filtracji i wyszukiwania:**  
  Osobne funkcje wyodrębniłyby tę logikę, co zwiększyłoby przejrzystość i testowalność.

- **Brak debounce w wyszukiwaniu:**  
  Aktualne filtrowanie po każdym znaku może obciążać przy dużej liczbie zadań - można zastosować debouncing.

- **Tłumaczenia w kodzie:**  
  Teksty UI osadzone bezpośrednio w skrypcie utrudniają lokalizację; warto wyprowadzić je do osobnych struktur.

- **Brak dodatkowego potwierdzenia usunięcia:**  
  Usuwanie zadań jest natychmiastowe; warto zaimplementować okienko potwierdzające, aby uniknąć błędów użytkownika.

- **Accessibility:**  
  Rozszerzenie obsługi dostępności (ARIA, wsparcie klawiatury) poprawiłoby komfort osób niepełnosprawnych.

- **Brak testów:**  
  Nie ma widocznych testów jednost
