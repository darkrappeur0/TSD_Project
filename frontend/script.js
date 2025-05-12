const socket = io();
const deck = ['1', '2', '3', '5', '8', '13', '21'];
const deckContainer = document.getElementById('deck');
const votesContainer = document.getElementById('votes');
let hasVoted = false;

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

function highlightSelectedCard(selectedCard) {
    const cards = deckContainer.querySelectorAll('.card');
    cards.forEach(card => card.classList.remove('selected'));
    selectedCard.classList.add('selected');
}

function renderVotes(session) {
    votesContainer.innerHTML = '';
    session.votes.forEach(vote => {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = session.revealed ? vote.value : '❓';
        votesContainer.appendChild(card);
    });
}

function resetme() {
    hasVoted = false;
    socket.emit('resetme');
    clearSelectedCard();
}

function resetall() {
    hasVoted = false;
    socket.emit('resetall');
    clearSelectedCard();
}

function clearSelectedCard() {
    const cards = deckContainer.querySelectorAll('.card');
    cards.forEach(card => card.classList.remove('selected'));
}

function reveal() {
    socket.emit('reveal');
}

socket.on('update', (data) => {
    const session = {
        votes: data.votes || [],
        revealed: data.revealed || false
    };
    renderVotes(session);
    if (session.votes.length === 0) {
        hasVoted = false;
        clearSelectedCard();
    }
});

renderDeck();

// Gestion des sessions
const createSessionBtn = document.getElementById("create-session-btn");
const sessionResult = document.getElementById("session-result");

createSessionBtn.addEventListener("click", async () => {
  const name = document.getElementById("developer-name").value;
  if (!name) {
    alert("Please enter your name.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    sessionResult.innerHTML = `
      Session created!<br/>
      Share this ID with your team: <strong>${data.sessionId}</strong><br/>
      <small>They can use this to join the session.</small>
    `;
  } catch (error) {
    console.error("Error creating session:", error);
    sessionResult.textContent = "Failed to create session.";
  }
});

const joinSessionBtn = document.getElementById("join-session-btn");
const joinResult = document.getElementById("join-result");

joinSessionBtn.addEventListener("click", async () => {
  const name = document.getElementById("join-name").value;
  const sessionId = document.getElementById("join-session-id").value;

  if (!name || !sessionId) {
    alert("Please enter your name and the session ID.");
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/session/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      joinResult.textContent = `Error: ${error.message}`;
      return;
    }

    const data = await response.json();
    joinResult.innerHTML = `
      Successfully joined session <strong>${sessionId}</strong><br/>
      Current members: ${data.members.join(", ")}
    `;
  } catch (error) {
    console.error("Error joining session:", error);
    joinResult.textContent = "Failed to join session.";
  }
});

// ------- MVPs (Ancien & Nouveau) ---------

// Liste d'anciens MVPs (exemples statiques)
const oldMvps = [
  "MVP 1: User login system",
  "MVP 2: Task creation",
  "MVP 3: Real-time vote sync"
];

const oldMvpsList = document.getElementById('old-mvps-list');
if (oldMvpsList) {
  oldMvps.forEach(mvp => {
    const li = document.createElement('li');
    li.textContent = mvp;
    oldMvpsList.appendChild(li);
  });
}

// Ajout de nouveaux MVPs dynamiquement
const addMvpBtn = document.getElementById('add-mvp-btn');
const newMvpInput = document.getElementById('new-mvp-input');
const newMvpsList = document.getElementById('new-mvps-list');

addMvpBtn.addEventListener('click', () => {
  const value = newMvpInput.value.trim();
  if (value) {
    const li = document.createElement('li');
    li.textContent = value;
    newMvpsList.appendChild(li);
    newMvpInput.value = '';
  }
});
