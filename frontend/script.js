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

function highlightSelectedCard(card) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
}

function renderVotes(data) {
  votesContainer.innerHTML = '';
  if (!data?.votes) return;

  data.votes.forEach(vote => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = data.revealed ? vote.value : '?';
    votesContainer.appendChild(card);
  });

  if (!data.revealed) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  }
}

function reveal() {
  socket.emit('reveal');
}

function resetme() {
  hasVoted = false;
  socket.emit('resetme');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  votesContainer.innerHTML = '';
}

function resetall() {
  hasVoted = false;
  socket.emit('resetall');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  votesContainer.innerHTML = '';
}

// ---- STORY MANAGEMENT ----
function addStory() {
  const title = document.getElementById('story-title').value;
  const description = document.getElementById('story-description').value;
  if (!title || !description) {
    alert("Please enter both title and description.");
    return;
  }

  socket.emit('addStory', { title, description });
  document.getElementById('story-title').value = '';
  document.getElementById('story-description').value = '';
}

socket.on('storiesUpdated', (stories) => {
  const storyDropdown = document.getElementById('story-dropdown');
  storyDropdown.innerHTML = '<option value="">Select a story</option>';

  stories.forEach(story => {
    const option = document.createElement('option');
    option.value = story.id;
    option.textContent = story.title;
    option.dataset.description = story.description;
    storyDropdown.appendChild(option);
  });
});

function displayStoryDetails() {
  const dropdown = document.getElementById('story-dropdown');
  const selectedOption = dropdown.options[dropdown.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    document.getElementById('selected-story-details').style.display = 'none';
    return;
  }

  document.getElementById('story-title-display').textContent = selectedOption.textContent;
  document.getElementById('story-description-display').textContent = selectedOption.dataset.description || '';
  document.getElementById('selected-story-details').style.display = 'block';
}

// ---- CSV UPLOAD & EXPORT ----

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
      socket.emit('addStory', { title, description });
    }
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
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
      a.click(); // This triggers the download
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
});

// ---- SOCKET EVENT LISTENING ----
socket.on('update', (data) => {
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
