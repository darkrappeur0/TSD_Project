const socket = io({
  auth: {
    token: getAuthToken()
  }
});

const deck = ['1', '2', '3', '5', '8', '13', '21'];
const deckContainer = document.getElementById('deck');
const votesContainer = document.getElementById('votes');

let hasVoted = false;
let sessionId = null;
let userName = null;
let stories = [];
let currentStoryIndex = 0; // Index de l'histoire actuellement estimée
let isOwner = false;

// Récupérer le token d'authentification
function getAuthToken() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    alert('Token d\'authentification requis!');
    window.location.href = '/login';
    return null;
  }
  return token;
}

// Récupérer l'ID de session depuis l'URL
function getSessionIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Récupérer le nom d'utilisateur depuis le localStorage
function getUserNameFromStorage() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      return user.username || 'User';
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }
  return 'User';
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  sessionId = getSessionIdFromURL();
  
  if (!sessionId) {
    alert('Session ID manquant!');
    window.location.href = '/dashboard';
    return;
  }
  
  const token = getAuthToken();
  if (!token) {
    return;
  }

  userName = getUserNameFromStorage();

  // Afficher l'ID de session
  const sessionIdElement = document.getElementById('session-id');
  if (sessionIdElement) {
    sessionIdElement.textContent = `Session ID: ${sessionId}`;
  }

  // Vérifier l'accès à la session avant de rejoindre
  checkSessionAccess().then(canJoin => {
    if (canJoin) {
      socket.emit('joinSession', { sessionId });
      renderDeck();
      setupEventListeners();
    }
  });
});


