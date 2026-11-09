# fix/ui6-modules-plan – for the next chat:

UI round 6, plan modules (U02 U21 U48 U26 U09 U10 U30 U47, U57 todos line). Found, not fixed (outside this branch's scope):

- **U02 root cause is in `ui/`:** `web/src/ui/Patterns.module.css` `.done .title` (and `.done [data-rr]`) is a descendant selector, so it reaches any `ItemRow` nested in a done row. ToDos now override it locally (`todos.module.css` `.subOpen`); the clean fix is `.done > .row .title` in `ui/` (`fix/ui6-ui` owns `ui/`). Once that lands, `.subOpen` can go.
- `todos.module.css` `.done .title` is dead CSS (no element there uses `styles.done`); left as is.
- Habits on the phone: the FAB still sits on the third card's action button (G17, layout branch).
- `calendar.nothing` is now "Noch nichts geplant." – also on empty days in the past (week list, day view), where "noch" reads slightly odd. A separate past-day text would fix it.
- es/fr/pt-BR are frozen: the time-tracking widget there shows only the old "nothing running" as its context line (no "today").
- U48 took the small option (due text "war am … fällig" on the card). A real "Wartet noch" board column would change `TODO_VIEWS` (views, drag targets, tests) – own package if wanted.
