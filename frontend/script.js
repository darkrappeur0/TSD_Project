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
            }
        };
        deckContainer.appendChild(card);
    });
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

function reset() {
    hasVoted = false;
    socket.emit('reset');
}

function reveal() {
    socket.emit('reveal');
}

socket.on('update', session => {
    renderVotes(session);
});

renderDeck();