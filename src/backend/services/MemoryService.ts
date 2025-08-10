import { PrismaClient } from '@prisma/client';

export interface MemoryData {
  [key: string]: any;
}

export interface MemoryUpdate {
  path: string;
  value: any;
  operation: 'set' | 'delete' | 'append' | 'merge';
}

export class MemoryService {
  constructor(private prisma: PrismaClient) {}

  // Project Memory Operations
  async getProjectMemory(projectId: string): Promise<MemoryData> {
    try {
      const memory = await this.prisma.memory.findFirst({
        where: {
          scope: 'project',
          scopeId: projectId,
        },
      });

      if (!memory) {
        // Initialize empty memory if doesn't exist
        return await this.initializeProjectMemory(projectId);
      }

      return JSON.parse(memory.data);
    } catch (error) {
      console.error('Error getting project memory:', error);
      throw error;
    }
  }

  async updateProjectMemory(projectId: string, data: MemoryData): Promise<MemoryData> {
    try {
      const existing = await this.prisma.memory.findFirst({
        where: {
          scope: 'project',
          scopeId: projectId,
        },
      });

      if (existing) {
        const updated = await this.prisma.memory.update({
          where: { id: existing.id },
          data: {
            data: JSON.stringify(data),
            lastModified: new Date(),
          },
        });
        return JSON.parse(updated.data);
      } else {
        const created = await this.prisma.memory.create({
          data: {
            scope: 'project',
            scopeId: projectId,
            data: JSON.stringify(data),
          },
        });
        return JSON.parse(created.data);
      }
    } catch (error) {
      console.error('Error updating project memory:', error);
      throw error;
    }
  }

  async mergeProjectMemory(projectId: string, updates: MemoryData): Promise<MemoryData> {
    try {
      const current = await this.getProjectMemory(projectId);
      const merged = this.deepMerge(current, updates);
      return await this.updateProjectMemory(projectId, merged);
    } catch (error) {
      console.error('Error merging project memory:', error);
      throw error;
    }
  }

  private async initializeProjectMemory(projectId: string): Promise<MemoryData> {
    const initialData = {
      project: {
        id: projectId,
        createdAt: new Date().toISOString(),
        metadata: {},
        context: {},
        goals: [],
        constraints: [],
      },
      agents: {},
      tools: {},
      history: [],
    };

    await this.prisma.memory.create({
      data: {
        scope: 'project',
        scopeId: projectId,
        data: JSON.stringify(initialData),
      },
    });

    return initialData;
  }

  // Conversation Memory Operations
  async getConversationMemory(conversationId: string): Promise<MemoryData> {
    try {
      const memory = await this.prisma.memory.findFirst({
        where: {
          scope: 'conversation',
          scopeId: conversationId,
        },
      });

      if (!memory) {
        return await this.initializeConversationMemory(conversationId);
      }

      return JSON.parse(memory.data);
    } catch (error) {
      console.error('Error getting conversation memory:', error);
      throw error;
    }
  }

  async updateConversationMemory(conversationId: string, data: MemoryData): Promise<MemoryData> {
    try {
      const existing = await this.prisma.memory.findFirst({
        where: {
          scope: 'conversation',
          scopeId: conversationId,
        },
      });

      if (existing) {
        const updated = await this.prisma.memory.update({
          where: { id: existing.id },
          data: {
            data: JSON.stringify(data),
            lastModified: new Date(),
          },
        });
        return JSON.parse(updated.data);
      } else {
        const created = await this.prisma.memory.create({
          data: {
            scope: 'conversation',
            scopeId: conversationId,
            data: JSON.stringify(data),
          },
        });
        return JSON.parse(created.data);
      }
    } catch (error) {
      console.error('Error updating conversation memory:', error);
      throw error;
    }
  }

  async mergeConversationMemory(conversationId: string, updates: MemoryData): Promise<MemoryData> {
    try {
      const current = await this.getConversationMemory(conversationId);
      const merged = this.deepMerge(current, updates);
      return await this.updateConversationMemory(conversationId, merged);
    } catch (error) {
      console.error('Error merging conversation memory:', error);
      throw error;
    }
  }

  private async initializeConversationMemory(conversationId: string): Promise<MemoryData> {
    const initialData = {
      conversation: {
        id: conversationId,
        startedAt: new Date().toISOString(),
        context: {},
        summary: '',
        keyPoints: [],
        decisions: [],
        actionItems: [],
      },
      participants: {},
      topics: [],
      entities: {},
      references: [],
    };

    await this.prisma.memory.create({
      data: {
        scope: 'conversation',
        scopeId: conversationId,
        data: JSON.stringify(initialData),
      },
    });

    return initialData;
  }

