import { Job, JobBoard, MY_NUMS } from "JobBoard";
import { econTasks, Evaluation, Task } from "econTasks";

type Dwarf = {
  readonly id: Id<Creep>;
  readonly role: string;
  commands: Command[];
  info: {
    remove: boolean;
    workParts: number;
    carryParts: number;
    spawnCost: number;
    cargo: SimpleStore;
    working: boolean;
  };
};
type Command = {
  readonly type: string;
  target: Id<AnyStructure | ConstructionSite | Creep | Source | Mineral | Resource | Tombstone | Ruin>;
  pos: Pos;
  amount: number;
  readonly jobId?: number;
  readonly resourceType?: ResourceConstant;
};
type resourcePlan = {
    visits: {roomName: string, id: Id<AnyStoreStructure>}[];
    available: number;
    planUse: number;
    resourceType: ResourceConstant;
}

class CreepHandler {
    private foremen: Foreman[] = [];

    public registerForeman(newguy: Foreman) {
        this.foremen.push(newguy);
    }
    public run() {
        for (let foreman of this.foremen) {
            foreman.run();
        }
    }
    public assignCreep(creep: Creep): boolean {
        let nameparts = creep.name.split("-");
        let role = nameparts[nameparts.length - 1];
        for (let foreman of this.foremen) {
            if (foreman.memberTypes.includes(role)) {
                if(foreman.memberIDs.includes(creep.id)) return true;
                if (foreman.assignCreep(creep, role)) return true;
            }
        }
        return false;
    }
    public getUpdateFunctions(): {func:() => number, name: string}[] {
        return this.foremen.map(foreman => ({func: () => foreman.updateJobs(), name: foreman.name}));
    }
}

abstract class Foreman {
    protected dwarves: Dwarf[] = [];
    protected _memberTypes: { [key: string]: string } = {};
    protected abstract jobs: Job[];
    //protects name during rollup, for Prioritizer purposes.
    protected abstract foremanName: string;

    public get memberTypes(): string[] {
        return Object.keys(this._memberTypes);
    }
    public get memberIDs(): Id<Creep>[] {
        return this.dwarves.map(dwarf => dwarf.id);
    }
    public get name(): string {
        return this.foremanName;
    }
    public abstract run(): void;
    public abstract assignCreep(creep: Creep, role: string): boolean;
    public abstract updateJobs():number;
}