async function checkSessionAccess() {
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/session/${sessionId}/join`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return true;
    } else {
      const error = await response.json();
      alert(`Cannot join session: ${error.message}`);
      window.location.href = '/dashboard';
      return false;
    }
  } catch (error) {
    console.error('Error checking session access:', error);
    alert('Error checking session access');
    window.location.href = '/dashboard';
    return false;
  }
}

// Setup event listeners
function setupEventListeners() {
  // CSV Upload
  const dropArea = document.getElementById('csv-drop-area');
  const fileInput = document.getElementById('csv-upload');

  if (dropArea && fileInput) {
    dropArea.addEventListener('click', () => fileInput.click());

    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.style.background = '#f0f0f0';
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.style.background = '';
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        readCSVFile(file);
      } else {
        alert('Veuillez déposer un fichier CSV.');
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.name.endsWith('.csv')) {
        readCSVFile(file);
      } else {
        alert('Veuillez sélectionner un fichier CSV.');
      }
    });
  }

  // Export CSV
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }
}

// Render voting cards
function renderDeck() {
  if (!deckContainer) return;
  
  deckContainer.innerHTML = '';
  deck.forEach(value => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = value;
    card.onclick = () => vote(value);
    deckContainer.appendChild(card);
  });
}

function vote(value) {
  if (hasVoted) return;
  
  socket.emit('vote', value);
  hasVoted = true;
  
  // Highlight selected card
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  event.target.classList.add('selected');
}

function renderVotes(data) {
  if (!votesContainer || !data?.votes) return;

  votesContainer.innerHTML = '';
  
  data.votes.forEach(vote => {
    const card = document.createElement('div');
    card.className = 'card vote-card';
    
    if (data.revealed && vote.value) {
      card.textContent = vote.value;
      if (vote.userName) {
        const nameSpan = document.createElement('small');
        nameSpan.textContent = vote.userName;
        nameSpan.style.display = 'block';
        nameSpan.style.fontSize = '10px';
        card.appendChild(nameSpan);
      }
    } else {
      card.textContent = '?';
    }
    
    votesContainer.appendChild(card);
  });

  // Show final estimate if revealed
  if (data.revealed && data.finalEstimate) {
    const estimateDiv = document.createElement('div');
    estimateDiv.className = 'final-estimate';
    estimateDiv.innerHTML = `<strong>Final Estimate: ${data.finalEstimate}</strong>`;
    votesContainer.appendChild(estimateDiv);
  }
}

function reveal() {
  socket.emit('reveal');
  socket.on('votesRevealed', (data) => {
        if (window.onEstimationComplete) {
            const currentStory = getCurrentStoryDetails(); // Vous devrez implémenter cette fonction
            window.onEstimationComplete(
                currentStory.title,
                currentStory.description,
                data.votes,
                calculateFinalEstimate(data.votes) // Fonction pour calculer l'estimation finale
            );
        }
    });
}


function resetme() {
  hasVoted = false;
  socket.emit('resetme');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
}

function resetall() {
  if (!isOwner) {
    if (!confirm("Seul le propriétaire devrait normalement réinitialiser pour tous. Continuer ?")) {
      return;
    }
  }
  hasVoted = false;
  socket.emit('resetall');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
}

function displayParticipants(participants) {
  const participantsDiv = document.getElementById('participants-list') || createParticipantsDiv();
  
  if (participants && participants.length > 0) {
    participantsDiv.innerHTML = `
      <h4>Participants (${participants.length})</h4>
      <ul>
        ${participants.map(p => `<li>${p}</li>`).join('')}
      </ul>
    `;
  }
}

function createParticipantsDiv() {
  const div = document.createElement('div');
  div.id = 'participants-list';
  div.style.cssText = 'margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;';
  
  const sessionIdDiv = document.getElementById('session-id');
  if (sessionIdDiv && sessionIdDiv.parentNode) {
    sessionIdDiv.parentNode.insertBefore(div, sessionIdDiv.nextSibling);
  }
  
  return div;
}


// ---- STORY MANAGEMENT ----
function addStory() {
  if (!isOwner) {
    alert("Seul le propriétaire de la session peut ajouter des histoires.");
    return;
  }

  const titleInput = document.getElementById('story-title');
  const descriptionInput = document.getElementById('story-description');
  
  if (!titleInput || !descriptionInput) return;
  
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  
  if (!title || !description) {
    alert("Veuillez entrer un titre et une description.");
    return;
  }

  socket.emit('addStory', { title, description });
  titleInput.value = '';
  descriptionInput.value = '';
}

function displayStoryDetails() {
  const dropdown = document.getElementById('story-dropdown');
  if (!dropdown) return;
  
  const selectedOption = dropdown.options[dropdown.selectedIndex];
  const detailsDiv = document.getElementById('selected-story-details');
  const titleDisplay = document.getElementById('story-title-display');
  const descriptionDisplay = document.getElementById('story-description-display');

  if (!selectedOption || !selectedOption.value) {
    if (detailsDiv) detailsDiv.style.display = 'none';
    return;
  }

  // Find the selected story
  const selectedStory = stories.find(s => s.id === selectedOption.value);
  if (selectedStory) {
    if (titleDisplay) titleDisplay.textContent = selectedStory.title;
    if (descriptionDisplay) descriptionDisplay.textContent = selectedStory.description;
    if (detailsDiv) detailsDiv.style.display = 'block';
    
    // Set this story as current for voting
    socket.emit('selectStory', { storyId: selectedStory.id });
  }
}

// ---- CSV FUNCTIONS ----
async function readCSVFile(file) {
  if (!isOwner) {
    alert("Seul le propriétaire de la session peut importer des histoires.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const [title, description] = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
      if (!title || !description) continue;
      
      socket.emit('addStory', { title, description });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    alert(`${lines.length} stories imported successfully!`);
  };
  reader.readAsText(file);
}

async function exportCSV() {
  if (!sessionId) return;
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/session/${sessionId}/stories`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch stories');
    }
    
    const exportStories = await response.json();
    
    if (exportStories.length === 0) {
      alert('No stories to export');
      return;
    }
    
    const csvRows = exportStories.map(s => 
      `"${s.title.replace(/"/g, '""')}";` + 
      `"${s.description.replace(/"/g, '""')}";` +
      `"${s.finalEstimate || ''}"`
    );
    
    const csvContent = 'Title;Description;Estimate\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stories_${sessionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Stories exported successfully!');
  } catch (error) {
    console.error('Export error:', error);
    alert('Error exporting stories');
  }
}

// ---- SOCKET EVENT LISTENERS ----

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  if (error.message.includes('Authentication')) {
    alert('Authentication error. Please login again.');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.href = '/login';
  }
});

socket.on('sessionJoined', (data) => {
  console.log(`Connected to session ${data.sessionId} as ${data.userName}`);
  stories = data.stories || [];
  isOwner = data.isOwner || false;
  
  updateStoriesDropdown();
  updateUIForPermissions();
});

socket.on('update', (data) => {
  renderVotes(data);
  if (data.votes.length === 0) {
    hasVoted = false;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  }
});

socket.on('storiesUpdated', (updatedStories) => {
  stories = updatedStories;
  updateStoriesDropdown();
});

socket.on('memberJoined', (data) => {
  console.log(`${data.userName} joined the session (${data.memberCount} members)`);
  // Optionnel: mettre à jour la liste des participants
});

