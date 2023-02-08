type RequestTask<T> = {
  id: string;
  action: () => Promise<T>;
  priority: number;
  status: 'idle' | 'running' | 'resolved' | 'rejected' | 'cancelled';
  resolve?: (val: T) => void;
  reject?: (error?: any) => void;
}

class PlotFetcherRegistry {
  tasks: Record<string, RequestTask<any>>;
  queuedTasks: string[];
  runningTasks: number;
  private runningTasksLimit = 4;

  constructor() {
    this.tasks = {};
    this.queuedTasks = [];
    this.runningTasks = 0;
  }

  addTask<T>(taskId: string, action: () => Promise<T>, priority: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.tasks[taskId] = {
        id: taskId,
        action,
        priority,
        status: 'idle',
        resolve,
        reject,
      }

      this.insertTaskInQueue(taskId, priority);

      this.popTask();
    });
  }

  cancelTask(taskId: string) {
    const task = this.tasks[taskId];
    if (task) {
      if (task.status === 'idle') {
        this.removeTaskFromQueue(taskId);
      }

      if (task.reject) {
        task.reject("Task cancelled.");
      }

      task.resolve = undefined;
      task.reject = undefined;
      task.status = 'cancelled';
    }
  }

  updateTaskPriority(taskId: string, priority: number) {
    const task = this.tasks[taskId];
    if (task) {
      if (task.status === 'idle') {
        task.priority = priority;
        this.removeTaskFromQueue(taskId);
        this.insertTaskInQueue(taskId, priority);
      }
    }
  }

  private insertTaskInQueue(taskId: string, priority: number) {
    for (let i = 0; i < this.queuedTasks.length; ++i) {
      const task = this.tasks[this.queuedTasks[i]];
      if (task.priority > priority) {
        this.queuedTasks.splice(i, 0, taskId);
        return;
      }
    }

    this.queuedTasks.push(taskId);
  }

  private removeTaskFromQueue(taskId: string) {
    this.queuedTasks = this.queuedTasks.filter((val) => val !== taskId);
  }

  private popTask() {
    if (this.queuedTasks.length === 0) {
      return;
    }

    if (
      this.runningTasks >= this.runningTasksLimit &&
      this.runningTasksLimit > 0
    ) {
      return;
    }

    const [taskId] = this.queuedTasks.splice(0, 1);
    this.executeTask(taskId);
  }

  private executeTask(taskId: string) {
    const task = this.tasks[taskId];

    if (!task) {
      return;
    }

    this.runningTasks += 1;
    task.status = 'running';

    task.action()
      .then((result) => {
        task.status = 'resolved';

        if (task.resolve) {
          task.resolve(result);
        }

        this.runningTasks -= 1;
        this.popTask();
      })
      .catch((error) => {
        task.status = 'rejected';

        if (task.reject) {
          task.reject(error);
        }

        this.runningTasks -= 1;
        this.popTask();
      });

  }
}

const registry = new PlotFetcherRegistry();

type FetcherTask<T> = {
  id: string;
  status: 'pending' | 'resolved' | 'rejected' | 'cancelled';
  result: Promise<T>;
}

export class PlotFetcher {
  private itemId: string;
  private currentTimestep?: number;
  private tasks: Record<string, FetcherTask<any>>;
  private endpointFn: (itemId: string) => Promise<any>;
  private fastEndpointFn: (itemId: string, timestep: number) => Promise<any>;
  private fetchTimeStepFn: (response: any, timeStep: number) => Promise<any>;
  private metaPromise?: Promise<any>;
  private initialized: boolean;
  private availableTimesteps: number[];
  private lookAhead = 3;
  private seed: number;
  
  constructor(
    itemId: string,
    endpointFn: (itemId: string) => Promise<any>,
    fastEndpointFn: (itemId: string, timestep: number) => Promise<any>,
    fetchTimeStepFn: (response: any, timeStep: number) => Promise<any>,
  ) {
    this.itemId = itemId;
    this.endpointFn = endpointFn;
    this.fastEndpointFn = fastEndpointFn;
    this.fetchTimeStepFn = fetchTimeStepFn;
    this.tasks = {};
    this.metaPromise = undefined;
    this.initialized = false;
    this.availableTimesteps = [];
    this.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  initialize() : Promise<any> {
    if (!this.initialized || !this.metaPromise) {
      this.metaPromise = this.endpointFn(this.itemId);

      this.metaPromise.then(result => {
        this.initialized = true;
        this.availableTimesteps = result.steps.sort();
      });
    }

    return this.metaPromise;
  }

  setCurrentTimestep(timestep: number, preFetch = true) {
    if (!this.initialized) {
      throw new Error(`The PlotFetcher for item ${this.itemId} has not been initialized.`);
    }

    this.currentTimestep = timestep;

    // First update the priority of the current pending tasks
    Object.entries(this.tasks).forEach(([key, task]) => {
      if (task.status === 'pending') {
        const ts = parseInt(key);

        const priority = ts < timestep ? Number.MAX_SAFE_INTEGER : ts - timestep;
        registry.updateTaskPriority(task.id, priority);
      }
    });
    
    if (preFetch) {
      this.preFetchPlots(timestep);
    }
  }

  getTimestepPlot(timestep: number) : Promise<any> | undefined {
    if (!this.initialized) {
      throw new Error(`The PlotFetcher for item ${this.itemId} has not been initialized.`);
    }

    let task = this.tasks[timestep];

    if (!task) {
      const refTimestep = this.currentTimestep || timestep;
      const priority = timestep < refTimestep ? Number.MAX_SAFE_INTEGER : timestep - refTimestep;
      task = this.createFetchTask(timestep, priority);
      this.tasks[timestep] = task;
    }

    return task.result;
  }

  private preFetchPlots(timestep: number) {
    const idx = this.availableTimesteps.indexOf(timestep);

    if (idx === -1) {
      return;
    }

    const maxIdx = Math.min(this.availableTimesteps.length, idx + this.lookAhead + 1);

    for (let i = idx; i < maxIdx; ++i) {
      const ts = this.availableTimesteps[i];
      const priority = ts - timestep;

      let task = this.tasks[ts];

      if (!task || (task.status === 'cancelled' || task.status === 'rejected')) {
        task = this.createFetchTask(ts, priority);
        this.tasks[ts] = task;
      }
    }
  }

  private createFetchTask<T>(timestep: number, priority: number): FetcherTask<T> {
    const id = `${this.seed}_${this.itemId}_${timestep}`;
    const result = registry.addTask(id, () => this.fastEndpointFn(this.itemId, timestep), priority);

    const task: FetcherTask<T> = {
      id,
      result,
      status: 'pending',
    }

    result.then((response) => {
      if (task.status === 'pending') {
        task.status = 'resolved';
        this.fetchTimeStepFn(response, timestep);
      }
    }).catch(() => {
      if (task.status === 'pending') {
        task.status = 'rejected';
      }
    });

    return task;
  }
}