class EconWorkForeman extends Foreman {
    protected jobs: Job[];
    protected foremanName = "econWorkForeman";
    constructor() {
        super();
        this._memberTypes = {
            "w": "worker",
            "md": "mobileDelver",
        };
        this.jobs = [];
    }
    //must be of shape [dwarfs][jobs], order matters!!
    //only semi-normalizes, mostly made to account for other dwarfs' priorities when deciding on job allocation.
    private normalizeTaskMatrix(taskMatrix: Evaluation[][]) {
        //normalize, order matters!
        let skipNormalization = taskMatrix.length == 1;
        if(skipNormalization){
            for(let i = 0; i < taskMatrix[0].length; i++){
                taskMatrix[0][i].normalized = taskMatrix[0][i].score;
            }
            return;
        }


        for(let j = 0; j < taskMatrix[0].length; j++) {
            let sum = _.sum(taskMatrix.map(row => row[j].score));
            if(sum == 0) {
                for(let i = 0; i < taskMatrix.length; i++){
                    taskMatrix[i][j].normalized = 0;
                }
                continue;
            }
            for(let i = 0; i < taskMatrix.length; i++){
                taskMatrix[i][j].normalized = taskMatrix[i][j].score / sum;
            }
        }
        for(let i = 0; i < taskMatrix.length; i++){
            let sum = _.sum(taskMatrix[i].map(cell => cell.normalized));
            if(sum == 0) {
                for(let j = 0; j < taskMatrix[0].length; j++){
                    taskMatrix[i][j].normalized = 0;
                }
                continue;
            }
            for(let j = 0; j < taskMatrix[0].length; j++){
                taskMatrix[i][j].normalized = taskMatrix[i][j].normalized / sum;
            }
        }
    }
    private findBestTaskCoords(taskMatrix: Evaluation[][]): {i: number, j: number} {
        let dwarfLength = taskMatrix.length;
        let jobLength = taskMatrix[0].length;
        if(dwarfLength == 0 || jobLength == 0) return {i: -1, j: -1};
        let best = {i: -1, j: -1, score: 0};
        for(let i = 0; i < dwarfLength; i++){
            for(let j = 0; j < jobLength; j++){
                if(taskMatrix[i][j].normalized > best.score){
                    best = {i, j, score: taskMatrix[i][j].normalized};
                }
            }
        }
        return {i: best.i, j: best.j};
    }
    private findBestTaskForJob(job: Job, simDwarf: Dwarf, simStore: {store:SimpleStore, used: number}, simPos:Pos, resourcePlanMatrix: resourcePlan[][], matrixCoords: {i: number, j: number}): Evaluation {
        let best = econTasks[job.type].efficiency(simDwarf, simStore.store, simPos, job);
        let rank = MY_NUMS.END_USER_RANK
        if(job.type == "deliver") rank = job.rank
        let resourceType = job.resourceType as ResourceConstant;

        let resourcePlan = resourcePlanMatrix[matrixCoords.i][matrixCoords.j];
        let availableCarry = simDwarf.info.carryParts*50 - simStore.used - _.sum(simStore.store);
        //if already planned, or planned wrong resource, or plan fully used, or creep full; return original evaluation, don't mess with it.
        if(availableCarry <= 0) return best;
        if(resourcePlan && (resourcePlan.resourceType != resourceType || resourcePlan.planUse == resourcePlan.available) ) return best;
        //TODO check job logic to see about a way to 'request' a resource amount, reading amount directly cannot work.
        //make new 'requestResource' function that asks for maximum amount of resource?
        let amount = Math.min(availableCarry, resourcePlan.available - resourcePlan.planUse, econTasks[job.type].maxResource(job));
        if (amount <= 0) return best;
        if(resourcePlan){
            simStore.store[resourceType] = (simStore.store[resourceType] || 0) + amount;
            resourcePlan.planUse += amount;
        }

        let newEval = econTasks[job.type].efficiency(simDwarf, simStore.store, simPos, job);
        if(newEval.score > best.score) return newEval;

        //undo plan if it didn't improve the score.
        //(shouldn't happen when taking into account maxResource() and amount<=0 check, but in case?)
        resourcePlan.planUse -= amount;
        //assert resourcetype, it's confirmed earlier.
        simStore.store[resourceType]! -= amount;
        return best;
    }
    private assignDelveTasks() {
        //delve tasks, no worry about picking up resources.
        let taskMatrix: Evaluation[][] = [];
        let jobOptions = this.jobs.filter(job => job.type == "delve" && job.active < job.amount);
        //only assign new delvers, don't bother old ones.
        //delver jobs should be considered permanent.
        let dwarfOptions = this.dwarves.filter(dwarf => dwarf.role == "mobileDelver" && !dwarf.info.remove && !dwarf.commands[0]);
        for (let i = 0; i < dwarfOptions.length; i++) {
            let dwarf = dwarfOptions[i];
            let creep = Game.getObjectById(dwarf.id);
            if (!creep) {
                dwarf.info.remove = true;
                console.log("creep not found for econ foreman delve task update, removing dwarf");
                return;
            }
            taskMatrix[i] = taskMatrix[i] || [];
            for (let j = 0; j < jobOptions.length; j++) {
                let simDwarf = dwarfOptions[i];
                let simPos = creep.pos;
                taskMatrix[i][j] = econTasks[jobOptions[j].type].efficiency(simDwarf, {}, simPos, jobOptions[j]);
            }
        }
        //condition is just a check before starting the loop
        while((dwarfOptions.length != 0 && jobOptions.length != 0)){
            this.normalizeTaskMatrix(taskMatrix);

            //pick best task.
            let best = this.findBestTaskCoords(taskMatrix);
            if(best.i == -1 || best.j == -1) break;

            let chosenDwarf = dwarfOptions[best.i];
            let chosenJob = jobOptions[best.j];
            econTasks[chosenJob.type].claim(chosenDwarf, Game.getObjectById(chosenDwarf.id) as Creep, chosenJob, taskMatrix[best.i][best.j].amount);
            //remove select dwarf so they don't get picked again.
            taskMatrix.splice(best.i, 1);
            dwarfOptions.splice(best.i, 1);
            //recalculate that job
            for(let i = 0; i < dwarfOptions.length; i++){
                let simDwarf = dwarfOptions[i];
                let simStore = simDwarf.info.cargo;
                let simPos = Game.getObjectById(simDwarf.id)!.pos
                taskMatrix[i][best.j] = econTasks[chosenJob.type].efficiency(simDwarf, simStore, simPos, chosenJob);
            }
        }
    }
    private assignWorkerTasks() {
        let taskMatrix: Evaluation[][] = [];
        let jobOptions = this.jobs.filter(job => job.amount > 0);
        let dwarfOptions = this.dwarves.filter(dwarf => !dwarf.info.remove && !dwarf.commands[0]);
        let simStores: {store:SimpleStore, used: number}[] = [];
        //list per cell in taskMatrix
        let plannedSources: resourcePlan[][] = [];
        for (let i = 0; i < dwarfOptions.length; i++) {
            let dwarf = dwarfOptions[i];
            let creep = Game.getObjectById(dwarf.id);
            if (!creep) {
                dwarf.info.remove = true;
                console.log("creep not found for econ foreman task update (non-delve), removing dwarf");
                return;
            }
            taskMatrix[i] = taskMatrix[i] || [];
            plannedSources[i] = plannedSources[i] || [];
            for (let j = 0; j < jobOptions.length; j++) {
                let simDwarf = dwarfOptions[i];
                simStores[i] = {store: simDwarf.info.cargo, used: 0};
                let simPos = creep.pos;
                //TODO WORK SITE TELOS
                //make an intermediate func that simulates getting resources for the job, and returns the highest scoring option.
                //save plan for later claiming in the next while loop.
                //update the simstorage after claiming for further task evaluations!
                taskMatrix[i][j] = econTasks[jobOptions[j].type].efficiency(simDwarf, simStores[i].store, simPos, jobOptions[j]);
                taskMatrix[i][j] = this.findBestTaskForJob(jobOptions[j], simDwarf, simStores[i], simPos, plannedSources, {i, j});
            }
        }
        let dwarfTimes = dwarfOptions.map(dwarf => 0);
        let timeFactor = 1000;
        //condition is just a check before starting the loop
        while((dwarfOptions.length != 0 && jobOptions.length != 0)){
            this.normalizeTaskMatrix(taskMatrix);
            for(let i = 0; i < taskMatrix.length; i++){
                let adjustment = ((timeFactor-dwarfTimes[i])/timeFactor)
                for(let j = 0; j < taskMatrix[0].length; j++){
                    //apply time factor penalty to all tasks, so we pick the best one considering time.
                    taskMatrix[i][j].normalized = taskMatrix[i][j].normalized * adjustment;
                }
            }

            //pick best task.
            let best = this.findBestTaskCoords(taskMatrix);
            if(best.i == -1 || best.j == -1) break;

            let chosenDwarf = dwarfOptions[best.i];
            let chosenJob = jobOptions[best.j];
            econTasks[chosenJob.type].claim(chosenDwarf, Game.getObjectById(chosenDwarf.id) as Creep, chosenJob, taskMatrix[best.i][best.j].amount);
            dwarfTimes[best.i] += taskMatrix[best.i][best.j].time;
            //updated simstore AND simpos goes here!
            //recalculate that job and that dwarf.
            for(let j = 0; j < jobOptions.length; j++){
                let simDwarf = chosenDwarf;
                let simStore = simStores[best.i];
                let simPos = Game.getObjectById(simDwarf.id)!.pos;
                taskMatrix[best.i][j] = econTasks[jobOptions[j].type].efficiency(simDwarf, simStore.store, simPos, jobOptions[j]);
            }
            for(let i = 0; i < dwarfOptions.length; i++){
                let simDwarf = dwarfOptions[i];
                let simStore = simStores[i];
                let simPos = Game.getObjectById(simDwarf.id)!.pos;
                taskMatrix[i][best.j] = econTasks[jobOptions[best.j].type].efficiency(simDwarf, simStore.store, simPos, jobOptions[best.j]);
            }

            if(dwarfTimes.some(time => time < 100)) continue;
            break;
        }
    }
    private updateTasks() {
        for (let dwarf of this.dwarves.filter(dwarf => dwarf.role != "mobileDelver")) {
            this.removeDwarfTasks(dwarf);
        }
        for (let dwarf of this.dwarves.filter(dwarf => dwarf.role == "mobileDelver")) {
            let job = this.jobs.find(job => job.id == dwarf.commands[0]?.jobId);
            if (!job || job.type != "delve" || job.active < job.amount) {
                this.removeDwarfTasks(dwarf);
            }
        }

        this.assignDelveTasks();
        this.assignWorkerTasks();

    }
    private removeDwarfTasks(dwarf: Dwarf) {
        while (dwarf.commands.length > 0) {
            econTasks[dwarf.commands[0].type].complete(dwarf, this.jobs, false);
        }
    }
    public run() {
        let tasksUpdated = false;

        for (let dwarf of this.dwarves) {
            let creep = Game.getObjectById(dwarf.id);
            if (!creep) {
                dwarf.info.remove = true;
                continue;
            }
            dwarf.info.working = false;
            //can work on 2 tasks per tick, ie work on one, move towards the next.
            for(let i = 0; i < 2; i++){
                if(dwarf.commands.length == 0 && !tasksUpdated){
                    this.updateTasks();
                    tasksUpdated = true;
                }
                if (dwarf.commands.length == 0) {
                    creep.say("❌🛠", true)
                    continue;
                }
                let resolveTask = undefined;
                let command = dwarf.commands[0];
                if (econTasks[command.type]) resolveTask = econTasks[command.type].do(dwarf, creep);
                else console.log("unknown econ work task type");
                if(resolveTask == undefined) break;
                econTasks[command.type].complete(dwarf, this.jobs, true);
            }
        }
    }
    public assignCreep(creep: Creep, role: string): boolean {
        role = this._memberTypes[role];
        if (!role) return false;

        let newDwarf: Dwarf = {
            role,
            id: creep.id,
            commands: [],
            info: {
                remove: false,
                workParts: creep.getActiveBodyparts(WORK),
                carryParts: creep.getActiveBodyparts(CARRY),
                spawnCost: creep.body.reduce((cost, part) => cost + BODYPART_COST[part.type], 0),
                cargo: {},
                working: false
            }
        }
        if(newDwarf.info.carryParts > 0){
            for(let resourceType in creep.store){
                newDwarf.info.cargo[resourceType as ResourceConstant] = creep.store[resourceType as ResourceConstant];
            }
        }
        this.dwarves.push(newDwarf);
        return true;
    }
    public updateJobs(): number {
        let score = 0.1;
        let currentJobs = new Set(this.jobs.map(job => job.id));
        this.jobs = g.jobBoard.UpdateEconWorkPartJobs(this.jobs);
        let newJobs = this.jobs.filter(job => !currentJobs.has(job.id));
        score += newJobs.length;
        return score;
    }
}

let creepHandler = new CreepHandler();
creepHandler.registerForeman(new EconWorkForeman());

export { creepHandler };
export type { Dwarf, Command };
