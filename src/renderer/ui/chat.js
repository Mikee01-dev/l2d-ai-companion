export function setupChatUI(onSendMessage) {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const speechBubble = document.getElementById('speech-bubble');
    const bubbleText = document.getElementById('bubble-text');
    const inputArea = document.getElementById('input-area');
    
    let bubbleTimer = null;
    let typingTimer = null;
    let isInputOpen = false;

    function showBubble(text, duration = 5000) {
        if (typingTimer) clearInterval(typingTimer);
        
        bubbleText.textContent = text;
        speechBubble.classList.remove('hidden');
        
        if (bubbleTimer) clearTimeout(bubbleTimer);
        if (duration > 0) {
            bubbleTimer = setTimeout(() => {
                speechBubble.classList.add('hidden');
            }, duration);
        }
    }

    function showTyping() {
        speechBubble.classList.remove('hidden');
        let dots = 0;
        if (typingTimer) clearInterval(typingTimer);
        
        if (bubbleTimer) clearTimeout(bubbleTimer);
        
        typingTimer = setInterval(() => {
            dots = (dots + 1) % 4;
            bubbleText.textContent = ".".repeat(dots) || " "; 
        }, 400);
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

    return { showBubble, showTyping, toggleInput, getIsInputOpen };
}