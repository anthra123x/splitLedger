import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

export interface QueueJob {
  id: string;
  data: any;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stage: string;
  progress: number;
  stageDetail: string;
  result: any;
  error: string | null;
  submittedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  stages: any[];
}

export class ProcessingQueue extends EventEmitter {
  concurrency: number;
  jobs: Map<string, QueueJob>;
  queue: QueueJob[];
  activeWorkers: number;
  handler: ((job: QueueJob, updateStage: (stage: any) => void) => Promise<any>) | null = null;
  stats: {
    totalSubmitted: number;
    totalCompleted: number;
    totalFailed: number;
    avgProcessingTimeMs: number;
  };

  constructor(concurrency = 4) {
    super();
    this.concurrency = concurrency;
    this.jobs = new Map();
    this.queue = [];
    this.activeWorkers = 0;
    this.stats = {
      totalSubmitted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      avgProcessingTimeMs: 0
    };
  }

  addJob(jobData: any, priority = 0): QueueJob {
    const jobId = crypto.randomUUID();
    const job: QueueJob = {
      id: jobId,
      data: jobData,
      priority,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      stageDetail: 'En cola de procesamiento',
      result: null,
      error: null,
      submittedAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      stages: []
    };

    this.jobs.set(jobId, job);
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.stats.totalSubmitted++;

    this.emit('job:added', job);
    this.processNext();
    return job;
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  async processNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;
    job.status = 'processing';
    job.startedAt = Date.now();
    job.progress = 10;
    this.emit('job:started', job);

    try {
      this.emit('job:progress', {
        jobId: job.id,
        stage: 'starting',
        detail: 'Iniciando unidad de procesamiento SplitLLM...',
        progress: 15
      });

      if (this.handler) {
        const result = await this.handler(job, (stageUpdate: any) => {
          job.stage = stageUpdate.stage;
          job.stageDetail = stageUpdate.detail;
          job.stages.push(stageUpdate);

          const progressMap: Record<string, number> = {
            ocr: 25,
            spatial_tokenization: 40,
            spatial_attention_graph: 60,
            cognitive_reasoning: 80,
            accounting_classification: 90,
            double_entry_solver: 95,
            completed: 100
          };
          job.progress = progressMap[stageUpdate.stage] || job.progress;

          this.emit('job:progress', {
            jobId: job.id,
            stage: job.stage,
            detail: job.stageDetail,
            progress: job.progress
          });
        });

        job.status = 'completed';
        job.progress = 100;
        job.result = result;
        job.finishedAt = Date.now();
        this.stats.totalCompleted++;

        const elapsed = job.finishedAt - job.startedAt;
        this.stats.avgProcessingTimeMs = Math.round(
          (this.stats.avgProcessingTimeMs * (this.stats.totalCompleted - 1) + elapsed) / this.stats.totalCompleted
        );

        this.emit('job:completed', job);
      }
    } catch (err: any) {
      console.error(`[Queue Error] Job ${job.id} falló:`, err.message);
      job.status = 'failed';
      job.error = err.message;
      job.finishedAt = Date.now();
      this.stats.totalFailed++;
      this.emit('job:failed', job);
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  registerHandler(fn: (job: QueueJob, updateStage: (stage: any) => void) => Promise<any>) {
    this.handler = fn;
  }

  getStats() {
    return {
      ...this.stats,
      queuedJobs: this.queue.length,
      activeWorkers: this.activeWorkers,
      concurrency: this.concurrency
    };
  }
}

export const processingQueue = new ProcessingQueue(4);
