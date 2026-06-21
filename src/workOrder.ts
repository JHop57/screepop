import {Stack} from "./utils/stack";


export const Steps = {
    Harvest: "🔄",
    Transfer: "📦",
    Upgrade: "⚡",
    Build: "🏗️",
    Move: "🚚"
} as const;
//🚧

// 2. Extract the type from the object values
export type Steps = (typeof Steps)[keyof typeof Steps];

export interface Task {
    readonly step: Steps;
    readonly targetId: Id<Source> | Id<Structure> | Id<ConstructionSite> | Id<StructureController>;
    readonly resourceType?: ResourceConstant;
    readonly amount?: number;
}

export class WorkOrder {
    readonly #birthTime: number = Game.time;
    #lastExecutedTime: number = Game.time;
    #status: "pending" | "in-progress" | "completed" | "aborted" = "pending";
    readonly #id: number = Math.floor(Math.random() * 65534);

    constructor(
        public task: Stack<Task>
    ) {

    }

    get id() {
        return this.#id;
    }

    get status() {
        if (Game.time - this.#lastExecutedTime > 50) {
            this.#status = "aborted";
        }
        return this.#status;
    }

    executeStep(creep: Creep): void {
        const currentTask = this.task.peek();
        if (!currentTask) {
            creep.memory.workOrder = undefined;
            console.log(`WorkOrder completed for creep ${creep.name}`);
            return;
        }

        switch (currentTask.step) {
            case Steps.Harvest:
                if(this.executeHarvest(creep, currentTask) === true) {
                    this.task.pop(); // Remove the completed task from the stack
                }
                break;
            case Steps.Transfer:
                if(this.executeTransfer(creep, currentTask) === true) {
                    this.task.pop(); // Remove the completed task from the stack
                }
                break;
        }

        if (this.task.isEmpty()) {
            this.#status = "completed";
            console.log(`WorkOrder ${this.id} completed for creep ${creep.name}`);
        }

        this.#lastExecutedTime = Game.time;
    }

    private executeHarvest(creep: Creep, task: Task): boolean {
        const source = Game.getObjectById(task.targetId) as Source | null;
        if (!source) {
            console.log(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
            return false;
        }
        if(creep.store.getFreeCapacity() === 0) {
            console.log(`Creep ${creep.name} has no capacity to harvest resources.`);
            return true; // Consider the task completed since the creep cannot carry resources
        }
        if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
            return false;
        }
        return true;
    }

    private executeTransfer(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as Structure | null;
        if (!target) {
            console.log(`Target with ID ${task.targetId} not found for creep ${creep.name}`);
            return false;
        }
        if (!task.resourceType || !task.amount) {
            console.log(`Invalid transfer task for creep ${creep.name}: missing resourceType or amount`);
            return false;
        }
        if (creep.transfer(target, task.resourceType, task.amount) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false;
        }
        return true;
    }
}
