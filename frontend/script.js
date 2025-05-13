const socket = io();
const deck = ['1', '2', '3', '5', '8', '13', '21'];
const deckContainer = document.getElementById('deck');
const votesContainer = document.getElementById('votes');
let hasVoted = false;

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

// Highlight the selected card
function highlightSelectedCard(card) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
}

// Display votes
function renderVotes(data) {
  votesContainer.innerHTML = '';
  if (!data?.votes) return;

  data.votes.forEach(vote => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = data.revealed ? vote.value : '?';
    votesContainer.appendChild(card);
  });
}

// Button actions
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
socket.on('update', (data) => {
  renderVotes(data);
  if (data.votes.length === 0) hasVoted = false;
});

// Add a story
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

// Render story list as dropdown
socket.on('storiesUpdated', (stories) => {
  const storyDropdown = document.getElementById('story-dropdown');
  storyDropdown.innerHTML = '<option value="">Select a story</option>'; // Reset the dropdown

  stories.forEach(story => {
    const option = document.createElement('option');
    option.value = story.id;
    option.textContent = story.title;
    storyDropdown.appendChild(option);
  });
});

// Display selected story details
function displayStoryDetails() {
  const selectedStoryId = document.getElementById('story-dropdown').value;

  if (!selectedStoryId) {
    document.getElementById('selected-story-details').style.display = 'none';
    return;
  }

  const story = getStoryById(selectedStoryId);

  if (story) {
    document.getElementById('story-title-display').textContent = story.title;
    document.getElementById('story-description-display').textContent = story.description;
    document.getElementById('selected-story-details').style.display = 'block';
  }
}

// Find a story by its ID
function getStoryById(storyId) {
  const storyList = document.getElementById('story-dropdown').options;
  for (let i = 0; i < storyList.length; i++) {
    if (storyList[i].value === storyId) {
      return {
        title: storyList[i].textContent,
        description: document.getElementById('story-description').value,
      };
    }
  }
  return null;
}

// Init
renderDeck();