socket.on('memberLeft', (data) => {
  console.log(`${data.userName} left the session (${data.memberCount} members)`);
  // Optionnel: mettre à jour la liste des participants
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  alert(`Error: ${error.message}`);
  
  if (error.message.includes('Session not found') || error.message.includes('Access denied')) {
    window.location.href = '/dashboard';
  }
});

socket.on('estimationCompleted', (data) => {
    addToHistory(
        data.storyTitle,
        data.storyDescription,
        data.votes,
        data.finalEstimate,
        new Date(data.timestamp)
    );
});

function updateUIForPermissions() {
  const addStoryButton = document.querySelector('button[onclick="addStory()"]');
  const csvUploadArea = document.getElementById('csv-drop-area');
  const storyTitleInput = document.getElementById('story-title');
  const storyDescriptionInput = document.getElementById('story-description');
  
  if (!isOwner) {
    // Désactiver les contrôles pour les non-propriétaires
    if (addStoryButton) {
      addStoryButton.disabled = true;
      addStoryButton.textContent = 'Add Story (Owner Only)';
      addStoryButton.style.opacity = '0.5';
    }
    
    if (csvUploadArea) {
      csvUploadArea.style.opacity = '0.5';
      csvUploadArea.style.pointerEvents = 'none';
      csvUploadArea.innerHTML = 'CSV Import (Owner Only)';
    }
    
    if (storyTitleInput) {
      storyTitleInput.disabled = true;
      storyTitleInput.placeholder = 'Story Title (Owner Only)';
    }
    
    if (storyDescriptionInput) {
      storyDescriptionInput.disabled = true;
      storyDescriptionInput.placeholder = 'Story Description (Owner Only)';
    }
    
    // Ajouter un message d'information
    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-message';
    infoDiv.innerHTML = `
      <p style="color: #666; font-style: italic; padding: 10px; background: #f9f9f9; border-radius: 5px; margin: 10px 0;">
        ℹ️ Vous êtes dans une session partagée. Seul le propriétaire peut ajouter des histoires.
      </p>
    `;
    
    const storyForm = document.querySelector('.story-form');
    if (storyForm && !document.querySelector('.info-message')) {
      storyForm.insertBefore(infoDiv, storyForm.firstChild);
    }
  } else {
    // Utilisateur propriétaire - afficher un message de confirmation
    const ownerDiv = document.createElement('div');
    ownerDiv.className = 'owner-message';
    ownerDiv.innerHTML = `
      <p style="color: #28a745; font-weight: bold; padding: 10px; background: #d4edda; border-radius: 5px; margin: 10px 0;">
        👑 Vous êtes le propriétaire de cette session
      </p>
    `;
    
    const storyForm = document.querySelector('.story-form');
    if (storyForm && !document.querySelector('.owner-message')) {
      storyForm.insertBefore(ownerDiv, storyForm.firstChild);
    }
  }
}

// Update stories dropdown
function updateStoriesDropdown() {
  const storyDropdown = document.getElementById('story-dropdown');
  if (!storyDropdown) return;
  
  storyDropdown.innerHTML = '<option value="">Select a story</option>';
  
  stories.forEach(story => {
    const option = document.createElement('option');
    option.value = story.id;
    option.textContent = story.title;
    storyDropdown.appendChild(option);
  });
}

function getCurrentStoryDetails() {
    const titleElement = document.getElementById('story-title-display');
    const descriptionElement = document.getElementById('story-description-display');
    
    return {
        title: titleElement ? titleElement.textContent : 'Story sans titre',
        description: descriptionElement ? descriptionElement.textContent : 'Pas de description'
    };
}

function calculateFinalEstimate(votes) {
    if (!votes || votes.length === 0) return 'Aucun vote';
    
    // Filtrer les votes numériques
    const numericVotes = votes
        .map(v => parseFloat(v.vote))
        .filter(v => !isNaN(v));
    
    if (numericVotes.length === 0) {
        // Si pas de votes numériques, retourner le vote le plus fréquent
        const voteCount = {};
        votes.forEach(v => {
            voteCount[v.vote] = (voteCount[v.vote] || 0) + 1;
        });
        
        return Object.keys(voteCount).reduce((a, b) => 
            voteCount[a] > voteCount[b] ? a : b
        );
    }
    
    // Si tous les votes sont identiques, c'est un consensus
    if (new Set(numericVotes).size === 1) {
        return `${numericVotes[0]} (Consensus)`;
    }
    
    // Sinon, calculer la médiane
    const sorted = numericVotes.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
    
    return `${median} (Médiane)`;
}