  import OpenAI from 'openai';
  import Anthropic from '@anthropic-ai/sdk';
  import { Ollama } from 'ollama';

  export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'ollama';
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    apiKey?: string;
    baseUrl?: string;
  }

  export interface LLMResponse {
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
    provider: string;
  }

  export class LLMService {
    private openai: OpenAI | null = null;
    private anthropic: Anthropic | null = null;
    private ollama: Ollama | null = null;
    private providers: Map<string, any> = new Map();

    constructor() {
      this.initializeProviders();
    }

    private initializeProviders() {
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.providers.set('openai', this.openai);
        console.log('✅ OpenAI provider initialized');
      }

      // Initialize Anthropic
      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.providers.set('anthropic', this.anthropic);
        console.log('✅ Anthropic provider initialized');
      }

      // Initialize Ollama (local)
      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      this.ollama = new Ollama({ host: ollamaHost });
      this.providers.set('ollama', this.ollama);
      console.log('✅ Ollama provider initialized at', ollamaHost);
    }

    async generateCompletion(
      prompt: string,
      config: LLMConfig
    ): Promise<LLMResponse> {
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
      } catch (error) {
        console.error(`Error generating completion with ${provider}:`, error);
        throw error;
      }
    }

    private async generateOpenAICompletion(
      prompt: string,
      model: string,
      temperature: number,
      maxTokens: number,
      systemPrompt?: string
    ): Promise<LLMResponse> {
      if (!this.openai) {
        throw new Error('OpenAI provider not initialized. Please set OPENAI_API_KEY');
      }

      const messages: any[] = [];
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

    private async generateAnthropicCompletion(
      prompt: string,
      model: string,
      temperature: number,
      maxTokens: number,
      systemPrompt?: string
    ): Promise<LLMResponse> {
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

    private async generateOllamaCompletion(
      prompt: string,
      model: string,
      temperature: number,
      maxTokens: number,
      systemPrompt?: string
    ): Promise<LLMResponse> {
      if (!this.ollama) {
        throw new Error('Ollama provider not initialized');
      }

      const response = await this.ollama.chat({
        model: model || 'llama2',
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
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

    async streamCompletion(
      prompt: string,
      config: LLMConfig,
      onChunk: (chunk: string) => void
    ): Promise<void> {
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

    private async streamOpenAICompletion(
      prompt: string,
      model: string,
      temperature: number,
      maxTokens: number,
      systemPrompt: string | undefined,
      onChunk: (chunk: string) => void
    ): Promise<void> {
      if (!this.openai) {
        throw new Error('OpenAI provider not initialized');
      }

      const messages: any[] = [];
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

    private async streamAnthropicCompletion(
      prompt: string,
      model: string,
      temperature: number,
      maxTokens: number,
      systemPrompt: string | undefined,
      onChunk: (chunk: string) => void
    ): Promise<void> {
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

    private async streamOllamaCompletion(
      prompt: string,
      model: string,
      temperature: number,
      maxTokens: number,
      systemPrompt: string | undefined,
      onChunk: (chunk: string) => void
    ): Promise<void> {
      if (!this.ollama) {
        throw new Error('Ollama provider not initialized');
      }

      const response = await this.ollama.chat({
        model: model || 'llama2',
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
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

    async testConnection(provider: string): Promise<boolean> {
      try {
        switch (provider) {
          case 'openai':
            if (!this.openai) return false;
            try {
              await this.openai.models.list();
              return true;
            } catch (error) {
              console.warn(`OpenAI connection failed: ${error.message}`);
              return false;
            }
          
          case 'anthropic':
            if (!this.anthropic) return false;
            try {
              // Anthropic doesn't have a simple health check, try a minimal completion
              await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1,
              });
              return true;
            } catch (error) {
              console.warn(`Anthropic connection failed: ${error.message}`);
              return false;
            }
          
          case 'ollama':
            if (!this.ollama) return false;
            try {
              // Add timeout to prevent hanging
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
              });
              
              const ollamaPromise = this.ollama.list();
              await Promise.race([ollamaPromise, timeoutPromise]);
              return true;
            } catch (error) {
              console.warn(`Ollama connection failed: ${error.message}`);
              return false;
            }
          
          default:
            return false;
        }
      } catch (error) {
        console.warn(`Failed to test ${provider} connection:`, error.message);
        return false;
      }
    }

    async testConnections(): Promise<Record<string, boolean>> {
      const results: Record<string, boolean> = {};
      
      for (const provider of ['openai', 'anthropic', 'ollama']) {
        try {
          console.log(`🔍 Testing ${provider} connection...`);
          results[provider] = await this.testConnection(provider);
          console.log(`✅ ${provider} test completed: ${results[provider]}`);
        } catch (error) {
          console.warn(`⚠️ Error testing ${provider}:`, error.message);
          results[provider] = false;
        }
      }
      
      return results;
    }

    async listAvailableModels(provider: string): Promise<string[]> {
      try {
        switch (provider) {
          case 'openai':
            if (!this.openai) throw new Error('OpenAI not initialized');
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
            if (!this.ollama) throw new Error('Ollama not initialized');
            const ollamaModels = await this.ollama.list();
            return ollamaModels.models.map(m => m.name);
          
          default:
            return [];
        }
      } catch (error) {
        console.error(`Failed to list models for ${provider}:`, error);
        return [];
      }
    }

    getStatus(): Record<string, string> {
      return {
        openai: this.openai ? 'initialized' : 'not configured',
        anthropic: this.anthropic ? 'initialized' : 'not configured',
        ollama: this.ollama ? 'initialized' : 'not configured',
      };
    }

    isProviderAvailable(provider: string): boolean {
      return this.providers.has(provider);
    }
  }