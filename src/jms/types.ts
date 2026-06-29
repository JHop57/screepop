
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
export type TaskTarget = Id<Source | Structure | ConstructionSite | StructureController>;
export type WoStatus =  "pending" | "in-progress" | "completed" | "aborted";

export interface Task {
    readonly step: Steps;
    readonly targetId: TaskTarget;
    readonly resourceType?: ResourceConstant;
    readonly amount?: number;
}

export interface WorkOrder {
    readonly id: number;
    readonly birthTime: number;
    heartbeatTime: number;
    status: WoStatus;
    tasks: Task[];
}
