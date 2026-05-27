import { SourceMap } from "module";

/*
task format for commandList is:
"type":jobType
"target":targetID,
"amount":amount //if applicable, not for build, upgrade, or harvest
"job":job object //if task linked to a job
*/
import jobBoard from "./jobBoard";
import task from "./tasks";
import { stat } from "fs";

//return an array of job-style objects that fully fills a worker
//TODO: evaluate most time-effiecent actions to get energy

function pioneerFilter(job: Job) {
  return job.type == "found" ;
}

function plan(creep: Creep, state: CreepState, jobList: Job[]) {
  if (creep.ticksToLive && creep.ticksToLive < 25) {
    creep.suicide();
    return false;
  }

  let plannedPos = creep.pos;
  let {job:myJob, score:discard} = jobBoard.getJob(jobList, pioneerFilter,{}, 0, 4, plannedPos, plannedPos);
  if (!myJob) {
    return false;
  }
  let eAmount;
  let target = myJob.target
  let newCommand: Command = {
    type: myJob.type,
    target: target as Id<AnyStoreStructure> /*jank todo*/,
    pos: myJob.pos,
    amount: 0,//unneeded
    resourceType: RESOURCE_ENERGY,
    job: myJob.id
  };
  myJob.active++;
  state.commands.push(newCommand);

  return true;
}

const pioneer = {
  run(creepState: CreepState, jobList: Job[]) {
    let creep = Game.getObjectById(creepState.id);
    creepState.info.moving = false;
    creepState.info.working = false;

    if (creep == null || creepState.info.remove) {
      while (creepState.commands.length > 0) {
        let command = creepState.commands[0];
        if (task[command.type]) task[command.type].resolve(creepState, jobList, false);
        else console.log("unknown task type 1");
      }
      return "deadCreep";
    }

    let resolveTask: boolean | undefined = true;
    let resolveMessage = "working";
    let loop = 0;
    while (resolveTask && loop < 4) {
      loop++;
      if (creepState.commands.length == 0) {
        plan(creep, creepState, jobList);
      }
      if (creepState.commands.length == 0) {
        creep.say("❌🛠, 💔. "+loop, true);
        return "noWork";
      }

      resolveTask = undefined;
      let command = creepState.commands[0];
      if (task[command.type]) resolveTask = task[command.type].run(creep, creepState);
      else console.log("unknown task type 2");
      if (resolveTask != undefined) {
        resolveMessage = "testing"; //resolve(creepState, jobList, true);
        global.scheduler.jobUpdate++;
        global.scheduler.mapUpdate++;
        if (task[command.type]) resolveTask = task[command.type].resolve(creepState, jobList, resolveTask);
        else console.log("unknown task type 3");
      }
    }
    return resolveMessage;
  },
  remove(creepState: CreepState, jobs: Job[]) {
    while (creepState.commands.length > 0) {
      let command = creepState.commands[0]
      if (task[command.type]) task[command.type].resolve(creepState, jobs, false);
      else console.log("unknown task type 4")
    }
  }
};

export default pioneer;
