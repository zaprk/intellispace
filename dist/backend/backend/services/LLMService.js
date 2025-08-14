"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const openai_1 = require("openai");
const sdk_1 = require("@anthropic-ai/sdk");
const ollama_1 = require("ollama");
class LLMService {
    constructor() {
        Object.defineProperty(this, "openai", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "anthropic", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "ollama", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "providers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.initializeProviders();
    }
    initializeProviders() {
        // Initialize OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.openai = new openai_1.default({
                apiKey: process.env.OPENAI_API_KEY,
            });
            this.providers.set('openai', this.openai);
            console.log('✅ OpenAI provider initialized');
        }
        // Initialize Anthropic
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new sdk_1.default({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            this.providers.set('anthropic', this.anthropic);
            console.log('✅ Anthropic provider initialized');
        }
        // Initialize Ollama (local)
        const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
        this.ollama = new ollama_1.Ollama({ host: ollamaHost });
        this.providers.set('ollama', this.ollama);
        console.log('✅ Ollama provider initialized at', ollamaHost);
    }
    async generateCompletion(prompt, config) {
        const { provider, model, temperature = 0.7, maxTokens = 1000, systemPrompt } = config;
        try {
            switch (provider) {
                case 'openai':
                    return await this.generateOpenAICompletion(prompt, model, temperature, maxTokens, systemPrompt);
                case 'anthropic':
                    return await this.generateAnthropicCompletion(prompt, model, temperature, maxTokens, systemPrompt);
                case 'ollama':
                    return await this.generateOllamaCompletion(prompt, model, temperature, maxTokens, systemPrompt);
                default:
                    throw new Error(`Unsupported LLM provider: ${provider}`);
            }
        }
        catch (error) {
            console.error(`Error generating completion with ${provider}:`, error);
            throw error;
        }
    }
    async generateOpenAICompletion(prompt, model, temperature, maxTokens, systemPrompt) {
        if (!this.openai) {
            throw new Error('OpenAI provider not initialized. Please set OPENAI_API_KEY');
        }
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const completion = await this.openai.chat.completions.create({
            model: model || 'gpt-4-turbo-preview',
            messages,
            temperature,
            max_tokens: maxTokens,
        });
        return {
            content: completion.choices[0]?.message?.content || '',
            usage: completion.usage ? {
                promptTokens: completion.usage.prompt_tokens,
                completionTokens: completion.usage.completion_tokens,
                totalTokens: completion.usage.total_tokens,
            } : undefined,
            model: completion.model,
            provider: 'openai',
        };
    }
    async generateAnthropicCompletion(prompt, model, temperature, maxTokens, systemPrompt) {
        if (!this.anthropic) {
            throw new Error('Anthropic provider not initialized. Please set ANTHROPIC_API_KEY');
        }
        const completion = await this.anthropic.messages.create({
            model: model || 'claude-3-opus-20240229',
            messages: [{ role: 'user', content: prompt }],
            system: systemPrompt,
            temperature,
            max_tokens: maxTokens,
        });
        const content = completion.content[0]?.type === 'text'
            ? completion.content[0].text
            : '';
        return {
            content,
            usage: {
                promptTokens: completion.usage?.input_tokens || 0,
                completionTokens: completion.usage?.output_tokens || 0,
                totalTokens: (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0),
            },
            model: completion.model,
            provider: 'anthropic',
        };
    }
    async generateOllamaCompletion(prompt, model, temperature, maxTokens, systemPrompt) {
        if (!this.ollama) {
            throw new Error('Ollama provider not initialized');
        }
        const response = await this.ollama.chat({
            model: model || 'llama2',
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt }
            ],
            options: {
                temperature,
                num_predict: maxTokens,
            },
        });
        return {
            content: response.message.content,
            model: response.model,
            provider: 'ollama',
        };
    }
    async streamCompletion(prompt, config, onChunk) {
        const { provider, model, temperature = 0.7, maxTokens = 1000, systemPrompt } = config;
        switch (provider) {
            case 'openai':
                await this.streamOpenAICompletion(prompt, model, temperature, maxTokens, systemPrompt, onChunk);
                break;
            case 'anthropic':
                await this.streamAnthropicCompletion(prompt, model, temperature, maxTokens, systemPrompt, onChunk);
                break;
            case 'ollama':
                await this.streamOllamaCompletion(prompt, model, temperature, maxTokens, systemPrompt, onChunk);
                break;
            default:
                throw new Error(`Unsupported LLM provider for streaming: ${provider}`);
        }
    }
    async streamOpenAICompletion(prompt, model, temperature, maxTokens, systemPrompt, onChunk) {
        if (!this.openai) {
            throw new Error('OpenAI provider not initialized');
        }
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const stream = await this.openai.chat.completions.create({
            model: model || 'gpt-4-turbo-preview',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
        });
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                onChunk(content);
            }
        }
    }
    async streamAnthropicCompletion(prompt, model, temperature, maxTokens, systemPrompt, onChunk) {
        if (!this.anthropic) {
            throw new Error('Anthropic provider not initialized');
        }
        const stream = await this.anthropic.messages.create({
            model: model || 'claude-3-opus-20240229',
            messages: [{ role: 'user', content: prompt }],
            system: systemPrompt,
            temperature,
            max_tokens: maxTokens,
            stream: true,
        });
        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                onChunk(chunk.delta.text);
            }
        }
    }
    async streamOllamaCompletion(prompt, model, temperature, maxTokens, systemPrompt, onChunk) {
        if (!this.ollama) {
            throw new Error('Ollama provider not initialized');
        }
        const response = await this.ollama.chat({
            model: model || 'llama2',
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt }
            ],
            options: {
                temperature,
                num_predict: maxTokens,
            },
            stream: true,
        });
        for await (const chunk of response) {
            if (chunk.message?.content) {
                onChunk(chunk.message.content);
            }
        }
    }
    async testConnection(provider) {
        try {
            switch (provider) {
                case 'openai':
                    if (!this.openai)
                        return false;
                    try {
                        await this.openai.models.list();
                        return true;
                    }
                    catch (error) {
                        console.warn(`OpenAI connection failed: ${error.message}`);
                        return false;
                    }
                case 'anthropic':
                    if (!this.anthropic)
                        return false;
                    try {
                        // Anthropic doesn't have a simple health check, try a minimal completion
                        await this.anthropic.messages.create({
                            model: 'claude-3-haiku-20240307',
                            messages: [{ role: 'user', content: 'test' }],
                            max_tokens: 1,
                        });
                        return true;
                    }
                    catch (error) {
                        console.warn(`Anthropic connection failed: ${error.message}`);
                        return false;
                    }
                case 'ollama':
                    if (!this.ollama)
                        return false;
                    try {
                        // Add timeout to prevent hanging
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Connection timeout')), 5000);
                        });
                        const ollamaPromise = this.ollama.list();
                        await Promise.race([ollamaPromise, timeoutPromise]);
                        return true;
                    }
                    catch (error) {
                        console.warn(`Ollama connection failed: ${error.message}`);
                        return false;
                    }
                default:
                    return false;
            }
        }
        catch (error) {
            console.warn(`Failed to test ${provider} connection:`, error.message);
            return false;
        }
    }
    async testConnections() {
        const results = {};
        for (const provider of ['openai', 'anthropic', 'ollama']) {
            try {
                console.log(`🔍 Testing ${provider} connection...`);
                results[provider] = await this.testConnection(provider);
                console.log(`✅ ${provider} test completed: ${results[provider]}`);
            }
            catch (error) {
                console.warn(`⚠️ Error testing ${provider}:`, error.message);
                results[provider] = false;
            }
        }
        return results;
    }
    async listAvailableModels(provider) {
        try {
            switch (provider) {
                case 'openai':
                    if (!this.openai)
                        throw new Error('OpenAI not initialized');
                    const openaiModels = await this.openai.models.list();
                    return openaiModels.data
                        .filter(m => m.id.includes('gpt'))
                        .map(m => m.id);
                case 'anthropic':
                    // Anthropic doesn't provide a models endpoint, return known models
                    return [
                        'claude-3-opus-20240229',
                        'claude-3-sonnet-20240229',
                        'claude-3-haiku-20240307',
                        'claude-2.1',
                        'claude-2.0',
                    ];
                case 'ollama':
                    if (!this.ollama)
                        throw new Error('Ollama not initialized');
                    const ollamaModels = await this.ollama.list();
                    return ollamaModels.models.map(m => m.name);
                default:
                    return [];
            }
        }
        catch (error) {
            console.error(`Failed to list models for ${provider}:`, error);
            return [];
        }
    }
    getStatus() {
        return {
            openai: this.openai ? 'initialized' : 'not configured',
            anthropic: this.anthropic ? 'initialized' : 'not configured',
            ollama: this.ollama ? 'initialized' : 'not configured',
        };
    }
    isProviderAvailable(provider) {
        return this.providers.has(provider);
    }
}
exports.LLMService = LLMService;
