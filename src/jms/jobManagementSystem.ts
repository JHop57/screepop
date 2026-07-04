import {WorkOrder, Task, Steps, OrderStatus, OrderClass} from './types'
import * as WO from "./workOrder";

const Plan = {
    SPAWN: 1,
    CONTROLLER: 4,
    STRUCTURE_EXTENSION:2,
    CONSTRUCTION: 1
};

class Jms {
    /*scribbles: Critical,high,medium,low*/

    public workOrders: WorkOrder[] = [];

    constructor(){}

    public addWorkOrder(wo:WorkOrder):void {
        this.workOrders.push(wo);
    }
    public initializeWorkorders(room: Room):void {
        let controllerCount = this.workOrders.filter(wo => wo.class === OrderClass.STRUCTURE_CONTROLLER).length;
        let constructionCount = this.workOrders.filter(wo => wo.class === OrderClass.MAX_CONSTRUCTION_SITES).length;
        let spawnCount = this.workOrders.filter(wo => wo.class === OrderClass.STRUCTURE_SPAWN).length;
        if(controllerCount < Plan.CONTROLLER){
            var job = this.AddUpgradeControllerJob(room);
            this.addWorkOrder(job);
        }
        if(constructionCount < Plan.CONSTRUCTION){
            // eventually replace with something to create a wo when a site is created
            var sites: ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES);
            if (sites.length > 0) {
                var job = this.AddBuildConstructionJob(room, sites);
                this.addWorkOrder(job);
            }
        }
    }

    public assignWorkOrder(creep: Creep):void{
        var job = this.workOrders.find(WorkOrder => WorkOrder.status === OrderStatus.Pending);
        if(job === undefined){
            console.log(`${creep.name}:assignWorkOrder:no workOrder`);
            return;
        }
        creep.memory.workOrderId = job.id;
        creep.memory.workOrderStep = 0;
        job.status = OrderStatus.InProgress;
    }

    private AddUpgradeControllerJob(room: Room):WorkOrder {
        var controllerId = room.controller?.id;
        if (!controllerId) {
            throw new Error(`Controller not found in the room ${room.name}.`);
        }
        var src = room.find(FIND_SOURCES);
        var srcId: Id<Source> = src[0].id;
        var job = WO.upgradeController(controllerId, srcId, CARRY_CAPACITY);
        return job;
    }

    private AddBuildConstructionJob(room: Room, sites: ConstructionSite[]):WorkOrder {
        if (sites.length === 0) {
            throw new Error(`No construction sites found.`);
        }
        var src = room.find(FIND_SOURCES);
        var srcId: Id<Source> = src[0].id;
        var siteId: Id<ConstructionSite> = sites[0].id;
        var job = WO.buildSite(siteId, srcId, CARRY_CAPACITY);
        return job;
    }


// // Example: Find all extensions in a specific room that have free energy capacity
// const extensions = Game.rooms['W1S1'].find(FIND_MY_STRUCTURES, {
//   filter: (structure) => {
//     return structure.structureType === STRUCTURE_EXTENSION &&
//            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
//   }
// });


    private executeHarvest(creep: Creep, task: Task): boolean {
        const source = Game.getObjectById(task.targetId) as Source | null;
        if (!source) {
            console.log(`${creep.name}:executeHarvest:Source with ID ${task.targetId} not found.`);
            return true;// return success so step is not repeated
        }

        const result = creep.harvest(source);

        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
            return false; // not there yet
        }

        if(result === OK && creep.store.getFreeCapacity() > 0)
            return false;  // keep loading

        console.log(`${creep.name}:executeHarvest:Target=${task.targetId}:Error=${result}.`);
        return true;  // some other error: quit here
    }

    private executeTransfer(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as Structure | null;
        if (!target) {
            console.log(`${creep.name}:executeTransfer:Target with ID ${task.targetId} not found.`);
            return true;// return success so step is not repeated
        }
        if (!task.resourceType || !task.amount) {
            console.log(`${creep.name}:executeTransfer:Invalid transfer task: missing resourceType or amount.`);
            return true;// return success so step is not repeated
        }

        const result = creep.transfer(target, task.resourceType, task.amount);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false; // not there yet
        }
        if(result === OK && creep.store.getUsedCapacity() > 0)
            return false;  // task incomplete

        console.log(`${creep.name}:executeTransfer:Target=${task.targetId}:Error=${result}`);
        return true; // return success so that work order is completed.
    }

    private executeBuild(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as ConstructionSite | null;
        if (!target) {
            console.log(`${creep.name}:executeBuild:Target with ID ${task.targetId} not found for creep ${creep.name}`);
            return true;// return success so step is not repeated
        }

        const result = creep.build(target);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false; // not there yet
        }
        if(result === OK && creep.store.getUsedCapacity() > 0)
            return false;  // task incomplete

        console.log(`${creep.name}:executeBuild:Target=${task.targetId}:Error=${result}`);
        return true; // task error so toss the task
    }

    private executeUpgrade(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as StructureController | null;
        if (!target) {
            console.log(`${creep.name}:executeUpgrade:Target with ID ${task.targetId} not found for creep ${creep.name}`);
            return true;// return success so step is not repeated
        }

        const result = creep.upgradeController(target);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false; // not there yet
        }
        if(result === OK && creep.store.getUsedCapacity() > 0)
            return false;  // task incomplete

        console.log(`${creep.name}:executeUpgrade:Target=${task.targetId}:Error=${result}`);
        return true; // task error so toss the task
    }

    public executeStep(creep: Creep): void {
        const workOrderId = creep.memory.workOrderId;
        const wo = this.workOrders.find(WorkOrder => WorkOrder.id === workOrderId);
        if(wo === undefined){
            console.log(`${creep.name}:executeStep:no workOrder`);
            return;
        }
console.log(`${creep.name}:executeStep: workOrder ${wo.id} - ${wo.status}`);

        if(wo.status === OrderStatus.Pending)
            wo.status = OrderStatus.InProgress;

        let StepId =  creep.memory.workOrderStep;
        if(StepId === undefined)
            StepId = 0;
        const currentTask = wo.tasks[StepId];

        let done: boolean = false;
        switch (currentTask.step) {
            case Steps.Harvest:
                if(this.executeHarvest(creep, currentTask) === true) {
                    done = true;
                }
                break;
            case Steps.Transfer:
                if(this.executeTransfer(creep, currentTask) === true) {
                    done = true;
                }
                break;
            case Steps.Build:
                if(this.executeBuild(creep, currentTask) === true) {
                    done = true;
                }
                break;
            case Steps.Upgrade:
                if(this.executeUpgrade(creep, currentTask) === true) {
                    done = true;
                }
                break;
        }

        if (done) {
            StepId = StepId + 1;

            if(wo.tasks.length <= StepId){
                wo.status = "completed";
                creep.memory.workOrderId = undefined;
                creep.memory.workOrderStep = undefined;
                console.log(`${creep.name}:executeStep: WorkOrder ${workOrderId} completed.`);
                return;
            }

            creep.memory.workOrderStep = StepId;
        }

        wo.heartbeatTime = Game.time;
    }
}

const jms = new Jms();
export {jms, WO, WorkOrder, Steps, Task, OrderStatus};
