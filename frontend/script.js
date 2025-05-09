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

socket.on('update', session => {
    renderVotes(session);
    // to reset hasVoted if there are no votes (which happens after reset)
    if (session.votes.length === 0) {
        hasVoted = false;
        clearSelectedCard();
    }
});

renderDeck();