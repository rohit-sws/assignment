const db = require('../config/database');
const documentParser = require('./documentParser.service');
const llmService = require('./llm.service');
const path = require('path');

class TimetableService {
    async processTimetable(file, teacherId) {
        let timetableId;

        try {
            // 1. Create timetable record
            timetableId = await this.createTimetableRecord(file, teacherId);

            // 2. Update status to processing
            await this.updateTimetableStatus(timetableId, 'processing');

            // 3. Parse document
            const fileType = this.getFileType(file.mimetype);
            const parsedData = await documentParser.parseDocument(file.path, fileType);

            // 4. Store raw extracted text
            await this.updateRawText(timetableId, parsedData.text);

            // 5. Extract structured data using LLM
            const extractedData = await llmService.extractTimetableData(parsedData.text);

            // 6. Save timeblocks to database
            await this.saveTimeblocks(timetableId, extractedData.timeblocks);

            // 7. Update status to completed
            await this.updateTimetableStatus(timetableId, 'completed');

            // 8. Log success
            await this.log(timetableId, 'info', 'Timetable processed successfully', extractedData.metadata);

            return await this.getTimetableById(timetableId);

        } catch (error) {
            console.error('Timetable processing error:', error);

            if (timetableId) {
                await this.updateTimetableStatus(timetableId, 'failed');
                await this.log(timetableId, 'error', error.message, { stack: error.stack });
            }

            throw error;
        }
    }

    async createTimetableRecord(file, teacherId) {
        const fileType = this.getFileType(file.mimetype);

        const [result] = await db.execute(
            `INSERT INTO timetables (teacher_id, original_filename, file_path, file_type, extraction_method) 
             VALUES (?, ?, ?, ?, ?)`,
            [teacherId, file.originalname, file.path, fileType, 'llm']
        );

        return result.insertId;
    }

    async updateTimetableStatus(timetableId, status) {
        await db.execute(
            'UPDATE timetables SET processing_status = ? WHERE id = ?',
            [status, timetableId]
        );
    }

    async updateRawText(timetableId, text) {
        await db.execute(
            'UPDATE timetables SET raw_extracted_text = ? WHERE id = ?',
            [text, timetableId]
        );
    }

    async saveTimeblocks(timetableId, timeblocks) {
        if (!timeblocks || timeblocks.length === 0) {
            throw new Error('No timeblocks extracted from document');
        }

        const values = timeblocks.map((block, index) => [
            timetableId,
            block.day,
            block.event_name,
            block.start_time,
            block.end_time,
            block.notes,
            null, // color_code (can be enhanced later)
            index
        ]);

        await db.query(
            `INSERT INTO timeblocks 
             (timetable_id, day_of_week, event_name, start_time, end_time, notes, color_code, order_index) 
             VALUES ?`,
            [values]
        );
    }

    async getTimetableById(timetableId) {
        const [timetables] = await db.execute(
            `SELECT t.*, teacher.name as teacher_name, teacher.email as teacher_email
             FROM timetables t
             JOIN teachers teacher ON t.teacher_id = teacher.id
             WHERE t.id = ?`,
            [timetableId]
        );

        if (timetables.length === 0) {
            throw new Error('Timetable not found');
        }

        const [timeblocks] = await db.execute(
            `SELECT * FROM timeblocks 
             WHERE timetable_id = ? 
             ORDER BY 
                FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
                start_time`,
            [timetableId]
        );

        return {
            ...timetables[0],
            timeblocks: timeblocks
        };
    }

    async getAllTimetables(teacherId = null) {
        let query = `
            SELECT t.*, teacher.name as teacher_name 
            FROM timetables t
            JOIN teachers teacher ON t.teacher_id = teacher.id
        `;
        const params = [];

        if (teacherId) {
            query += ' WHERE t.teacher_id = ?';
            params.push(teacherId);
        }

        query += ' ORDER BY t.upload_date DESC';

        const [timetables] = await db.execute(query, params);
        return timetables;
    }

    async log(timetableId, level, message, details = null) {
        await db.execute(
            'INSERT INTO processing_logs (timetable_id, log_level, message, details) VALUES (?, ?, ?, ?)',
            [timetableId, level, message, JSON.stringify(details)]
        );
    }

    getFileType(mimetype) {
        const typeMap = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'image/png': 'image',
            'image/jpeg': 'image',
            'image/jpg': 'image'
        };
        return typeMap[mimetype] || 'unknown';
    }

    // Cleanup method to delete old files
    async deleteTimetable(timetableId) {
        const [timetables] = await db.execute(
            'SELECT file_path FROM timetables WHERE id = ?',
            [timetableId]
        );

        if (timetables.length > 0 && timetables[0].file_path) {
            const fs = require('fs').promises;
            try {
                await fs.unlink(timetables[0].file_path);
            } catch (error) {
                console.error('Failed to delete file:', error);
            }
        }

        await db.execute('DELETE FROM timetables WHERE id = ?', [timetableId]);
    }
}

module.exports = new TimetableService();