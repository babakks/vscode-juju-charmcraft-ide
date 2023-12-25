import { randomUUID } from "crypto";
import { OutputChannel, StatusBarItem } from "vscode";

export type BackgroundWorkerFunction<T> = () => Promise<T>;

interface BackgroundJob {
    id: string;
    name: string;
}

/**
 * Run jobs in background, while reporting to the user in the status bar area.
 */
export class BackgroundWorkerManager {
    private _jobs = new Map<string, BackgroundJob>();

    constructor(readonly statusBarItem: StatusBarItem, readonly output: OutputChannel) {
    }

    /**
     * Runs given function in background (as a promise) and resolves with the
     * returned value.
     */
    async execute<T>(name: string, f: BackgroundWorkerFunction<T>): Promise<T> {
        const job = { id: randomUUID(), name };
        this._jobs.set(job.id, job);
        this.output.appendLine(`worker executing: '${name}'`);
        this.updateStatusBarItem();
        const t0 = Date.now();
        const result = await f();
        const dt = Date.now() - t0;
        this._jobs.delete(job.id);
        this.output.appendLine(`worker execution done (${dt} ms): '${name}'`);
        this.updateStatusBarItem();
        return result;
    }

    private updateStatusBarItem() {
        const n = this._jobs.size;
        if (n === 0) {
            this.statusBarItem.text = '';
            this.statusBarItem.tooltip = '';
            this.statusBarItem.hide();
        } else if (n === 1) {
            const job = Array.from(this._jobs.values())[0];
            this.statusBarItem.text = `$(loading~spin) Charmcraft-IDE: Running ${job.name}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.text = `$(loading~spin) Charmcraft-IDE: Running (${n})`;
            this.statusBarItem.show();
        }
    }
}
