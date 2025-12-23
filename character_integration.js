class ConfirmedAISearch {
    static SEARCH_FLAG = "[SEARCH_REQUEST]";
    static PENDING_SEARCHES = new Map();

    constructor() {
        this.CONFIRM_TIMEOUT = 60000; // 1 minute expiration
        this.registerHandlers();
    }

    registerHandlers() {
        SillyTavernAPI.registerCharacterMessageHandler(
            this.handleCharacterRequest.bind(this)
        );

        SillyTavernAPI.registerMessageInterceptor(
            this.handleUserResponse.bind(this)
        );
    }

    // Character requests search
    async handleCharacterRequest(message) {
        if (!message.content.includes(ConfirmedAISearch.SEARCH_FLAG)) return false;

        const match = message.content.match(
            new RegExp(`${ConfirmedAISearch.SEARCH_FLAG}\\s*"(.+?)"`)
        );

        if (!match) return false;

        const query = match[1].trim();
        const searchId = `search-${Date.now()}`;

        this.PENDING_SEARCHES.set(searchId, {
            query,
            timestamp: Date.now()
        });

        SillyTavernAPI.sendMessage({
            author: 'System',
            content: `🔍 Character wants to search: "${query}"\n` +
                    `Reply with "/confirm ${searchId}" to approve`,
            isSystem: true
        });

        return true; // Mark as handled
    }

    // User confirms/denies
    handleUserResponse(message) {
        if (!message.content.startsWith('/confirm')) return false;

        const searchId = message.content.split(' ')[1];
        if (!this.PENDING_SEARCHES.has(searchId)) {
            SillyTavernAPI.sendMessage({
                author: 'System',
                content: '❌ Invalid search request ID',
                isSystem: true
            });
            return true;
        }

        const { query, timestamp } = this.PENDING_SEARCHES.get(searchId);

        // Check if expired
        if (Date.now() - timestamp > this.CONFIRM_TIMEOUT) {
            this.PENDING_SEARCHES.delete(searchId);
            SillyTavernAPI.sendMessage({
                author: 'System',
                content: '⌛ Search request expired',
                isSystem: true
            });
            return true;
        }

        this.executeApprovedSearch(searchId, query);
        return true;
    }

    async executeApprovedSearch(searchId, query) {
        try {
            const results = await this.fetchSearchResults(query);
            const context = this.formatForAI(results);

            SillyTavernAPI.injectContextualMemory(
                `[Approved search for "${query}"]\n${context}`
            );

            SillyTavernAPI.sendMessage({
                author: 'System',
                content: '✅ Search results injected into conversation',
                isSystem: true
            });

        } catch (error) {
            SillyTavernAPI.sendMessage({
                author: 'System',
                content: '🔴 Search failed - ' + error.message,
                isSystem: true
            });
        } finally {
            this.PENDING_SEARCHES.delete(searchId);
        }
    }

    // ... (keep existing fetchSearchResults and formatForAI methods)
}

new ConfirmedAISearch();
