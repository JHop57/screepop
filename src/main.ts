//import { ErrorMapper } from "utils/ErrorMapper"
import * as _ from "lodash";
//import * as roleHarvester from "roleHarvester";
// import * as roleUpgrader from 'roleUpgrader'
// import * as roleBuilder from 'roleBuilder'
import {jms,WorkOrder,Task, Steps } from "./jms/jobManagementSystem";
//import {WorkOrder, Steps, Task, newWorkOrder } from "./jms/workOrder";
//import { Stack } from "./utils/stack";

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
        workOrders: WorkOrder[];
    }

    interface CreepMemory {
        role: string;
        workOrderId?: number;
        workOrderStep?: number;
        //room: string
        // working: boolean
        // upgrading: boolean
        // building: boolean
    }
}
// Syntax for adding properties to `global` (ex "global.log")
declare const global: {
    log: any;
};

let log = Memory.log || [];
jms.workOrders = Memory.workOrders || [];


// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
//export const loop = ErrorMapper.wrapLoop(() => {
export const loop = () => {
    let harvesterCount: number = 0;
    let builderCount: number = 0;
    let upgraderCount: number = 0;

    const ownedRoom = Object.values(Game.rooms)
        .find(room => room.controller?.my);
    if(ownedRoom) {
        jms.initializeWorkorders(ownedRoom);
    }

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];

        if(creep.memory.role === "harvester") {
            harvesterCount++;
        }
        if(creep.memory.role === "builder"){
            builderCount++;
        }
        if(creep.memory.role === "upgrader"){
            upgraderCount++;
        }

        const wo = jms.workOrders.find(WorkOrder => WorkOrder.id === creep.memory.workOrderId);
        if(wo === undefined){
            creep.memory.workOrderId = undefined;
            creep.memory.workOrderStep = 0;
        }
        if (creep.memory.workOrderId === undefined) {
            jms.assignWorkOrder(creep);
        }
        if(creep.memory.workOrderId) {
            jms.executeStep(creep);
        }
    }


    if (harvesterCount < 2) {
        let newName = "Harvester" + Game.time;
        console.log("Spawning new harvester: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "harvester" } });
    }

    if (builderCount < 1) {
        let newName = "Builder" + Game.time;
        console.log("Spawning new builder: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "builder" } });
    }

    // let upgrader = _.filter(Game.creeps, (creep: Creep) => creep.memory.role == "upgrader");
    // console.log("Upgraders: " + upgrader.length);

    if (upgraderCount < 1) {
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




    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
    if (Game.time % 10 == 0) {
        jms.workOrders.forEach(element => {
            if(element.status === "in-progress" && Game.time - element.heartbeatTime > 20) {
                element.status = "completed"
            }
        });

        // Clean up completed or aborted work orders
        jms.workOrders = jms.workOrders.filter(x => x.status != "completed");

        Memory.log = log;
        Memory.workOrders = jms.workOrders;
    }
};

global.log = (...args: any[]) => console.log("LOG:", ...args);


