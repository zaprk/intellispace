"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = projectRoutes;
// src/backend/routes/projects.ts
const express_1 = require("express");
const uuid_1 = require("uuid");
function projectRoutes(prisma) {
    const router = (0, express_1.Router)();
    // Get all projects
    router.get('/', async (req, res) => {
        try {
            const projects = await prisma.project.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { conversations: true },
                    },
                },
            });
            res.json(projects);
        }
        catch (error) {
            console.error('Error fetching projects:', error);
            res.status(500).json({ error: 'Failed to fetch projects' });
        }
    });
    // Get single project
    router.get('/:id', async (req, res) => {
        try {
            const project = await prisma.project.findUnique({
                where: { id: req.params.id },
                include: {
                    conversations: {
                        orderBy: { updatedAt: 'desc' },
                        take: 10,
                    },
                },
            });
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            res.json(project);
        }
        catch (error) {
            console.error('Error fetching project:', error);
            res.status(500).json({ error: 'Failed to fetch project' });
        }
    });
    // Create project
    router.post('/', async (req, res) => {
        try {
            const { name, description } = req.body;
            const project = await prisma.project.create({
                data: {
                    id: (0, uuid_1.v4)(),
                    name,
                    description,
                },
            });
            res.status(201).json(project);
        }
        catch (error) {
            console.error('Error creating project:', error);
            res.status(500).json({ error: 'Failed to create project' });
        }
    });
    // Update project
    router.patch('/:id', async (req, res) => {
        try {
            const { name, description } = req.body;
            const project = await prisma.project.update({
                where: { id: req.params.id },
                data: {
                    ...(name && { name }),
                    ...(description && { description }),
                    updatedAt: new Date(),
                },
            });
            res.json(project);
        }
        catch (error) {
            console.error('Error updating project:', error);
            res.status(500).json({ error: 'Failed to update project' });
        }
    });
    // Delete project
    router.delete('/:id', async (req, res) => {
        try {
            // Delete all related data
            await prisma.message.deleteMany({
                where: {
                    conversation: {
                        projectId: req.params.id,
                    },
                },
            });
            await prisma.memory.deleteMany({
                where: {
                    scopeId: req.params.id,
                    scope: 'project',
                },
            });
            await prisma.conversation.deleteMany({
                where: { projectId: req.params.id },
            });
            await prisma.project.delete({
                where: { id: req.params.id },
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting project:', error);
            res.status(500).json({ error: 'Failed to delete project' });
        }
    });
    return router;
}
