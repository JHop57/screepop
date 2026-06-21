//import { ErrorMapper } from "utils/ErrorMapper"
import * as _ from "lodash";
import * as roleHarvester from "roleHarvester";
// import * as roleUpgrader from 'roleUpgrader'
// import * as roleBuilder from 'roleBuilder'
import { Steps, Task, WorkOrder } from "./workOrder";
import { Stack } from "./utils/stack";

declare global {
    /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definition alone.
          You must also give them an implementation if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
    // Memory extension samples
    interface Memory {
        uuid: number;
        log: any;
        role: string;
    }

    interface CreepMemory {
        role: string;
        workOrder?: WorkOrder;
        //room: string
        // working: boolean
        // upgrading: boolean
        // building: boolean
    }
}
// Syntax for adding properties to `global` (ex "global.log")
declare const global: {
    log: any;
    workOrders: WorkOrder[];
};

let log = Memory.log || [];
if (Game.time % 100 == 0) {
    Memory.log = log;
}

export

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
//export const loop = ErrorMapper.wrapLoop(() => {
export const loop = () => {


    // variable defined as dictionary {[key]:value}
    // Id<Source> is a type that represents the unique identifier of a Source object in Screeps
    //sources: { [key: Id<Source>]: SourceEntry  };

    // const tower = Game.getObjectById('c999f5e34c74695e5ba18c68' as Id<StructureTower>) as StructureTower | null;
    // if(tower) {
    //     const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
    //         filter: (structure) => structure.hits < structure.hitsMax
    //     });
    //     if(closestDamagedStructure) {
    //         tower.repair(closestDamagedStructure);
    //     }

    //     const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    //     if(closestHostile) {
    //         tower.attack(closestHostile);
    //     }
    // }

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if(creep.memory.workOrder.status === "aborted" || creep.memory.workOrder.status === "completed") {
            creep.memory.workOrder = undefined;
        }

        if (!creep.memory.workOrder && global.workOrders.size === 0) {
            var res = creep.room.find(FIND_SOURCES);

            const stack = new Stack<Task>();
            stack.push({ step: Steps.Harvest, targetId: res[0].id, resourceType: RESOURCE_ENERGY, amount: 50 });
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: structure => {
                    return (
                        (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ||
                            structure.structureType == STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    );
                }
            });
            stack.push({ step: Steps.Transfer, targetId: targets[0].id, resourceType: RESOURCE_ENERGY });

            var a = creep.memory.workOrder as WorkOrder;
            global.workOrders.push(a);
            creep.memory.workOrder = a;
        }
        if(creep.memory.workOrder) {
            creep.memory.workOrder.executeStep(creep);
        }
    }

    let harvesters = _.filter(Game.creeps, (creep: Creep) => creep.memory.role == "harvester");
    console.log("Harvesters: " + harvesters.length);

    if (harvesters.length < 2) {
        let newName = "Harvester" + Game.time;
        console.log("Spawning new harvester: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "harvester" } });
    }

    let builder = _.filter(Game.creeps, (creep: Creep) => creep.memory.role == "builder");
    console.log("Builders: " + builder.length);

    if (builder.length < 2) {
        let newName = "Builder" + Game.time;
        console.log("Spawning new builder: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "builder" } });
    }

    let upgrader = _.filter(Game.creeps, (creep: Creep) => creep.memory.role == "upgrader");
    console.log("Upgraders: " + upgrader.length);

    if (upgrader.length < 2) {
        let newName = "Upgrader" + Game.time;
        console.log("Spawning new upgrader: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "upgrader" } });
    }

    if (Game.spawns["Spawn1"].spawning) {
        var spawningCreep = Game.creeps[Game.spawns["Spawn1"].spawning.name];
        Game.spawns["Spawn1"].room.visual.text(
            "🛠️" + spawningCreep.memory.role,
            Game.spawns["Spawn1"].pos.x + 1,
            Game.spawns["Spawn1"].pos.y,
            { align: "left", opacity: 0.8 }
        );
    }



    // Clean up completed or aborted work orders
    for (const wo of global.workOrders) {
        if(wo.status === "aborted" || wo.status === "completed") {
            findIndexAndRemove(wo.id);
        }

    }
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
};

global.log = (...args: any[]) => console.log("LOG:", ...args);
function findIndexAndRemove(id: number) {
    const indexToRemove = global.workOrders.findIndex(item => item.id === id);
    if (indexToRemove !== -1) {
        global.workOrders.splice(indexToRemove, 1); // Removes 1 item at the found index
    }
}

