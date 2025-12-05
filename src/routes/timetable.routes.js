const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const timetableController = require('../controllers/timetable.controller');

/**
 * @route   POST /api/timetables/upload
 * @desc    Upload and process a timetable document
 * @access  Public
 */
router.post('/upload', upload.single('timetable'), timetableController.uploadTimetable);

/**
 * @route   GET /api/timetables
 * @desc    Get all timetables (optionally filter by teacher)
 * @access  Public
 */
router.get('/', timetableController.getAllTimetables);

/**
 * @route   GET /api/timetables/:id
 * @desc    Get a specific timetable with all timeblocks
 * @access  Public
 */
router.get('/:id', timetableController.getTimetable);

/**
 * @route   DELETE /api/timetables/:id
 * @desc    Delete a timetable
 * @access  Public
 */
router.delete('/:id', timetableController.deleteTimetable);

/**
 * @route   GET /api/timetables/:id/logs
 * @desc    Get processing logs for a timetable
 * @access  Public
 */
router.get('/:id/logs', timetableController.getProcessingLogs);

module.exports = router;