  // Advanced Memory Operations
  async applyMemoryUpdate(
    scope: 'project' | 'conversation',
    scopeId: string,
    update: MemoryUpdate
  ): Promise<MemoryData> {
    try {
      const current = scope === 'project' 
        ? await this.getProjectMemory(scopeId)
        : await this.getConversationMemory(scopeId);

      const updated = this.applyUpdate(current, update);

      return scope === 'project'
        ? await this.updateProjectMemory(scopeId, updated)
        : await this.updateConversationMemory(scopeId, updated);
    } catch (error) {
      console.error('Error applying memory update:', error);
      throw error;
    }
  }

  private applyUpdate(data: MemoryData, update: MemoryUpdate): MemoryData {
    const path = update.path.split('.');
    const result = { ...data };
    let current: any = result;

    // Navigate to the parent of the target
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }

    const lastKey = path[path.length - 1];

    switch (update.operation) {
      case 'set':
        current[lastKey] = update.value;
        break;
      
      case 'delete':
        delete current[lastKey];
        break;
      
      case 'append':
        if (!Array.isArray(current[lastKey])) {
          current[lastKey] = [];
        }
        current[lastKey].push(update.value);
        break;
      
      case 'merge':
        if (typeof current[lastKey] === 'object' && !Array.isArray(current[lastKey])) {
          current[lastKey] = { ...current[lastKey], ...update.value };
        } else {
          current[lastKey] = update.value;
        }
        break;
    }

    return result;
  }

  // Memory Search and Query
  async searchMemory(
    scope: 'project' | 'conversation',
    scopeId: string,
    query: string
  ): Promise<any[]> {
    try {
      const memory = scope === 'project'
        ? await this.getProjectMemory(scopeId)
        : await this.getConversationMemory(scopeId);

      return this.searchInObject(memory, query.toLowerCase());
    } catch (error) {
      console.error('Error searching memory:', error);
      return [];
    }
  }

  private searchInObject(obj: any, query: string, path: string = ''): any[] {
    const results: any[] = [];

    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      if (typeof value === 'string' && value.toLowerCase().includes(query)) {
        results.push({
          path: currentPath,
          key,
          value,
          type: 'string',
        });
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'string' && item.toLowerCase().includes(query)) {
              results.push({
                path: `${currentPath}[${index}]`,
                key: `${key}[${index}]`,
                value: item,
                type: 'array-item',
              });
            } else if (typeof item === 'object') {
              results.push(...this.searchInObject(item, query, `${currentPath}[${index}]`));
            }
          });
        } else {
          results.push(...this.searchInObject(value, query, currentPath));
        }
      }
    }

    return results;
  }

  // Memory Statistics
  async getMemoryStats(scope: 'project' | 'conversation', scopeId: string): Promise<any> {
    try {
      const memory = scope === 'project'
        ? await this.getProjectMemory(scopeId)
        : await this.getConversationMemory(scopeId);

      const jsonString = JSON.stringify(memory);
      
      return {
        sizeBytes: Buffer.byteLength(jsonString, 'utf8'),
        sizeKB: (Buffer.byteLength(jsonString, 'utf8') / 1024).toFixed(2),
        keys: Object.keys(memory).length,
        depth: this.getObjectDepth(memory),
        totalValues: this.countValues(memory),
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return null;
    }
  }

  private getObjectDepth(obj: any, currentDepth: number = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const key in obj) {
      const depth = this.getObjectDepth(obj[key], currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private countValues(obj: any): number {
    let count = 0;

    for (const key in obj) {
      count++;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += this.countValues(obj[key]);
      }
    }

    return count;
  }

  // Utility Functions
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  // Memory Cleanup
  async clearMemory(scope: 'project' | 'conversation', scopeId: string): Promise<void> {
    try {
      await this.prisma.memory.deleteMany({
        where: {
          scope,
          scopeId,
        },
      });

      // Re-initialize with empty memory
      if (scope === 'project') {
        await this.initializeProjectMemory(scopeId);
      } else {
        await this.initializeConversationMemory(scopeId);
      }
    } catch (error) {
      console.error('Error clearing memory:', error);
      throw error;
    }
  }

  // Memory Export/Import
  async exportMemory(scope: 'project' | 'conversation', scopeId: string): Promise<string> {
    try {
      const memory = scope === 'project'
        ? await this.getProjectMemory(scopeId)
        : await this.getConversationMemory(scopeId);

      return JSON.stringify(memory, null, 2);
    } catch (error) {
      console.error('Error exporting memory:', error);
      throw error;
    }
  }

  async importMemory(
    scope: 'project' | 'conversation',
    scopeId: string,
    jsonData: string
  ): Promise<MemoryData> {
    try {
      const data = JSON.parse(jsonData);
      
      return scope === 'project'
        ? await this.updateProjectMemory(scopeId, data)
        : await this.updateConversationMemory(scopeId, data);
    } catch (error) {
      console.error('Error importing memory:', error);
      throw error;
    }
  }
}