const socket = io();
const deck = ['1', '2', '3', '5', '8', '13', '21'];
const deckContainer = document.getElementById('deck');
const votesContainer = document.getElementById('votes');
const storyErrorMsg = document.getElementById('story-error-msg');

const selectedStoryTitle = document.getElementById('selected-story-title');
const selectedStoryDescription = document.getElementById('selected-story-description');
const storySelect = document.getElementById('story-select');
const previousStoriesList = document.getElementById('previous-stories');

let hasVoted = false;
let sessionId = null;
let stories = [];
let selectedStory = null;
let revealedVotes = [];

// Render voting cards
function renderDeck() {
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

// Highlight selected card
function highlightSelectedCard(card) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
}

// Display votes
function renderVotes(data) {
  votesContainer.innerHTML = '';
  if (!data?.votes) return;

  revealedVotes = data.revealed ? data.votes : [];

  data.votes.forEach(vote => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = data.revealed ? vote.value : '?';
    votesContainer.appendChild(card);
  });

  // Store previous story and estimation
  if (data.revealed && selectedStory) {
    const estimations = revealedVotes.map(v => parseInt(v.value)).filter(v => !isNaN(v));
    const avg = estimations.reduce((a, b) => a + b, 0) / (estimations.length || 1);
    const li = document.createElement('li');
    li.textContent = `${selectedStory.title} - Avg: ${isNaN(avg) ? 'N/A' : avg.toFixed(2)}`;
    previousStoriesList.appendChild(li);
  }
}

// Story creation
document.getElementById('add-story-btn').addEventListener('click', async () => {
  const title = document.getElementById('story-title').value.trim();
  const description = document.getElementById('story-description').value.trim();

  if (!title || !description || !sessionId) {
    storyErrorMsg.textContent = 'Please fill out both title and description.';
    return;
  }

  const existing = stories.find(s => s.title.toLowerCase() === title.toLowerCase());
  if (existing) {
    storyErrorMsg.textContent = 'A story with this title already exists.';
    return;
  }

  storyErrorMsg.textContent = '';

  await fetch(`/session/${sessionId}/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });

  document.getElementById('story-title').value = '';
  document.getElementById('story-description').value = '';

  fetchStories();
});

// Story deletion
document.getElementById('delete-story-btn').addEventListener('click', async () => {
  const titleToDelete = document.getElementById('delete-story-title').value.trim();
  if (!titleToDelete || !sessionId) return;

  const storyToDelete = stories.find(s => s.title.toLowerCase() === titleToDelete.toLowerCase());
  if (!storyToDelete) {
    storyErrorMsg.textContent = 'Story not found.';
    return;
  }

  storyErrorMsg.textContent = '';

  await fetch(`/session/${sessionId}/story/${storyToDelete.id}`, {
    method: 'DELETE'
  });

  document.getElementById('delete-story-title').value = '';
  fetchStories();
});

// Update story dropdown
function updateStoryDropdown() {
  storySelect.innerHTML = '<option value="">-- Select Story --</option>';
  stories.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    storySelect.appendChild(opt);
  });
}

// Fetch all stories
async function fetchStories() {
  if (!sessionId) return;
  const res = await fetch(`/session/${sessionId}/stories`);
  stories = await res.json();
  updateStoryDropdown();
}

// Drag and drop functionality for CSV upload
const dropArea = document.getElementById('csv-drop-area');
const fileInput = document.getElementById('csv-upload');

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
    alert('Please drop a CSV file.');
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.name.endsWith('.csv')) {
    readCSVFile(file);
  } else {
    alert('Please select a CSV file.');
  }
});

async function readCSVFile(file) {
  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const [title, description] = line.split(';').map(s => s.trim());
      if (!title || !description) continue;
      await fetch(`/session/${sessionId}/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
    }
  };
  fetchStories();
  reader.readAsText(file);
}

// Export stories to CSV
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      // Fetch latest stories
      const res = await fetch(`/session/${sessionId}/stories`);
      const exportStories = await res.json();
      // Prepare CSV content (empty if no stories)
      const csvRows = exportStories.length
        ? exportStories.map(s => `"${s.title.replace(/"/g, '""')}";"${s.description.replace(/"/g, '""')}"`)
        : [];
      const csvContent = csvRows.join('\n');
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stories.csv';
      document.body.appendChild(a);
      a.click(); // This triggers the download
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
});


// Reveal/reset
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

// Socket event listeners
socket.on('sessionID', id => {
  sessionId = id;
  document.getElementById('session-id').textContent = `Session ID: ${id}`;
  fetchStories();
});
socket.on('update', data => {
  renderVotes(data);
  if (data.votes.length === 0) hasVoted = false;
});

// Story selection
storySelect.addEventListener('change', () => {
  const selectedId = storySelect.value;
  selectedStory = stories.find(s => s.id === selectedId);
  selectedStoryTitle.textContent = selectedStory ? selectedStory.title : 'None';
  selectedStoryDescription.textContent = selectedStory ? selectedStory.description : '';
});


document.getElementById('delete-story-btn').addEventListener('click', async () => {
  const titleToDelete = document.getElementById('delete-story-title').value.trim();
  if (!titleToDelete || !sessionId) return;

  const storyToDelete = stories.find(s => s.title.toLowerCase() === titleToDelete.toLowerCase());
  if (!storyToDelete) {
    storyErrorMsg.textContent = 'Story not found.';
    return;
  }

  storyErrorMsg.textContent = '';

  // Supprimer la story via le backend
  await fetch(`/session/${sessionId}/story/${storyToDelete.id}`, {
    method: 'DELETE'
  });

  // Si la story supprimée est actuellement sélectionnée
  if (selectedStory && selectedStory.id === storyToDelete.id) {
    selectedStory = null;
    storySelect.value = '';
    selectedStoryTitle.textContent = '';
    selectedStoryDescription.textContent = '';
  }

  document.getElementById('delete-story-title').value = '';
  fetchStories();
});

// Initialize
renderDeck();
