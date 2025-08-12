/**
 * Progress Tracking Service - AWS Lambda Compatible
 * Uses in-memory storage for job progress tracking
 */
const { logger } = require('../src/utils/logger');

class ProgressTracker {
    constructor() {
        // In-memory job storage (for AWS Lambda, consider DynamoDB for persistence)
        this.jobs = new Map();
        this.jobHistory = new Map(); // Keep completed jobs for a while
        this.maxHistorySize = 100;
        this.jobTimeout = 30 * 60 * 1000; // 30 minutes timeout
    }

    /**
     * Create a new translation job
     * @param {Object} jobData - Job configuration
     * @returns {string} Job ID
     */
    createJob(jobData) {
        const jobId = this.generateJobId();
        const job = {
            id: jobId,
            status: 'pending', // pending, running, completed, failed
            progress: 0,
            message: 'Job created',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...jobData,
            steps: [],
            errors: []
        };

        this.jobs.set(jobId, job);
        
        // Set timeout to auto-cleanup
        setTimeout(() => {
            this.cleanupJob(jobId);
        }, this.jobTimeout);

        logger.info(`Created job ${jobId} for project ${jobData.projectID} → ${jobData.targetLocale}`);

        return jobId;
    }

    /**
     * Update job progress
     * @param {string} jobId - Job ID
     * @param {Object} update - Progress update
     */
    updateProgress(jobId, update) {
        const job = this.jobs.get(jobId);

        if (!job) {
            logger.warn(`Job ${jobId} not found for progress update`);

            return false;
        }

        Object.assign(job, update, {
            updatedAt: new Date()
        });

        // Add step to history
        if (update.step) {
            job.steps.push({
                timestamp: new Date(),
                step: update.step,
                progress: update.progress || job.progress,
                message: update.message || ''
            });
        }

        // Handle completion
        if (update.status === 'completed' || update.status === 'failed') {
            this.moveToHistory(jobId);
        }

        logger.info(`Job ${jobId}: ${job.progress}% - ${update.message || job.message}`);

        return true;
    }

    /**
     * Get job status
     * @param {string} jobId - Job ID
     * @returns {Object|null} Job status or null if not found
     */
    getJobStatus(jobId) {
        // Check active jobs first
        const activeJob = this.jobs.get(jobId);

        if (activeJob) {
            return { ...activeJob };
        }

        // Check history
        const historyJob = this.jobHistory.get(jobId);

        if (historyJob) {
            return { ...historyJob };
        }

        return null;
    }

    /**
     * Move completed job to history
     * @param {string} jobId - Job ID
     */
    moveToHistory(jobId) {
        const job = this.jobs.get(jobId);

        if (job) {
            this.jobs.delete(jobId);
            this.jobHistory.set(jobId, job);

            // Cleanup old history if needed
            if (this.jobHistory.size > this.maxHistorySize) {
                const oldestKey = this.jobHistory.keys().next().value;

                this.jobHistory.delete(oldestKey);
            }
        }
    }

    /**
     * Cleanup job (timeout or manual)
     * @param {string} jobId - Job ID
     */
    cleanupJob(jobId) {
        const job = this.jobs.get(jobId);

        if (job && job.status === 'running') {
            this.updateProgress(jobId, {
                status: 'failed',
                progress: job.progress,
                message: 'Job timed out',
                error: 'Operation exceeded maximum time limit'
            });
        } else if (job) {
            this.moveToHistory(jobId);
        }
    }

    /**
     * Get all active jobs (for monitoring)
     * @returns {Array} Active jobs
     */
    getActiveJobs() {
        return Array.from(this.jobs.values());
    }

    /**
     * Get job statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            activeJobs: this.jobs.size,
            completedJobs: this.jobHistory.size,
            totalJobs: this.jobs.size + this.jobHistory.size
        };
    }

    /**
     * Generate unique job ID (simple implementation without uuid for now)
     * @returns {string} Job ID
     */
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Global instance (singleton for AWS Lambda)
const progressTracker = new ProgressTracker();

module.exports = progressTracker; 