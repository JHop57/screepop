
export const Steps = {
    Harvest: "🔄",
    Transfer: "📦",
    Upgrade: "⚡",
    Build: "🚧",
    Move: "🚚"
//🚧
} as const;
export type Steps = (typeof Steps)[keyof typeof Steps];

export const WStatus = {
    Pending: "pending",
    InProgress: "in-progress",
    Completed: "completed",
    Aborted: "aborted"
} as const;
export type WStatus = (typeof WStatus)[keyof typeof WStatus];

export const WCategory = {
    Controller: "🎮",
    Construction: "🏗️"
} as const;
export type WCategory = (typeof WCategory)[keyof typeof WCategory];


export type TaskTarget = Id<Source | Structure | ConstructionSite | StructureController>;




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
    status: WStatus;
    tasks: Task[];
}
