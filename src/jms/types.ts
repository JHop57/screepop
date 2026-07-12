
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

export const OrderType = {
    FILL_SPAWN: "fill-spawn",
    FILL_EXTENSION: "fill-extension",
    FILL_CONTAINER: "fill-container",
    UPGRADE_CONTROLLER: "upgrade-controller",
    BUILD_SITE: "build-site",
    CREATE_CREEP: "create-creep"
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export type TaskTarget = Id<Source | Structure | ConstructionSite | StructureController>;

export interface Task {
    readonly step: Steps;
    readonly targetId: TaskTarget;
    readonly resourceType?: ResourceConstant;
    readonly amount?: number;
}

export interface WorkOrder {
    readonly id: number;
    type: OrderType;
    targetId: TaskTarget;
    tasks: Task[];
    status: OrderStatus;
    repeat: number;
    readonly birthTime: number;
    heartbeatTime: number;
    payload?: any;
}
