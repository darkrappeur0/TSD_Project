const deck = [1, 2, 3, 5, 8, 13, 21];
const deckContainer = document.getElementById('deck')!;

deck.forEach(card => {
    const btn = document.createElement('button');
    btn.textContent = card.toString();
    btn.onclick = () => selectCard(card);
    deckContainer.appendChild(btn);
});

let selectedCard: number | null = null;

function selectCard(card: number) {
    selectedCard = card;
    alert(`Selected card: ${card}`);
    sendEstimation(card);
}

export function resetSelection() {
    selectedCard = null;
    alert('Selection reset');
}

const ws = new WebSocket('ws://localhost:4000');

function sendEstimation(card: number) {
    ws.send(JSON.stringify({ type: 'estimation', value: card }));
}

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Estimation received:', message);
};
