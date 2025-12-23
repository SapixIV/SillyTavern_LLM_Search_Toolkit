class SearchToolkit {
    // Configuration - adjust these as needed
    static config = {
        // User search settings
        USER_SEARCH_PREFIX: '/search',

        // AI-initiated search settings
        AI_SEARCH_FLAG: '[SEARCH]',
        CONFIRM_PREFIX: '/confirm_search',
        CONFIRM_TIMEOUT: 60000, // 1 minute

        // Shared settings
        MAX_QUERY_LENGTH: 128,
        MIN_QUERY_LENGTH: 3,
        COOLDOWN_SECONDS: 15,
        MAX_RESULTS: 3
    };

    constructor() {
        this.pendingSearches = new Map();
        this.lastUserSearch = 0;
        this.registerHandlers();
    }

    registerHandlers() {
        // User-initiated searches
        SillyTavernAPI.registerMessageInterceptor(
            msg => this.handleUserSearch(msg)
        );

        // AI-initiated searches
        SillyTavernAPI.registerCharacterMessageHandler(
            msg => this.handleAISearchRequest(msg)
        );
    }

    /* === User Search Handling === */
    handleUserSearch(message) {
        if (!message.content.startsWith(this.config.USER_SEARCH_PREFIX)) return false;

        try {
            const query = this.validateQuery(
                message.content.slice(this.config.USER_SEARCH_PREFIX.length).trim()
            );

            if (this.checkCooldown()) return true;

            this.executeSearch(query, 'user');
            return true;

        } catch (error) {
            this.sendSystemMessage(error.message, 'error');
            return true;
        }
    }

    /* === AI Search Handling === */
    handleAISearchRequest(message) {
        if (!message.content.includes(this.config.AI_SEARCH_FLAG)) return false;

        const match = message.content.match(
            new RegExp(`${this.config.AI_SEARCH_FLAG}\\s*"(.+?)"`)
        );
        if (!match) return false;

        const query = match[1].trim();
        const searchId = `ai-${Date.now()}`;

        this.pendingSearches.set(searchId, {
            query,
            timestamp: Date.now()
        });

        this.sendSearchPrompt(query, searchId);
        return true;
    }

    sendSearchPrompt(query, searchId) {
        SillyTavernAPI.sendMessage({
            author: 'SearchToolkit',
            content: `🔍 <span class="search-prompt">AI wants to search:</span>\n` +
                     `<div class="search-query">"${query}"</div>\n` +
                     `<small>Reply "${this.config.CONFIRM_PREFIX} ${searchId}" to approve</small>`,
            isSystem: true
        });
    }

    /* === Core Search Logic === */
    async executeSearch(query, initiator) {
        try {
            const results = await this.fetchResults(query);

            if (initiator === 'user') {
                this.sendUserResults(results);
            } else {
                SillyTavernAPI.injectContextualMemory(
                    `[Web Search: "${query}"]\n${this.formatForAI(results)}`
                );
                this.sendSystemMessage('✅ Search results added to context', 'success');
            }

        } catch (error) {
            this.sendSystemMessage(`Search failed: ${error.message}`, 'error');
        }
    }

    // ... (include all utility methods from previous versions)
}

new SearchToolkit();
