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

// Render story list
socket.on('storiesUpdated', (stories) => {
  const storyList = document.getElementById('stories');
  storyList.innerHTML = '';
  stories.forEach(story => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${story.title}</strong><br><em>${story.description}</em>`;
    storyList.appendChild(li);
  });
});

// Init
renderDeck();
