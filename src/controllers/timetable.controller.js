const timetableService = require('../services/timetable.service');
const llmService = require('../services/llm.service');
const db = require('../config/database');

class TimetableController {
    async uploadTimetable(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded'
                });
            }

            // Get LLM provider from request body
            const llmProvider = req.body.llm_provider || process.env.DEFAULT_LLM_PROVIDER || 'openai';
            const apiKey = req.body.api_key || null;

            // Validate provider
            const validProviders = ['openai', 'gemini', 'anthropic'];
            if (!validProviders.includes(llmProvider.toLowerCase())) {
                return res.status(400).json({
                    error: `Invalid LLM provider. Must be one of: ${validProviders.join(', ')}`
                });
            }

            // For demo purposes, use default teacher or create one
            let teacherId = req.body.teacher_id;

            if (!teacherId) {
                // Create or get default teacher
                const [teachers] = await db.execute(
                    'SELECT id FROM teachers WHERE email = ?',
                    ['demo@example.com']
                );

                if (teachers.length > 0) {
                    teacherId = teachers[0].id;
                } else {
                    const [result] = await db.execute(
                        'INSERT INTO teachers (name, email) VALUES (?, ?)',
                        ['Demo Teacher', 'demo@example.com']
                    );
                    teacherId = result.insertId;
                }
            }

            // Process timetable with selected provider
            const result = await timetableService.processTimetable(
                req.file,
                teacherId,
                { llmProvider, apiKey }
            );

            res.status(201).json({
                success: true,
                message: 'Timetable uploaded and processed successfully',
                data: result,
                llm_provider_used: llmProvider
            });

        } catch (error) {
            next(error);
        }
    }

    async getTimetable(req, res, next) {
        try {
            const { id } = req.params;
            const timetable = await timetableService.getTimetableById(id);

            res.json({
                success: true,
                data: timetable
            });

        } catch (error) {
            if (error.message === 'Timetable not found') {
                return res.status(404).json({
                    error: 'Timetable not found'
                });
            }
            next(error);
        }
    }

    async getAllTimetables(req, res, next) {
        try {
            const teacherId = req.query.teacher_id;
            const timetables = await timetableService.getAllTimetables(teacherId);

            res.json({
                success: true,
                count: timetables.length,
                data: timetables
            });

        } catch (error) {
            next(error);
        }
    }

    async deleteTimetable(req, res, next) {
        try {
            const { id } = req.params;
            await timetableService.deleteTimetable(id);

            res.json({
                success: true,
                message: 'Timetable deleted successfully'
            });

        } catch (error) {
            next(error);
        }
    }

    async getProcessingLogs(req, res, next) {
        try {
            const { id } = req.params;

            const [logs] = await db.execute(
                'SELECT * FROM processing_logs WHERE timetable_id = ? ORDER BY created_at DESC',
                [id]
            );

            res.json({
                success: true,
                data: logs
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * Get available LLM providers
     */
    async getAvailableProviders(req, res, next) {
        try {
            const providers = llmService.getAvailableProviders();

            res.json({
                success: true,
                default_provider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
                providers: providers
            });

        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TimetableController();