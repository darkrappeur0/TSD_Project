const socket = io();
const deck = ['1', '2', '3', '5', '8', '13', '21'];
const deckContainer = document.getElementById('deck');
const votesContainer = document.getElementById('votes');
const storyTitleContainer = document.getElementById('story-title');  // Ajouter un conteneur pour afficher le titre de la story
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

// Display votes (hidden or revealed)
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

// Display the story title
function renderStoryTitle(title) {
  if (storyTitleContainer) {
    storyTitleContainer.textContent = `User Story: ${title}`;
  }
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
  renderStoryTitle(data.title);  // Afficher le titre de la story
  if (data.votes.length === 0) hasVoted = false;
});

// Initialize
renderDeck();
