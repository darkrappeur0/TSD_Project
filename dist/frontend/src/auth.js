"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = exports.loginUser = exports.removeUsername = exports.setUsername = exports.getUsername = exports.removeAuthToken = exports.setAuthToken = exports.getAuthToken = void 0;
// auth.ts (à conserver et modifier)
const TOKEN_KEY = 'authToken';
const USERNAME_KEY = 'username'; // Nouvelle clé pour stocker le nom d'utilisateur
const getAuthToken = () => {
    return localStorage.getItem(TOKEN_KEY);
};
exports.getAuthToken = getAuthToken;
const setAuthToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
};
exports.setAuthToken = setAuthToken;
const removeAuthToken = () => {
    localStorage.removeItem(TOKEN_KEY);
};
exports.removeAuthToken = removeAuthToken;
const getUsername = () => {
    return sessionStorage.getItem(USERNAME_KEY); // Récupérer du sessionStorage
};
exports.getUsername = getUsername;
const setUsername = (username) => {
    sessionStorage.setItem(USERNAME_KEY, username); // Stocker dans le sessionStorage
};
exports.setUsername = setUsername;
const removeUsername = () => {
    sessionStorage.removeItem(USERNAME_KEY);
};
exports.removeUsername = removeUsername;
const loginUser = async (username, password) => {
    const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la connexion.');
    }
    const data = await response.json();
    (0, exports.setAuthToken)(data.token);
    (0, exports.setUsername)(username); // Stocker le nom d'utilisateur après connexion réussie
};
exports.loginUser = loginUser;
const registerUser = async (username, password) => {
    const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de l\'inscription.');
    }
    // Pas besoin de stocker le token ici, l'utilisateur devra se connecter après l'inscription
};
exports.registerUser = registerUser;
//# sourceMappingURL=auth.js.map