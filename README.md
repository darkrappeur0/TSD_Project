Installation
Prérequis

    Node.js v18+

    MongoDB (local ou distant)

Setup backend

cd backend
npm install

Configurer l'URL MongoDB et le secret JWT (via un .env ou en éditant server.ts pour des tests locaux).

Exemple .env :

MONGO_URL=mongodb://localhost/tsd
JWT_SECRET=supersecret

Lancer le backend

npm start

Le backend sera disponible sur : http://localhost:4000





MVP 1.X

✅ 1.0 — The program should run with npm start
✅ 1.1 — Deck de cartes (basique, personnalisable en UI)
✅ 1.2 — Sélection d'une carte
✅ 1.3 — Affichage des estimations
✅ 1.4 — Reset global
✅ 1.5 — Reset personnel avant affichage
✅ 1.6 — Chrome 99+ supporté
✅ 1.7 — UX simple, pas besoin de guide
MVP 2.X

✅ 2.3 — CRUD user stories
✅ 2.4 — Assignation de tâches à user story
✅ 2.5 — Description des user stories
✅ 2.6 — Sélection de user stories via scroll list
✅ 2.7 — Partage des stories en session via WS
⏳ 2.1 / 2.2 — Sessions multi-utilisateur avec invitation → à implémenter
⏳ 2.8 — Affichage estimations après votes ou validation
⏳ 2.9 — Import Jira → à implémenter
⏳ 2.10 — Export Jira → à implémenter
✅ 2.11 — Affichage de l'ID de session
MVP 3.X

⏳ 3.1 — Historique des sessions → à implémenter
✅ 3.2 — Login/Logout
✅ 3.3 — Register
✅ 3.4 — GDPR consentement obligatoire
✅ 3.5 — Confirmation avant suppression
⏳ 3.6 — Déploiement en ligne (frontend : GitHub Pages, backend : Render/Heroku/etc.)