export function setupChatUI(onSendMessage) {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const speechBubble = document.getElementById('speech-bubble');
    const bubbleText = document.getElementById('bubble-text');
    const inputArea = document.getElementById('input-area');
    
    let bubbleTimer = null;
    let isInputOpen = false;

    function showBubble(text, duration = 5000) {
        bubbleText.textContent = text;
        speechBubble.classList.remove('hidden');
        if (bubbleTimer) clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => {
            speechBubble.classList.add('hidden');
        }, duration);
    }

    function toggleInput(show) {
        isInputOpen = show;
        if (show) {
            inputArea.classList.remove('hidden');
            chatInput.focus();
        } else {
            inputArea.classList.add('hidden');
        }
    }

    function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        onSendMessage(text);
    }

    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    function getIsInputOpen() {
        return isInputOpen;
    }

    return { showBubble, toggleInput, getIsInputOpen };
}