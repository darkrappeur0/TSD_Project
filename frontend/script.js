const socket = io();
const deck = ['1', '2', '3', '5', '8', '13', '21'];
const deckContainer = document.getElementById('deck');
const votesContainer = document.getElementById('votes');
const storyErrorMsg = document.getElementById('story-error-msg');

let hasVoted = false;
let sessionId = null;
let userName = null;
let stories = [];
let selectedStory = null;

// Récupérer l'ID de session depuis l'URL
function getSessionIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Récupérer le nom d'utilisateur depuis le localStorage ou demander
function getUserName() {
  let name = localStorage.getItem('userName');
  if (!name) {
    name = prompt('Entrez votre nom:');
    if (name) {
      localStorage.setItem('userName', name);
    }
  }
  return name;
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  sessionId = getSessionIdFromURL();
  userName = getUserName();
  
  if (!sessionId) {
    alert('Session ID manquant!');
    window.location.href = '/';
    return;
  }
  
  if (!userName) {
    alert('Nom d\'utilisateur requis!');
    window.location.href = '/';
    return;
  }

  // Afficher l'ID de session
  const sessionIdElement = document.getElementById('session-id');
  if (sessionIdElement) {
    sessionIdElement.textContent = `Session ID: ${sessionId}`;
  }

  // Rejoindre la session
  socket.emit('joinSession', { sessionId, userName });
  
  renderDeck();
});

// Render voting cards
function renderDeck() {
  if (!deckContainer) return;
  
  deckContainer.innerHTML = '';
  deck.forEach(value => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = value;
    card.onclick = () => {
      if (!hasVoted) {
        socket.emit('vote', value);
        hasVoted = true;
        highlightSelectedCard(card);
      }
    };
    deckContainer.appendChild(card);
  });
}

function highlightSelectedCard(card) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
}

function renderVotes(data) {
  if (!votesContainer || !data?.votes) return;

  votesContainer.innerHTML = '';
  
  data.votes.forEach(vote => {
    const card = document.createElement('div');
    card.className = 'card vote-card';
    card.textContent = data.revealed ? vote.value : '?';
    
    // Ajouter le nom de l'utilisateur si disponible
    if (vote.userName && data.revealed) {
      const nameSpan = document.createElement('small');
      nameSpan.textContent = vote.userName;
      nameSpan.style.display = 'block';
      nameSpan.style.fontSize = '10px';
      card.appendChild(nameSpan);
    }
    
    votesContainer.appendChild(card);
  });

  if (!data.revealed) {
    document.querySelectorAll('.card.vote-card').forEach(c => c.classList.remove('selected'));
  }
}

function reveal() {
  socket.emit('reveal');
}

function resetme() {
  hasVoted = false;
  socket.emit('resetme');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
}

function resetall() {
  hasVoted = false;
  socket.emit('resetall');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
}

// ---- STORY MANAGEMENT ----
function addStory() {
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

  if (titleDisplay) titleDisplay.textContent = selectedOption.textContent;
  if (descriptionDisplay) descriptionDisplay.textContent = selectedOption.dataset.description || '';
  if (detailsDiv) detailsDiv.style.display = 'block';
}

// ---- CSV UPLOAD & EXPORT ----
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

async function readCSVFile(file) {
  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const [title, description] = line.split(';').map(s => s.trim());
      if (!title || !description) continue;
      socket.emit('addStory', { title, description });
      // Petite pause pour éviter de surcharger le serveur
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  reader.readAsText(file);
}

// Export CSV
const exportBtn = document.getElementById('export-csv-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    if (!sessionId) return;
    
    try {
      const res = await fetch(`/session/${sessionId}/stories`);
      const exportStories = await res.json();
      
      const csvRows = exportStories.length
        ? exportStories.map(s => `"${s.title.replace(/"/g, '""')}";"${s.description.replace(/"/g, '""')}"`)
        : [];
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stories.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export des histoires');
    }
  });
}

// ---- SOCKET EVENT LISTENERS ----

// Confirmation de connexion à la session
socket.on('sessionJoined', (data) => {
  console.log(`Connecté à la session ${data.sessionId} en tant que ${data.userName}`);
  stories = data.stories || [];
  updateStoriesDropdown();
});

// Mise à jour des votes
socket.on('update', (data) => {
  renderVotes(data);
  if (data.votes.length === 0) hasVoted = false;
});

// Mise à jour des histoires
socket.on('storiesUpdated', (updatedStories) => {
  stories = updatedStories;
  updateStoriesDropdown();
});

// Nouveau membre rejoint
socket.on('memberJoined', (data) => {
  console.log(`${data.userName} a rejoint la session (${data.memberCount} membres)`);
});

// Membre quitté
socket.on('memberLeft', (data) => {
  console.log(`${data.userName} a quitté la session (${data.memberCount} membres)`);
});

// Gestion des erreurs
socket.on('error', (error) => {
  console.error('Erreur Socket:', error);
  alert(`Erreur: ${error.message}`);
});

// Fonction utilitaire pour mettre à jour le dropdown des histoires
function updateStoriesDropdown() {
  const storyDropdown = document.getElementById('story-dropdown');
  if (!storyDropdown) return;
  
  storyDropdown.innerHTML = '<option value="">Sélectionner une histoire</option>';
  
  stories.forEach(story => {
    const option = document.createElement('option');
    option.value = story.id;
    option.textContent = story.title;
    option.dataset.description = story.description;
    storyDropdown.appendChild(option);
  });
}