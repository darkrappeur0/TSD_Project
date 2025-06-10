"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./auth");
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const authMessage = document.getElementById('authMessage');
    const newSessionIdInput = document.getElementById('newSessionId');
    const createSessionBtn = document.getElementById('createSessionBtn');
    const existingSessionIdInput = document.getElementById('existingSessionId');
    const joinSessionBtn = document.getElementById('joinSessionBtn');
    const sessionMessage = document.getElementById('sessionMessage');
    const sessionSection = document.querySelector('.session-section');
    const logoutBtn = document.getElementById('logoutBtn');
    const authForm = document.getElementById('authForm');
    function displayMessage(element, text, type = 'info') {
        element.textContent = text;
        element.className = `message ${type}`;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 5000);
    }
    const checkAuthenticationStatus = () => {
        if ((0, auth_1.getAuthToken)() && (0, auth_1.getUsername)()) {
            // Utilisateur connecté
            authForm.style.display = 'none';
            sessionSection.style.display = 'block';
            logoutBtn.style.display = 'block';
            displayMessage(authMessage, `Bienvenue, ${(0, auth_1.getUsername)()}!`, 'success');
        }
        else {
            // Utilisateur non connecté
            authForm.style.display = 'block';
            sessionSection.style.display = 'none';
            logoutBtn.style.display = 'none';
            displayMessage(authMessage, 'Veuillez vous connecter ou vous inscrire.', 'info');
        }
    };
    registerBtn.addEventListener('click', async () => {
        const username = usernameInput.value;
        const password = passwordInput.value;
        if (!username || !password) {
            displayMessage(authMessage, 'Veuillez remplir tous les champs.', 'warning');
            return;
        }
        try {
            await (0, auth_1.registerUser)(username, password);
            displayMessage(authMessage, 'Inscription réussie! Vous pouvez maintenant vous connecter.', 'success');
            // Optionnel: vider les champs après l'inscription
            passwordInput.value = '';
        }
        catch (error) {
            displayMessage(authMessage, error.message || 'Erreur lors de l\'inscription.', 'error');
        }
    });
    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value;
        const password = passwordInput.value;
        if (!username || !password) {
            displayMessage(authMessage, 'Veuillez remplir tous les champs.', 'warning');
            return;
        }
        try {
            await (0, auth_1.loginUser)(username, password);
            displayMessage(authMessage, 'Connexion réussie!', 'success');
            passwordInput.value = ''; // Vider le champ du mot de passe
            checkAuthenticationStatus(); // Mettre à jour l'UI après connexion
        }
        catch (error) {
            displayMessage(authMessage, error.message || 'Erreur lors de la connexion.', 'error');
        }
    });
    createSessionBtn.addEventListener('click', async () => {
        const sessionId = newSessionIdInput.value.trim();
        if (!sessionId) {
            displayMessage(sessionMessage, 'Veuillez entrer un ID de session.', 'warning');
            return;
        }
        try {
            const token = (0, auth_1.getAuthToken)();
            if (!token)
                throw new Error('Non authentifié.');
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la création de la session.');
            }
            const data = await response.json();
            sessionStorage.setItem('currentSessionId', data.sessionId);
            displayMessage(sessionMessage, `Session '${data.sessionId}' créée et rejointe avec succès!`, 'success');
            window.location.href = '/index.html'; // Rediriger vers la page de session
        }
        catch (error) {
            displayMessage(sessionMessage, error.message || 'Erreur lors de la création de la session.', 'error');
        }
    });
    joinSessionBtn.addEventListener('click', async () => {
        const sessionId = existingSessionIdInput.value.trim();
        if (!sessionId) {
            displayMessage(sessionMessage, 'Veuillez entrer l\'ID de session à rejoindre.', 'warning');
            return;
        }
        try {
            const token = (0, auth_1.getAuthToken)();
            if (!token)
                throw new Error('Non authentifié.');
            const response = await fetch('/api/sessions/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la jointure de la session.');
            }
            const data = await response.json();
            sessionStorage.setItem('currentSessionId', data.sessionId);
            displayMessage(sessionMessage, `Session '${data.sessionId}' rejointe avec succès!`, 'success');
            window.location.href = '/index.html'; // Rediriger vers la page de session
        }
        catch (error) {
            displayMessage(sessionMessage, error.message || 'Erreur lors de la jointure de la session.', 'error');
        }
    });
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('currentSessionId');
        window.location.href = '/main.html';
    });
    // Initial check on page load
    checkAuthenticationStatus();
});
//# sourceMappingURL=main.js.map