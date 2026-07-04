
export const Steps = {
    Harvest: "🔄",
    Transfer: "📦",
    Upgrade: "⚡",
    Build: "🚧",
    Move: "🚚"
//🚧
} as const;
export type Steps = (typeof Steps)[keyof typeof Steps];

export const OrderStatus = {
    Pending: "pending",
    InProgress: "in-progress",
    Completed: "completed",
    Aborted: "aborted"
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderClass = {
    STRUCTURE_SPAWN: 1,
    STRUCTURE_CONTROLLER: 4,
    STRUCTURE_EXTENSION: 1,
    MAX_CONSTRUCTION_SITES: 1
} as const;
export type OrderClass = (typeof OrderClass)[keyof typeof OrderClass];

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
    class: OrderClass;
    status: OrderStatus;
    tasks: Task[];
}
