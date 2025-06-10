// auth.ts (à conserver et modifier)
const TOKEN_KEY = 'authToken';
const USERNAME_KEY = 'username'; // Nouvelle clé pour stocker le nom d'utilisateur
export const getAuthToken = () => {
    return localStorage.getItem(TOKEN_KEY);
};
export const setAuthToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
};
export const removeAuthToken = () => {
    localStorage.removeItem(TOKEN_KEY);
};
export const getUsername = () => {
    return sessionStorage.getItem(USERNAME_KEY); // Récupérer du sessionStorage
};
export const setUsername = (username) => {
    sessionStorage.setItem(USERNAME_KEY, username); // Stocker dans le sessionStorage
};
export const removeUsername = () => {
    sessionStorage.removeItem(USERNAME_KEY);
};
export const loginUser = async (username, password) => {
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
    setAuthToken(data.token);
    setUsername(username); // Stocker le nom d'utilisateur après connexion réussie
};
export const registerUser = async (username, password) => {
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
//# sourceMappingURL=auth.js.map