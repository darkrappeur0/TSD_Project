import { getAuthToken, getUsername, removeAuthToken, removeUsername } from './auth';
class PokerPlanningApp {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.username = null;
        this.currentStory = null;
        this.storiesInSession = [];
        this.elements = {
            sessionIdDisplay: document.getElementById('session-id-display'),
            usernameDisplay: document.getElementById('username-display'),
            addStoryForm: document.getElementById('addStoryForm'),
            storyTitleInput: document.getElementById('storyTitle'),
            storyDescriptionInput: document.getElementById('storyDescription'),
            storyTasksInput: document.getElementById('storyTasks'),
            addStoryBtn: document.getElementById('addStoryBtn'),
            importCsvInput: document.getElementById('importCsv'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),
            storiesList: document.getElementById('storiesList'),
            storyDetails: document.getElementById('storyDetails'),
            storyTitleDetails: document.getElementById('storyTitleDetails'),
            storyDescriptionDetails: document.getElementById('storyDescriptionDetails'),
            storyTasksDetails: document.getElementById('storyTasksDetails'),
            selectStoryBtn: document.getElementById('selectStoryBtn'),
            deleteStoryBtn: document.getElementById('deleteStoryBtn'),
            cardsContainer: document.getElementById('cards-container'),
            votesDisplay: document.getElementById('votes-display'),
            revealVotesBtn: document.getElementById('revealVotesBtn'),
            resetMyVoteBtn: document.getElementById('resetMyVoteBtn'),
            resetAllVotesBtn: document.getElementById('resetAllVotesBtn'),
            membersList: document.getElementById('members-list'),
            messageDisplay: document.getElementById('messageDisplay'),
            logoutBtn: document.getElementById('logoutBtn'),
        };
        this.checkAuthAndSession();
        this.setupEventListeners();
    }
    checkAuthAndSession() {
        const token = getAuthToken();
        this.username = getUsername();
        this.sessionId = sessionStorage.getItem('currentSessionId');
        if (!token || !this.username || !this.sessionId) {
            alert('Veuillez vous connecter et rejoindre une session.');
            window.location.href = '/main.html';
            return;
        }
        this.elements.usernameDisplay.textContent = `Connecté en tant que: ${this.username}`;
        this.elements.sessionIdDisplay.textContent = `Session ID: ${this.sessionId}`;
        this.connectWebSocket();
    }
    setupEventListeners() {
        this.elements.addStoryForm.addEventListener('submit', this.handleAddStory.bind(this));
        this.elements.importCsvInput.addEventListener('change', this.handleImportCsv.bind(this));
        this.elements.exportCsvBtn.addEventListener('click', this.handleExportCsv.bind(this));
        this.elements.storiesList.addEventListener('change', this.handleStorySelectionChange.bind(this));
        this.elements.selectStoryBtn.addEventListener('click', this.handleSelectStory.bind(this));
        this.elements.deleteStoryBtn.addEventListener('click', this.handleDeleteStory.bind(this));
        this.elements.revealVotesBtn.addEventListener('click', () => this.sendWebSocketMessage('reveal'));
        this.elements.resetMyVoteBtn.addEventListener('click', () => this.sendWebSocketMessage('resetme'));
        this.elements.resetAllVotesBtn.addEventListener('click', () => this.sendWebSocketMessage('resetall'));
        this.elements.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        // Setup for voting cards
        this.elements.cardsContainer.innerHTML = this.generateCardsHtml(); // Generate Fibonacci/custom cards
        this.elements.cardsContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('card')) {
                this.handleVote(target.dataset.value || '');
            }
        });
    }
    generateCardsHtml() {
        const values = ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];
        return values.map(value => `<div class="card" data-value="${value}">${value}</div>`).join('');
    }
    connectWebSocket() {
        // Remplacez 'ws://localhost:3000' par l'URL de votre serveur WebSocket
        this.ws = new WebSocket(`ws://localhost:3000/websocket?token=${getAuthToken()}&sessionId=${this.sessionId}`);
        this.ws.onopen = () => {
            console.log('Connecté au serveur WebSocket.');
            // Envoyer un message de jointure de session
            this.sendWebSocketMessage('joinSession', { sessionId: this.sessionId, username: this.username });
        };
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Message WebSocket reçu:', data);
            if (data.type === 'sessionUpdate') {
                this.updateUI(data.payload);
            }
            else if (data.type === 'message') {
                this.displayMessage(data.payload.text, data.payload.type || 'info');
            }
        };
        this.ws.onclose = () => {
            console.log('Déconnecté du serveur WebSocket.');
            // Gérer la reconnexion ou la redirection
        };
        this.ws.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
            this.displayMessage('Erreur de connexion WebSocket.', 'error');
        };
    }
    sendWebSocketMessage(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
        else {
            console.warn('WebSocket non connecté ou fermé.');
            this.displayMessage('Erreur: WebSocket non connecté. Veuillez rafraîchir la page.', 'error');
        }
    }
    async handleAddStory(event) {
        event.preventDefault();
        const title = this.elements.storyTitleInput.value;
        const description = this.elements.storyDescriptionInput.value;
        const tasks = this.elements.storyTasksInput.value.split(',').map(t => t.trim()).filter(t => t);
        if (!title || !this.sessionId) {
            this.displayMessage('Le titre de l\'histoire et l\'ID de session sont requis.', 'error');
            return;
        }
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}/stories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`,
                },
                body: JSON.stringify({ title, description, tasks }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de l\'ajout de l\'histoire.');
            }
            this.displayMessage('Histoire ajoutée avec succès !', 'success');
            this.elements.addStoryForm.reset();
            // L'UI sera mise à jour via le message WebSocket 'sessionUpdate'
        }
        catch (error) {
            console.error('Erreur lors de l\'ajout de l\'histoire:', error);
            this.displayMessage(error.message || 'Erreur lors de l\'ajout de l\'histoire.', 'error');
        }
    }
    async handleImportCsv(event) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) {
            this.displayMessage('Aucun fichier sélectionné.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const csvContent = e.target?.result;
            // Parse CSV: Expecting 'title,description,task1|task2|task3'
            const lines = csvContent.split('\n').filter(line => line.trim() !== '');
            const storiesToImport = lines.map(line => {
                const [title, description, tasksStr] = line.split(',');
                const tasks = tasksStr ? tasksStr.split('|').map(t => t.trim()) : [];
                return { title: title?.trim(), description: description?.trim(), tasks };
            }).filter(story => story.title); // Filter out empty titles
            if (storiesToImport.length === 0) {
                this.displayMessage('Aucune histoire valide trouvée dans le fichier CSV.', 'warning');
                return;
            }
            try {
                // Envoyer chaque histoire individuellement ou en lot
                for (const story of storiesToImport) {
                    const response = await fetch(`/api/sessions/${this.sessionId}/stories`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getAuthToken()}`,
                        },
                        body: JSON.stringify(story),
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Erreur lors de l'importation de l'histoire: ${story.title}.`);
                    }
                }
                this.displayMessage(`${storiesToImport.length} histoire(s) importée(s) avec succès !`, 'success');
                input.value = ''; // Clear the input
            }
            catch (error) {
                console.error('Erreur lors de l\'importation CSV:', error);
                this.displayMessage(error.message || 'Erreur lors de l\'importation des histoires CSV.', 'error');
            }
        };
        reader.readAsText(file);
    }
    handleExportCsv() {
        if (this.storiesInSession.length === 0) {
            this.displayMessage('Aucune histoire à exporter.', 'warning');
            return;
        }
        let csvContent = 'title,description,tasks\n';
        this.storiesInSession.forEach(story => {
            const tasksStr = story.tasks ? story.tasks.join('|') : '';
            csvContent += `${story.title},${story.description || ''},${tasksStr}\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `session_${this.sessionId}_stories.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.displayMessage('Histoires exportées au format CSV.', 'success');
        }
        else {
            this.displayMessage('Votre navigateur ne supporte pas l\'exportation directe de CSV.', 'error');
        }
    }
    handleStorySelectionChange() {
        const selectedStoryId = this.elements.storiesList.value;
        const selectedStory = this.storiesInSession.find(s => s._id === selectedStoryId);
        if (selectedStory) {
            this.elements.storyTitleDetails.textContent = selectedStory.title;
            this.elements.storyDescriptionDetails.textContent = selectedStory.description || 'Pas de description.';
            this.elements.storyTasksDetails.innerHTML = '';
            if (selectedStory.tasks && selectedStory.tasks.length > 0) {
                selectedStory.tasks.forEach(task => {
                    const li = document.createElement('li');
                    li.textContent = task;
                    this.elements.storyTasksDetails.appendChild(li);
                });
            }
            else {
                const li = document.createElement('li');
                li.textContent = 'Pas de tâches.';
                this.elements.storyTasksDetails.appendChild(li);
            }
            this.elements.storyDetails.style.display = 'block';
            this.elements.selectStoryBtn.style.display = 'inline-block';
            this.elements.deleteStoryBtn.style.display = 'inline-block';
        }
        else {
            this.elements.storyDetails.style.display = 'none';
            this.elements.selectStoryBtn.style.display = 'none';
            this.elements.deleteStoryBtn.style.display = 'none';
        }
    }
    async handleSelectStory() {
        const selectedStoryId = this.elements.storiesList.value;
        if (!selectedStoryId || !this.sessionId) {
            this.displayMessage('Veuillez sélectionner une histoire.', 'error');
            return;
        }
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}/selectStory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`,
                },
                body: JSON.stringify({ storyInSessionId: selectedStoryId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la sélection de l\'histoire.');
            }
            this.displayMessage('Histoire sélectionnée pour le vote !', 'success');
            // L'UI sera mise à jour via le message WebSocket 'sessionUpdate'
        }
        catch (error) {
            console.error('Erreur lors de la sélection de l\'histoire:', error);
            this.displayMessage(error.message || 'Erreur lors de la sélection de l\'histoire.', 'error');
        }
    }
    async handleDeleteStory() {
        const selectedStoryId = this.elements.storiesList.value;
        if (!selectedStoryId || !this.sessionId) {
            this.displayMessage('Veuillez sélectionner une histoire à supprimer.', 'error');
            return;
        }
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette histoire ?')) {
            return;
        }
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}/stories/${selectedStoryId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la suppression de l\'histoire.');
            }
            this.displayMessage('Histoire supprimée avec succès !', 'success');
            // L'UI sera mise à jour via le message WebSocket 'sessionUpdate'
        }
        catch (error) {
            console.error('Erreur lors de la suppression de l\'histoire:', error);
            this.displayMessage(error.message || 'Erreur lors de la suppression de l\'histoire.', 'error');
        }
    }
    handleVote(value) {
        if (!this.currentStory) {
            this.displayMessage('Veuillez sélectionner une histoire à voter d\'abord.', 'warning');
            return;
        }
        this.sendWebSocketMessage('vote', { value });
    }
    updateUI(sessionUpdate) {
        this.storiesInSession = sessionUpdate.stories;
        this.elements.membersList.innerHTML = '';
        sessionUpdate.members.forEach(member => {
            const li = document.createElement('li');
            li.textContent = member.username;
            this.elements.membersList.appendChild(li);
        });
        // Update stories dropdown
        this.elements.storiesList.innerHTML = '<option value="">-- Sélectionner une histoire --</option>';
        sessionUpdate.stories.sort((a, b) => a.order - b.order).forEach(story => {
            const option = document.createElement('option');
            option.value = story._id;
            option.textContent = story.title;
            if (sessionUpdate.currentStoryId === story._id) {
                option.selected = true;
                this.currentStory = story;
            }
            this.elements.storiesList.appendChild(option);
        });
        // Trigger change to update details display for selected story
        this.handleStorySelectionChange();
        // Update votes display
        this.elements.votesDisplay.innerHTML = '';
        if (this.currentStory) {
            const currentVotes = this.currentStory.votes;
            const revealed = this.currentStory.revealed;
            const votesByUser = {};
            currentVotes.forEach(vote => {
                votesByUser[vote.username] = vote.value;
            });
            sessionUpdate.members.forEach(member => {
                const memberVoteDiv = document.createElement('div');
                memberVoteDiv.classList.add('member-vote');
                const voteValue = votesByUser[member.username];
                if (revealed && voteValue) {
                    memberVoteDiv.innerHTML = `<strong>${member.username}:</strong> ${voteValue}`;
                }
                else if (voteValue) {
                    memberVoteDiv.innerHTML = `<strong>${member.username}:</strong> <span class="voted">Voté</span>`;
                }
                else {
                    memberVoteDiv.innerHTML = `<strong>${member.username}:</strong> <span class="not-voted">En attente</span>`;
                }
                this.elements.votesDisplay.appendChild(memberVoteDiv);
            });
            // Calculate and display average if revealed
            if (revealed) {
                const numericVotes = currentVotes
                    .map(vote => parseFloat(vote.value))
                    .filter(value => !isNaN(value)); // Filter out non-numeric votes (?, ☕)
                if (numericVotes.length > 0) {
                    const sum = numericVotes.reduce((acc, val) => acc + val, 0);
                    const average = sum / numericVotes.length;
                    const averageDisplay = document.createElement('p');
                    averageDisplay.innerHTML = `<strong>Moyenne:</strong> ${average.toFixed(2)}`;
                    this.elements.votesDisplay.appendChild(averageDisplay);
                }
            }
            // Enable/disable buttons based on current story and revealed status
            this.elements.revealVotesBtn.disabled = !this.currentStory || revealed;
            this.elements.resetMyVoteBtn.disabled = !this.currentStory;
            this.elements.resetAllVotesBtn.disabled = !this.currentStory;
        }
        else {
            this.elements.votesDisplay.textContent = 'Aucune histoire sélectionnée pour le vote.';
            this.elements.revealVotesBtn.disabled = true;
            this.elements.resetMyVoteBtn.disabled = true;
            this.elements.resetAllVotesBtn.disabled = true;
        }
    }
    displayMessage(text, type = 'info') {
        this.elements.messageDisplay.textContent = text;
        this.elements.messageDisplay.className = `message ${type}`;
        setTimeout(() => {
            this.elements.messageDisplay.textContent = '';
            this.elements.messageDisplay.className = 'message';
        }, 5000); // Message disappears after 5 seconds
    }
    handleLogout() {
        removeAuthToken();
        removeUsername();
        sessionStorage.removeItem('currentSessionId');
        window.location.href = '/main.html';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new PokerPlanningApp();
});
//# sourceMappingURL=app.js.map