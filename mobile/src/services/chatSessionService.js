let chatHistory = [];

export const chatSessionService = {
    getHistory: () => [...chatHistory],

    addMessage: (message) => {
        chatHistory.push(message);
    },

    setHistory: (history) => {
        chatHistory = [...history];
    },

    clearHistory: () => {
        chatHistory = [];
    }
};
